const AppSetting = require('../models/AppSetting');

const ESCALATION_TIMES_KEY = 'escalation_times';
const ESCALATION_SCHEDULE_KEY = 'escalation_schedule';

const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

const DEFAULT_ESCALATION_GROUPS = [
  { reportType: 'main_combined',                label: 'Dispatch Escalation',           defaultRunCount: 2, defaultTimes: ['11:30', '18:15', '20:00', '22:00'],   defaultWeekdays: ALL_WEEKDAYS },
  { reportType: 'sr_escalation',                label: 'DR Replacement',                defaultRunCount: 2, defaultTimes: ['11:00', '15:00', '18:00', '20:00'],   defaultWeekdays: ALL_WEEKDAYS },
  { reportType: 'to_escalation',                label: 'TO Escalation',                 defaultRunCount: 2, defaultTimes: ['11:00', '16:30', '18:30', '20:30'],   defaultWeekdays: ALL_WEEKDAYS },
  { reportType: 'ur_scrap',                     label: 'Scrap Escalation',              defaultRunCount: 1, defaultTimes: ['11:00', '15:00', '18:00', '20:00'],   defaultWeekdays: ALL_WEEKDAYS },
  { reportType: 'ur_followup',                  label: 'Stock Escalation',              defaultRunCount: 1, defaultTimes: ['20:00', '22:00', '23:00', '23:59'],   defaultWeekdays: ALL_WEEKDAYS },
  { reportType: 'prf_ob_escalation',            label: 'PRF/OB Escalation',            defaultRunCount: 1, defaultTimes: ['16:30', '18:30', '20:30', '22:30'],   defaultWeekdays: ALL_WEEKDAYS },
  { reportType: 'supplier_warranty_escalation', label: 'Supplier Warranty Escalation', defaultRunCount: 1, defaultTimes: ['20:30', '22:30', '23:30', '23:59'],   defaultWeekdays: ALL_WEEKDAYS },
  { reportType: 'external_repair_escalation',   label: 'External Repair Escalation',   defaultRunCount: 1, defaultTimes: ['15:30', '18:30', '20:30', '22:30'],   defaultWeekdays: ALL_WEEKDAYS },
];

const MAX_RUNS_PER_DAY = 4;

// Generate slots and times dynamically
const DEFAULT_ESCALATION_TIMES = [];
DEFAULT_ESCALATION_GROUPS.forEach(group => {
  group.slots = [];
  for (let i = 0; i < MAX_RUNS_PER_DAY; i++) {
    const key = `${group.reportType}_slot_${i + 1}`;
    group.slots.push(key);
    DEFAULT_ESCALATION_TIMES.push({
      key,
      reportType: group.reportType,
      label: `Send Time ${i + 1}`,
      defaultTime: group.defaultTimes[i] || '11:00',
      order: i + 1
    });
  }
});

const DEFAULT_TIME_MAP = DEFAULT_ESCALATION_TIMES.reduce((acc, item) => {
  acc[item.key] = item.defaultTime;
  return acc;
}, {});

const SLOT_REPORT_TYPE_MAP = DEFAULT_ESCALATION_GROUPS.reduce((acc, group) => {
  group.slots.forEach((slot) => {
    acc[slot] = group.reportType;
  });
  return acc;
}, {});

