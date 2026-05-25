const Service = require('../models/Service');
const UnderRepair = require('../models/UnderRepair');
const EstimationPending = require('../models/EstimationPending');
const CompletedFRN = require('../models/CompletedFRN');
const SCCompletedFRN = require('../models/SCCompletedFRN');
const Scrap = require('../models/Scrap');
const Employee = require('../models/Employee');
const Division = require('../models/Division');

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const geminiBackoffByScope = new Map();
const GEMINI_BACKOFF_MS = 5 * 60 * 1000;

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeUpper(value) {
  return normalizeText(value).toUpperCase();
}

function safeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseAnyDate(value, fallback = null) {
  if (!value && fallback) return parseAnyDate(fallback, null);
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

  const text = String(value).trim();
  if (!text) return fallback ? parseAnyDate(fallback, null) : null;

  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    const date = new Date(text);
    if (!Number.isNaN(date.getTime())) return date;
  }

  const dmy = text.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dmy) {
    const date = new Date(`${dmy[3]}-${dmy[2]}-${dmy[1]}T00:00:00`);
    if (!Number.isNaN(date.getTime())) return date;
  }

  const general = new Date(text);
  if (!Number.isNaN(general.getTime())) return general;

  return fallback ? parseAnyDate(fallback, null) : null;
}

function monthParts(month) {
  const match = String(month || '').match(/^(\d{4})-(\d{2})$/);
  if (!match) throw new Error('Month must be in YYYY-MM format.');
  const year = Number(match[1]);
  const monthIndex = Number(match[2]);
  const start = new Date(Date.UTC(year, monthIndex - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
  const shortMonth = start.toLocaleString('en-IN', { month: 'short', timeZone: 'UTC' });
  const longMonth = start.toLocaleString('en-IN', { month: 'long', timeZone: 'UTC' });
  return {
    year,
    month: monthIndex,
    start,
    end,
    monthKey: `${year}-${String(monthIndex).padStart(2, '0')}`,
    shortMonth,
    longMonth,
    label: `${shortMonth} ${year}`,
  };
}

function isDateInRange(date, start, end) {
  if (!date) return false;
  return date >= start && date < end;
}

function diffDays(startValue, endValue) {
  const start = parseAnyDate(startValue);
  const end = parseAnyDate(endValue);
  if (!start || !end) return null;
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000));
}

function rate(withinTarget, total) {
  return total > 0 ? withinTarget / total : null;
}

