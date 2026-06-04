const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const mongoose = require('mongoose');

const Empfrn = require('../models/EmpFRN');
const EstimationPending = require('../models/EstimationPending');
const EscalationRunLog = require('../models/EscalationRunLog');
const EscalationQueue = require('../models/EscalationQueue');
const AppSetting = require('../models/AppSetting');

const IST_OFFSET_MINUTES = 330;
const IST_OFFSET_MS = IST_OFFSET_MINUTES * 60 * 1000;
const REPORT_DIR = path.join(__dirname, '..', 'generated-reports', 'escalations');
const PYTHON_SCRIPT = path.join(__dirname, '..', 'scripts', 'send_escalation_mail.py');
const BUNDLED_PYTHON = path.join(os.homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'python', process.platform === 'win32' ? 'python.exe' : 'bin/python');
const MAIL_ATTEMPTS = Math.max(1, parseInt(process.env.ESCALATION_MAIL_ATTEMPTS || '2', 10) || 2);
const UR_DAILY_TYPES = ['UR Stock', 'WS Stock', 'External Repair', 'Completed', 'Supplier Warrenty', 'No Fault', 'Given to PSP'];
const CUSTOM_ESCALATIONS = {
  prf_ob: {
    slot: 'prf_ob',
    category: 'prf_ob',
    module: 'prf_ob',
    reportType: 'prf_ob_escalation',
    slotLabel: 'PRF/OB Daily',
    title: 'PRF/OB Escalation Report',
    reportPrefix: 'prf-ob-escalation',
    template: 'PRF-OB Escalation',
    headerRow: 3,
    runHour: 16,
    runMinute: 30,
  },
  supplier_warranty: {
    slot: 'supplier_warranty',
    category: 'supplier_warranty',
    module: 'supplier_warranty',
    reportType: 'supplier_warranty_escalation',
    slotLabel: 'Supplier Warranty Tue/Fri',
    title: 'Supplier Warranty Escalation Report',
    reportPrefix: 'supplier-warranty-escalation',
    template: 'Supplier',
    runHour: 20,
    runMinute: 30,
  },
  external_repair: {
    slot: 'external_repair',
    category: 'external_repair',
    module: 'external_repair',
    reportType: 'external_repair_escalation',
    slotLabel: 'External Repair Daily',
    title: 'External Repair Escalation Report',
    reportPrefix: 'external-repair-escalation',
    template: 'External repairs',
    runHour: 15,
    runMinute: 30,
  },
};

function splitCsv(value) {
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function toBool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return !!fallback;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n', 'off'].includes(normalized)) return false;
  return !!fallback;
}

async function getEscalationRecipients(reportType = '') {
  try {
    const doc = await AppSetting.findOne({ key: 'escalation_emails' }).lean();
    const configuredEntries = Array.isArray(doc?.value) ? doc.value : [];
    const normalizedReportType = String(reportType || '').trim();
    const configured = configuredEntries
      .filter((item) => {
        if (!item || typeof item !== 'object') return !normalizedReportType;
        if (!normalizedReportType) return true;
        const itemType = String(item.reportType || '').trim();
        return itemType === normalizedReportType || itemType === 'all_escalation';
      })
      .map((item) => {
        if (item && typeof item === 'object' && item.email) return String(item.email).trim();
        return String(item || '').trim();
      })
      .filter(Boolean);
    if (configured.length) return Array.from(new Set(configured));
  } catch (_) {}
  return splitCsv(process.env.ESCALATION_EMAIL_TO);
}

async function getEscalationSenderConfig() {
  try {
    const doc = await AppSetting.findOne({ key: 'escalation_sender' }).lean();
    const value = doc?.value && typeof doc.value === 'object' ? doc.value : {};
    const smtpHost = String(value.smtpHost || process.env.ESCALATION_SMTP_HOST || '').trim();
    const smtpPort = String(value.smtpPort || process.env.ESCALATION_SMTP_PORT || '587').trim() || '587';
    const smtpUser = String(value.smtpUser || process.env.ESCALATION_SMTP_USER || '').trim();
    const smtpPass = String(value.smtpPass || process.env.ESCALATION_SMTP_PASS || '').trim();
    const fromEmail = String(value.fromEmail || process.env.ESCALATION_EMAIL_FROM || smtpUser).trim();
    const startTls = toBool(value.startTls, String(process.env.ESCALATION_SMTP_STARTTLS || 'true').trim().toLowerCase() !== 'false');
    const ssl = toBool(value.ssl, String(process.env.ESCALATION_SMTP_SSL || 'false').trim().toLowerCase() === 'true');
    return { smtpHost, smtpPort, smtpUser, smtpPass, fromEmail, startTls, ssl };
  } catch (_) {
    return {
      smtpHost: String(process.env.ESCALATION_SMTP_HOST || '').trim(),
      smtpPort: String(process.env.ESCALATION_SMTP_PORT || '587').trim() || '587',
      smtpUser: String(process.env.ESCALATION_SMTP_USER || '').trim(),
      smtpPass: String(process.env.ESCALATION_SMTP_PASS || '').trim(),
      fromEmail: String(process.env.ESCALATION_EMAIL_FROM || process.env.ESCALATION_SMTP_USER || '').trim(),
      startTls: String(process.env.ESCALATION_SMTP_STARTTLS || 'true').trim().toLowerCase() !== 'false',
      ssl: String(process.env.ESCALATION_SMTP_SSL || 'false').trim().toLowerCase() === 'true',
    };
  }
}

function getEscalationSenderConfigError(sender = {}) {
  if (!String(sender.smtpHost || '').trim()) return 'Escalation sender SMTP host is not configured.';
  if (!String(sender.fromEmail || '').trim()) return 'Escalation sender from email is not configured.';
  return '';
}

async function getReadyEscalationSenderConfig() {
  const sender = await getEscalationSenderConfig();
  const error = getEscalationSenderConfigError(sender);
  if (error) {
    const err = new Error(error);
    err.code = 'ESCALATION_SENDER_NOT_CONFIGURED';
    throw err;
  }
  return sender;
}

function isSkippedEscalationError(error) {
  return error && error.code === 'ESCALATION_SENDER_NOT_CONFIGURED';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toIstDate(date = new Date()) {
  return new Date(date.getTime() + IST_OFFSET_MS);
}

function getIstParts(date = new Date()) {
  const ist = toIstDate(date);
  return {
    year: ist.getUTCFullYear(),
    month: ist.getUTCMonth() + 1,
    day: ist.getUTCDate(),
    hour: ist.getUTCHours(),
    minute: ist.getUTCMinutes(),
  };
}

function makeUtcFromIst(year, month, day, hour, minute, second = 0, ms = 0) {
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second, ms) - IST_OFFSET_MS);
}

function getPreviousIstDateParts(parts) {
  const current = makeUtcFromIst(parts.year, parts.month, parts.day, 0, 0, 0, 0);
  const previous = toIstDate(new Date(current.getTime() - 24 * 60 * 60 * 1000));
  return {
    year: previous.getUTCFullYear(),
    month: previous.getUTCMonth() + 1,
    day: previous.getUTCDate(),
  };
}

