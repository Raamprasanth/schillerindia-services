const AppSetting = require('../models/AppSetting');

const ESCALATION_LABELS_KEY = 'escalation_labels';

const DEFAULT_ESCALATION_TYPES = [
  { value: 'all_escalation', label: 'All Escalation' },
  { value: 'main_combined', label: 'Dispatch Escalation' },
  { value: 'pending_frn', label: 'Pending FRN Escalation' },
  { value: 'estimation_pending', label: 'Estimation Pending Escalation' },
  { value: 'sr_escalation', label: 'FRN Replacement Escalation' },
  { value: 'to_escalation', label: 'In House FRN Replacement' },
  { value: 'ur_followup', label: 'Stock Escalation' },
  { value: 'ur_scrap', label: 'Under Repair Scrap Escalation' },
  { value: 'prf_ob_escalation', label: 'PRF/OB Escalation' },
  { value: 'supplier_warranty_escalation', label: 'Supplier Warranty Escalation' },
  { value: 'external_repair_escalation', label: 'External Repair Escalation' },
];

const DEFAULT_LABEL_MAP = DEFAULT_ESCALATION_TYPES.reduce((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {});

function cleanLabel(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeLabelMap(value = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return DEFAULT_ESCALATION_TYPES.reduce((acc, item) => {
    acc[item.value] = cleanLabel(source[item.value]) || item.label;
    return acc;
  }, {});
}

async function getEscalationLabelMap() {
  const doc = await AppSetting.findOne({ key: ESCALATION_LABELS_KEY }).lean();
  return normalizeLabelMap(doc?.value);
}

async function saveEscalationLabelMap(labels = {}, updatedBy = '') {
  const normalized = normalizeLabelMap(labels);
  const saved = await AppSetting.findOneAndUpdate(
    { key: ESCALATION_LABELS_KEY },
    { $set: { value: normalized, updatedBy } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
  return normalizeLabelMap(saved?.value || normalized);
}

function applyEscalationTypeLabels(types = DEFAULT_ESCALATION_TYPES, labels = DEFAULT_LABEL_MAP) {
  const labelMap = normalizeLabelMap(labels);
  return types.map((item) => ({
    value: item.value,
    label: labelMap[item.value] || item.label,
    defaultLabel: DEFAULT_LABEL_MAP[item.value] || item.label,
  }));
}

async function getEscalationTypesWithLabels() {
  const labels = await getEscalationLabelMap();
  return applyEscalationTypeLabels(DEFAULT_ESCALATION_TYPES, labels);
}

function labelFor(labels, key) {
  const labelMap = normalizeLabelMap(labels);
  return labelMap[key] || DEFAULT_LABEL_MAP[key] || key;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function composeSlotLabel(labels, reportType, fallbackSlotLabel) {
  const base = labelFor(labels, reportType);
  const fallback = cleanLabel(fallbackSlotLabel);
  if (!fallback) return base;
  const normalizedBase = base.toLowerCase().replace(/\s+escalation$/, '').trim();
  const normalizedFallback = fallback.toLowerCase();
  if (normalizedBase && normalizedFallback.includes(normalizedBase)) {
    return fallback.replace(new RegExp(escapeRegExp(normalizedBase), 'i'), base.replace(/\s+Escalation$/i, ''));
  }
  if (/morning|afternoon|evening|daily|weekly|follow-up|scrap|tue|fri|tuesday|friday/i.test(fallback)) {
    return `${base} - ${fallback}`;
  }
  return base;
}

module.exports = {
  ESCALATION_LABELS_KEY,
  DEFAULT_ESCALATION_TYPES,
  getEscalationLabelMap,
  saveEscalationLabelMap,
  applyEscalationTypeLabels,
  getEscalationTypesWithLabels,
  labelFor,
  composeSlotLabel,
};
