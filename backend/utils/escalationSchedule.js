const AppSetting = require('../models/AppSetting');

const ESCALATION_TIMES_KEY = 'escalation_times';
const ESCALATION_SCHEDULE_KEY = 'escalation_schedule';

const DEFAULT_ESCALATION_TIMES = [
  { key: 'morning', reportType: 'main_combined', label: 'Dispatch Send Time 1', defaultTime: '11:30', order: 1 },
  { key: 'evening', reportType: 'main_combined', label: 'Dispatch Send Time 2', defaultTime: '18:15', order: 2 },
  { key: 'sr_morning', reportType: 'sr_escalation', label: 'FRN Replacement Send Time 1', defaultTime: '11:00', order: 1 },
  { key: 'sr_afternoon', reportType: 'sr_escalation', label: 'FRN Replacement Send Time 2', defaultTime: '15:00', order: 2 },
  { key: 'to_morning', reportType: 'to_escalation', label: 'In House FRN Replacement Send Time 1', defaultTime: '11:00', order: 1 },
  { key: 'to_evening', reportType: 'to_escalation', label: 'In House FRN Replacement Send Time 2', defaultTime: '16:30', order: 2 },
  { key: 'ur_scrap', reportType: 'ur_scrap', label: 'Under Repair Scrap Send Time', defaultTime: '11:00', order: 1 },
  { key: 'ur_followup', reportType: 'ur_followup', label: 'Stock Escalation Send Time', defaultTime: '20:00', order: 1 },
  { key: 'prf_ob', reportType: 'prf_ob_escalation', label: 'PRF/OB Send Time', defaultTime: '16:30', order: 1 },
  { key: 'supplier_warranty', reportType: 'supplier_warranty_escalation', label: 'Supplier Warranty Send Time', defaultTime: '20:30', order: 1 },
  { key: 'external_repair', reportType: 'external_repair_escalation', label: 'External Repair Send Time', defaultTime: '15:30', order: 1 },
];

const DEFAULT_ESCALATION_GROUPS = [
  { reportType: 'main_combined', label: 'Dispatch Escalation', slots: ['morning', 'evening'], defaultRunCount: 2 },
  { reportType: 'sr_escalation', label: 'FRN Replacement Escalation', slots: ['sr_morning', 'sr_afternoon'], defaultRunCount: 2 },
  { reportType: 'to_escalation', label: 'In House FRN Replacement', slots: ['to_morning', 'to_evening'], defaultRunCount: 2 },
  { reportType: 'ur_scrap', label: 'Under Repair Scrap Escalation', slots: ['ur_scrap'], defaultRunCount: 1 },
  { reportType: 'ur_followup', label: 'Stock Escalation', slots: ['ur_followup'], defaultRunCount: 1 },
  { reportType: 'prf_ob_escalation', label: 'PRF/OB Escalation', slots: ['prf_ob'], defaultRunCount: 1 },
  { reportType: 'supplier_warranty_escalation', label: 'Supplier Warranty Escalation', slots: ['supplier_warranty'], defaultRunCount: 1 },
  { reportType: 'external_repair_escalation', label: 'External Repair Escalation', slots: ['external_repair'], defaultRunCount: 1 },
];

const DEFAULT_TIME_MAP = DEFAULT_ESCALATION_TIMES.reduce((acc, item) => {
  acc[item.key] = item.defaultTime;
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
  const runCounts = DEFAULT_ESCALATION_GROUPS.reduce((acc, group) => {
    const max = group.slots.length;
    const raw = Number.parseInt(sourceRunCounts[group.reportType], 10);
    const count = Number.isFinite(raw) ? raw : group.defaultRunCount;
    acc[group.reportType] = Math.min(max, Math.max(1, count));
    return acc;
  }, {});
  return { runCounts };
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
  parseTime,
  formatTimeLabel,
  normalizeTimeMap,
  normalizeScheduleConfig,
  getEscalationTimeMap,
  saveEscalationTimeMap,
  getEscalationScheduleConfig,
  saveEscalationScheduleConfig,
  getEnabledEscalationSlots,
  applyEscalationTimes,
};
