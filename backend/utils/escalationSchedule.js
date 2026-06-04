const AppSetting = require('../models/AppSetting');

const ESCALATION_TIMES_KEY = 'escalation_times';

const DEFAULT_ESCALATION_TIMES = [
  { key: 'morning', reportType: 'main_combined', label: 'Dispatch Morning', defaultTime: '11:30' },
  { key: 'evening', reportType: 'main_combined', label: 'Dispatch Evening', defaultTime: '18:15' },
  { key: 'sr_morning', reportType: 'sr_escalation', label: 'FRN Replacement Morning', defaultTime: '11:00' },
  { key: 'sr_afternoon', reportType: 'sr_escalation', label: 'FRN Replacement Afternoon', defaultTime: '15:00' },
  { key: 'to_morning', reportType: 'to_escalation', label: 'In House FRN Replacement Morning', defaultTime: '11:00' },
  { key: 'to_evening', reportType: 'to_escalation', label: 'In House FRN Replacement Evening', defaultTime: '16:30' },
  { key: 'ur_scrap', reportType: 'ur_scrap', label: 'Under Repair Scrap Sunday', defaultTime: '11:00' },
  { key: 'ur_followup', reportType: 'ur_followup', label: 'Stock Escalation Daily', defaultTime: '20:00' },
  { key: 'prf_ob', reportType: 'prf_ob_escalation', label: 'PRF/OB Daily', defaultTime: '16:30' },
  { key: 'supplier_warranty', reportType: 'supplier_warranty_escalation', label: 'Supplier Warranty Tue/Fri', defaultTime: '20:30' },
  { key: 'external_repair', reportType: 'external_repair_escalation', label: 'External Repair Daily', defaultTime: '15:30' },
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

function applyEscalationTimes(times = DEFAULT_TIME_MAP) {
  const normalized = normalizeTimeMap(times);
  return DEFAULT_ESCALATION_TIMES.map((item) => ({
    ...item,
    time: normalized[item.key],
    timeLabel: formatTimeLabel(normalized[item.key]),
  }));
}

module.exports = {
  ESCALATION_TIMES_KEY,
  DEFAULT_ESCALATION_TIMES,
  DEFAULT_TIME_MAP,
  parseTime,
  formatTimeLabel,
  normalizeTimeMap,
  getEscalationTimeMap,
  saveEscalationTimeMap,
  applyEscalationTimes,
};
