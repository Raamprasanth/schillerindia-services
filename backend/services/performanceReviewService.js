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
const TrackerSubmission = require('../models/TrackerSubmission');
const User = require('../models/User');
const Ecall = require('../models/Ecall');
const Eclose = require('../models/Eclose');
const EmpDailyWork = require('../models/EmpDailyWork');
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

  const dmy = text.match(/^(\d{2})[-\/\.](\d{2})[-\/\.](\d{4})$/);
  if (dmy) {
    const date = new Date(`${dmy[3]}-${dmy[2]}-${dmy[1]}T00:00:00`);
    if (!Number.isNaN(date.getTime())) return date;
  }

  const general = new Date(text);
  if (!Number.isNaN(general.getTime())) return general;

  return fallback ? parseAnyDate(fallback, null) : null;
}

function monthParts(month) {
  const str = String(month || '').trim();
  const matchMonth = str.match(/^(\d{4})-(\d{2})$/);
  const matchQuarter = str.match(/^(\d{4})-Q([1-4])$/);
  const matchHalf = str.match(/^(\d{4})-H([1-2])$/);
  const matchAnnual = str.match(/^(\d{4})-A$/);
  const matchRange = str.match(/^(\d{4})-(\d{2}):(\d{4})-(\d{2})$/);
  const matchDateRange = str.match(/^(\d{4})-(\d{2})-(\d{2}):(\d{4})-(\d{2})-(\d{2})$/);

  let year, start, end, shortMonth, longMonth, label, periodKey;

  if (matchMonth) {
    year = Number(matchMonth[1]);
    const monthIndex = Number(matchMonth[2]);
    start = new Date(Date.UTC(year, monthIndex - 1, 1, 0, 0, 0, 0));
    end = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
    shortMonth = start.toLocaleString('en-IN', { month: 'short', timeZone: 'UTC' });
    longMonth = start.toLocaleString('en-IN', { month: 'long', timeZone: 'UTC' });
    label = `${shortMonth} ${year}`;
    periodKey = `${year}-${String(monthIndex).padStart(2, '0')}`;
  } else if (matchQuarter) {
    year = Number(matchQuarter[1]);
    const q = Number(matchQuarter[2]);
    start = new Date(Date.UTC(year, (q - 1) * 3, 1, 0, 0, 0, 0));
    end = new Date(Date.UTC(year, q * 3, 1, 0, 0, 0, 0));
    label = `Q${q} ${year}`;
    periodKey = `${year}-Q${q}`;
    shortMonth = `Q${q}`;
    longMonth = `Quarter ${q}`;
  } else if (matchHalf) {
    year = Number(matchHalf[1]);
    const h = Number(matchHalf[2]);
    start = new Date(Date.UTC(year, (h - 1) * 6, 1, 0, 0, 0, 0));
    end = new Date(Date.UTC(year, h * 6, 1, 0, 0, 0, 0));
    label = `H${h} ${year}`;
    periodKey = `${year}-H${h}`;
    shortMonth = `H${h}`;
    longMonth = `Half ${h}`;
  } else if (matchAnnual) {
    year = Number(matchAnnual[1]);
    start = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
    end = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0, 0));
    label = `Year ${year}`;
    periodKey = `${year}-A`;
    shortMonth = `${year}`;
    longMonth = `${year}`;
  } else if (matchDateRange) {
    year = Number(matchDateRange[1]);
    const startYear = Number(matchDateRange[1]);
    const startMonth = Number(matchDateRange[2]);
    const startDay = Number(matchDateRange[3]);
    const endYear = Number(matchDateRange[4]);
    const endMonth = Number(matchDateRange[5]);
    const endDay = Number(matchDateRange[6]);
    
    start = new Date(Date.UTC(startYear, startMonth - 1, startDay, 0, 0, 0, 0));
    // The end date should be inclusive, so we add 1 day to the bound
    end = new Date(Date.UTC(endYear, endMonth - 1, endDay + 1, 0, 0, 0, 0));
    
    const startLabel = start.toLocaleDateString('en-IN', { timeZone: 'UTC' });
    const displayEnd = new Date(Date.UTC(endYear, endMonth - 1, endDay, 0, 0, 0, 0));
    const endLabel = displayEnd.toLocaleDateString('en-IN', { timeZone: 'UTC' });
    
    label = startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`;
    periodKey = str;
    shortMonth = label;
    longMonth = label;
  } else if (matchRange) {
    year = Number(matchRange[1]);
    const startYear = Number(matchRange[1]);
    const startMonth = Number(matchRange[2]);
    const endYear = Number(matchRange[3]);
    const endMonth = Number(matchRange[4]);
    
    start = new Date(Date.UTC(startYear, startMonth - 1, 1, 0, 0, 0, 0));
    end = new Date(Date.UTC(endYear, endMonth, 1, 0, 0, 0, 0));
    
    const startLabel = start.toLocaleString('en-IN', { month: 'short', timeZone: 'UTC' }) + ' ' + startYear;
    // We display end label as endMonth - 1, because the bound is the START of the NEXT month
    const displayEnd = new Date(Date.UTC(endYear, endMonth - 1, 1, 0, 0, 0, 0));
    const endLabel = displayEnd.toLocaleString('en-IN', { month: 'short', timeZone: 'UTC' }) + ' ' + endYear;
    
    label = startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`;
    periodKey = str;
    shortMonth = label;
    longMonth = label;
  } else {
    throw new Error('Month must be in YYYY-MM, YYYY-Qx, YYYY-Hx, YYYY-A, YYYY-MM:YYYY-MM, or YYYY-MM-DD:YYYY-MM-DD format.');
  }

  return {
    year,
    month: matchMonth ? Number(matchMonth[2]) : null,
    start,
    end,
    monthKey: periodKey,
    shortMonth,
    longMonth,
    label,
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

// Helper to count days in a month
function countDaysInMonth(year, month, dayOfWeek) {
  let d = new Date(year, month - 1, 1);
  let count = 0;
  while (d.getMonth() === month - 1) {
    if (d.getDay() === dayOfWeek) {
      count++;
    }
    d.setDate(d.getDate() + 1);
  }
  return count;
}

function countDatesInMonth(year, month, dates) {
  const lastDay = new Date(year, month, 0).getDate();
  return dates.filter(day => day >= 1 && day <= lastDay).length;
}

function localDateKey(date) {
  if (!date || Number.isNaN(date.getTime())) return '';
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function getNonSundayDates(monthInfo) {
  const days = [];
  const date = new Date(monthInfo.start);
  const end = new Date(monthInfo.end);
  while (date < end) {
    const isThirdSaturday = (date.getDay() === 6 && date.getDate() >= 15 && date.getDate() <= 21);
    if (date.getDay() !== 0 && !isThirdSaturday) days.push(localDateKey(date));
    date.setDate(date.getDate() + 1);
  }
  return days;
}

function dayKeyInMonth(value, monthInfo) {
  const date = parseAnyDate(value);
  if (!date) return '';
  const local = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (local < monthInfo.start || local >= monthInfo.end) return '';
  if (local.getDay() === 0) return '';
  if (local.getDay() === 6) {
    const day = local.getDate();
    if (day >= 15 && day <= 21) return '';
  }
  return localDateKey(local);
}

function employeeRegex(employee) {
  return new RegExp(`^${safeRegex(employee)}$`, 'i');
}

function normalizePerson(value) {
  return normalizeUpper(value).replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function personMatches(value, employee) {
  const haystack = normalizePerson(value);
  const needle = normalizePerson(employee);
  if (!haystack || !needle) return false;
  return haystack === needle || haystack.includes(needle) || needle.includes(haystack);
}

function recordMatchesEmployeeEntry(record, employee, userIds = []) {
  const idSet = new Set(userIds.map(String).filter(Boolean));
  const createdBy = String(record?.createdBy || record?.userId || '');
  if (createdBy && idSet.has(createdBy)) return true;
  return [
    record?.submittedBy,
    record?.engineer,
    record?.scEng,
    record?.scEngg,
    record?.addedBy,
    record?.updatedBy,
    record?.closedBy,
  ].some((value) => personMatches(value, employee));
}

function makeSimpleEmployeeNarratives(employee, monthInfo, callDays, dailyWorkDays, workingDays) {
  const missingCallDays = Math.max(0, workingDays - callDays);
  const missingDailyWorkDays = Math.max(0, workingDays - dailyWorkDays);
  return {
    justification: `${employee} updated call entries on ${callDays} working days and daily work on ${dailyWorkDays} working days in ${monthInfo.label}.`,
    corrective: missingCallDays || missingDailyWorkDays
      ? `Complete call entry and daily work updates on every non-Sunday working day; currently ${missingCallDays} call-entry days and ${missingDailyWorkDays} daily-work days are missing.`
      : 'Maintain the same daily update discipline for every non-Sunday working day.',
    hod: callDays === workingDays && dailyWorkDays === workingDays
      ? 'Daily reporting discipline is complete for the selected month.'
      : 'Daily reporting requires follow-up for the missing non-Sunday working days.',
    source: 'manual',
  };
}

async function getSimpleEmployeePerformanceData({ monthInfo, employee, selectedDivision }) {
  const workingDayKeys = getNonSundayDates(monthInfo);
  const workingDaySet = new Set(workingDayKeys);
  const workingDays = workingDayKeys.length;
  const empRegex = employeeRegex(employee);
  const employeeToken = normalizeText(employee).split(/\s+/).filter(Boolean)[0] || employee;
  const empTokenRegex = new RegExp(safeRegex(employeeToken), 'i');
  const monthStartKey = localDateKey(monthInfo.start);
  const monthEndDate = new Date(monthInfo.end.getTime() - 86400000);
  const monthEndKey = localDateKey(monthEndDate);

  const matchedUsers = await User.find({
    $or: [
      { name: empRegex },
      { name: empTokenRegex },
      { email: empRegex },
      { email: empTokenRegex },
      { userId: empRegex },
      { userId: empTokenRegex },
    ],
  }).select('_id name email userId').lean();
  
  const matchedEmployees = await Employee.find({
    $or: [
      { name: empRegex },
      { name: empTokenRegex },
      { email: empRegex },
      { email: empTokenRegex },
      { employeeId: empRegex },
      { employeeId: empTokenRegex },
    ],
  }).select('_id name email employeeId').lean();

  const userIds = [
    ...matchedUsers.map((user) => String(user._id)),
    ...matchedEmployees.map((emp) => String(emp._id))
  ];

  const monthDateFilter = {
    $or: [
      { callDate: { $gte: monthStartKey, $lte: monthEndKey } },
      { entryDate: { $gte: monthStartKey, $lte: monthEndKey } },
      { closeDate: { $gte: monthStartKey, $lte: monthEndKey } },
      { createdAt: { $gte: monthInfo.start, $lt: monthInfo.end } },
    ],
  };

  const [openCallDocs, closedCallDocs, dailyWorkDocs, currentOpenCallReviews] = await Promise.all([
    Ecall.find({
      ...monthDateFilter,
    }).lean(),
    Eclose.find({
      ...monthDateFilter,
    }).lean(),
    EmpDailyWork.find({
      $or: [
        { date: { $gte: monthStartKey, $lte: monthEndKey } },
        { createdAt: { $gte: monthInfo.start, $lt: monthInfo.end } },
      ],
    }).lean(),
    TrackerSubmission.find({ employee: { $in: userIds }, ...(monthInfo.monthKey.includes(':') ? { reportDate: { $gte: monthStartKey, $lte: monthEndKey } } : { month: monthInfo.monthKey }), type: 'OpenCallReview' }).lean(),
  ]);

  const callEntryDays = new Set();
  for (const doc of [...openCallDocs, ...closedCallDocs]) {
    if (!recordMatchesEmployeeEntry(doc, employee, userIds)) continue;
    const key = dayKeyInMonth(doc.callDate || doc.entryDate || doc.closeDate || doc.createdAt, monthInfo);
    if (workingDaySet.has(key)) callEntryDays.add(key);
  }

  const dailyWorkDays = new Set();
  for (const doc of dailyWorkDocs) {
    if (!recordMatchesEmployeeEntry(doc, employee, userIds)) continue;
    const key = dayKeyInMonth(doc.date || doc.createdAt, monthInfo);
    if (workingDaySet.has(key)) dailyWorkDays.add(key);
  }

  const openCallReviewDays = new Set((currentOpenCallReviews || []).map(doc => doc.reportDate));

  const currentActivityRows = [
    makeActivityRow('Call entries updated', workingDays, callEntryDays.size, null, null),
    makeActivityRow('Daily work updated', workingDays, dailyWorkDays.size, null, null),
    makeActivityRow('Open Call Review', workingDays, openCallReviewDays.size, null, null),
  ];

  const previousMonthDate = new Date(Date.UTC(monthInfo.year, monthInfo.month - 2, 1));
  const previousMonth = `${previousMonthDate.getUTCFullYear()}-${String(previousMonthDate.getUTCMonth() + 1).padStart(2, '0')}`;
  const previousMonthInfo = monthParts(previousMonth);
  const previousWorkingDayKeys = getNonSundayDates(previousMonthInfo);
  const previousWorkingDaySet = new Set(previousWorkingDayKeys);
  const previousStartKey = localDateKey(previousMonthInfo.start);
  const previousEndDate = new Date(previousMonthInfo.end.getTime() - 86400000);
  const previousEndKey = localDateKey(previousEndDate);

  const previousMonthDateFilter = {
    $or: [
      { callDate: { $gte: previousStartKey, $lte: previousEndKey } },
      { entryDate: { $gte: previousStartKey, $lte: previousEndKey } },
      { closeDate: { $gte: previousStartKey, $lte: previousEndKey } },
      { createdAt: { $gte: previousMonthInfo.start, $lt: previousMonthInfo.end } },
    ],
  };

  const [previousOpenCallDocs, previousClosedCallDocs, previousDailyWorkDocs, previousOpenCallReviews] = await Promise.all([
    Ecall.find({
      ...previousMonthDateFilter,
    }).lean(),
    Eclose.find({
      ...previousMonthDateFilter,
    }).lean(),
    EmpDailyWork.find({
      $or: [
        { date: { $gte: previousStartKey, $lte: previousEndKey } },
        { createdAt: { $gte: previousMonthInfo.start, $lt: previousMonthInfo.end } },
      ],
    }).lean(),
    TrackerSubmission.find({ employee: { $in: userIds }, ...(previousMonthInfo.monthKey.includes(':') ? { reportDate: { $gte: previousStartKey, $lte: previousEndKey } } : { month: previousMonthInfo.monthKey }), type: 'OpenCallReview' }).lean(),
  ]);

  const previousCallDays = new Set();
  for (const doc of [...previousOpenCallDocs, ...previousClosedCallDocs]) {
    if (!recordMatchesEmployeeEntry(doc, employee, userIds)) continue;
    const key = dayKeyInMonth(doc.callDate || doc.entryDate || doc.closeDate || doc.createdAt, previousMonthInfo);
    if (previousWorkingDaySet.has(key)) previousCallDays.add(key);
  }

  const previousDailyWorkDays = new Set();
  for (const doc of previousDailyWorkDocs) {
    if (!recordMatchesEmployeeEntry(doc, employee, userIds)) continue;
    const key = dayKeyInMonth(doc.date || doc.createdAt, previousMonthInfo);
    if (previousWorkingDaySet.has(key)) previousDailyWorkDays.add(key);
  }

  const previousOpenCallReviewDays = new Set((previousOpenCallReviews || []).map(doc => doc.reportDate));

  currentActivityRows[0].prevRate = rate(previousCallDays.size, previousWorkingDayKeys.length);
  currentActivityRows[0].nextRate = targetNext(currentActivityRows[0].prevRate);
  currentActivityRows[1].prevRate = rate(previousDailyWorkDays.size, previousWorkingDayKeys.length);
  currentActivityRows[1].nextRate = targetNext(currentActivityRows[1].prevRate);
  currentActivityRows[2].prevRate = rate(previousOpenCallReviewDays.size, previousWorkingDayKeys.length);
  currentActivityRows[2].nextRate = targetNext(currentActivityRows[2].prevRate);

  const totalTracked = workingDays * currentActivityRows.length;
  const completedCount = callEntryDays.size + dailyWorkDays.size;
  const pendingCount = Math.max(0, totalTracked - completedCount);
  const baseSummary = {
    month: monthInfo.monthKey,
    monthLabel: monthInfo.label,
    scope: 'employee',
    division: selectedDivision,
    employee: normalizeText(employee),
    totalTracked,
    completedCount,
    pendingCount,
    completionRate: completionPercent(completedCount, totalTracked),
    criticalPendingCount: pendingCount,
    supplierPendingCount: 0,
    scrapDelayedCount: 0,
    serviceCount: [...openCallDocs, ...closedCallDocs].filter((doc) => recordMatchesEmployeeEntry(doc, employee, userIds)).length,
    underRepairCount: 0,
    estimationCount: 0,
    scrapCount: 0,
    workingDays,
    sundayExcluded: new Date(monthInfo.year, monthInfo.month, 0).getDate() - workingDays,
    callEntryDays: callEntryDays.size,
    dailyWorkDays: dailyWorkDays.size,
  };

  const compliance = makeAuxiliaryMetrics(baseSummary, currentActivityRows);
  compliance.weeklyCrm = currentActivityRows[0].withinPercent;
  compliance.pendingActivity = currentActivityRows[1].withinPercent;
  compliance.callReportToHod = baseSummary.completionRate;
  compliance.fiveSRate = baseSummary.completionRate;
  compliance.repairReport = baseSummary.completionRate;
  compliance.trackerSubmissions = {};

  return {
    scope: 'employee',
    month: monthInfo.monthKey,
    monthLabel: monthInfo.label,
    sheetName: monthInfo.shortMonth,
    division: selectedDivision,
    employee: normalizeText(employee),
    employeeDivision: selectedDivision,
    activityRows: currentActivityRows,
    row14: null,
    row15: null,
    compliance,
    narratives: makeSimpleEmployeeNarratives(normalizeText(employee), monthInfo, callEntryDays.size, dailyWorkDays.size, workingDays),
    summary: baseSummary,
    calculationMode: 'call_daily_work_non_sunday',
  };
}

function buildReportDefinitions(year, month) {
  return [
    { type: 'CRM', expectedPerEmployee: countDaysInMonth(year, month, 2) },
    { type: 'PendingActivity', expectedPerEmployee: countDaysInMonth(year, month, 1) },
    { type: 'NonSaleable', expectedPerEmployee: countDatesInMonth(year, month, [2, 16]) },
    { type: 'SupplierWarranty', expectedPerEmployee: countDatesInMonth(year, month, [3, 16]) },
    { type: 'CriticalPendingReport', expectedPerEmployee: countDatesInMonth(year, month, [2]) },
    { type: 'PIRequest', expectedPerEmployee: countDatesInMonth(year, month, [5]) },
    { type: 'BuyBack', expectedPerEmployee: [4, 8, 12].includes(month) ? countDatesInMonth(year, month, [15]) : 0 }
  ];
}

async function getRealTrackerMetrics(scope, divisionName, employeeName, monthInfo) {
  const reportDefs = buildReportDefinitions(monthInfo.year, monthInfo.month);
  
  let empCount = 0;
  const escapeRegex = (s) => (s || '').replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  let matchQuery = {};
  if (monthInfo.monthKey.includes(':')) {
    const monthStartKey = localDateKey(monthInfo.start);
    const monthEndKey = localDateKey(new Date(monthInfo.end.getTime() - 86400000));
    matchQuery.reportDate = { $gte: monthStartKey, $lte: monthEndKey };
  } else {
    matchQuery.month = monthInfo.monthKey;
  }

  if (scope === 'division') {
    const Employee = require('../models/Employee');
    const divRegex = new RegExp('^' + escapeRegex(divisionName) + '$', 'i');
    empCount = await Employee.countDocuments({ role: 'employee', division: divRegex });
    matchQuery.division = divRegex;
  } else {
    empCount = 1;
    const Employee = require('../models/Employee');
    const empDoc = await Employee.findOne({ name: employeeName, role: 'employee' }).lean();
    if (empDoc) {
      const divRegex = new RegExp('^' + escapeRegex(empDoc.division) + '$', 'i');
      matchQuery.division = divRegex;
    } else {
      empCount = 0; // Employee not found
    }
  }

  const actuals = {
    CRM: 0, PendingActivity: 0, NonSaleable: 0,
    SupplierWarranty: 0, CriticalPendingReport: 0, PIRequest: 0, BuyBack: 0
  };

  const submissionsObj = {};
  if (scope === 'division' || empCount > 0) {
    const submissions = await TrackerSubmission.aggregate([
      { $match: matchQuery },
      { $group: { _id: { type: "$type", date: "$reportDate" }, count: { $sum: 1 } } }
    ]);
    
    // actuals just count total unique type+date per employee?? No, TrackerSubmission is per employee.
    // the previous aggregate grouped by just type. We can group by type and push dates!
    const allSubs = await TrackerSubmission.find(matchQuery).lean();
    for (const sub of allSubs) {
      if (actuals[sub.type] !== undefined) {
        actuals[sub.type]++;
      }
      if (!submissionsObj[sub.type]) submissionsObj[sub.type] = [];
      submissionsObj[sub.type].push({ date: sub.reportDate, emp: sub.employee.toString() });
    }
  }

  const result = { submissionsObj };
  for (const def of reportDefs) {
    const expected = def.expectedPerEmployee; // Tracker submissions are unique per division
    const actual = actuals[def.type];
    const pct = expected > 0 ? percent((actual / expected) * 100) : percent(0);
    result[def.type] = pct;
  }
  
  return result;
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
      divisions: employee.divisions || [],
    })),
  };
}