function parseTime(value, fallback = '00:00') {
  const text = String(value || fallback || '').trim();
  const match = text.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return parseTime(fallback, '00:00');
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return parseTime(fallback, '00:00');
  return { hour, minute, value: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`, minutes: hour * 60 + minute };
}

function formatTimeLabel(value) {
  const { hour, minute } = parseTime(value);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, '0')} ${suffix}`;
}

function normalizeTimeMap(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  return DEFAULT_ESCALATION_TIMES.reduce((acc, item) => {
    acc[item.key] = parseTime(source[item.key], item.defaultTime).value;
    return acc;
  }, {});
}

function normalizeScheduleConfig(value = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const sourceRunCounts = source.runCounts && typeof source.runCounts === 'object' ? source.runCounts : source;
  const sourceWeekdays = source.weekdays && typeof source.weekdays === 'object' ? source.weekdays : {};
  const runCounts = DEFAULT_ESCALATION_GROUPS.reduce((acc, group) => {
    const max = group.slots.length;
    const raw = Number.parseInt(sourceRunCounts[group.reportType], 10);
    const count = Number.isFinite(raw) ? raw : group.defaultRunCount;
    acc[group.reportType] = Math.min(max, Math.max(1, count));
    return acc;
  }, {});
  const weekdays = DEFAULT_ESCALATION_GROUPS.reduce((acc, group) => {
    // Use DB-stored weekdays if present; otherwise fall back to ALL_WEEKDAYS (run every day)
    const stored = sourceWeekdays[group.reportType];
    if (Array.isArray(stored) && stored.length > 0) {
      let days = stored.map(Number).filter(d => d >= 0 && d <= 6);
      if (group.reportType === 'ur_followup' && !days.includes(6)) {
        days.push(6);
        days.sort((a, b) => a - b);
      }
      acc[group.reportType] = days;
    } else {
      acc[group.reportType] = group.defaultWeekdays || ALL_WEEKDAYS;
    }
    return acc;
  }, {});
  return { runCounts, weekdays };
}

async function getEscalationTimeMap() {
  const doc = await AppSetting.findOne({ key: ESCALATION_TIMES_KEY }).lean();
  return normalizeTimeMap(doc?.value || {});
}

async function saveEscalationTimeMap(times = {}, updatedBy = '') {
  const normalized = normalizeTimeMap(times);
  const saved = await AppSetting.findOneAndUpdate(
    { key: ESCALATION_TIMES_KEY },
    { $set: { value: normalized, updatedBy } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
  return normalizeTimeMap(saved?.value || normalized);
}

async function getEscalationScheduleConfig() {
  const doc = await AppSetting.findOne({ key: ESCALATION_SCHEDULE_KEY }).lean();
  return normalizeScheduleConfig(doc?.value || {});
}

async function saveEscalationScheduleConfig(config = {}, updatedBy = '') {
  const normalized = normalizeScheduleConfig(config);
  const saved = await AppSetting.findOneAndUpdate(
    { key: ESCALATION_SCHEDULE_KEY },
    { $set: { value: normalized, updatedBy } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
  return normalizeScheduleConfig(saved?.value || normalized);
}

function getEnabledEscalationSlots(config = {}) {
  const normalized = normalizeScheduleConfig(config);
  return new Set(DEFAULT_ESCALATION_GROUPS.flatMap((group) => {
    const count = normalized.runCounts[group.reportType] || group.defaultRunCount;
    return group.slots.slice(0, count);
  }));
}

function getEscalationGroup(reportType) {
  return DEFAULT_ESCALATION_GROUPS.find((group) => group.reportType === reportType) || null;
}

function getEnabledSlotsForReportType(reportType, config = {}) {
  const group = getEscalationGroup(reportType);
  if (!group) return [];
  const enabledSlots = getEnabledEscalationSlots(config);
  return group.slots.filter((slot) => enabledSlots.has(slot));
}

function getReportTypeForSlot(slot) {
  return SLOT_REPORT_TYPE_MAP[slot] || '';
}

function isEscalationReportAllowedOnDay(reportType, day, config = {}) {
  const normalized = normalizeScheduleConfig(config);
  const days = normalized.weekdays[reportType] || ALL_WEEKDAYS;
  return days.includes(day);
}

function isEscalationSlotAllowedOnDay(slot, day, config = {}) {
  const reportType = getReportTypeForSlot(slot);
  return reportType ? isEscalationReportAllowedOnDay(reportType, day, config) : true;
}

function applyEscalationTimes(times = DEFAULT_TIME_MAP, scheduleConfig = {}) {
  const normalized = normalizeTimeMap(times);
  const enabledSlots = getEnabledEscalationSlots(scheduleConfig);
  return DEFAULT_ESCALATION_TIMES.map((item) => ({
    ...item,
    time: normalized[item.key],
    timeLabel: formatTimeLabel(normalized[item.key]),
    enabled: enabledSlots.has(item.key),
  }));
}

module.exports = {
  ESCALATION_TIMES_KEY,
  ESCALATION_SCHEDULE_KEY,
  DEFAULT_ESCALATION_TIMES,
  DEFAULT_ESCALATION_GROUPS,
  DEFAULT_TIME_MAP,
  ALL_WEEKDAYS,
  parseTime,
  formatTimeLabel,
  normalizeTimeMap,
  normalizeScheduleConfig,
  getEscalationTimeMap,
  saveEscalationTimeMap,
  getEscalationScheduleConfig,
  saveEscalationScheduleConfig,
  getEnabledEscalationSlots,
  getEscalationGroup,
  getEnabledSlotsForReportType,
  getReportTypeForSlot,
  isEscalationReportAllowedOnDay,
  isEscalationSlotAllowedOnDay,
  applyEscalationTimes,
};