function addIstDays(parts, days) {
  const base = makeUtcFromIst(parts.year, parts.month, parts.day, 0, 0, 0, 0);
  const shifted = toIstDate(new Date(base.getTime() + days * 24 * 60 * 60 * 1000));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function getNextSupplierWarrantyRun(parts, referenceDate) {
  const weekday = toIstDate(referenceDate).getUTCDay();
  const minutes = parts.hour * 60 + parts.minute;
  const runMinutes = 20 * 60 + 30;
  if (weekday === 2 && minutes <= runMinutes) return { parts, label: 'Supplier Warranty Tuesday', startOffset: -4 };
  if (weekday === 5 && minutes <= runMinutes) return { parts, label: 'Supplier Warranty Friday', startOffset: -3 };
  const daysUntilTuesday = (9 - weekday) % 7 || 7;
  const daysUntilFriday = (12 - weekday) % 7 || 7;
  if (daysUntilTuesday < daysUntilFriday) {
    return { parts: addIstDays(parts, daysUntilTuesday), label: 'Supplier Warranty Tuesday', startOffset: -4 };
  }
  return { parts: addIstDays(parts, daysUntilFriday), label: 'Supplier Warranty Friday', startOffset: -3 };
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function formatIstStamp(date) {
  const parts = getIstParts(date);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)} ${pad(parts.hour)}:${pad(parts.minute)} IST`;
}

function getSlotWindow(slot, referenceDate = new Date()) {
  const nowIst = getIstParts(referenceDate);
  if (slot === 'morning') {
    const prev = getPreviousIstDateParts(nowIst);
    return {
      slot,
      slotLabel: 'Morning',
      jobDate: `${nowIst.year}-${pad(nowIst.month)}-${pad(nowIst.day)}`,
      windowStart: makeUtcFromIst(prev.year, prev.month, prev.day, 16, 1, 0, 0),
      windowEnd: makeUtcFromIst(nowIst.year, nowIst.month, nowIst.day, 11, 29, 59, 999),
    };
  }
  return {
    slot,
    slotLabel: 'Evening',
    jobDate: `${nowIst.year}-${pad(nowIst.month)}-${pad(nowIst.day)}`,
    windowStart: makeUtcFromIst(nowIst.year, nowIst.month, nowIst.day, 11, 30, 0, 0),
    windowEnd: makeUtcFromIst(nowIst.year, nowIst.month, nowIst.day, 15, 59, 59, 999),
  };
}

function getSrSlotWindow(slot, referenceDate = new Date()) {
  const nowIst = getIstParts(referenceDate);
  if (slot === 'sr_morning') {
    const prev = getPreviousIstDateParts(nowIst);
    return {
      slot,
      category: 'sr',
      slotLabel: 'SR Morning',
      jobDate: `${nowIst.year}-${pad(nowIst.month)}-${pad(nowIst.day)}`,
      windowStart: makeUtcFromIst(prev.year, prev.month, prev.day, 16, 0, 0, 0),
      windowEnd: makeUtcFromIst(nowIst.year, nowIst.month, nowIst.day, 10, 59, 59, 999),
      reportName: `sr-escalation-morning-${nowIst.year}-${pad(nowIst.month)}-${pad(nowIst.day)}.xlsx`,
    };
  }
  return {
    slot,
    category: 'sr',
    slotLabel: 'SR Afternoon',
    jobDate: `${nowIst.year}-${pad(nowIst.month)}-${pad(nowIst.day)}`,
    windowStart: makeUtcFromIst(nowIst.year, nowIst.month, nowIst.day, 11, 0, 0, 0),
    windowEnd: makeUtcFromIst(nowIst.year, nowIst.month, nowIst.day, 14, 59, 59, 999),
    reportName: `sr-escalation-afternoon-${nowIst.year}-${pad(nowIst.month)}-${pad(nowIst.day)}.xlsx`,
  };
}

function getToSlotWindow(slot, referenceDate = new Date()) {
  const nowIst = getIstParts(referenceDate);
  if (slot === 'to_morning') {
    const prev = getPreviousIstDateParts(nowIst);
    return {
      slot,
      category: 'to',
      slotLabel: 'TO Morning',
      jobDate: `${nowIst.year}-${pad(nowIst.month)}-${pad(nowIst.day)}`,
      windowStart: makeUtcFromIst(prev.year, prev.month, prev.day, 16, 30, 0, 0),
      windowEnd: makeUtcFromIst(nowIst.year, nowIst.month, nowIst.day, 10, 59, 59, 999),
      reportName: `to-escalation-morning-${nowIst.year}-${pad(nowIst.month)}-${pad(nowIst.day)}.xlsx`,
    };
  }
  return {
    slot,
    category: 'to',
    slotLabel: 'TO Evening',
    jobDate: `${nowIst.year}-${pad(nowIst.month)}-${pad(nowIst.day)}`,
    windowStart: makeUtcFromIst(nowIst.year, nowIst.month, nowIst.day, 11, 0, 0, 0),
    windowEnd: makeUtcFromIst(nowIst.year, nowIst.month, nowIst.day, 16, 29, 59, 999),
    reportName: `to-escalation-evening-${nowIst.year}-${pad(nowIst.month)}-${pad(nowIst.day)}.xlsx`,
  };
}

function getPreviousSundayIstDateParts(parts) {
  const current = makeUtcFromIst(parts.year, parts.month, parts.day, 0, 0, 0, 0);
  const currentIst = toIstDate(current);
  const weekday = currentIst.getUTCDay();
  const previous = toIstDate(new Date(current.getTime() - 7 * 24 * 60 * 60 * 1000));
  if (weekday === 0) {
    return {
      year: previous.getUTCFullYear(),
      month: previous.getUTCMonth() + 1,
      day: previous.getUTCDate(),
    };
  }
  const sunday = toIstDate(new Date(current.getTime() - weekday * 24 * 60 * 60 * 1000));
  return {
    year: sunday.getUTCFullYear(),
    month: sunday.getUTCMonth() + 1,
    day: sunday.getUTCDate(),
  };
}

function getUrSlotWindow(slot, referenceDate = new Date()) {
  const nowIst = getIstParts(referenceDate);
  if (slot === 'ur_scrap') {
    const previousSunday = getPreviousSundayIstDateParts(nowIst);
    return {
      slot,
      category: 'ur_scrap',
      slotLabel: 'Weekly Scrap',
      jobDate: `${nowIst.year}-${pad(nowIst.month)}-${pad(nowIst.day)}`,
      windowStart: makeUtcFromIst(previousSunday.year, previousSunday.month, previousSunday.day, 11, 0, 0, 0),
      windowEnd: makeUtcFromIst(nowIst.year, nowIst.month, nowIst.day, 10, 59, 59, 999),
      reportName: `ur-scrap-escalation-${nowIst.year}-${pad(nowIst.month)}-${pad(nowIst.day)}.xlsx`,
    };
  }
  const prev = getPreviousIstDateParts(nowIst);
  return {
    slot,
    category: 'ur_followup',
    slotLabel: 'Daily Under Repair Follow-up',
    jobDate: `${nowIst.year}-${pad(nowIst.month)}-${pad(nowIst.day)}`,
    windowStart: makeUtcFromIst(prev.year, prev.month, prev.day, 20, 0, 0, 0),
    windowEnd: makeUtcFromIst(nowIst.year, nowIst.month, nowIst.day, 19, 59, 59, 999),
    reportName: `ur-followup-escalation-${nowIst.year}-${pad(nowIst.month)}-${pad(nowIst.day)}.xlsx`,
  };
}

function getCustomEscalationSlotWindow(slot, referenceDate = new Date()) {
  const config = CUSTOM_ESCALATIONS[slot];
  if (!config) throw new Error(`Unknown escalation slot: ${slot}`);
  const nowIst = getIstParts(referenceDate);
  if (slot === 'supplier_warranty') {
    const run = getNextSupplierWarrantyRun(nowIst, referenceDate);
    const start = addIstDays(run.parts, run.startOffset);
    const runAt = makeUtcFromIst(run.parts.year, run.parts.month, run.parts.day, config.runHour, config.runMinute, 0, 0);
    const scheduledRunTime = Math.abs(referenceDate.getTime() - runAt.getTime()) < 60 * 1000;
    return {
      ...config,
      slotLabel: run.label,
      jobDate: `${run.parts.year}-${pad(run.parts.month)}-${pad(run.parts.day)}`,
      windowStart: makeUtcFromIst(start.year, start.month, start.day, 20, 31, 0, 0),
      windowEnd: scheduledRunTime ? new Date(runAt.getTime() - 60 * 1000) : referenceDate,
      reportName: `${config.reportPrefix}-${run.parts.year}-${pad(run.parts.month)}-${pad(run.parts.day)}.xlsx`,
    };
  }
  const prev = getPreviousIstDateParts(nowIst);
  const runAt = makeUtcFromIst(nowIst.year, nowIst.month, nowIst.day, config.runHour, config.runMinute, 0, 0);
  return {
    ...config,
    jobDate: `${nowIst.year}-${pad(nowIst.month)}-${pad(nowIst.day)}`,
    windowStart: makeUtcFromIst(prev.year, prev.month, prev.day, config.runHour, config.runMinute, 0, 0),
    windowEnd: new Date(runAt.getTime() - 1),
    reportName: `${config.reportPrefix}-${nowIst.year}-${pad(nowIst.month)}-${pad(nowIst.day)}.xlsx`,
  };
}

function getSlotsForCurrentTime(date = new Date()) {
  const parts = getIstParts(date);
  const slots = [];
  if (parts.hour === 11 && parts.minute === 0) {
    slots.push('sr_morning');
    slots.push('to_morning');
    if (toIstDate(date).getUTCDay() === 0) slots.push('ur_scrap');
  }
  if (parts.hour === 11 && parts.minute === 30) slots.push('morning');
  if (parts.hour === 15 && parts.minute === 0) slots.push('sr_afternoon');
  if (parts.hour === 15 && parts.minute === 30) {
    slots.push('external_repair');
  }
  if (parts.hour === 20 && parts.minute === 30 && [2, 5].includes(toIstDate(date).getUTCDay())) {
    slots.push('supplier_warranty');
  }
  if (parts.hour === 16 && parts.minute === 30) {
    slots.push('to_evening');
    slots.push('prf_ob');
  }
  if (parts.hour === 16 && parts.minute === 0) slots.push('evening');
  if (parts.hour === 20 && parts.minute === 0) slots.push('ur_followup');
  return slots;
}

function buildJobKey(slotWindow) {
  return `${slotWindow.jobDate}-${slotWindow.slot}`;
}

function buildFrnEscalationRow(doc) {
  return {
    'DIVISION NAME': doc.divisionName || doc.division || '',
    'SCH REF': doc.scRno || doc.scReNo || '',
    RA_ENGINEER: doc.raEng || doc.estRaEng || '',
    SC_ENGINEER: doc.scEng || '',
    FRN_NO: doc.frnNo || '',
    BRANCH: doc.branch || doc.region || '',
    ENGINEER_ID: doc.eng || '',
    ENGINEER_NAME: doc.eng || doc.engineer || '',
    CUST_NAME: doc.customer || doc.custName || '',
    PRODUCT_MODEL: doc.model || '',
    UNIT_STATUS: doc.unitStatus || doc.unitSts || '',
    DEF_MOD_BRD_NAME: doc.defMod || '',
    MOD_BRD_NAME: doc.defMod || '',
    DEF_GIR_NO: doc.defGir || '',
    'PART NUMBER': doc.partNo || '',
    PART_NO: doc.partNo || '',
    'ITEM DESCRIPTION': doc.partsDescription || doc.itemDescription || '',
    REP_GIR_NO: doc.repGirNo || '',
    'RE VALUE': doc.revalue || '',
    DEF_UNIT_GIR_NO: doc.defUnitGir || '',
    FINAL_REMARKS: doc.finalRemarks || '',
    DESTINATION: doc.destination || '',
    'SHIPMENT REF NUMBER': doc.shipComm || doc.dcNo || doc.repGirNo || '',
    'REF DATE': (doc.toEscalationQueuedAt || doc.srEscalationQueuedAt || doc.escalationQueuedAt) ? new Date(doc.toEscalationQueuedAt || doc.srEscalationQueuedAt || doc.escalationQueuedAt).toISOString().replace('T', ' ').replace('Z', '') : '',
  };
}

function buildEstimationEscalationRow(doc) {
  return {
    'DIVISION NAME': doc.divisionName || doc.division || '',
    'Division Name': doc.divisionName || doc.division || '',
    'SCH REF': doc.scReNo || doc.scRno || '',
    RA_ENGINEER: doc.obRaEng || doc.estRaEng || '',
    SC_ENGINEER: doc.scEng || '',
    FRN_NO: doc.frnNo || '',
    BRANCH: doc.branch || doc.reg || '',
    ENGINEER_ID: doc.eng || doc.estRaEng || '',
    ENGINEER_NAME: doc.eng || doc.engineer || '',
    STK_CUST: doc.stkCust || '',
    CUST_NAME: doc.custName || doc.customer || '',
    PRODUCT_MODEL: doc.model || '',
    UNIT_STATUS: doc.unitSts || '',
    DEF_MOD_BRD_NAME: doc.defMod || '',
    MOD_BRD_NAME: doc.defMod || '',
    DEF_TYPE: doc.defType || '',
    DEF_GIR_NO: doc.defGir || '',
    'PART NUMBER': doc.partNo || '',
    PART_NO: doc.partNo || '',
    'ITEM DESCRIPTION': doc.partsDescription || doc.itemDescription || '',
    REP_GIR_NO: doc.obRepGirNo || doc.repGirNo || '',
    'RE VALUE': doc.revalue || '',
    DEF_UNIT_GIR_NO: doc.obDefUnitGir || doc.defUnitGir || '',
    FINAL_REMARKS: doc.finalRemarks || doc.obFinalRemarks || '',
    DESTINATION: doc.obDestination || doc.destination || '',
    'SHIPMENT REF NUMBER': doc.obShipComm || doc.obDcNo || doc.obRepGirNo || doc.estNo || '',
    'REF DATE': (doc.toEscalationQueuedAt || doc.srEscalationQueuedAt || doc.escalationQueuedAt) ? new Date(doc.toEscalationQueuedAt || doc.srEscalationQueuedAt || doc.escalationQueuedAt).toISOString().replace('T', ' ').replace('Z', '') : '',
  };
}

function normalizeToItems(items = []) {
  return (Array.isArray(items) ? items : []).map((item) => ({
    partNo: String(item?.partNo || '').trim(),
    qty: Math.max(1, parseInt(item?.qty, 10) || 1),
  })).filter((item) => item.partNo);
}

function buildToEscalationRow(doc, items = []) {
  return {
    'Division Name': doc.divisionName || doc.division || '',
    'SCH REF': doc.scRno || doc.scReNo || '',
    SC_REF_NO: doc.scRno || doc.scReNo || '',
    FRN_NO: doc.frnNo || '',
    STK_CUST: doc.stkCust || '',
    BRANCH: doc.branch || doc.reg || doc.region || '',
    CUST_NAME: doc.custName || doc.customer || '',
    PRODUCT_MODEL: doc.model || '',
    UNIT_STATUS: doc.unitSts || doc.unitStatus || '',
    DEF_GIR_NO: doc.defGir || '',
    MOD_BRD_NAME: doc.defMod || '',
    MODEL: doc.model || '',
    FINAL_REMARKS: doc.finalRemarks || '',
    TO_ITEMS: normalizeToItems(items),
    REF_DATE: (doc.toEscalationQueuedAt || new Date()).toISOString().replace('T', ' ').replace('Z', ''),
  };
}

function buildUrEscalationRow(doc) {
  return {
    'DIVISION NAME': doc.divisionName || doc.division || '',
    'SCH REF': doc.scReNo || doc.scRno || '',
    SC_REF_NO: doc.scReNo || doc.scRno || '',
    FRN_NO: doc.frnNo || '',
    DIVISION: doc.divisionName || doc.division || '',
    BRANCH: doc.branch || doc.reg || '',
    SC_ENGINEER: doc.scEng || '',
    RA_ENGINEER: doc.raEng || '',
    SUPPLIER_NAME: doc.supplier || '',
    ENGINEER_ID: doc.eng || '',
    CUSTOMER_NAME: doc.custName || doc.customer || '',
    MODEL: doc.model || '',
    PRODUCT_MODEL: doc.model || '',
    UNIT_STATUS: doc.unitSts || doc.unitStatus || '',
    DEF_MOD_BRD_NAME: doc.defMod || '',
    MOD_BRD_NAME: doc.defMod || '',
    DEF_TYPE: doc.defType || '',
    DEF_GIR_NO: doc.defGir || '',
    'PART NUMBER': doc.partNo || '',
    'ITEM DESCRIPTION': doc.partsDescription || doc.itemDescription || '',
    REP_GIR_NO: doc.repGirNo || '',
    TYPE_OF_WORK: doc.urTypeWork || doc.typeWork || '',
    TYPE_OF_ACC: doc.typeOfAcc || doc.unitStatus || '',
    FINAL_REMARKS: doc.finalRemarks || '',
    TECHNICAL_REMARKS: doc.techRemarks || '',
    TECH_REMARKS: doc.techRemarks || '',
    COMPONENTS_USED: doc.components || '',
    DESTINATION: doc.destination || '',
    'RE VALUE': doc.revalue || '',
    TIMESTAMP: new Date().toISOString().replace('T', ' ').replace('Z', ''),
    REF_DATE: new Date().toISOString().replace('T', ' ').replace('Z', ''),
  };
}

function buildPrfObEscalationRow(doc) {
  return {
    ENTRY_DATE: doc.entryDate || '',
    'ENTRY DATE': doc.entryDate || '',
    TYPE: doc.type || '',
    DIVISION: doc.division || '',
    DEALER: doc.dealer || '',
    REF_NO: doc.refNo || '',
    STATUS: doc.status || '',
    RECEIVED_DATE: doc.receivedDate || '',
    'RECEIVED DATE FROM SC': doc.receivedDate || '',
    'RAISED DATE': doc.raisedDate || doc.entryDate || '',
    SC_ENGINEER: doc.scEng || '',
    ENGINEER: doc.eng || '',
    REGION: doc.region || '',
    BRANCH: doc.branch || '',
    SUPPLIER: doc.supplier || '',
    MODEL: doc.model || '',
    'WARRENTY STATUS': doc.warrantyStatus || '',
    'PRF/OB REF NO.': doc.refNo || '',
    'CRM REF NO.': doc.crmRefNo || '',
    'PART TYPE': doc.partType || '',
    'PART DESCRIPTION': doc.partsDescription || '',
    SERIAL_NO: doc.serialNo || '',
    PART_NO: doc.partNo || '',
    QTY: doc.qty || '',
    UNIT_PRICE: doc.unitPrice || '',
    TOTAL_AMOUNT: doc.totalAmount || '',
    REMARKS: doc.remarks || '',
    'EXECUTED DATE': doc.executedDate || '',
    TIMESTAMP: new Date().toISOString().replace('T', ' ').replace('Z', ''),
    'SPARES RECEIVED DATE AT SVC': doc.sparesReceivedAtSvc || '',
    REF_DATE: new Date().toISOString().replace('T', ' ').replace('Z', ''),
  };
}

function buildSupplierWarrantyEscalationRow(doc) {
  return {
    Supplier: doc.supplier || '',
    'SRR/RMA/BLT No': doc.srrNo || doc.rmaNo || '',
    'FRN number': doc.frnNo || '',
    'Warranty reported date': doc.entryDate || '',
    'Warranty approved status': doc.warrantyApprovedStatus || '',
    'Warranty approved date': doc.warrantyApprovedDate || '',
    'Def GR number': doc.defGir || '',
    Model: doc.model || '',
    'Unit Serial No': doc.serialNo || '',
    'Part No': doc.partNo || '',
    'Description ': doc.partsDescription || doc.description || '',
    'Def part serial number': doc.defPartSerialNo || '',
    'Problem Details': doc.finalRemarks || doc.techRemarks || '',
    'Licence version/Model configuration': doc.licenceVersion || '',
    'Customer Name': doc.customer || doc.custName || '',
    'Warranty type': doc.warrantyType || doc.unitStatus || '',
    'Supplier warranty status': doc.jobSheetStatus || '',
    'Def Invoice number supplier': doc.defInvoiceNo || '',
    'FRN entry date': doc.entryDate || '',
    'ship date from service center': doc.shipDateSC || '',
    'DC/Invoice No ': doc.dcNo || '',
    'DC/Invoice Date': doc.dcDate || '',
    'AWB No': doc.awbNo || '',
    'AWB DATE': doc.awbDate || '',
    'Replacement received status ': doc.replacementStatus || '',
    'Replacement received date': doc.replacementDate || '',
    'Type of work supplier ': doc.typeWork || 'Supplier Warranty',
    'Received part invoice number': doc.receivedPartInvoiceNo || '',
    'Received part invoice date': doc.receivedPartInvoiceDate || '',
    'Replacement  GIR No': doc.replacementGirNo || '',
    'Received part serial number': doc.receivedPartSerialNo || '',
    'Service Centre Remarks': doc.finalRemarks || doc.remarks || '',
    ENTRY_DATE: doc.entryDate || '',
    SC_REF_NO: doc.scRno || '',
    FRN_NO: doc.frnNo || '',
    DIVISION: doc.division || '',
    REGION: doc.region || '',
    SC_ENGINEER: doc.scEng || '',
    ENGINEER: doc.engineer || doc.eng || '',
    CUSTOMER: doc.customer || doc.custName || '',
    MODEL: doc.model || '',
    UNIT_STATUS: doc.unitStatus || '',
    DEF_MOD_BRD_NAME: doc.defMod || '',
    DEF_GIR_NO: doc.defGir || '',
    TYPE_OF_WORK: doc.typeWork || 'Supplier Warranty',
    RECEIVED_DATE: doc.rcvdDate || '',
    PENDING_DAYS: doc.pdPfrn || doc.pdays || '',
    JOB_SHEET_STATUS: doc.jobSheetStatus || '',
    REF_DATE: new Date().toISOString().replace('T', ' ').replace('Z', ''),
  };
}

function buildExternalRepairEscalationRow(doc) {
  return {
    'S/N': '',
    Year: doc.entryDate ? String(doc.entryDate).slice(0, 4) : '',
    'Vendor Name': doc.supplier || doc.vendorName || '',
    Model: doc.model || '',
    'Customer name': doc.customer || doc.custName || '',
    'Unit Serial no.': doc.serialNo || '',
    'Unit Status': doc.unitStatus || '',
    'Problem details': doc.techRemarks || doc.finalRemarks || '',
    'Part no.': doc.partNo || '',
    'Item Description': doc.partsDescription || doc.components || '',
    'Def GIR no.': doc.defGir || '',
    'DEF PART SN': doc.repGirSno || '',
    'Vendor ticket number': doc.vendorTicketNo || '',
    'Commercial TO Details': doc.dcNo || '',
    'Docket details ': doc.shipDateComm || '',
    'Received date at Esskay': doc.entryDate || '',
    'Received back at SVC': doc.shipDateSC || '',
    'Repair Status': doc.status || '',
    'Amount charged for repair': doc.revalue || '',
    'Software details': doc.reportType || '',
    'Service centre comments': doc.finalRemarks || '',
    ENTRY_DATE: doc.entryDate || '',
    SC_REF_NO: doc.scRno || '',
    FRN_NO: doc.frnNo || '',
    DIVISION: doc.division || '',
    REGION: doc.region || '',
    SC_ENGINEER: doc.scEng || '',
    ENGINEER: doc.eng || doc.engineer || '',
    CUSTOMER: doc.customer || doc.custName || '',
    MODEL: doc.model || '',
    UNIT_STATUS: doc.unitStatus || '',
    DEF_MOD_BRD_NAME: doc.defMod || '',
    DEF_GIR_NO: doc.defGir || '',
    REPAIR_ENGINEER: doc.raEng || '',
    REP_BRD_DATE: doc.repBrdDate || '',
    DC_NO: doc.dcNo || '',
    REP_GIR_SNO: doc.repGirSno || '',
    FINAL_REMARKS: doc.finalRemarks || '',
    TECH_REMARKS: doc.techRemarks || '',
    COMPONENTS_USED: doc.components || '',
    DESTINATION: doc.destination || '',
    SHIP_DATE_SC: doc.shipDateSC || '',
    SHIP_DATE_COMM: doc.shipDateComm || '',
    STATUS: doc.status || '',
    PENDING_DAYS: doc.pdays || '',
    REF_DATE: new Date().toISOString().replace('T', ' ').replace('Z', ''),
  };
}

async function collectEscalationData(slotWindow) {
  const queueDocs = await EscalationQueue.find({
    module: { $in: ['frn', 'est'] },
    queuedAt: { $gte: slotWindow.windowStart, $lte: slotWindow.windowEnd }
  }).sort({ queuedAt: 1 }).lean();

  const frnRows = [];
  const estimationRows = [];
  queueDocs.forEach((doc) => {
    if (doc.module === 'frn') frnRows.push(doc.row || {});
    if (doc.module === 'est') estimationRows.push(doc.row || {});
  });

  return {
    frnRows,
    estimationRows,
  };
}

async function collectUrEscalationData(slotWindow) {
  const moduleName = slotWindow.slot === 'ur_scrap' ? 'ur_scrap' : 'ur_followup';
  const queueDocs = await EscalationQueue.find({
    module: moduleName,
    queuedAt: { $gte: slotWindow.windowStart, $lte: slotWindow.windowEnd }
  }).sort({ queuedAt: 1 }).lean();

  return {
    rows: queueDocs.map((doc) => doc.row || {}),
  };
}

async function collectCustomEscalationData(slotWindow) {
  const queueDocs = await EscalationQueue.find({
    module: slotWindow.module,
    queuedAt: { $gte: slotWindow.windowStart, $lte: slotWindow.windowEnd }
  }).sort({ queuedAt: 1 }).lean();

  return {
    rows: queueDocs.map((doc) => doc.row || {}),
  };
}

async function collectSrEscalationData(slotWindow) {
  const queueDocs = await EscalationQueue.find({
    module: { $in: ['sr_frn', 'sr_est'] },
    queuedAt: { $gte: slotWindow.windowStart, $lte: slotWindow.windowEnd }
  }).sort({ queuedAt: 1 }).lean();

  const frnRows = [];
  const estimationRows = [];
  queueDocs.forEach((doc) => {
    if (doc.module === 'sr_frn') frnRows.push(doc.row || {});
    if (doc.module === 'sr_est') estimationRows.push(doc.row || {});
  });

  return { frnRows, estimationRows, queueDocs };
}

async function clearSrEscalationQueue(queueDocs = []) {
  if (!queueDocs.length) return;
  const queueIds = queueDocs.map((doc) => doc._id).filter(Boolean);
  const frnIds = [...new Set(queueDocs.filter((doc) => doc.module === 'sr_frn' && doc.sourceId).map((doc) => doc.sourceId))];
  const estIds = [...new Set(queueDocs.filter((doc) => doc.module === 'sr_est' && doc.sourceId).map((doc) => doc.sourceId))];

  const ops = [];
  if (queueIds.length) ops.push(EscalationQueue.deleteMany({ _id: { $in: queueIds } }));
  if (frnIds.length) {
    ops.push(Empfrn.updateMany(
      { _id: { $in: frnIds } },
      { $set: { srEscalationQueuedAt: null, srEscalationQueuedBy: '' } }
    ));
  }
  if (estIds.length) {
    ops.push(EstimationPending.updateMany(
      { _id: { $in: estIds } },
      { $set: { srEscalationQueuedAt: null, srEscalationQueuedBy: '' } }
    ));
  }
  await Promise.all(ops);
}

async function clearToEscalationQueue(queueDocs = []) {
  if (!queueDocs.length) return;
  const queueIds = queueDocs.map((doc) => doc._id).filter(Boolean);
  const frnIds = [...new Set(queueDocs.filter((doc) => doc.module === 'to_frn' && doc.sourceId).map((doc) => doc.sourceId))];
  const estIds = [...new Set(queueDocs.filter((doc) => doc.module === 'to_est' && doc.sourceId).map((doc) => doc.sourceId))];
  const urIds = [...new Set(queueDocs.filter((doc) => doc.module === 'to_ur' && doc.sourceId).map((doc) => doc.sourceId))];

  const ops = [];
  if (queueIds.length) ops.push(EscalationQueue.deleteMany({ _id: { $in: queueIds } }));
  if (frnIds.length) {
    ops.push(Empfrn.updateMany(
      { _id: { $in: frnIds } },
      { $set: { toEscalationQueuedAt: null, toEscalationQueuedBy: '' } }
    ));
  }
  if (estIds.length) {
    ops.push(EstimationPending.updateMany(
      { _id: { $in: estIds } },
      { $set: { toEscalationQueuedAt: null, toEscalationQueuedBy: '' } }
    ));
  }
  if (urIds.length) {
    ops.push(Service.updateMany(
      { _id: { $in: urIds } },
      { $set: { toEscalationQueuedAt: null, toEscalationQueuedBy: '' } }
    ));
  }
  await Promise.all(ops);
}

async function enqueueEscalationSnapshot(module, sourceId, queuedBy, row) {
  await EscalationQueue.create({
    module,
    sourceId: sourceId ? String(sourceId) : '',
    queuedBy: queuedBy || '',
    queuedAt: new Date(),
    row,
  });
}

async function enqueueLatestEscalationSnapshot(module, sourceId, queuedBy, row) {
  await EscalationQueue.findOneAndUpdate(
    { module, sourceId: sourceId ? String(sourceId) : '' },
    {
      $set: {
        queuedBy: queuedBy || '',
        queuedAt: new Date(),
        row,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function removeEscalationSnapshot(module, sourceId) {
  if (!sourceId) return;
  await EscalationQueue.deleteMany({ module, sourceId: String(sourceId) });
}

function buildUrMailPayload(slotWindow, data) {
  const isScrap = slotWindow.slot === 'ur_scrap';
  const title = isScrap ? 'Weekly Scrap Escalation Report' : 'Daily Under Repair Escalation Report';
  const bodyLines = [
    'SchillerIndia under-repair escalation report',
    '',
    `Slot: ${slotWindow.slotLabel}`,
    `Window (IST): ${formatIstStamp(slotWindow.windowStart)} to ${formatIstStamp(slotWindow.windowEnd)}`,
    `Records: ${data.rows.length}`,
    '',
    `Attached Excel contains the ${isScrap ? 'scrap' : 'under-repair follow-up'} escalation details.`,
  ];

  return {
    format: 'xlsx',
    to: [],
    subject: `${title} - ${slotWindow.jobDate}`,
    body: bodyLines.join('\n'),
    sheets: [
      {
        name: isScrap ? 'Scrap Escalation' : 'Stock Escalation',
        template: isScrap ? 'Scrap Escalation' : 'Stock Escalation',
        headerRow: isScrap ? 4 : 1,
        rows: data.rows,
      },
    ],
  };
}

function buildCustomMailPayload(slotWindow, data) {
  return {
    format: 'xlsx',
    to: [],
    subject: `${slotWindow.title} - ${slotWindow.jobDate}`,
    body: [
      `SchillerIndia ${slotWindow.title.toLowerCase()}`,
      '',
      `Slot: ${slotWindow.slotLabel}`,
      `Window (IST): ${formatIstStamp(slotWindow.windowStart)} to ${formatIstStamp(slotWindow.windowEnd)}`,
      `Records: ${data.rows.length}`,
      '',
      'Attached Excel contains the queued escalation details.',
    ].join('\n'),
    sheets: [
      {
        name: slotWindow.template || 'Sheet0',
        template: slotWindow.template,
        headerRow: slotWindow.headerRow || 1,
        rows: data.rows,
      },
    ],
  };
}

async function collectToEscalationData(slotWindow) {
  const rows = await EscalationQueue.find({
    module: { $in: ['to_frn', 'to_est', 'to_ur'] },
    queuedAt: { $gte: slotWindow.windowStart, $lte: slotWindow.windowEnd },
  }).sort({ queuedAt: 1 }).lean();

  const frnRows = rows.filter((item) => item.module === 'to_frn').map((item) => item.row || {});
  const estimationRows = rows.filter((item) => item.module === 'to_est').map((item) => item.row || {});
  const underRepairRows = rows.filter((item) => item.module === 'to_ur').map((item) => item.row || {});

  return {
    frnRows,
    estimationRows,
    underRepairRows,
    queueDocs: rows,
  };
}

function buildMailPayload(slotWindow, data) {
  const combinedRows = [...data.frnRows, ...data.estimationRows];
  const total = combinedRows.length;
  return {
    format: 'xlsx',
    to: [],
    subject: `Dispatch Escalation Report - ${slotWindow.slotLabel} Slot - ${slotWindow.jobDate}`,
    body: [
      'SchillerIndia dispatch escalation report',
      '',
      `Slot: ${slotWindow.slotLabel}`,
      `Window (IST): ${formatIstStamp(slotWindow.windowStart)} to ${formatIstStamp(slotWindow.windowEnd)}`,
      `Pending FRN updates: ${data.frnRows.length}`,
      `SO Pending updates: ${data.estimationRows.length}`,
      `Total records: ${total}`,
      '',
      'Attached Excel contains the combined Pending FRN and SO Pending escalation details.',
    ].join('\n'),
    sheets: [
      { name: 'Dispatch Escalation', template: 'Dispatch Escalation', rows: combinedRows },
    ],
  };
}

function buildSrMailPayload(slotWindow, data) {
  const combinedRows = [...data.frnRows, ...data.estimationRows];
  const total = combinedRows.length;
  return {
    format: 'xlsx',
    to: [],
    subject: `SR Escalation Report - ${slotWindow.slotLabel} - ${slotWindow.jobDate}`,
    body: [
      'SchillerIndia spares requirement escalation report',
      '',
      `Slot: ${slotWindow.slotLabel}`,
      `Window (IST): ${formatIstStamp(slotWindow.windowStart)} to ${formatIstStamp(slotWindow.windowEnd)}`,
      `Pending FRN SR records: ${data.frnRows.length}`,
      `SO Pending SR records: ${data.estimationRows.length}`,
      `Total records: ${total}`,
      '',
      'Attached Excel contains the combined SR escalation details from Pending FRN and SO Pending.',
    ].join('\n'),
    sheets: [
      { name: 'SR', template: 'SR', rows: combinedRows },
    ],
  };
}

function buildToMailPayload(slotWindow, data) {
  const sourceRows = [...data.frnRows, ...data.estimationRows, ...(data.underRepairRows || [])];
  const rows = [];
  sourceRows.forEach((row) => {
    const items = normalizeToItems(row?.TO_ITEMS);
    if (!items.length) {
      rows.push({
        'Division Name': row['Division Name'] || row['DIVISION NAME'] || '',
        'SCH REF': row['SCH REF'] || row.SC_REF_NO || '',
        FRN_NO: row.FRN_NO || '',
        STK_CUST: row.STK_CUST || '',
        BRANCH: row.BRANCH || '',
        CUST_NAME: row.CUST_NAME || '',
        PRODUCT_MODEL: row.PRODUCT_MODEL || row.MODEL || '',
        UNIT_STATUS: row.UNIT_STATUS || '',
        DEF_GIR_NO: row.DEF_GIR_NO || '',
        PART_NO: '',
        'ITEM DESCRIPTION': row['ITEM DESCRIPTION'] || '',
        QTY: '',
        FINAL_REMARKS: row.FINAL_REMARKS || '',
      });
      return;
    }
    items.forEach((item) => {
      rows.push({
        'Division Name': row['Division Name'] || row['DIVISION NAME'] || '',
        'SCH REF': row['SCH REF'] || row.SC_REF_NO || '',
        FRN_NO: row.FRN_NO || '',
        STK_CUST: row.STK_CUST || '',
        BRANCH: row.BRANCH || '',
        CUST_NAME: row.CUST_NAME || '',
        PRODUCT_MODEL: row.PRODUCT_MODEL || row.MODEL || '',
        UNIT_STATUS: row.UNIT_STATUS || '',
        DEF_GIR_NO: row.DEF_GIR_NO || '',
        PART_NO: item.partNo || '',
        'ITEM DESCRIPTION': row['ITEM DESCRIPTION'] || '',
        QTY: String(item.qty || 1),
        FINAL_REMARKS: row.FINAL_REMARKS || '',
      });
    });
  });
  return {
    reportName: slotWindow.reportName,
    subject: `[SchillerIndia] ${slotWindow.slotLabel} TO Escalation - ${slotWindow.jobDate}`,
    body: `Please find attached the ${slotWindow.slotLabel.toLowerCase()} TO escalation report for ${slotWindow.jobDate}.`,
    format: 'xlsx',
    sheets: [
      {
        name: 'TO',
        template: 'TO',
        rows,
      },
    ],
  };
}

function getPythonCandidates() {
  const candidates = [];
  const configuredPython = String(process.env.ESCALATION_PYTHON || process.env.PYTHON || '').trim();
  if (configuredPython) candidates.push({ command: configuredPython, argsPrefix: [] });
  if (fs.existsSync(BUNDLED_PYTHON)) candidates.push({ command: BUNDLED_PYTHON, argsPrefix: [] });
  if (process.platform === 'win32') candidates.push({ command: 'py', argsPrefix: ['-3'] });
  candidates.push({ command: 'python3', argsPrefix: [] });
  candidates.push({ command: 'python', argsPrefix: [] });
  return candidates;
}

function execFileAsync(command, args, options) {
  return new Promise((resolve, reject) => {
    execFile(command, args, options, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

async function sendEscalationWorkbook(payload, outputPath, senderConfig = null) {
  const tmpInput = path.join(os.tmpdir(), `schiller-escalation-${Date.now()}.json`);
  fs.writeFileSync(tmpInput, JSON.stringify(payload, null, 2), 'utf8');
  const sender = senderConfig || await getReadyEscalationSenderConfig();
  const childEnv = {
    ...process.env,
    ESCALATION_SMTP_HOST: sender.smtpHost || '',
    ESCALATION_SMTP_PORT: String(sender.smtpPort || '587'),
    ESCALATION_SMTP_USER: sender.smtpUser || '',
    ESCALATION_SMTP_PASS: sender.smtpPass || '',
    ESCALATION_EMAIL_FROM: sender.fromEmail || '',
    ESCALATION_SMTP_STARTTLS: sender.startTls ? 'true' : 'false',
    ESCALATION_SMTP_SSL: sender.ssl ? 'true' : 'false',
  };

  let lastError = null;
  for (const candidate of getPythonCandidates()) {
    for (let attempt = 1; attempt <= MAIL_ATTEMPTS; attempt += 1) {
      try {
        await execFileAsync(candidate.command, [...candidate.argsPrefix, PYTHON_SCRIPT, tmpInput, outputPath], {
          cwd: path.join(__dirname, '..'),
          env: childEnv,
          windowsHide: true,
        });
        try { fs.unlinkSync(tmpInput); } catch (_) {}
        return;
      } catch (error) {
        lastError = error;
        if (attempt < MAIL_ATTEMPTS) await sleep(1000 * attempt);
      }
    }
  }

  try { fs.unlinkSync(tmpInput); } catch (_) {}
  throw new Error(lastError ? (lastError.stderr || lastError.message || 'Python mailer failed') : 'No usable Python runtime found');
}

async function runEscalationSlot(slot, options = {}) {
  if (!mongoose.connection || mongoose.connection.readyState !== 1) {
    return { ok: false, skipped: true, message: 'MongoDB is not connected.' };
  }

  const slotWindow = getSlotWindow(slot, options.referenceDate || new Date());
  const jobKey = buildJobKey(slotWindow);
  const existing = await EscalationRunLog.findOne({ jobKey }).lean();
  if (existing && !options.force) {
    return { ok: true, skipped: true, message: `Job already processed for ${jobKey}.`, log: existing };
  }

  let log = existing
    ? await EscalationRunLog.findOneAndUpdate({ jobKey }, { $set: { status: 'running', error: '' } }, { new: true })
    : await EscalationRunLog.create({
        jobKey,
        slot,
        category: 'main',
        trigger: options.trigger || 'scheduler',
        windowStart: slotWindow.windowStart,
        windowEnd: slotWindow.windowEnd,
        status: 'running',
      });

  try {
    const recipients = await getEscalationRecipients('main_combined');
    if (!recipients.length) {
      log = await EscalationRunLog.findByIdAndUpdate(log._id, { $set: { status: 'skipped', error: 'ESCALATION_EMAIL_TO is empty.' } }, { new: true });
      return { ok: false, skipped: true, message: 'ESCALATION_EMAIL_TO is not configured.', log };
    }

    const data = await collectEscalationData(slotWindow);
    const totalCount = data.frnRows.length + data.estimationRows.length;
    if (!totalCount) {
      log = await EscalationRunLog.findByIdAndUpdate(
        log._id,
        { $set: { status: 'no_records', frnCount: 0, estCount: 0, totalCount: 0, sentAt: new Date() } },
        { new: true }
      );
      return { ok: true, skipped: true, message: 'No records found for this escalation window.', log };
    }

    fs.mkdirSync(REPORT_DIR, { recursive: true });
    const reportPath = path.join(REPORT_DIR, `dispatch-escalation-${slotWindow.slot}-${slotWindow.jobDate}.xlsx`);
    log = await EscalationRunLog.findByIdAndUpdate(
      log._id,
      {
        $set: {
          frnCount: data.frnRows.length,
          estCount: data.estimationRows.length,
          totalCount,
          reportPath,
        },
      },
      { new: true }
    );
    const sender = await getReadyEscalationSenderConfig();
    const payload = buildMailPayload(slotWindow, data);
    payload.to = recipients;
    await sendEscalationWorkbook(payload, reportPath, sender);

    log = await EscalationRunLog.findByIdAndUpdate(
      log._id,
      {
        $set: {
          status: 'success',
          frnCount: data.frnRows.length,
          estCount: data.estimationRows.length,
          totalCount,
          reportPath,
          sentAt: new Date(),
        },
      },
      { new: true }
    );

    return { ok: true, message: 'Escalation report sent successfully.', log };
  } catch (error) {
    const skipped = isSkippedEscalationError(error);
    log = await EscalationRunLog.findByIdAndUpdate(log._id, { $set: { status: skipped ? 'skipped' : 'failed', error: error.message || 'Unknown error' } }, { new: true });
    return { ok: false, skipped, message: error.message || 'Escalation failed.', log };
  }
}

async function runUrEscalationSlot(slot, options = {}) {
  if (!mongoose.connection || mongoose.connection.readyState !== 1) {
    return { ok: false, skipped: true, message: 'MongoDB is not connected.' };
  }

  const slotWindow = getUrSlotWindow(slot, options.referenceDate || new Date());
  const jobKey = buildJobKey(slotWindow);
  const existing = await EscalationRunLog.findOne({ jobKey }).lean();
  if (existing && !options.force) {
    return { ok: true, skipped: true, message: `Job already processed for ${jobKey}.`, log: existing };
  }

  let log = existing
    ? await EscalationRunLog.findOneAndUpdate({ jobKey }, { $set: { status: 'running', error: '' } }, { new: true })
    : await EscalationRunLog.create({
        jobKey,
        slot,
        category: slotWindow.category,
        trigger: options.trigger || 'scheduler',
        windowStart: slotWindow.windowStart,
        windowEnd: slotWindow.windowEnd,
        status: 'running',
      });

  try {
    const recipients = await getEscalationRecipients(slotWindow.category);
    if (!recipients.length) {
      log = await EscalationRunLog.findByIdAndUpdate(log._id, { $set: { status: 'skipped', error: 'ESCALATION_EMAIL_TO is empty.' } }, { new: true });
      return { ok: false, skipped: true, message: 'ESCALATION_EMAIL_TO is not configured.', log };
    }

    const data = await collectUrEscalationData(slotWindow);
    if (!data.rows.length) {
      log = await EscalationRunLog.findByIdAndUpdate(
        log._id,
        { $set: { status: 'no_records', urCount: 0, totalCount: 0, sentAt: new Date() } },
        { new: true }
      );
      return { ok: true, skipped: true, message: 'No records found for this escalation window.', log };
    }

    fs.mkdirSync(REPORT_DIR, { recursive: true });
    const reportPath = path.join(REPORT_DIR, slotWindow.reportName);
    log = await EscalationRunLog.findByIdAndUpdate(
      log._id,
      {
        $set: {
          urCount: data.rows.length,
          totalCount: data.rows.length,
          reportPath,
        },
      },
      { new: true }
    );
    const sender = await getReadyEscalationSenderConfig();
    const payload = buildUrMailPayload(slotWindow, data);
    payload.to = recipients;
    await sendEscalationWorkbook(payload, reportPath, sender);

    log = await EscalationRunLog.findByIdAndUpdate(
      log._id,
      {
        $set: {
          status: 'success',
          urCount: data.rows.length,
          totalCount: data.rows.length,
          reportPath,
          sentAt: new Date(),
        },
      },
      { new: true }
    );

    return { ok: true, message: 'Under-repair escalation report sent successfully.', log };
  } catch (error) {
    const skipped = isSkippedEscalationError(error);
    log = await EscalationRunLog.findByIdAndUpdate(log._id, { $set: { status: skipped ? 'skipped' : 'failed', error: error.message || 'Unknown error' } }, { new: true });
    return { ok: false, skipped, message: error.message || 'Under-repair escalation failed.', log };
  }
}

async function runSrEscalationSlot(slot, options = {}) {
  if (!mongoose.connection || mongoose.connection.readyState !== 1) {
    return { ok: false, skipped: true, message: 'MongoDB is not connected.' };
  }

  const slotWindow = getSrSlotWindow(slot, options.referenceDate || new Date());
  const jobKey = buildJobKey(slotWindow);
  const existing = await EscalationRunLog.findOne({ jobKey }).lean();
  if (existing && !options.force) {
    return { ok: true, skipped: true, message: `Job already processed for ${jobKey}.`, log: existing };
  }

  let log = existing
    ? await EscalationRunLog.findOneAndUpdate({ jobKey }, { $set: { status: 'running', error: '' } }, { new: true })
    : await EscalationRunLog.create({
        jobKey,
        slot,
        category: 'sr',
        trigger: options.trigger || 'scheduler',
        windowStart: slotWindow.windowStart,
        windowEnd: slotWindow.windowEnd,
        status: 'running',
      });

  try {
    const recipients = await getEscalationRecipients('sr_escalation');
    if (!recipients.length) {
      log = await EscalationRunLog.findByIdAndUpdate(log._id, { $set: { status: 'skipped', error: 'ESCALATION_EMAIL_TO is empty.' } }, { new: true });
      return { ok: false, skipped: true, message: 'ESCALATION_EMAIL_TO is not configured.', log };
    }

    const data = await collectSrEscalationData(slotWindow);
    const totalCount = data.frnRows.length + data.estimationRows.length;
    if (!totalCount) {
      log = await EscalationRunLog.findByIdAndUpdate(
        log._id,
        { $set: { status: 'no_records', frnCount: 0, estCount: 0, totalCount: 0, sentAt: new Date() } },
        { new: true }
      );
      return { ok: true, skipped: true, message: 'No records found for this SR escalation window.', log };
    }

    fs.mkdirSync(REPORT_DIR, { recursive: true });
    const reportPath = path.join(REPORT_DIR, slotWindow.reportName);
    log = await EscalationRunLog.findByIdAndUpdate(
      log._id,
      {
        $set: {
          frnCount: data.frnRows.length,
          estCount: data.estimationRows.length,
          totalCount,
          reportPath,
        },
      },
      { new: true }
    );
    const sender = await getReadyEscalationSenderConfig();
    const payload = buildSrMailPayload(slotWindow, data);
    payload.to = recipients;
    await sendEscalationWorkbook(payload, reportPath, sender);
    await clearSrEscalationQueue(data.queueDocs || []);

    log = await EscalationRunLog.findByIdAndUpdate(
      log._id,
      {
        $set: {
          status: 'success',
          frnCount: data.frnRows.length,
          estCount: data.estimationRows.length,
          totalCount,
          reportPath,
          sentAt: new Date(),
        },
      },
      { new: true }
    );

    return { ok: true, message: 'SR escalation report sent successfully.', log };
  } catch (error) {
    const skipped = isSkippedEscalationError(error);
    log = await EscalationRunLog.findByIdAndUpdate(log._id, { $set: { status: skipped ? 'skipped' : 'failed', error: error.message || 'Unknown error' } }, { new: true });
    return { ok: false, skipped, message: error.message || 'SR escalation failed.', log };
  }
}

async function runToEscalationSlot(slot, options = {}) {
  if (!mongoose.connection || mongoose.connection.readyState !== 1) {
    return { ok: false, skipped: true, message: 'MongoDB is not connected.' };
  }

  const slotWindow = getToSlotWindow(slot, options.referenceDate || new Date());
  const jobKey = buildJobKey(slotWindow);
  const existing = await EscalationRunLog.findOne({ jobKey }).lean();
  if (existing && !options.force) {
    return { ok: true, skipped: true, message: `Job already processed for ${jobKey}.`, log: existing };
  }

  let log = existing
    ? await EscalationRunLog.findOneAndUpdate({ jobKey }, { $set: { status: 'running', error: '' } }, { new: true })
    : await EscalationRunLog.create({
        jobKey,
        slot,
        category: 'to',
        trigger: options.trigger || 'scheduler',
        windowStart: slotWindow.windowStart,
        windowEnd: slotWindow.windowEnd,
        status: 'running',
      });

  try {
    const recipients = await getEscalationRecipients('to_escalation');
    if (!recipients.length) {
      log = await EscalationRunLog.findByIdAndUpdate(log._id, { $set: { status: 'skipped', error: 'ESCALATION_EMAIL_TO is empty.' } }, { new: true });
      return { ok: false, skipped: true, message: 'ESCALATION_EMAIL_TO is not configured.', log };
    }

    const data = await collectToEscalationData(slotWindow);
    const totalCount = data.frnRows.length + data.estimationRows.length + (data.underRepairRows || []).length;
    if (!totalCount) {
      log = await EscalationRunLog.findByIdAndUpdate(
        log._id,
        { $set: { status: 'no_records', frnCount: 0, estCount: 0, urCount: 0, totalCount: 0, sentAt: new Date() } },
        { new: true }
      );
      return { ok: true, skipped: true, message: 'No records found for this TO escalation window.', log };
    }

    fs.mkdirSync(REPORT_DIR, { recursive: true });
    const reportPath = path.join(REPORT_DIR, slotWindow.reportName);
    log = await EscalationRunLog.findByIdAndUpdate(
      log._id,
      {
        $set: {
          frnCount: data.frnRows.length,
          estCount: data.estimationRows.length,
          urCount: (data.underRepairRows || []).length,
          totalCount,
          reportPath,
        },
      },
      { new: true }
    );
    const sender = await getReadyEscalationSenderConfig();
    const payload = buildToMailPayload(slotWindow, data);
    payload.to = recipients;
    await sendEscalationWorkbook(payload, reportPath, sender);
    await clearToEscalationQueue(data.queueDocs || []);

    log = await EscalationRunLog.findByIdAndUpdate(
      log._id,
      {
        $set: {
          status: 'success',
          frnCount: data.frnRows.length,
          estCount: data.estimationRows.length,
          urCount: (data.underRepairRows || []).length,
          totalCount,
          reportPath,
          sentAt: new Date(),
        },
      },
      { new: true }
    );

    return { ok: true, message: 'TO escalation report sent successfully.', log };
  } catch (error) {
    const skipped = isSkippedEscalationError(error);
    log = await EscalationRunLog.findByIdAndUpdate(log._id, { $set: { status: skipped ? 'skipped' : 'failed', error: error.message || 'Unknown error' } }, { new: true });
    return { ok: false, skipped, message: error.message || 'TO escalation failed.', log };
  }
}

async function runCustomEscalationSlot(slot, options = {}) {
  if (!mongoose.connection || mongoose.connection.readyState !== 1) {
    return { ok: false, skipped: true, message: 'MongoDB is not connected.' };
  }

  const slotWindow = getCustomEscalationSlotWindow(slot, options.referenceDate || new Date());
  const jobKey = buildJobKey(slotWindow);
  const existing = await EscalationRunLog.findOne({ jobKey }).lean();
  if (existing && !options.force) {
    return { ok: true, skipped: true, message: `Job already processed for ${jobKey}.`, log: existing };
  }

  let log = existing
    ? await EscalationRunLog.findOneAndUpdate({ jobKey }, { $set: { status: 'running', error: '' } }, { new: true })
    : await EscalationRunLog.create({
        jobKey,
        slot,
        category: slotWindow.category,
        trigger: options.trigger || 'scheduler',
        windowStart: slotWindow.windowStart,
        windowEnd: slotWindow.windowEnd,
        status: 'running',
      });

  try {
    const recipients = await getEscalationRecipients(slotWindow.reportType);
    if (!recipients.length) {
      log = await EscalationRunLog.findByIdAndUpdate(log._id, { $set: { status: 'skipped', error: 'ESCALATION_EMAIL_TO is empty.' } }, { new: true });
      return { ok: false, skipped: true, message: 'ESCALATION_EMAIL_TO is not configured.', log };
    }

    const data = await collectCustomEscalationData(slotWindow);
    if (!data.rows.length) {
      log = await EscalationRunLog.findByIdAndUpdate(
        log._id,
        { $set: { status: 'no_records', totalCount: 0, sentAt: new Date() } },
        { new: true }
      );
      return { ok: true, skipped: true, message: 'No records found for this escalation window.', log };
    }

    fs.mkdirSync(REPORT_DIR, { recursive: true });
    const reportPath = path.join(REPORT_DIR, slotWindow.reportName);
    log = await EscalationRunLog.findByIdAndUpdate(
      log._id,
      {
        $set: {
          totalCount: data.rows.length,
          reportPath,
        },
      },
      { new: true }
    );
    const sender = await getReadyEscalationSenderConfig();
    const payload = buildCustomMailPayload(slotWindow, data);
    payload.to = recipients;
    await sendEscalationWorkbook(payload, reportPath, sender);

    log = await EscalationRunLog.findByIdAndUpdate(
      log._id,
      {
        $set: {
          status: 'success',
          totalCount: data.rows.length,
          reportPath,
          sentAt: new Date(),
        },
      },
      { new: true }
    );

    return { ok: true, message: `${slotWindow.title} sent successfully.`, log };
  } catch (error) {
    const skipped = isSkippedEscalationError(error);
    log = await EscalationRunLog.findByIdAndUpdate(log._id, { $set: { status: skipped ? 'skipped' : 'failed', error: error.message || 'Unknown error' } }, { new: true });
    return { ok: false, skipped, message: error.message || `${slotWindow.title} failed.`, log };
  }
}

function initEscalationScheduler() {
  if (process.env.ESCALATION_ENABLED === 'false') {
    console.log('[Escalation] Scheduler disabled via ESCALATION_ENABLED=false');
    return;
  }

  console.log('[Escalation] Scheduler armed for SR 11:00 AM & 3:00 PM, supplier warranty Tue/Fri 8:30 PM, external 3:30 PM, main 11:30 AM & 4:00 PM, PRF/OB 4:30 PM, Sunday 11:00 AM scrap, and daily 8:00 PM UR follow-up IST.');
  const timer = setInterval(async () => {
    try {
      const slots = getSlotsForCurrentTime(new Date());
      if (!slots.length) return;
      for (const slot of slots) {
        const result = slot === 'morning' || slot === 'evening'
          ? await runEscalationSlot(slot, { trigger: 'scheduler' })
          : slot === 'sr_morning' || slot === 'sr_afternoon'
            ? await runSrEscalationSlot(slot, { trigger: 'scheduler' })
            : slot === 'to_morning' || slot === 'to_evening'
              ? await runToEscalationSlot(slot, { trigger: 'scheduler' })
            : slot === 'ur_scrap' || slot === 'ur_followup'
              ? await runUrEscalationSlot(slot, { trigger: 'scheduler' })
            : await runCustomEscalationSlot(slot, { trigger: 'scheduler' });
        if (!result.skipped) console.log(`[Escalation] ${slot} slot: ${result.message}`);
      }
    } catch (error) {
      console.error('[Escalation] Scheduler error:', error.message);
    }
  }, 30000);

  if (typeof timer.unref === 'function') timer.unref();
}

module.exports = {
  UR_DAILY_TYPES,
  buildFrnEscalationRow,
  buildEstimationEscalationRow,
  buildToEscalationRow,
  buildUrEscalationRow,
  buildPrfObEscalationRow,
  buildSupplierWarrantyEscalationRow,
  buildExternalRepairEscalationRow,
  enqueueEscalationSnapshot,
  enqueueLatestEscalationSnapshot,
  removeEscalationSnapshot,
  getEscalationRecipients,
  getCustomEscalationSlotWindow,
  getSrSlotWindow,
  getToSlotWindow,
  getUrSlotWindow,
  initEscalationScheduler,
  runEscalationSlot,
  runSrEscalationSlot,
  runToEscalationSlot,
  runUrEscalationSlot,
  runCustomEscalationSlot,
};