async function getAllEmployeesPerformanceData({ monthInfo, selectedDivision }) {
  const workingDayKeys = getNonSundayDates(monthInfo);
  const workingDaySet = new Set(workingDayKeys);
  const workingDays = workingDayKeys.length;
  const monthStartKey = localDateKey(monthInfo.start);
  const monthEndDate = new Date(monthInfo.end.getTime() - 86400000);
  const monthEndKey = localDateKey(monthEndDate);

  const User = require('../models/User');
  const Employee = require('../models/Employee');
  const Ecall = require('../models/Ecall');
  const Eclose = require('../models/Eclose');
  const EmpDailyWork = require('../models/EmpDailyWork');
  const TrackerSubmission = require('../models/TrackerSubmission');


  
    let filter = { 
      isActive: { $ne: false }, 
      role: { $in: ['employee', 'service_coordinator'] } 
    };
    if (selectedDivision) {
      filter.$or = [
        { division: selectedDivision },
        { divisions: selectedDivision },
        { division: new RegExp(selectedDivision, 'i') },
        { divisions: new RegExp(selectedDivision, 'i') }
      ];
    }
    let employees = await User.find(filter).select('_id name email employeeId division divisions').lean();

  
  
    let legacyFilter = { isActive: { $ne: false } };
    if (selectedDivision) {
      legacyFilter.$or = [
        { division: selectedDivision },
        { divisions: selectedDivision },
        { division: new RegExp(selectedDivision, 'i') },
        { divisions: new RegExp(selectedDivision, 'i') }
      ];
    }
    const legacyEmployees = await Employee.find(legacyFilter).select('_id name email employeeId division divisions').lean();

  const seenNames = new Set(employees.map(e => e.name.toLowerCase()));
  for (const le of legacyEmployees) {
      if (!seenNames.has(le.name.toLowerCase())) {
        employees.push(le);
        seenNames.add(le.name.toLowerCase());
      }
    }

    const excludedNames = ['raam', 'vassougui v', 'siva hari thilipan', 'gajenthiran k', 'pradap k', 'service coordinator'];
    employees = employees.filter(e => e && e.name && !excludedNames.includes(e.name.trim().toLowerCase()));


  const monthDateFilter = {
    $or: [
      { callDate: { $gte: monthStartKey, $lte: monthEndKey } },
      { entryDate: { $gte: monthStartKey, $lte: monthEndKey } },
      { closeDate: { $gte: monthStartKey, $lte: monthEndKey } },
      { createdAt: { $gte: monthInfo.start, $lt: monthInfo.end } },
    ],
  };

  const [openCallDocs, closedCallDocs, dailyWorkDocs, openCallReviews] = await Promise.all([
    Ecall.find(monthDateFilter).lean(),
    Eclose.find(monthDateFilter).lean(),
    EmpDailyWork.find({
      $or: [
        { date: { $gte: monthStartKey, $lte: monthEndKey } },
        { createdAt: { $gte: monthInfo.start, $lt: monthInfo.end } },
      ],
    }).lean(),
    TrackerSubmission.find({ ...(monthInfo.monthKey.includes(':') ? { reportDate: { $gte: monthStartKey, $lte: monthEndKey } } : { month: monthInfo.monthKey }), type: 'OpenCallReview' }).lean(),
  ]);

  const allCalls = [...openCallDocs, ...closedCallDocs];
  const results = [];
  
  for (const emp of employees) {
    const userIds = [String(emp._id)];
    
    const callDays = new Set();
    for (const doc of allCalls) {
      if (recordMatchesEmployeeEntry(doc, emp.name, userIds)) {
        const key = dayKeyInMonth(doc.callDate || doc.entryDate || doc.closeDate || doc.createdAt, monthInfo);
        if (workingDaySet.has(key)) callDays.add(key);
      }
    }

    const workDays = new Set();
    for (const doc of dailyWorkDocs) {
      if (recordMatchesEmployeeEntry(doc, emp.name, userIds)) {
        const key = dayKeyInMonth(doc.date || doc.createdAt, monthInfo);
        if (workingDaySet.has(key)) workDays.add(key);
      }
    }

    const reviewDays = new Set();
    for (const doc of openCallReviews) {
      if (String(doc.employee) === String(emp._id) || (doc.employeeName && String(doc.employeeName).toLowerCase() === String(emp.name).toLowerCase())) {
        if (workingDaySet.has(doc.reportDate)) reviewDays.add(doc.reportDate);
      }
    }
    
    const callScore = callDays.size;
    const workScore = workDays.size;
    const reviewScore = reviewDays.size;
    
    const totalTracked = workingDays * 3;
    const completedCount = callScore + workScore + reviewScore;
    const completionRate = totalTracked > 0 ? Math.round((completedCount / totalTracked) * 100) : 0;
    
    let remark = 'Very Poor';
      if (completionRate >= 91) remark = 'Outstanding';
      else if (completionRate >= 81) remark = 'Excellent';
      else if (completionRate >= 61) remark = 'Very Good';
      else if (completionRate >= 41) remark = 'Satisfactory';
      else if (completionRate >= 21) remark = 'Needs Improvement';
    
    results.push({
      employee: emp.name,
      workingDays,
      callScore,
      workScore,
      reviewScore,
      completionRate,
      remark
    });
  }
  
  return {
    month: monthInfo.label,
    workingDays,
    employees: results
  };
}