function percent(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function completionPercent(withinTarget, total) {
  return percent(total > 0 ? (withinTarget / total) * 100 : 0);
}

function normalizeDivisionName(record, divisionLookup = null) {
  const division = record?.division;
  if (division && typeof division === 'object') {
    if (division.name) return normalizeUpper(division.name);
    if (division._id && record.divisionName) return normalizeUpper(record.divisionName);
    if (division._id && divisionLookup) {
      const mapped = divisionLookup.get(String(division._id));
      if (mapped) return normalizeUpper(mapped);
    }
  }
  if (division && typeof division !== 'object' && divisionLookup) {
    const mapped = divisionLookup.get(String(division));
    if (mapped) return normalizeUpper(mapped);
  }
  return normalizeUpper(record?.divisionName || division || '');
}

function matchesEmployee(record, employeeName) {
  const wanted = normalizeUpper(employeeName);
  if (!wanted) return true;
  const fields = [
    record?.submittedBy,
    record?.scEng,
    record?.eng,
    record?.engineer,
    record?.raEng,
    record?.updatedBy,
    record?.closedBy,
  ].map(normalizeUpper);
  return fields.includes(wanted);
}

function isConsumable(record) {
  const haystack = [
    record?.typeAcc,
    record?.defType,
    record?.partNo,
    record?.defMod,
    record?.commWarrDetails,
  ].join(' ').toLowerCase();
  return haystack.includes('consum');
}

function terminalDateForService(service, related) {
  const serviceId = String(service?._id || '');
  const dates = [
    parseAnyDate(service?.completedAt),
    parseAnyDate(service?.updatedAt),
    parseAnyDate(related.completedByServiceId.get(serviceId)?.closedAt),
    parseAnyDate(related.completedByServiceId.get(serviceId)?.createdAt),
    parseAnyDate(related.scCompletedByServiceId.get(serviceId)?.createdAt),
    parseAnyDate(related.scrapByServiceId.get(serviceId)?.createdAt),
  ].filter(Boolean);
  if (!dates.length) return null;
  dates.sort((a, b) => a - b);
  return dates[0];
}

function terminalDateForUnderRepair(doc, related) {
  const serviceId = String(doc?.serviceId || '');
  const dates = [
    parseAnyDate(doc?.repBrd),
    parseAnyDate(doc?.updatedAt),
    parseAnyDate(related.completedByServiceId.get(serviceId)?.closedAt),
    parseAnyDate(related.completedByServiceId.get(serviceId)?.createdAt),
    parseAnyDate(related.scCompletedByServiceId.get(serviceId)?.createdAt),
    parseAnyDate(related.scrapByServiceId.get(serviceId)?.createdAt),
  ].filter(Boolean);
  if (!dates.length) return null;
  dates.sort((a, b) => a - b);
  return dates[0];
}

function targetNext(prevRate) {
  if (prevRate === null || prevRate === undefined) return 0.9;
  return Math.max(0.85, Math.min(1, Number(prevRate) + 0.05));
}

function makeActivityRow(label, total, withinTarget, prevRateValue = null) {
  return {
    label,
    total,
    withinTarget,
    currentRate: rate(withinTarget, total),
    prevRate: prevRateValue,
    nextRate: targetNext(prevRateValue),
  };
}

function percentFromRate(rateValue) {
  return percent((Number(rateValue) || 0) * 100);
}

function makeAuxiliaryMetrics(base, activityRows = []) {
  const criticalCount = Number(base.criticalPendingCount || 0);
  const supplierPending = Number(base.supplierPendingCount || 0);
  const scrapDelayed = Number(base.scrapDelayedCount || 0);
  const rowsWithData = activityRows.filter((row) => Number(row?.total || 0) > 0);
  const averageRate = rowsWithData.length
    ? rowsWithData.reduce((sum, row) => sum + Number(row.currentRate || 0), 0) / rowsWithData.length
    : Number(base.completionRate || 0) / 100;
  const rowRate = (label) => {
    const match = activityRows.find((row) => row.label === label);
    return match ? percentFromRate(match.currentRate) : percentFromRate(averageRate);
  };
  const completionRateValue = percent(base.completionRate || 0);
  const criticalPendingRate = base.totalTracked > 0
    ? percent(((base.totalTracked - criticalCount) / base.totalTracked) * 100)
    : completionRateValue;

  return {
    weeklyCrm: completionRateValue,
    pendingActivity: percentFromRate(averageRate),
    nonSaleable: rowRate('Non-Saleable'),
    supplierWarranty: rowRate('No. of Warranty Board received & given for re-export'),
    supplierPendingReview: supplierPending > 0
      ? Math.max(0, rowRate('No. of Warranty Board received & given for re-export') - supplierPending * 5)
      : rowRate('No. of Warranty Board received & given for re-export'),
    criticalPending: criticalPendingRate,
    purchaseIndent: rowRate('No of Estimation given for out of warranty.'),
    quarterlyBuyback: Math.max(0, percentFromRate(averageRate) - scrapDelayed * 5),
    callReportToHod: completionRateValue,
    fiveSRate: percentFromRate(averageRate),
    repairReport: rowRate('Under Repair except warrenty spares'),
  };
}

function fallbackNarratives(scopeLabel, base) {
  const pendingText = base.pendingCount
    ? `${base.pendingCount} records are still pending with ${base.criticalPendingCount} critical items needing closer follow-up.`
    : 'No open backlog is pending right now.';
  const justification = `${scopeLabel} closed ${base.completedCount} out of ${base.totalTracked} tracked cases this month, while ${pendingText}`;
  const corrective = base.criticalPendingCount > 0
    ? 'Prioritize critical open items first, tighten daily follow-up on delayed repairs and estimations, and review execution aging every morning with the team.'
    : 'Keep the current closure discipline, continue same-day updates, and maintain weekly review of estimation, under-repair, and external repair queues.';
  const hod = base.completionRate >= 85
    ? `${scopeLabel} shows strong performance this month with stable execution and a controlled pending queue.`
    : `${scopeLabel} needs focused action on delayed executions and follow-up closure discipline in the coming month.`;
  return { justification, corrective, hod };
}

function extractJson(text) {
  if (!text) return null;
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function buildAiNarratives(scopeLabel, base, activityRows) {
  const fallback = fallbackNarratives(scopeLabel, base);
  const apiKey = normalizeText(process.env.GEMINI_API_KEY);
  if (!apiKey) return { ...fallback, source: 'fallback' };

  const cooldownUntil = geminiBackoffByScope.get(scopeLabel);
  if (cooldownUntil && cooldownUntil > Date.now()) {
    return { ...fallback, source: 'fallback' };
  }

  const prompt = [
    'You are preparing a monthly service performance review summary.',
    'Return JSON only with keys: justification, corrective, hod.',
    'Each value must be a concise professional sentence.',
    `Scope: ${scopeLabel}`,
    `Metrics: ${JSON.stringify(base)}`,
    `Activities: ${JSON.stringify(activityRows.map((row) => ({ label: row.label, total: row.total, withinTarget: row.withinTarget, currentRate: row.currentRate })))}`,
  ].join('\n');

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        geminiBackoffByScope.set(scopeLabel, Date.now() + GEMINI_BACKOFF_MS);
      }
      throw new Error(`Gemini HTTP ${response.status}`);
    }
    const payload = await response.json();
    const text = payload?.candidates?.[0]?.content?.parts?.map((part) => part?.text || '').join('') || '';
    const parsed = extractJson(text);
    if (!parsed) return { ...fallback, source: 'fallback' };

    geminiBackoffByScope.delete(scopeLabel);

    return {
      justification: normalizeText(parsed.justification) || fallback.justification,
      corrective: normalizeText(parsed.corrective) || fallback.corrective,
      hod: normalizeText(parsed.hod) || fallback.hod,
      source: 'gemini',
    };
  } catch (error) {
    if (error.message !== 'Gemini HTTP 429') {
      console.warn(`Gemini monthly summary failed for ${scopeLabel}:`, error.message);
    }
    return { ...fallback, source: 'fallback' };
  }
}

