const Service = require('../models/Service');
const EmpFRN = require('../models/EmpFRN');
const EmpOBPending = require('../models/EmpOBPending');
const UnderRepair = require('../models/UnderRepair');
const EstimationPending = require('../models/EstimationPending');
const CompletedFRN = require('../models/CompletedFRN');
const SCCompletedFRN = require('../models/SCCompletedFRN');
const Scrap = require('../models/Scrap');
const Employee = require('../models/Employee');
const Division = require('../models/Division');
const EPrfOb = require('../models/EPrfOb');
const Ecr = require('../models/Ecr');
const FqcNonsaleable = require('../models/FqcNonsaleable');
const FqcNonSaleableFs = require('../models/FqcNonSaleableFs');
const Bir = require('../models/Bir');
const ClosedBir = require('../models/ClosedBir');
const { getNextKey } = require('../utils/geminiKeys');

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

function makeActivityRow(label, total, withinTarget, prevRateValue = null, targetDays = null) {
  const safeTotal = Math.max(0, Number(total) || 0);
  const safeWithin = Math.max(0, Math.min(safeTotal, Number(withinTarget) || 0));
  const outOfTarget = Math.max(0, safeTotal - safeWithin);
  return {
    label,
    total: safeTotal,
    withinTarget: safeWithin,
    outOfTarget,
    targetDays,
    currentRate: rate(safeWithin, safeTotal),
    withinPercent: completionPercent(safeWithin, safeTotal),
    outOfTargetPercent: completionPercent(outOfTarget, safeTotal),
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
    supplierWarranty: rowRate('Pending FRN'),
    supplierPendingReview: supplierPending > 0
      ? Math.max(0, rowRate('Pending FRN') - supplierPending * 5)
      : rowRate('Pending FRN'),
    criticalPending: criticalPendingRate,
    purchaseIndent: rowRate('Estimation'),
    quarterlyBuyback: Math.max(0, percentFromRate(averageRate) - scrapDelayed * 5),
    callReportToHod: completionRateValue,
    fiveSRate: percentFromRate(averageRate),
    repairReport: rowRate('Under Repair'),
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
  let apiKey = '';
  try { apiKey = getNextKey(); } catch (e) { /* no keys configured */ }
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
  const serviceById = new Map(services.map((record) => [String(record._id), record]));
  const relatedFilter = serviceIds.length ? { serviceId: { $in: serviceIds } } : { _id: null };

  const empRegex = employee ? new RegExp(`^${safeRegex(employee)}$`, 'i') : null;
  const [empFrnDocs, empObPendingDocs, underRepairDocs, estimationDocs, completedDocs, scCompletedDocs, scrapDocs, eprfobDocs, ecrDocs, fqcNonsaleableDocs, fqcNonSaleableFsDocs, birDocs, closedBirDocs] = await Promise.all([
    EmpFRN.find(scope === 'division' ? {} : { $or: [{ submittedBy: empRegex }, { scEng: empRegex }, { eng: empRegex }, { raEng: empRegex }] }).populate('division', 'name').lean(),
    EmpOBPending.find(scope === 'division' ? {} : { $or: [{ employeeName: empRegex }, { submittedBy: empRegex }, { scEng: empRegex }, { eng: empRegex }] }).lean(),
    UnderRepair.find(scope === 'division' ? {} : { $or: [{ engineer: empRegex }, { scEng: empRegex }, { raEng: empRegex }] }).lean(),
    EstimationPending.find(scope === 'division' ? {} : { $or: [{ submittedBy: empRegex }, { scEng: empRegex }, { eng: empRegex }] }).lean(),
    CompletedFRN.find(scope === 'division' ? {} : { $or: [{ closedBy: empRegex }, { scEng: empRegex }, { eng: empRegex }, { raEng: empRegex }] }).lean(),
    SCCompletedFRN.find(relatedFilter).lean(),
    Scrap.find(scope === 'division' ? {} : { $or: [{ addedBy: empRegex }, { scEng: empRegex }, { engineer: empRegex }] }).lean(),
    EPrfOb.find(scope === 'division' ? {} : { engineer: empRegex }).lean(),
    Ecr.find().lean(),
    FqcNonsaleable.find(scope === 'division' ? {} : { $or: [{ engineer: empRegex }, { scEngineer: empRegex }] }).lean(),
    FqcNonSaleableFs.find().lean(),
    Bir.find(scope === 'division' ? {} : { $or: [{ engineer: empRegex }, { scEngineer: empRegex }] }).lean(),
    ClosedBir.find().lean(),
  ]);

  const baseServiceIdSet = new Set(serviceIds);
  const recordInScope = (record) => {
    const serviceId = String(record?.serviceId || '');
    const linkedService = serviceId ? serviceById.get(serviceId) : null;
    if (scope === 'division') {
      if (linkedService && normalizeDivisionName(linkedService, divisionLookup) === normalizeUpper(selectedDivision)) return true;
      if (serviceId && baseServiceIdSet.has(serviceId)) return true;
      const recordDivision = normalizeDivisionName(record, divisionLookup);
      const fallbackDivision = normalizeUpper(record?.divisionName || record?.division || record?.region || '');
      return recordDivision === normalizeUpper(selectedDivision) || fallbackDivision === normalizeUpper(selectedDivision);
    }
    return matchesEmployee(record, employee) ||
      (linkedService && matchesEmployee(linkedService, employee)) ||
      normalizeUpper(record?.employeeName) === normalizeUpper(employee);
  };
  const inSelectedMonth = (record, dateFields = ['entryDate', 'createdAt']) => {
    const firstDate = dateFields.map((field) => parseAnyDate(record?.[field])).find(Boolean);
    const fallbackDate = parseAnyDate(record?.createdAt);
    return isDateInRange(firstDate || fallbackDate, monthInfo.start, monthInfo.end);
  };
  const firstDate = (...values) => values.map((value) => parseAnyDate(value)).find(Boolean) || null;
  const firstByServiceId = (records, serviceId) => records
    .filter((record) => String(record?.serviceId || '') === String(serviceId || ''))
    .sort((a, b) => (firstDate(a.closedAt, a.createdAt, a.updatedAt)?.getTime() || 0) - (firstDate(b.closedAt, b.createdAt, b.updatedAt)?.getTime() || 0))[0] || null;
  const firstByMatcher = (records, matcher, datePicker) => records
    .filter(matcher)
    .sort((a, b) => ((datePicker(a)?.getTime() || 0) - (datePicker(b)?.getTime() || 0)))[0] || null;

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

  const pendingFrnRows = empFrnDocs.filter((record) => inSelectedMonth(record, ['entryDate', 'createdAt']) && recordInScope(record));
  const obPendingRows = empObPendingDocs.filter((record) => inSelectedMonth(record, ['entryDate', 'createdAt']) && recordInScope(record));
  const underRepairRows = filteredUnderRepair.filter((record) => !isSupplierWarrantyUnderRepair(record));
  const toSoRows = eprfobDocs.filter((record) => ['TO', 'SO'].includes(normalizeUpper(record.type)) && inSelectedMonth(record, ['entryDate', 'raisedDate', 'createdAt']) && recordInScope(record));
  const nonSaleableRows = fqcNonsaleableDocs.filter((record) => inSelectedMonth(record, ['entryDate', 'fqcInDate', 'createdAt']) && recordInScope(record));
  const birListRows = birDocs.filter((record) => inSelectedMonth(record, ['unitInwardDate', 'fqcInwardDate', 'createdAt']) && recordInScope(record));

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

  const pendingFrnConRows = pendingFrnRows.filter(isConsumable);
  const pendingFrnNonConRows = pendingFrnRows.filter((record) => !isConsumable(record));

  const pendingFrnWithin = pendingFrnNonConRows.filter((record) => {
    const startDate = firstDate(record.entryDate, record.createdAt);
    const underRepairMatch = firstByServiceId(underRepairDocs, record.serviceId);
    const completedMatch = firstByServiceId(completedDocs, record.serviceId);
    const endDate = [
      firstDate(underRepairMatch?.createdAt, underRepairMatch?.updatedAt),
      firstDate(completedMatch?.closedAt, completedMatch?.createdAt),
    ].filter(Boolean).sort((a, b) => a - b)[0] || null;
    const days = diffDays(startDate, endDate);
    return days !== null && days <= 3;
  }).length;

  const pendingFrnConWithin = pendingFrnConRows.filter((record) => {
    const startDate = firstDate(record.entryDate, record.createdAt);
    const underRepairMatch = firstByServiceId(underRepairDocs, record.serviceId);
    const completedMatch = firstByServiceId(completedDocs, record.serviceId);
    const endDate = [
      firstDate(underRepairMatch?.createdAt, underRepairMatch?.updatedAt),
      firstDate(completedMatch?.closedAt, completedMatch?.createdAt),
    ].filter(Boolean).sort((a, b) => a - b)[0] || null;
    const days = diffDays(startDate, endDate);
    return days !== null && days <= 3;
  }).length;

  const soPendingRows = estimationDocs;
  const soPendingWithin = soPendingRows.filter((record) => {
    const startDate = firstDate(record.estUpdatedAt, record.estDate, record.createdAt);
    const completedMatch = firstByServiceId(completedDocs, record.serviceId);
    const endDate = firstDate(completedMatch?.closedAt, completedMatch?.createdAt);
    const days = diffDays(startDate, endDate);
    return days !== null && days <= 3;
  }).length;

  const underRepairRows = underRepairDocs;
  const underRepairWithin = underRepairRows.filter((record) => {
    const startDate = firstDate(record.entryDate, record.createdAt);
    const completedMatch = firstByServiceId(completedDocs, record.serviceId);
    const endDate = firstDate(completedMatch?.closedAt, completedMatch?.createdAt);
    const days = diffDays(startDate, endDate);
    return days !== null && days <= 5;
  }).length;

  const estimationWithin = obPendingRows.filter((record) => {
    const startDate = firstDate(record.entryDate, record.createdAt);
    const estimationMatch = firstByServiceId(estimationDocs, record.serviceId);
    const endDate = firstDate(estimationMatch?.createdAt, estimationMatch?.submittedAt, estimationMatch?.obUpdatedAt);
    const days = diffDays(startDate, endDate);
    return days !== null && days <= 3;
  }).length;

  const toSoWithin = toSoRows.filter((record) => {
    const startDate = firstDate(record.entryDate, record.raisedDate, record.createdAt);
    const ecrMatch = firstByMatcher(
      ecrDocs,
      (doc) => String(doc.sourceEPrfObId || '') === String(record._id || '') ||
        (normalizeUpper(doc.refNo) === normalizeUpper(record.refNo) && normalizeUpper(doc.type) === normalizeUpper(record.type) && normalizeUpper(doc.division) === normalizeUpper(record.division)),
      (doc) => firstDate(doc.executedDate, doc.receivedDate, doc.createdAt)
    );
    const endDate = firstDate(ecrMatch?.executedDate, ecrMatch?.receivedDate, ecrMatch?.createdAt);
    const days = diffDays(startDate, endDate);
    return days !== null && days <= 5;
  }).length;

  const nonSaleableWithin = nonSaleableRows.filter((record) => {
    const startDate = firstDate(record.entryDate, record.fqcInDate, record.createdAt);
    const fsMatch = firstByMatcher(
      fqcNonSaleableFsDocs,
      (doc) => normalizeUpper(doc.modelSn) === normalizeUpper(record.modelSn) && (!record.division || normalizeUpper(doc.division) === normalizeUpper(record.division)),
      (doc) => firstDate(doc.entryDate, doc.fqcInwardDate, doc.updatedAt, doc.createdAt)
    );
    const endDate = firstDate(fsMatch?.entryDate, fsMatch?.fqcInwardDate, fsMatch?.updatedAt, fsMatch?.createdAt);
    const days = diffDays(startDate, endDate);
    return days !== null && days <= 5;
  }).length;

  const birWithin = birListRows.filter((record) => {
    const startDate = firstDate(record.unitInwardDate, record.fqcInwardDate, record.createdAt);
    const closedMatch = firstByMatcher(
      closedBirDocs,
      (doc) => (normalizeUpper(doc.birRef) && normalizeUpper(doc.birRef) === normalizeUpper(record.birRef)) ||
        (normalizeUpper(doc.serial) && normalizeUpper(doc.serial) === normalizeUpper(record.serial) && normalizeUpper(doc.model) === normalizeUpper(record.model)),
      (doc) => firstDate(doc.approvedDate, doc.createdAt)
    );
    const endDate = firstDate(closedMatch?.approvedDate, closedMatch?.createdAt);
    const days = diffDays(startDate, endDate);
    return days !== null && days <= 5;
  }).length;

  const currentActivityRows = [
    makeActivityRow('Pending frn', pendingFrnNonConRows.length, pendingFrnWithin, null, 3),
    makeActivityRow('pending FRN con', pendingFrnConRows.length, pendingFrnConWithin, null, 3),
    makeActivityRow('SO Pending', soPendingRows.length, soPendingWithin, null, 3),
    makeActivityRow('Under Repair', underRepairRows.length, underRepairWithin, null, 5),
    makeActivityRow('TO/SO', toSoRows.length, toSoWithin, null, 5),
    makeActivityRow('Non-Saleable', nonSaleableRows.length, nonSaleableWithin, null, 5),
    makeActivityRow('BIR list', birListRows.length, birWithin, null, 5),
    makeActivityRow('Estimation', obPendingRows.length, estimationWithin, null, 3),
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
  const previousPendingFrnCon = previousIwCamcStock.filter(isConsumable);
  const previousPendingFrnNonCon = previousIwCamcStock.filter((record) => !isConsumable(record));
  const previousBirRows = previousServices.filter((record) => isBirRecord(record));

  const previousRows = [
    previousPendingFrnNonCon,
    previousPendingFrnCon,
    previousEstimation,
    previousServices.filter((record) => /PRF|TO|SO/i.test(String(record.typeReport || record.repType || record.type || ''))),
    previousScrap,
    previousBirRows,
    previousServices.filter((r) => false),
  ];

  const previousWithinCounters = [
    (rows) => countWithinTarget(rows, 3), // Pending frn
    (rows) => countWithinTarget(rows, 3), // pending FRN con
    (rows) => countWithinTarget(rows, 3), // SO Pending
    (rows) => countWithinTarget(rows, 5), // TO/SO
    (rows) => countScrapWithinTarget(rows, 5), // Non-Saleable
    (rows) => countWithinTarget(rows, 5), // BIR list
    (rows) => countEstimationWithinTarget(rows), // Estimation
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
  const narratives = {
    ...fallbackNarratives(
      scope === 'division'
        ? `${selectedDivision} division review`
        : `${normalizeText(employee)} individual review`,
      baseSummary
    ),
    source: 'manual',
  };

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