async function getPerformanceReviewData({ scope, month, division, employee }) {
  if (!['division', 'employee'].includes(scope)) {
    throw new Error('Scope must be either division or employee.');
  }
  if (scope === 'division' && !normalizeText(division)) {
    throw new Error('Division is required for division review.');
  }
  // Employee validation removed

  const monthInfo = monthParts(month);
  const options = await getPerformanceReviewOptions();
  const divisionLookup = new Map(
    (options.divisions || []).map((item) => [String(item.id), item.name])
  );
  const selectedEmployee = options.employees.find((item) => normalizeUpper(item.name) === normalizeUpper(employee));
  const selectedDivision = scope === 'division'
    ? normalizeText(division)
    : normalizeText(selectedEmployee?.division || division);

  if (scope === 'employee') {
    return await getAllEmployeesPerformanceData({ monthInfo, selectedDivision });
  }

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

  const soPendingRows = filteredEstimation;
  const soPendingWithin = soPendingRows.filter((record) => {
    const startDate = firstDate(record.estUpdatedAt, record.estDate, record.createdAt);
    const completedMatch = firstByServiceId(completedDocs, record.serviceId);
    const endDate = firstDate(completedMatch?.closedAt, completedMatch?.createdAt);
    const days = diffDays(startDate, endDate);
    return days !== null && days <= 3;
  }).length;

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

  // Previous month TO/SO rows (eprfob docs in previous month scope)
  const previousToSoRows = eprfobDocs.filter((record) =>
    ['TO', 'SO'].includes(normalizeUpper(record.type)) &&
    (() => {
      const recordDate = parseAnyDate(record.entryDate || record.raisedDate || record.createdAt);
      return isDateInRange(recordDate, previousMonthInfo.start, previousMonthInfo.end);
    })() &&
    recordInScope(record)
  );

  // Previous month OB Pending (Estimation) rows scoped to previous month services
  const previousObPendingRows = empObPendingDocs.filter((record) => {
    const recordDate = parseAnyDate(record.entryDate || record.createdAt);
    return isDateInRange(recordDate, previousMonthInfo.start, previousMonthInfo.end) && recordInScope(record);
  });

  // Previous month Non-Saleable rows
  const previousNonSaleableRows = fqcNonsaleableDocs.filter((record) => {
    const recordDate = parseAnyDate(record.entryDate || record.fqcInDate || record.createdAt);
    return isDateInRange(recordDate, previousMonthInfo.start, previousMonthInfo.end) && recordInScope(record);
  });

  const previousUnderRepairRows = previousUnderRepair.filter((record) => !isSupplierWarrantyUnderRepair(record));

  // Align exactly with currentActivityRows order:
  // [0] Pending frn, [1] pending FRN con, [2] SO Pending, [3] Under Repair,
  // [4] TO/SO, [5] Non-Saleable, [6] BIR list, [7] Estimation
  const previousRows = [
    previousPendingFrnNonCon,
    previousPendingFrnCon,
    previousEstimation,       // SO Pending uses estimation data
    previousUnderRepairRows,
    previousToSoRows,
    previousNonSaleableRows,
    previousBirRows,
    previousObPendingRows,
  ];

  const previousWithinCounters = [
    (rows) => countWithinTarget(rows, 3),            // [0] Pending frn
    (rows) => countWithinTarget(rows, 3),            // [1] pending FRN con
    (rows) => rows.filter((record) => {              // [2] SO Pending
      const startDate = firstDate(record.estUpdatedAt, record.estDate, record.createdAt);
      const completedMatch = firstByServiceId(completedDocs, record.serviceId);
      const endDate = firstDate(completedMatch?.closedAt, completedMatch?.createdAt);
      const days = diffDays(startDate, endDate);
      return days !== null && days <= 3;
    }).length,
    (rows) => countUnderRepairWithinTarget(rows, 5), // [3] Under Repair
    (rows) => rows.filter((record) => {              // [4] TO/SO
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
    }).length,
    (rows) => rows.filter((record) => {              // [5] Non-Saleable
      const startDate = firstDate(record.entryDate, record.fqcInDate, record.createdAt);
      const fsMatch = firstByMatcher(
        fqcNonSaleableFsDocs,
        (doc) => normalizeUpper(doc.modelSn) === normalizeUpper(record.modelSn) && (!record.division || normalizeUpper(doc.division) === normalizeUpper(record.division)),
        (doc) => firstDate(doc.entryDate, doc.fqcInwardDate, doc.updatedAt, doc.createdAt)
      );
      const endDate = firstDate(fsMatch?.entryDate, fsMatch?.fqcInwardDate, fsMatch?.updatedAt, fsMatch?.createdAt);
      const days = diffDays(startDate, endDate);
      return days !== null && days <= 5;
    }).length,
    (rows) => countWithinTarget(rows, 5),            // [6] BIR list
    (rows) => rows.filter((record) => {              // [7] Estimation
      const startDate = firstDate(record.entryDate, record.createdAt);
      const estimationMatch = firstByServiceId(estimationDocs, record.serviceId);
      const endDate = firstDate(estimationMatch?.createdAt, estimationMatch?.submittedAt, estimationMatch?.obUpdatedAt);
      const days = diffDays(startDate, endDate);
      return days !== null && days <= 3;
    }).length,
  ];

  currentActivityRows.forEach((row, index) => {
    const previousSet = previousRows[index] || [];
    const counter = previousWithinCounters[index];
    const prevWithin = counter ? counter(previousSet) : 0;
    const total = previousSet.length;
    
    // User clarified: they want the actual completion rate (% Execution) of the previous month.
    row.prevRate = rate(prevWithin, total);
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

  const actualEmployeeName = selectedEmployee ? selectedEmployee.name : employee;
  const realTrackers = await getRealTrackerMetrics(scope, selectedDivision, actualEmployeeName, monthInfo);
  const compliance = makeAuxiliaryMetrics(
    baseSummary,
    [...currentActivityRows, ...(row14 ? [row14] : []), ...(row15 ? [row15] : [])]
  );
  // Override fake compliance with real tracker percentages
  compliance.weeklyCrm = realTrackers.CRM;
  compliance.pendingActivity = realTrackers.PendingActivity;
  compliance.nonSaleable = realTrackers.NonSaleable;
  compliance.supplierWarranty = realTrackers.SupplierWarranty;
  compliance.criticalPending = realTrackers.CriticalPendingReport;
  compliance.purchaseIndent = realTrackers.PIRequest;
    compliance.buyBack = realTrackers.BuyBack;
  compliance.trackerSubmissions = realTrackers.submissionsObj;

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



async function getCommercialPerformanceData({ month }) {
  const monthInfo = monthParts(month);
  
  const Service = require('../models/Service');
  const Ctodr = require('../models/Ctodr');
  const EmpFRN = require('../models/EmpFRN');
  const EstimationPending = require('../models/EstimationPending');
  const ScPrfOb = require('../models/ScPrfOb');
  const ScCsr = require('../models/ScCsr');
  const Cdr = require('../models/Cdr');

  const getDiff = (d1, d2) => {
    const date1 = parseAnyDate(d1);
    const date2 = parseAnyDate(d2);
    if (!date1 || !date2 || isNaN(date1.getTime()) || isNaN(date2.getTime())) return null;
    const utc1 = Date.UTC(date1.getFullYear(), date1.getMonth(), date1.getDate());
    const utc2 = Date.UTC(date2.getFullYear(), date2.getMonth(), date2.getDate());
    return (utc2 - utc1) / (1000 * 60 * 60 * 24);
  };

  const categorize = (diff) => {
    if (diff === null || isNaN(diff)) return null;
    if (diff < 1) return '< 1 day';
    if (diff <= 2) return '1 to 2 days';
    return '> 2 days';
  };

  const categorize15_30 = (diff) => {
    if (diff === null || isNaN(diff)) return null;
    if (diff < 15) return '< 15 days';
    if (diff <= 30) return '15 to 30 days';
    return '> 30 days';
  };

  // Ensure start and end cover the whole month
  const start = monthInfo.start;
  const end = monthInfo.end;

  const isDateInRange = (date, s, e) => {
    if (!date || isNaN(date.getTime())) return false;
    return date.getTime() >= s.getTime() && date.getTime() < e.getTime();
  };

  const allServices = await Service.find().populate('division', 'name').lean();
  const services = allServices.filter(s => isDateInRange(parseAnyDate(s.entryDate, s.createdAt), start, end));
  
  const allTodrs = await Ctodr.find().lean();
  const todrs = allTodrs.filter(t => {
    const raisedDate = parseAnyDate(t.toRaisedDate);
    const receivedDate = parseAnyDate(t.sparesReceivedDate);
    const entryDate = parseAnyDate(t.entryDate, t.createdAt);
    return raisedDate && receivedDate && isDateInRange(entryDate, start, end);
  });
  
  const allScPrfObs = await ScPrfOb.find().lean();
  const scPrfObs = allScPrfObs.filter(p => isDateInRange(parseAnyDate(p.entryDate, p.createdAt), start, end));
  
  const allScSrs = await ScCsr.find().lean();
  const scSrs = allScSrs.filter(s => {
    const raisedDate = parseAnyDate(s.toRaisedDate);
    const receivedDate = parseAnyDate(s.sparesReceivedDate);
    const closedDate = parseAnyDate(s.closeDate, s.createdAt);
    return raisedDate && receivedDate && isDateInRange(closedDate, start, end);
  });

  const allCdrs = await Cdr.find().lean();
  const cdrs = allCdrs.filter(c => {
    const reqDate = parseAnyDate(c.entryDate);
    const recDate = parseAnyDate(c.sparesReceivedDate);
    return reqDate && recDate && isDateInRange(reqDate, start, end);
  });

  const divisionsMap = {};
  const ensureDivision = (div) => {
    const d = String(div || 'Unknown').trim().replace(/\s+/g, ' ').toUpperCase();
    if (!divisionsMap[d]) {
      divisionsMap[d] = {
        'FRN ( Inward - SVC )': { '< 1 day': 0, '1 to 2 days': 0, '> 2 days': 0, total: 0 },
        'TO ( Raised - Received )': { '< 1 day': 0, '1 to 2 days': 0, '> 2 days': 0, total: 0 },
        'TO/SO ( Entry - Received )': { '< 1 day': 0, '1 to 2 days': 0, '> 2 days': 0, total: 0 },
        'SR ( Raised - Received )': { '< 1 day': 0, '1 to 2 days': 0, '> 2 days': 0, total: 0 },
        'DR ( Requested - Received )': { '< 1 day': 0, '1 to 2 days': 0, '> 2 days': 0, total: 0 },
        'Field TO/SO ( ER Raised - Entry )': { '< 1 day': 0, '1 to 2 days': 0, '> 2 days': 0, total: 0 },
        'Re-Export (Ship Date-DC Date)': { '< 1 day': 0, '1 to 2 days': 0, '> 2 days': 0, total: 0 },
        'Re-Export ( DC Date - AWB Date )': { '< 15 days': 0, '15 to 30 days': 0, '> 30 days': 0, total: 0 }
      };
    }
    return divisionsMap[d];
  };

  const toSourceIds = [...new Set([
    ...todrs.map(t => t.sourceId),
    ...cdrs.map(c => c.sourceId)
  ].filter(id => id && /^[0-9a-fA-F]{24}$/.test(String(id))).map(String))];
  const toSourceMap = new Map();
  if (toSourceIds.length) {
    const [empFrns, servicesRef, estimations] = await Promise.all([
      EmpFRN.find({ _id: { $in: toSourceIds } }).populate('division', 'name').lean(),
      Service.find({ _id: { $in: toSourceIds } }).populate('division', 'name').lean(),
      EstimationPending.find({ _id: { $in: toSourceIds } }).populate('division', 'name').lean(),
    ]);
    [...empFrns, ...servicesRef, ...estimations].forEach(doc => toSourceMap.set(String(doc._id), doc));
  }

  const divisionNameForTo = (row) => {
    if (row.division) return row.division;
    const source = row.sourceId ? toSourceMap.get(String(row.sourceId)) : null;
    if (!source) return 'Unknown';
    return source.division?.name || source.divisionName || source.division || 'Unknown';
  };

  for (const s of services) {
    const diff = getDiff(s.entryDate || s.createdAt, s.frnDate);
    const cat = categorize(diff);
    if (cat) {
      const divName = s.division?.name || s.divisionName || s.division || 'Unknown';
    if (!divName || String(divName).toUpperCase() === 'UNKNOWN') return;
    const divData = ensureDivision(divName);
      divData['FRN ( Inward - SVC )'][cat]++;
      divData['FRN ( Inward - SVC )'].total++;
    }
  }

  for (const t of todrs) {
    const diff = getDiff(t.toRaisedDate, t.sparesReceivedDate);
    const cat = categorize(diff);
    if (cat) {
      const divData = ensureDivision(divisionNameForTo(t));
      divData['TO ( Raised - Received )'][cat]++;
      divData['TO ( Raised - Received )'].total++;
    }
  }

  for (const p of scPrfObs) {
    // 1. TO/SO ( Entry - Received )
    const endDate = p.sparesReceivedAtSvc;
    let diff = getDiff(p.entryDate, endDate);
    let cat = categorize(diff);
    if (cat) {
      const divData = ensureDivision(p.division);
      divData['TO/SO ( Entry - Received )'][cat]++;
      divData['TO/SO ( Entry - Received )'].total++;
    }
    
    // 2. Field TO/SO ( ER Raised - Entry )
    const diffRaised = getDiff(p.raisedDate, p.entryDate);
    const catRaised = categorize(diffRaised);
    if (catRaised) {
      const divData = ensureDivision(p.division);
      divData['Field TO/SO ( ER Raised - Entry )'][catRaised]++;
      divData['Field TO/SO ( ER Raised - Entry )'].total++;
    }
  }

  for (const s of scSrs) {
    const fromLoc = String(s.fromLocation || '').toLowerCase();
    const toLoc = String(s.toLocation || '').toLowerCase();
    if (fromLoc.includes('serv') && toLoc.includes('pdy')) {
      const diff = getDiff(s.toRaisedDate, s.sparesReceivedDate);
      const cat = categorize(diff);
      if (cat) {
        const divData = ensureDivision(s.division);
        divData['SR ( Raised - Received )'][cat]++;
        divData['SR ( Raised - Received )'].total++;
      }
    }
  }

  for (const c of cdrs) {
    const diff = getDiff(c.entryDate, c.sparesReceivedDate);
    const cat = categorize(diff);
    if (cat) {
      const divData = ensureDivision(divisionNameForTo(c));
      divData['DR ( Requested - Received )'][cat]++;
      divData['DR ( Requested - Received )'].total++;
    }
  }

  const Scrap = require('../models/Scrap');
  const allScraps = await Scrap.find().lean();
  const scraps = allScraps.filter(s => isDateInRange(parseAnyDate(s.shipDateFromSc), start, end));
  
  for (const s of scraps) {
    const diff1 = getDiff(s.dcInvoiceDate, s.shipDateFromSc);
    const cat1 = categorize(diff1);
    if (cat1) {
      const divName = s.division || 'Unknown';
      const divData = ensureDivision(divName);
      divData['Re-Export (Ship Date-DC Date)'][cat1]++;
      divData['Re-Export (Ship Date-DC Date)'].total++;
    }

    const diff2 = getDiff(s.dcInvoiceDate, s.awbDate);
    const cat2 = categorize15_30(diff2);
    if (cat2) {
      const divName = s.division || 'Unknown';
      const divData = ensureDivision(divName);
      divData['Re-Export ( DC Date - AWB Date )'][cat2]++;
      divData['Re-Export ( DC Date - AWB Date )'].total++;
    }
  }

  return divisionsMap;
}

async function getRepairTeamPerformanceData({ month }) {
  const monthInfo = monthParts(month);
  
  const RTFRN = require('../models/RTFRN.JS');
  const RTOB = require('../models/RTOB');
  const RTUR = require('../models/rturModel');
  const RTRR = require('../models/Rtrr');
  const RTCRL = require('../models/rtcrlModel');
  const RTCRR = require('../models/Rtcrr');

  const getDiff = (d1, d2) => {
    const date1 = parseAnyDate(d1);
    const date2 = parseAnyDate(d2);
    if (!date1 || !date2 || isNaN(date1.getTime()) || isNaN(date2.getTime())) return null;
    const utc1 = Date.UTC(date1.getFullYear(), date1.getMonth(), date1.getDate());
    const utc2 = Date.UTC(date2.getFullYear(), date2.getMonth(), date2.getDate());
    return (utc2 - utc1) / (1000 * 60 * 60 * 24);
  };

  const categorize = (diff) => {
    if (diff === null || isNaN(diff)) return null;
    if (diff < 1) return '< 1 day';
    if (diff <= 3) return '1 to 3 days';
    return '> 3 days';
  };

  const start = monthInfo.start;
  const end = monthInfo.end;
  const isDateInRange = (date, s, e) => {
    if (!date || isNaN(date.getTime())) return false;
    return date.getTime() >= s.getTime() && date.getTime() < e.getTime();
  };

  const [activeFrns, activeObs, activeUrs, activeRrs, closedCrls, closedRrs] = await Promise.all([
    RTFRN.find().lean(),
    RTOB.find().lean(),
    RTUR.find().lean(),
    RTRR.find().lean(),
    RTCRL.find().lean(),
    RTCRR.find().lean()
  ]);

  const divisionsMap = {};
  const ensureDivision = (div) => {
    const d = 'All Divisions';
    if (!divisionsMap[d]) {
      divisionsMap[d] = {
        'Pending FRN': { '< 1 day': 0, '1 to 3 days': 0, '> 3 days': 0, total: 0, RP: 0 },
        'OB Pending': { '< 1 day': 0, '1 to 3 days': 0, '> 3 days': 0, total: 0, RP: 0 },
        'Under Repair': { '< 1 day': 0, '1 to 3 days': 0, '> 3 days': 0, total: 0, RP: 0 },
        'Re-Repair': { '< 1 day': 0, '1 to 3 days': 0, '> 3 days': 0, total: 0, RP: 0 }
      };
    }
    return divisionsMap[d];
  };

  const now = new Date();
  const isCurrentMonth = (monthInfo.year === now.getFullYear() && monthInfo.month === (now.getMonth() + 1));

  const processActive = (items, actKey, dateField) => {
    for (const item of items) {
      const divName = item.division || 'Unknown';
    if (!divName || String(divName).toUpperCase() === 'UNKNOWN') return;
    const divData = ensureDivision(divName);
      // Increment RP for active items only if querying the current month
      if (isCurrentMonth) {
        divData[actKey].RP++;
      }
      
      const d = parseAnyDate(item[dateField], item.createdAt);
      if (isDateInRange(d, start, end)) {
        divData[actKey].total++;
      }
    }
  };

  processActive(activeFrns, 'Pending FRN', 'entryDate');
  processActive(activeObs, 'OB Pending', 'entryDate');
  processActive(activeUrs, 'Under Repair', 'entryDate');
  processActive(activeRrs, 'Re-Repair', 'revertedDate');

  const processClosed = (items, actKey, categoryCheck, entryField, closedField) => {
    for (const item of items) {
      if (categoryCheck && item.category !== categoryCheck) continue;
      const dEntry = parseAnyDate(item[entryField], item.createdAt);
      if (isDateInRange(dEntry, start, end)) {
        const divName = item.division || 'Unknown';
    if (!divName || String(divName).toUpperCase() === 'UNKNOWN') return;
    const divData = ensureDivision(divName);
        divData[actKey].total++;

        const dClosed = parseAnyDate(item[closedField]);
        const diff = getDiff(dEntry, dClosed || new Date());
        const cat = categorize(diff);
        if (cat) {
          divData[actKey][cat]++;
        }
      }
    }
  };

  processClosed(closedCrls, 'Pending FRN', 'PFRN', 'entryDate', 'closedDate');
  processClosed(closedCrls, 'OB Pending', 'OB', 'entryDate', 'closedDate');
  processClosed(closedCrls, 'Under Repair', 'UR', 'entryDate', 'closedDate');
  
  for (const item of closedRrs) {
    const dEntry = parseAnyDate(item.revertedDate || item.entryDate, item.createdAt);
    if (isDateInRange(dEntry, start, end)) {
      const divName = item.division || 'Unknown';
    if (!divName || String(divName).toUpperCase() === 'UNKNOWN') return;
    const divData = ensureDivision(divName);
      divData['Re-Repair'].total++;

      const dClosed = parseAnyDate(item.reRepDate || item.closedDate);
      const diff = getDiff(dEntry, dClosed || new Date());
      const cat = categorize(diff);
      if (cat) {
        divData['Re-Repair'][cat]++;
      }
    }
  }

  return divisionsMap;
}


async function getProductTeamPerformanceData({ month }) {
  const monthInfo = monthParts(month);
  const start = monthInfo.start;
  const end = monthInfo.end;
  
  const User = require('../models/User');
  const PtCallRegister = require('../models/PtCallRegister');
  const PtDailyWork = require('../models/PtDailyWork');
  const Bir = require('../models/Bir');
  const PtBir = require('../models/PtBir');
    const PtClosedBir = require('../models/PtClosedBir');
  const Division = require('../models/Division');
  
  const getDiff = (d1, d2) => {
    const date1 = parseAnyDate(d1);
    const date2 = parseAnyDate(d2);
    if (!date1 || !date2 || isNaN(date1.getTime()) || isNaN(date2.getTime())) return null;
    const utc1 = Date.UTC(date1.getFullYear(), date1.getMonth(), date1.getDate());
    const utc2 = Date.UTC(date2.getFullYear(), date2.getMonth(), date2.getDate());
    return (utc2 - utc1) / (1000 * 60 * 60 * 24);
  };
  
  const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  const workingDayKeys = getNonSundayDates(monthInfo);
  const workingDaySet = new Set(workingDayKeys);
  const workingDays = workingDayKeys.length;
  
  const monthStartKey = localDateKey(monthInfo.start);
  const monthEndDate = new Date(monthInfo.end.getTime() - 86400000);
  const monthEndKey = localDateKey(monthEndDate);
  
  // 1. Fetch Product Team Members
  const ptUsers = await User.find({ role: 'pt' }).lean();
  
  // 2. PT Employee Performance
  const employeesData = [];
  
  // Cache all docs for the month to avoid N+1 queries
  // PtCallRegister is the collection where PT users log their calls (submittedBy = PT user name)
  const ptCallRegisters = await PtCallRegister.find({
    $or: [
      { callDate: { $gte: monthStartKey, $lte: monthEndKey } },
      { entryDate: { $gte: monthStartKey, $lte: monthEndKey } }
    ]
  }).lean();
  
  const ptDailyWorks = await PtDailyWork.find({
    date: { $gte: monthStartKey, $lte: monthEndKey }
  }).lean();
  
  for (const user of ptUsers) {
    const empRegex = new RegExp('^' + escapeRegExp(user.name) + '$', 'i');
    
    // PT Calls — match by submittedBy (who the PT user is) or scEng
    const callDays = new Set();
    for (const doc of ptCallRegisters) {
      if (empRegex.test(doc.submittedBy) || empRegex.test(doc.scEng)) {
        const key = dayKeyInMonth(doc.callDate || doc.entryDate, monthInfo);
        if (workingDaySet.has(key)) callDays.add(key);
      }
    }
    
    // PT Daily Work
    const workDays = new Set();
    for (const doc of ptDailyWorks) {
      if (empRegex.test(doc.addedBy) || empRegex.test(doc.team)) {
        const key = dayKeyInMonth(doc.date, monthInfo);
        if (workingDaySet.has(key)) workDays.add(key);
      }
    }
    
    const callScore = callDays.size;
    const workScore = workDays.size;
    const totalTracked = workingDays * 2;
    const completedCount = callScore + workScore;
    const completionRate = totalTracked > 0 ? Math.round((completedCount / totalTracked) * 100) : 0;
    let remark = 'Very Poor';
      if (completionRate >= 91) remark = 'Outstanding';
      else if (completionRate >= 81) remark = 'Excellent';
      else if (completionRate >= 61) remark = 'Very Good';
      else if (completionRate >= 41) remark = 'Satisfactory';
      else if (completionRate >= 21) remark = 'Needs Improvement';
    
    employeesData.push({
      employee: user.name,
      workingDays,
      callScore,
      workScore,
      completionRate,
      remark
    });
  }
  
  // 3. BIR List Tracker
  const birData = [];
  
  
    const ptbirs = await PtBir.find({
      $or: [
        { unitInwardDate: { $gte: monthStartKey, $lte: monthEndKey } },
        { createdAt: { $gte: start, $lt: end } }
      ]
    }).lean();

    const ptcbirs = await PtClosedBir.find({
      $or: [
        { unitInwardDate: { $gte: monthStartKey, $lte: monthEndKey } },
        { createdAt: { $gte: start, $lt: end } },
        { approvedDate: { $gte: monthStartKey, $lte: monthEndKey } }
      ]
    }).lean();
    
    let withinTargetCount = 0;
    
    for (const ptcbir of ptcbirs) {
      const diff = ptcbir.unitInwardDate ? getDiff(ptcbir.unitInwardDate, ptcbir.createdAt) : getDiff(ptcbir.createdAt, ptcbir.createdAt);
      if (diff !== null && diff <= 7) {
        withinTargetCount++;
      }
    }
    
    const total = ptbirs.length + ptcbirs.length;
  const rate = total > 0 ? Math.round((withinTargetCount / total) * 100) : 0;
  let remark = 'Very Poor';
    if (rate >= 91) remark = 'Outstanding';
    else if (rate >= 81) remark = 'Excellent';
    else if (rate >= 61) remark = 'Very Good';
    else if (rate >= 41) remark = 'Satisfactory';
    else if (rate >= 21) remark = 'Needs Improvement';
  
  birData.push({
    division: 'All Divisions',
    total,
    completed: withinTargetCount,
    rate,
    remark
  });
  
  return {
    month: monthInfo.label,
    workingDays,
    employees: employeesData,
    birData
  };
}

module.exports = {
  getProductTeamPerformanceData,
  getCommercialPerformanceData,
  getRepairTeamPerformanceData,
  getPerformanceReviewOptions,
  getPerformanceReviewData,
};