async function getPerformanceReviewOptions() {
  const [divisions, employees] = await Promise.all([
    Division.find().sort({ name: 1 }).lean(),
    Employee.find({ isActive: { $ne: false } }).sort({ name: 1 }).lean(),
  ]);

  return {
    divisions: divisions.map((division) => ({
      id: String(division._id),
      name: division.name,
    })),
    employees: employees.map((employee) => ({
      id: String(employee._id),
      name: employee.name,
      employeeId: employee.employeeId || '',
      division: employee.division || '',
    })),
  };
}

async function getPerformanceReviewData({ scope, month, division, employee }) {
  if (!['division', 'employee'].includes(scope)) {
    throw new Error('Scope must be either division or employee.');
  }
  if (scope === 'division' && !normalizeText(division)) {
    throw new Error('Division is required for division review.');
  }
  if (scope === 'employee' && !normalizeText(employee)) {
    throw new Error('Employee is required for individual review.');
  }

  const monthInfo = monthParts(month);
  const options = await getPerformanceReviewOptions();
  const divisionLookup = new Map(
    (options.divisions || []).map((item) => [String(item.id), item.name])
  );
  const selectedEmployee = options.employees.find((item) => normalizeUpper(item.name) === normalizeUpper(employee));
  const selectedDivision = scope === 'division'
    ? normalizeText(division)
    : normalizeText(selectedEmployee?.division || division);

  const services = await Service.find().populate('division', 'name').lean();
  const baseServices = services.filter((record) => {
    const recordDate = parseAnyDate(record.entryDate, record.createdAt);
    if (!isDateInRange(recordDate, monthInfo.start, monthInfo.end)) return false;
    if (scope === 'division') return normalizeDivisionName(record, divisionLookup) === normalizeUpper(selectedDivision);
    return matchesEmployee(record, employee);
  });

  const serviceIds = baseServices.map((record) => String(record._id));
  const relatedFilter = serviceIds.length ? { serviceId: { $in: serviceIds } } : { _id: null };

  const [underRepairDocs, estimationDocs, completedDocs, scCompletedDocs, scrapDocs] = await Promise.all([
    UnderRepair.find(scope === 'division'
      ? {}
      : {
          $or: [
            { engineer: new RegExp(`^${safeRegex(employee)}$`, 'i') },
            { scEng: new RegExp(`^${safeRegex(employee)}$`, 'i') },
            { raEng: new RegExp(`^${safeRegex(employee)}$`, 'i') },
          ],
        }).lean(),
    EstimationPending.find(scope === 'division'
      ? {}
      : {
          $or: [
            { submittedBy: new RegExp(`^${safeRegex(employee)}$`, 'i') },
            { scEng: new RegExp(`^${safeRegex(employee)}$`, 'i') },
            { eng: new RegExp(`^${safeRegex(employee)}$`, 'i') },
          ],
        }).lean(),
    CompletedFRN.find(relatedFilter).lean(),
    SCCompletedFRN.find(relatedFilter).lean(),
    Scrap.find(scope === 'division'
      ? {}
      : {
          $or: [
            { addedBy: new RegExp(`^${safeRegex(employee)}$`, 'i') },
            { scEng: new RegExp(`^${safeRegex(employee)}$`, 'i') },
            { engineer: new RegExp(`^${safeRegex(employee)}$`, 'i') },
          ],
        }).lean(),
  ]);

  const filteredUnderRepair = underRepairDocs.filter((record) => {
    const recordDate = parseAnyDate(record.entryDate, record.createdAt);
    if (!isDateInRange(recordDate, monthInfo.start, monthInfo.end)) return false;
    if (scope === 'division') {
      const matchingService = baseServices.find((service) => String(service._id) === String(record.serviceId));
      return !!matchingService;
    }
    return true;
  });

  const filteredEstimation = estimationDocs.filter((record) => {
    const recordDate = parseAnyDate(record.estUpdatedAt || record.estDate || record.createdAt, record.createdAt);
    if (!isDateInRange(recordDate, monthInfo.start, monthInfo.end)) return false;
    if (scope === 'division') {
      const matchingService = baseServices.find((service) => String(service._id) === String(record.serviceId));
      return !!matchingService;
    }
    return true;
  });

  const filteredScrap = scrapDocs.filter((record) => {
    const recordDate = parseAnyDate(record.entryDate, record.createdAt);
    if (!isDateInRange(recordDate, monthInfo.start, monthInfo.end)) return false;
    if (scope === 'division') {
      const serviceDivision = normalizeUpper(record.division || record.region || '');
      return serviceDivision === normalizeUpper(selectedDivision);
    }
    return true;
  });

  const related = {
    completedByServiceId: new Map(completedDocs.map((doc) => [String(doc.serviceId || ''), doc])),
    scCompletedByServiceId: new Map(scCompletedDocs.map((doc) => [String(doc.serviceId || ''), doc])),
    scrapByServiceId: new Map(filteredScrap.map((doc) => [String(doc.serviceId || ''), doc])),
  };

  const joinedText = (record) => [
    record?.type,
    record?.typeWork,
    record?.typeReport,
    record?.reportType,
    record?.finalRemarks,
    record?.fieldRemarks,
    record?.techRemarks,
    record?.notes,
    record?.commWarrDetails,
  ].join(' ');
  const isBirRecord = (record) => /\bBIR\b/i.test(joinedText(record));
  const isWarrantyReexportRecord = (record) => /(RE[- ]?EXPORT|SUPPLIER WARR?ANTY|SUPPLIER WARRANTY|EXTERNAL REPAIR)/i.test(joinedText(record));
  const isSupplierWarrantyUnderRepair = (record) => /(SUPPLIER WARR?ANTY|SUPPLIER WARRANTY)/i.test(joinedText(record));

  const iwCamcStock = baseServices.filter((record) => ['IW', 'CAMC', 'STOCK'].includes(normalizeUpper(record.unitSts)));
  const pcbRows = iwCamcStock.filter((record) => !isConsumable(record));
  const consumableRows = iwCamcStock.filter((record) => isConsumable(record));
  const obRows = baseServices.filter((record) => ['OW', 'LAMC'].includes(normalizeUpper(record.unitSts)));
  const prfRows = baseServices.filter((record) => /PRF/i.test(String(record.typeReport || record.repType || record.type || '')));
  const birRows = baseServices.filter((record) => isBirRecord(record));
  const reExportRows = baseServices.filter((record) => isWarrantyReexportRecord(record));
  const underRepairRows = filteredUnderRepair.filter((record) => !isSupplierWarrantyUnderRepair(record));

  const countWithinTarget = (records, targetDays) => records.filter((record) => {
    const endDate = terminalDateForService(record, related);
    const startDate = parseAnyDate(record.rcvdDate || record.entryDate, record.createdAt);
    const days = diffDays(startDate, endDate);
    return days !== null && days <= targetDays;
  }).length;

  const countUnderRepairWithinTarget = (records, targetDays) => records.filter((record) => {
    const endDate = terminalDateForUnderRepair(record, related);
    const startDate = parseAnyDate(record.entryDate, record.createdAt);
    const days = diffDays(startDate, endDate);
    return days !== null && days <= targetDays;
  }).length;

  const countEstimationWithinTarget = (records) => records.filter((record) => {
    const startDate = parseAnyDate(record.entryDate, record.createdAt);
    const endDate = parseAnyDate(record.estUpdatedAt || record.estDate || record.createdAt, record.createdAt);
    const limit = /holter/i.test(String(record.model || '')) ? 5 : 3;
    const days = diffDays(startDate, endDate);
    return days !== null && days <= limit;
  }).length;

  const countScrapWithinTarget = (records, targetDays) => records.filter((record) => {
    const startDate = parseAnyDate(record.entryDate, record.createdAt);
    const endDate = parseAnyDate(record.updatedAt || record.createdAt, record.createdAt);
    const days = diffDays(startDate, endDate);
    return days !== null && days <= targetDays;
  }).length;

  const currentActivityRows = [
    makeActivityRow('IW/CAMC/STOCK - PCB, Sub units, Units & Spares', pcbRows.length, countWithinTarget(pcbRows, 3)),
    makeActivityRow('IW/CAMC/STOCK - All consumables', consumableRows.length, countWithinTarget(consumableRows, 2)),
    makeActivityRow('OB/LAMC', obRows.length, countWithinTarget(obRows, 3)),
    makeActivityRow('PRF', prfRows.length, countWithinTarget(prfRows, 1)),
    makeActivityRow('Non-Saleable', filteredScrap.length, countScrapWithinTarget(filteredScrap, 30)),
    makeActivityRow('Under Repair except warrenty spares', underRepairRows.length, countUnderRepairWithinTarget(underRepairRows, 10)),
    makeActivityRow('BIR', birRows.length, countWithinTarget(birRows, 3)),
    makeActivityRow('No. of Warranty Board received & given for re-export', reExportRows.length, countWithinTarget(reExportRows, 30)),
    makeActivityRow('No of Estimation given for out of warranty.', filteredEstimation.length, countEstimationWithinTarget(filteredEstimation)),
  ];

  let row14 = null;
  let row15 = null;
  if (scope === 'employee') {
    const lateEntryDays = new Set();
    let sameDayCount = 0;
    const frnEligible = baseServices.filter((record) => normalizeText(record.frnNo || record.scReNo));
    for (const record of frnEligible) {
      const entry = parseAnyDate(record.entryDate, record.createdAt);
      const frn = parseAnyDate(record.frnDate, record.createdAt);
      if (entry && frn) {
        const sameDay = entry.toISOString().slice(0, 10) === frn.toISOString().slice(0, 10);
        if (sameDay) sameDayCount += 1;
        else lateEntryDays.add(entry.toISOString().slice(0, 10));
      }
    }
    const workingDays = Math.max(1, new Set(baseServices.map((record) => {
      const date = parseAnyDate(record.entryDate, record.createdAt);
      return date ? date.toISOString().slice(0, 10) : null;
    }).filter(Boolean)).size || 1);
    row14 = makeActivityRow('No of days calls not entered', workingDays, Math.max(0, workingDays - lateEntryDays.size));
    row15 = makeActivityRow('No of FRN entered on the same day', frnEligible.length, sameDayCount);
  }

  const previousMonthDate = new Date(Date.UTC(monthInfo.year, monthInfo.month - 2, 1));
  const previousMonth = `${previousMonthDate.getUTCFullYear()}-${String(previousMonthDate.getUTCMonth() + 1).padStart(2, '0')}`;
  const previousMonthInfo = monthParts(previousMonth);
  const previousServices = services.filter((record) => {
    const recordDate = parseAnyDate(record.entryDate, record.createdAt);
    if (!isDateInRange(recordDate, previousMonthInfo.start, previousMonthInfo.end)) return false;
    if (scope === 'division') return normalizeDivisionName(record, divisionLookup) === normalizeUpper(selectedDivision);
    return matchesEmployee(record, employee);
  });

  const previousUnderRepair = underRepairDocs.filter((record) => {
    const recordDate = parseAnyDate(record.entryDate, record.createdAt);
    if (!isDateInRange(recordDate, previousMonthInfo.start, previousMonthInfo.end)) return false;
    if (scope === 'division') {
      const matchingService = previousServices.find((service) => String(service._id) === String(record.serviceId));
      return !!matchingService;
    }
    return true;
  });

  const previousEstimation = estimationDocs.filter((record) => {
    const recordDate = parseAnyDate(record.estUpdatedAt || record.estDate || record.createdAt, record.createdAt);
    if (!isDateInRange(recordDate, previousMonthInfo.start, previousMonthInfo.end)) return false;
    if (scope === 'division') {
      const matchingService = previousServices.find((service) => String(service._id) === String(record.serviceId));
      return !!matchingService;
    }
    return true;
  });

  const previousScrap = scrapDocs.filter((record) => {
    const recordDate = parseAnyDate(record.entryDate, record.createdAt);
    if (!isDateInRange(recordDate, previousMonthInfo.start, previousMonthInfo.end)) return false;
    if (scope === 'division') {
      const serviceDivision = normalizeUpper(record.division || record.region || '');
      return serviceDivision === normalizeUpper(selectedDivision);
    }
    return true;
  });

  const previousIwCamcStock = previousServices.filter((record) => ['IW', 'CAMC', 'STOCK'].includes(normalizeUpper(record.unitSts)));
  const previousBirRows = previousServices.filter((record) => isBirRecord(record));
  const previousReExportRows = previousServices.filter((record) => isWarrantyReexportRecord(record));
  const previousUnderRepairRows = previousUnderRepair.filter((record) => !isSupplierWarrantyUnderRepair(record));
  const previousRows = [
    previousIwCamcStock.filter((record) => !isConsumable(record)),
    previousIwCamcStock.filter((record) => isConsumable(record)),
    previousServices.filter((record) => ['OW', 'LAMC'].includes(normalizeUpper(record.unitSts))),
    previousServices.filter((record) => /PRF/i.test(String(record.typeReport || record.repType || record.type || ''))),
    previousScrap,
    previousUnderRepairRows,
    previousBirRows,
    previousReExportRows,
    previousEstimation,
  ];

  const previousWithinCounters = [
    (rows) => countWithinTarget(rows, 3),
    (rows) => countWithinTarget(rows, 2),
    (rows) => countWithinTarget(rows, 3),
    (rows) => countWithinTarget(rows, 1),
    (rows) => countScrapWithinTarget(rows, 30),
    (rows) => countUnderRepairWithinTarget(rows, 10),
    (rows) => countWithinTarget(rows, 3),
    (rows) => countWithinTarget(rows, 30),
    (rows) => countEstimationWithinTarget(rows),
  ];

  currentActivityRows.forEach((row, index) => {
    const previousSet = previousRows[index] || [];
    const prevWithin = previousWithinCounters[index] ? previousWithinCounters[index](previousSet) : 0;
    row.prevRate = rate(prevWithin, previousSet.length);
    row.nextRate = targetNext(row.prevRate);
  });
  if (row14 || row15) {
    const previousLateEntryDays = new Set();
    let previousSameDayCount = 0;
    const previousFrnEligible = previousServices.filter((record) => normalizeText(record.frnNo || record.scReNo));
    for (const record of previousFrnEligible) {
      const entry = parseAnyDate(record.entryDate, record.createdAt);
      const frn = parseAnyDate(record.frnDate, record.createdAt);
      if (entry && frn) {
        const sameDay = entry.toISOString().slice(0, 10) === frn.toISOString().slice(0, 10);
        if (sameDay) previousSameDayCount += 1;
        else previousLateEntryDays.add(entry.toISOString().slice(0, 10));
      }
    }
    const previousWorkingDays = Math.max(1, new Set(previousServices.map((record) => {
      const date = parseAnyDate(record.entryDate, record.createdAt);
      return date ? date.toISOString().slice(0, 10) : null;
    }).filter(Boolean)).size || 1);

    if (row14) {
      row14.prevRate = rate(Math.max(0, previousWorkingDays - previousLateEntryDays.size), previousWorkingDays);
      row14.nextRate = targetNext(row14.prevRate);
    }
    if (row15) {
      row15.prevRate = rate(previousSameDayCount, previousFrnEligible.length);
      row15.nextRate = targetNext(row15.prevRate);
    }
  }

  const totalTracked = currentActivityRows.reduce((sum, row) => sum + row.total, 0) + (row15?.total || 0);
  const completedCount = currentActivityRows.reduce((sum, row) => sum + row.withinTarget, 0) + (row15?.withinTarget || 0);
  const pendingCount = Math.max(0, totalTracked - completedCount);
  const criticalPendingCount = baseServices.filter((record) => {
    const date = parseAnyDate(record.entryDate, record.createdAt);
    return date && diffDays(date, new Date()) > 15 && normalizeText(record.status).toLowerCase() !== 'completed';
  }).length;

  const baseSummary = {
    month: monthInfo.monthKey,
    monthLabel: monthInfo.label,
    scope,
    division: selectedDivision,
    employee: normalizeText(employee),
    totalTracked,
    completedCount,
    pendingCount,
    completionRate: completionPercent(completedCount, totalTracked),
    criticalPendingCount,
    supplierPendingCount: 0,
    scrapDelayedCount: Math.max(0, filteredScrap.length - countScrapWithinTarget(filteredScrap, 30)),
    serviceCount: baseServices.length,
    underRepairCount: filteredUnderRepair.length,
    estimationCount: filteredEstimation.length,
    scrapCount: filteredScrap.length,
  };

  const compliance = makeAuxiliaryMetrics(
    baseSummary,
    [...currentActivityRows, ...(row14 ? [row14] : []), ...(row15 ? [row15] : [])]
  );
  const narratives = await buildAiNarratives(
    scope === 'division'
      ? `${selectedDivision} division review`
      : `${normalizeText(employee)} individual review`,
    baseSummary,
    [...currentActivityRows, ...(row14 ? [row14] : []), ...(row15 ? [row15] : [])]
  );

  return {
    scope,
    month: monthInfo.monthKey,
    monthLabel: monthInfo.label,
    sheetName: monthInfo.shortMonth,
    division: selectedDivision,
    employee: normalizeText(employee),
    employeeDivision: selectedEmployee?.division || selectedDivision,
    activityRows: currentActivityRows,
    row14,
    row15,
    compliance,
    narratives,
    summary: baseSummary,
  };
}

module.exports = {
  getPerformanceReviewOptions,
  getPerformanceReviewData,
};
