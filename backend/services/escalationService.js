const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const mongoose = require('mongoose');

const Empfrn = require('../models/EmpFRN');
const EstimationPending = require('../models/EstimationPending');
const Service = require('../models/empservice');
const EscalationRunLog = require('../models/EscalationRunLog');
const EscalationQueue = require('../models/EscalationQueue');
const AppSetting = require('../models/AppSetting');
const {
  getEscalationTimeMap,
  getEscalationScheduleConfig,
  getEnabledEscalationSlots,
  getReportTypeForSlot,
  isEscalationSlotAllowedOnDay,
  parseTime,
  formatTimeLabel,
} = require('../utils/escalationSchedule');
const { runEscalationMailer } = require('../utils/escalationMailer');

const IST_OFFSET_MINUTES = 330;
const IST_OFFSET_MS = IST_OFFSET_MINUTES * 60 * 1000;
const REPORT_DIR = path.join(__dirname, '..', 'generated-reports', 'escalations');
const PYTHON_SCRIPT = path.join(__dirname, '..', 'scripts', 'send_escalation_mail.py');
const PROJECT_PYTHON = path.join(__dirname, '..', '..', '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
const BUNDLED_PYTHON = path.join(os.homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'python', process.platform === 'win32' ? 'python.exe' : 'bin/python');
const MAIL_ATTEMPTS = Math.max(1, parseInt(process.env.ESCALATION_MAIL_ATTEMPTS || '2', 10) || 2);
const MAIL_TIMEOUT_MS = Math.max(30000, parseInt(process.env.ESCALATION_MAIL_TIMEOUT_MS || '120000', 10) || 120000);
const SCHEDULER_GRACE_MS = Math.max(60000, parseInt(process.env.ESCALATION_SCHEDULER_GRACE_MS || '3600000', 10) || 3600000);
const SCHEDULER_TICK_MS = Math.max(1000, parseInt(process.env.ESCALATION_SCHEDULER_TICK_MS || '1000', 10) || 1000);
const DEFAULT_STALE_RUNNING_MS = Math.max(10 * 60 * 1000, MAIL_TIMEOUT_MS * 4 + 60 * 1000);
const STALE_RUNNING_MS = Math.max(60000, parseInt(process.env.ESCALATION_STALE_RUNNING_MS || String(DEFAULT_STALE_RUNNING_MS), 10) || DEFAULT_STALE_RUNNING_MS);
const UR_DAILY_TYPES = ['UR Stock', 'WS Stock', 'External Repair', 'Completed', 'Supplier Warranty', 'Supplier Warrenty', 'No Fault', 'Given to PSP'];
const SCRAP_ESCALATION_HEADERS = [
  'DIVISION NAME',
  'ENTRY DATE',
  'SC_REF_NO',
  'SC_ENGINEER',
  'RA_ENGINEER',
  'FRN_NO',
  'SUPPLIER_NAME',
  'PRODUCT_MODEL',
  'DEF_MOD_BRD_NAME',
  'DEF_TYPE',
  'TYPE_OF_ACC',
  'PART_NO',
  'DEF_GIR_NO',
  'TECHNICAL_REMARKS',
  'FINAL_REMARKS',
  'TIMESTAMP',
];
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

function normalizeSmtpPassword(password, sender = {}) {
  const value = String(password || '').trim();
  const host = String(sender.smtpHost || '').toLowerCase();
  const user = String(sender.smtpUser || sender.fromEmail || '').toLowerCase();
  if (host.includes('gmail.com') || user.endsWith('@gmail.com')) {
    return value.replace(/\s+/g, '');
  }
  return value;
}

function hasApiMailProviderConfigured() {
  const provider = String(process.env.ESCALATION_MAIL_PROVIDER || '').trim().toLowerCase();
  if (provider === 'smtp') return false;
  return Boolean(
    process.env.BREVO_API_KEY ||
    process.env.SENDINBLUE_API_KEY ||
    process.env.ESCALATION_BREVO_API_KEY ||
    process.env.SENDGRID_API_KEY ||
    process.env.ESCALATION_SENDGRID_API_KEY ||
    process.env.RESEND_API_KEY ||
    process.env.ESCALATION_RESEND_API_KEY
  );
}

async function getEscalationRecipients(reportType = '') {
  try {
    const doc = await AppSetting.findOne({ key: 'escalation_emails' }).lean();
    const configuredEntries = Array.isArray(doc?.value) ? doc.value : [];

    const targetTypes = new Set(
      (Array.isArray(reportType) ? reportType : String(reportType || '').split(','))
        .map(t => String(t || '').trim())
        .filter(Boolean)
    );
    if (targetTypes.has('ur_followup')) targetTypes.add('ur_escalation');
    if (targetTypes.has('ur_escalation')) targetTypes.add('ur_followup');

    const configured = configuredEntries
      .filter((item) => {
        if (!item || typeof item !== 'object') return !targetTypes.size;
        if (!targetTypes.size) return true;
        const itemType = String(item.reportType || '').trim();
        const types = itemType.split(',').map(t => t.trim()).filter(Boolean);
        return types.some(t => targetTypes.has(t) || t === 'all_escalation');
      })
      .map((item) => {
        if (item && typeof item === 'object' && item.email) {
          return {
            email: String(item.email).trim(),
            division: String(item.division || 'all').trim(),
            region: String(item.region || 'all').trim()
          };
        }
        return { email: String(item || '').trim(), division: 'all', region: 'all' };
      })
      .filter((item) => item.email);
    
    if (configured.length) {
      // Deduplicate by email+division+region
      const unique = [];
      const seen = new Set();
      for (const c of configured) {
        const key = `${c.email}|${c.division}|${c.region}`;
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(c);
        }
      }
      return unique;
    }
  } catch (_) {}
  return splitCsv(process.env.ESCALATION_EMAIL_TO).map(email => ({ email, division: 'all', region: 'all' }));
}

async function getEscalationSenderConfig() {
  try {
    const doc = await AppSetting.findOne({ key: 'escalation_sender' }).lean();
    const value = doc?.value && typeof doc.value === 'object' ? doc.value : {};
    const smtpHost = String(value.smtpHost || process.env.ESCALATION_SMTP_HOST || '').trim();
    const smtpPort = String(value.smtpPort || process.env.ESCALATION_SMTP_PORT || '587').trim() || '587';
    const smtpUser = String(value.smtpUser || process.env.ESCALATION_SMTP_USER || '').trim();
    const rawSmtpPass = String(value.smtpPass || process.env.ESCALATION_SMTP_PASS || '').trim();
    const fromEmail = String(value.fromEmail || process.env.ESCALATION_EMAIL_FROM || smtpUser).trim();
    const startTls = toBool(value.startTls, String(process.env.ESCALATION_SMTP_STARTTLS || 'true').trim().toLowerCase() !== 'false');
    const ssl = toBool(value.ssl, String(process.env.ESCALATION_SMTP_SSL || 'false').trim().toLowerCase() === 'true');
    const smtpPass = normalizeSmtpPassword(rawSmtpPass, { smtpHost, smtpUser, fromEmail });
    return { smtpHost, smtpPort, smtpUser, smtpPass, fromEmail, startTls, ssl };
  } catch (_) {
    const smtpHost = String(process.env.ESCALATION_SMTP_HOST || '').trim();
    const smtpUser = String(process.env.ESCALATION_SMTP_USER || '').trim();
    const fromEmail = String(process.env.ESCALATION_EMAIL_FROM || process.env.ESCALATION_SMTP_USER || '').trim();
    return {
      smtpHost,
      smtpPort: String(process.env.ESCALATION_SMTP_PORT || '587').trim() || '587',
      smtpUser,
      smtpPass: normalizeSmtpPassword(process.env.ESCALATION_SMTP_PASS, { smtpHost, smtpUser, fromEmail }),
      fromEmail,
      startTls: String(process.env.ESCALATION_SMTP_STARTTLS || 'true').trim().toLowerCase() !== 'false',
      ssl: String(process.env.ESCALATION_SMTP_SSL || 'false').trim().toLowerCase() === 'true',
    };
  }
}

function getEscalationSenderConfigError(sender = {}) {
  if (!String(sender.fromEmail || '').trim()) return 'Escalation sender from email is not configured.';
  if (hasApiMailProviderConfigured()) return '';
  if (!String(sender.smtpHost || '').trim()) return 'Escalation sender SMTP host is not configured.';
  if (!String(sender.smtpUser || '').trim()) return 'Escalation sender SMTP user is not configured.';
  if (!String(sender.smtpPass || '').trim()) return 'Escalation sender SMTP password is not configured.';
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

function scheduledTime(times, key, fallback) {
  const legacyKeyMap = {
    morning: 'main_combined_slot_1',
    evening: 'main_combined_slot_2',
    sr_morning: 'sr_escalation_slot_1',
    sr_afternoon: 'sr_escalation_slot_2',
    to_morning: 'to_escalation_slot_1',
    to_evening: 'to_escalation_slot_2',
    ur_scrap: 'ur_scrap_slot_1',
    ur_followup: 'ur_followup_slot_1',
    prf_ob: 'prf_ob_escalation_slot_1',
    supplier_warranty: 'supplier_warranty_escalation_slot_1',
    external_repair: 'external_repair_escalation_slot_1',
  };
  return parseTime(times?.[key] || times?.[legacyKeyMap[key]], fallback);
}

function reportTypeForEscalationSlot(slot) {
  const legacyReportTypeMap = {
    morning: 'main_combined',
    evening: 'main_combined',
    sr_morning: 'sr_escalation',
    sr_afternoon: 'sr_escalation',
    to_morning: 'to_escalation',
    to_evening: 'to_escalation',
    ur_scrap: 'ur_scrap',
    ur_followup: 'ur_followup',
    prf_ob: 'prf_ob_escalation',
    supplier_warranty: 'supplier_warranty_escalation',
    external_repair: 'external_repair_escalation',
  };
  return getReportTypeForSlot(slot) || legacyReportTypeMap[slot] || '';
}

function slotOrder(slot) {
  const match = String(slot || '').match(/_slot_(\d+)$/);
  if (match) return Number(match[1]) || 1;
  if (String(slot || '').includes('evening') || String(slot || '').includes('afternoon')) return 2;
  return 1;
}

function getNextSupplierWarrantyRun(parts, referenceDate, times = {}) {
  const weekday = toIstDate(referenceDate).getUTCDay();
  const minutes = parts.hour * 60 + parts.minute;
  const run = scheduledTime(times, 'supplier_warranty', '20:30');
  const runLabel = formatTimeLabel(run.value);
  if (weekday === 2 && minutes <= run.minutes) return { parts, label: `Supplier Warranty Tuesday ${runLabel}`, startOffset: -4, run };
  if (weekday === 5 && minutes <= run.minutes) return { parts, label: `Supplier Warranty Friday ${runLabel}`, startOffset: -3, run };
  const daysUntilTuesday = (9 - weekday) % 7 || 7;
  const daysUntilFriday = (12 - weekday) % 7 || 7;
  if (daysUntilTuesday < daysUntilFriday) {
    return { parts: addIstDays(parts, daysUntilTuesday), label: `Supplier Warranty Tuesday ${runLabel}`, startOffset: -4, run };
  }
  return { parts: addIstDays(parts, daysUntilFriday), label: `Supplier Warranty Friday ${runLabel}`, startOffset: -3, run };
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function formatIstStamp(date) {
  const parts = getIstParts(date);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)} ${pad(parts.hour)}:${pad(parts.minute)} IST`;
}

async function getSlotWindow(slot, referenceDate = new Date()) {
  const nowIst = getIstParts(referenceDate);
  const times = await getEscalationTimeMap();
  const order = slotOrder(slot);
  const slotTime = scheduledTime(times, slot, order === 2 ? '18:15' : '11:30');
  const runAt = makeUtcFromIst(nowIst.year, nowIst.month, nowIst.day, slotTime.hour, slotTime.minute, 0, 0);
  return {
    slot,
    slotLabel: `Send Time ${order}`,
    runTime: slotTime.value,
    jobDate: `${nowIst.year}-${pad(nowIst.month)}-${pad(nowIst.day)}`,
    windowStart: makeUtcFromIst(nowIst.year, nowIst.month, nowIst.day, 0, 0, 0, 0),
    windowEnd: slot === 'Manual' ? referenceDate : new Date(runAt.getTime() - 1),
  };
}

async function getSrSlotWindow(slot, referenceDate = new Date()) {
  const nowIst = getIstParts(referenceDate);
  const times = await getEscalationTimeMap();
  const order = slotOrder(slot);
  const slotTime = scheduledTime(times, slot, order === 2 ? '15:00' : '11:00');
  const runAt = makeUtcFromIst(nowIst.year, nowIst.month, nowIst.day, slotTime.hour, slotTime.minute, 0, 0);
  return {
    slot,
    category: 'sr',
    slotLabel: `SR Send Time ${order}`,
    runTime: slotTime.value,
    jobDate: `${nowIst.year}-${pad(nowIst.month)}-${pad(nowIst.day)}`,
    windowStart: makeUtcFromIst(nowIst.year, nowIst.month, nowIst.day, 0, 0, 0, 0),
    windowEnd: slot === 'Manual' ? referenceDate : new Date(runAt.getTime() - 1),
    reportName: `sr-escalation-send-${order}-${nowIst.year}-${pad(nowIst.month)}-${pad(nowIst.day)}.xlsx`,
  };
}

async function getToSlotWindow(slot, referenceDate = new Date()) {
  const nowIst = getIstParts(referenceDate);
  const times = await getEscalationTimeMap();
  const order = slotOrder(slot);
  const slotTime = scheduledTime(times, slot, order === 2 ? '16:30' : '11:00');
  const runAt = makeUtcFromIst(nowIst.year, nowIst.month, nowIst.day, slotTime.hour, slotTime.minute, 0, 0);
  return {
    slot,
    category: 'to',
    slotLabel: `TO Send Time ${order}`,
    runTime: slotTime.value,
    jobDate: `${nowIst.year}-${pad(nowIst.month)}-${pad(nowIst.day)}`,
    windowStart: makeUtcFromIst(nowIst.year, nowIst.month, nowIst.day, 0, 0, 0, 0),
    windowEnd: slot === 'Manual' ? referenceDate : new Date(runAt.getTime() - 1),
    reportName: `to-escalation-send-${order}-${nowIst.year}-${pad(nowIst.month)}-${pad(nowIst.day)}.xlsx`,
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

function getPreviousAllowedRunParts(reportType, parts, referenceDate, runTime, scheduleConfig) {
  for (let offset = 1; offset <= 7; offset += 1) {
    const candidate = addIstDays(parts, -offset);
    const dayUtc = makeUtcFromIst(candidate.year, candidate.month, candidate.day, runTime.hour, runTime.minute, 0, 0);
    const weekday = toIstDate(dayUtc).getUTCDay();
    if (isEscalationSlotAllowedOnDay(`${reportType}_slot_1`, weekday, scheduleConfig)) {
      return candidate;
    }
  }
  return getPreviousSundayIstDateParts(parts);
}

async function getUrSlotWindow(slot, referenceDate = new Date()) {
  const nowIst = getIstParts(referenceDate);
  const [times, scheduleConfig] = await Promise.all([
    getEscalationTimeMap(),
    getEscalationScheduleConfig(),
  ]);
  const reportType = reportTypeForEscalationSlot(slot);
  const isScrap = reportType === 'ur_scrap';
  const runTime = scheduledTime(times, slot, isScrap ? '11:00' : '20:00');
  const order = slotOrder(slot);
  if (isScrap) {
    const previousRun = getPreviousAllowedRunParts('ur_scrap', nowIst, referenceDate, runTime, scheduleConfig);
    return {
      slot,
      category: 'ur_scrap',
      slotLabel: `Weekly Scrap Send Time ${order}`,
      runTime: runTime.value,
      jobDate: `${nowIst.year}-${pad(nowIst.month)}-${pad(nowIst.day)}`,
      windowStart: makeUtcFromIst(previousRun.year, previousRun.month, previousRun.day, runTime.hour, runTime.minute, 0, 0),
      windowEnd: slot === 'Manual' ? referenceDate : new Date(makeUtcFromIst(nowIst.year, nowIst.month, nowIst.day, runTime.hour, runTime.minute, 0, 0).getTime() - 1),
      reportName: `ur-scrap-escalation-${nowIst.year}-${pad(nowIst.month)}-${pad(nowIst.day)}.xlsx`,
    };
  }
  const prev = getPreviousIstDateParts(nowIst);
  return {
    slot,
    category: 'ur_followup',
    slotLabel: `Daily Stock Follow-up Send Time ${order}`,
    runTime: runTime.value,
    jobDate: `${nowIst.year}-${pad(nowIst.month)}-${pad(nowIst.day)}`,
    windowStart: makeUtcFromIst(prev.year, prev.month, prev.day, runTime.hour, runTime.minute, 0, 0),
    windowEnd: slot === 'Manual' ? referenceDate : new Date(makeUtcFromIst(nowIst.year, nowIst.month, nowIst.day, runTime.hour, runTime.minute, 0, 0).getTime() - 1),
    reportName: `ur-followup-escalation-${nowIst.year}-${pad(nowIst.month)}-${pad(nowIst.day)}.xlsx`,
  };
}

async function getCustomEscalationSlotWindow(slot, referenceDate = new Date()) {
  const times = await getEscalationTimeMap();
  const baseConfig = CUSTOM_ESCALATIONS[slot];
  const slotTime = scheduledTime(times, slot, baseConfig ? `${pad(baseConfig.runHour)}:${pad(baseConfig.runMinute)}` : '00:00');
  const config = baseConfig ? { ...baseConfig, runHour: slotTime.hour, runMinute: slotTime.minute } : null;
  if (!config) throw new Error(`Unknown escalation slot: ${slot}`);
  const nowIst = getIstParts(referenceDate);
  if (slot === 'supplier_warranty') {
    const run = getNextSupplierWarrantyRun(nowIst, referenceDate, times);
    const start = addIstDays(run.parts, run.startOffset);
    const runAt = makeUtcFromIst(run.parts.year, run.parts.month, run.parts.day, run.run.hour, run.run.minute, 0, 0);
    const scheduledRunTime = Math.abs(referenceDate.getTime() - runAt.getTime()) < 60 * 1000;
    return {
      ...config,
      slotLabel: run.label,
      runTime: run.run.value,
      jobDate: `${run.parts.year}-${pad(run.parts.month)}-${pad(run.parts.day)}`,
      windowStart: makeUtcFromIst(start.year, start.month, start.day, run.run.hour, run.run.minute + 1, 0, 0),
      windowEnd: scheduledRunTime ? new Date(runAt.getTime() - 60 * 1000) : referenceDate,
      reportName: `${config.reportPrefix}-${run.parts.year}-${pad(run.parts.month)}-${pad(run.parts.day)}.xlsx`,
    };
  }
  const prev = getPreviousIstDateParts(nowIst);
  const runAt = makeUtcFromIst(nowIst.year, nowIst.month, nowIst.day, config.runHour, config.runMinute, 0, 0);
  return {
    ...config,
    jobDate: `${nowIst.year}-${pad(nowIst.month)}-${pad(nowIst.day)}`,
    runTime: slotTime.value,
    windowStart: makeUtcFromIst(prev.year, prev.month, prev.day, config.runHour, config.runMinute, 0, 0),
    windowEnd: slot === 'Manual' ? referenceDate : new Date(runAt.getTime() - 1),
    reportName: `${config.reportPrefix}-${nowIst.year}-${pad(nowIst.month)}-${pad(nowIst.day)}.xlsx`,
  };
}

async function getSlotsForCurrentTime(date = new Date()) {
  const parts = getIstParts(date);
  const times = await getEscalationTimeMap();
  const scheduleConfig = await getEscalationScheduleConfig();
  const enabledSlots = getEnabledEscalationSlots(scheduleConfig);
  const weekday = toIstDate(date).getUTCDay();
  const slots = [];
  const matches = (key) => {
    // Only use the time explicitly saved in DB — no fallback to hardcoded defaults
    const rawTime = times?.[key];
    if (!rawTime) return false; // skip if no time configured in Settings
    const time = parseTime(rawTime);
    const runAt = makeUtcFromIst(parts.year, parts.month, parts.day, time.hour, time.minute, 0, 0);
    const dueAge = date.getTime() - runAt.getTime();
    return enabledSlots.has(key)
      && isEscalationSlotAllowedOnDay(key, weekday, scheduleConfig)
      && dueAge >= 0
      && dueAge < SCHEDULER_GRACE_MS;
  };
  
  const { DEFAULT_ESCALATION_TIMES } = require('../utils/escalationSchedule');
  for (const item of DEFAULT_ESCALATION_TIMES) {
    if (matches(item.key)) {
      slots.push(item.key);
    }
  }
  return slots;
}

function buildJobKey(slotWindow) {
  const runTime = String(slotWindow.runTime || '').trim().replace(':', '');
  return `${slotWindow.jobDate}-${slotWindow.slot}${runTime ? `-${runTime}` : ''}`;
}

function isStaleRunningLog(log) {
  if (!log || log.status !== 'running') return false;
  const touched = new Date(log.updatedAt || log.createdAt || 0).getTime();
  return !touched || Date.now() - touched > STALE_RUNNING_MS;
}

async function prepareEscalationRunLog(jobKey, createData, options = {}) {
  const existing = await EscalationRunLog.findOne({ jobKey }).lean();
  if (existing && !options.force) {
    if (existing.status === 'success' || existing.status === 'skipped') {
      return { skip: true, log: existing, message: `Job already processed for ${jobKey}.` };
    }
    if (existing.status === 'running' && !isStaleRunningLog(existing)) {
      return { skip: true, log: existing, message: `Job is already running for ${jobKey}.` };
    }
  }

  const reset = {
    ...createData,
    status: 'running',
    error: '',
    sentAt: null,
  };
  const log = existing
    ? await EscalationRunLog.findOneAndUpdate({ jobKey }, { $set: reset }, { new: true })
    : await EscalationRunLog.create({ jobKey, ...reset });
  return { skip: false, log };
}

function pick(doc, keys = []) {
  for (const key of keys) {
    const value = String(key).split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), doc);
    if (isFilledCell(value)) return value;
  }
  return '';
}

function isObjectIdLike(value) {
  return /^[a-f\d]{24}$/i.test(String(value || '').trim());
}

function cleanDisplayValue(value) {
  if (!isFilledCell(value)) return '';
  if (typeof value === 'object') {
    return cleanDisplayValue(value.name || value.displayName || value.divisionName || value.label);
  }
  const text = String(value).trim();
  return isObjectIdLike(text) ? '' : text;
}

function pickClean(doc, keys = []) {
  for (const key of keys) {
    const value = String(key).split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), doc);
    const clean = cleanDisplayValue(value);
    if (clean) return clean;
  }
  return '';
}

function pickEntryDate(doc) {
  return pick(doc, ['entryDate', 'rcvdDate', 'receivedDate', 'frnEntryDate', 'createdAt']);
}

function pickRepairEngineer(doc) {
  return pickClean(doc, ['raEng', 'repairEngineer', 'repairedBy', 'estRaEng', 'obRaEng']);
}

function pickStockCustomer(doc) {
  // Only return the actual STK/CUST type value (e.g. "STK" or "CUST").
  // Do NOT fall back to customer/custName — those belong in the CUST_NAME column.
  // Also check serviceId.stkCust for docs where stkCust lives on the linked service.
  return pick(doc, ['stkCust', 'stockCust', 'serviceId.stkCust']);
}

function pickItemDescription(doc) {
  return pick(doc, ['itemDescription', 'description', 'partsDescription', 'defMod']);
}

function buildFrnEscalationRow(doc) {
  return {
    'Division Name': pick(doc, ['divisionName', 'division.name', 'division']),
    'DIVISION NAME': pick(doc, ['divisionName', 'division.name', 'division']),
    'SCH REF': pick(doc, ['scRno', 'scReNo', 'scRefNo']),
    RA_ENGINEER: pick(doc, ['raEng', 'estRaEng', 'obRaEng']),
    SC_ENGINEER: doc.scEng || '',
    FRN_NO: doc.frnNo || '',
    BRANCH: pick(doc, ['branch', 'reg', 'region']),
    ENGINEER_ID: pick(doc, ['eng', 'engineer.name', 'engineer']),
    ENGINEER_NAME: pick(doc, ['eng', 'engineer.name', 'engineer']),
    STK_CUST: pickStockCustomer(doc),
    'STK/CUST': pickStockCustomer(doc),
    CUST_NAME: pick(doc, ['customer', 'custName']),
    PRODUCT_MODEL: doc.model || '',
    UNIT_STATUS: doc.unitStatus || doc.unitSts || '',
    DEF_TYPE: doc.defMod || '',
    DEF_MOD_BRD_NAME: doc.defMod || '',
    MOD_BRD_NAME: doc.defMod || '',
    DEF_GIR_NO: doc.defGir || '',
    'PART NUMBER': doc.partNo || '',
    PART_NO: doc.partNo || '',
    'ITEM DESCRIPTION': pickItemDescription(doc),
    REP_GIR_NO: pick(doc, ['repGirNo', 'repGir']),
    'RE VALUE': pick(doc, ['revalue', 'reValue', 'cost']),
    'DEF Part SNO': pick(doc, ['defPartSno', 'obDefPartSno']),
    FINAL_REMARKS: pick(doc, ['finalRemarks', 'remarks', 'techRemarks']),
    DESTINATION: doc.destination || '',
    'SHIPMENT REF NUMBER': doc.shipComm || doc.dcNo || doc.repGirNo || '',
    'REF DATE': (doc.toEscalationQueuedAt || doc.srEscalationQueuedAt || doc.escalationQueuedAt) ? new Date(doc.toEscalationQueuedAt || doc.srEscalationQueuedAt || doc.escalationQueuedAt).toISOString().replace('T', ' ').replace('Z', '') : '',
  };
}

function buildEstimationEscalationRow(doc) {
  return {
    'Division Name': pick(doc, ['divisionName', 'division.name', 'division']),
    'DIVISION NAME': pick(doc, ['divisionName', 'division.name', 'division']),
    'Division Name': pick(doc, ['divisionName', 'division.name', 'division']),
    'DIVISION NAME': pick(doc, ['divisionName', 'division.name', 'division']),
    'SCH REF': pick(doc, ['scReNo', 'scRno', 'scRefNo']),
    RA_ENGINEER: pick(doc, ['obRaEng', 'estRaEng', 'raEng']),
    SC_ENGINEER: doc.scEng || '',
    FRN_NO: doc.frnNo || '',
    BRANCH: pick(doc, ['branch', 'reg', 'region']),
    ENGINEER_ID: pick(doc, ['eng', 'engineer.name', 'engineer', 'estRaEng']),
    ENGINEER_NAME: pick(doc, ['eng', 'engineer.name', 'engineer', 'estRaEng']),
    STK_CUST: pickStockCustomer(doc),
    'STK/CUST': pickStockCustomer(doc),
    CUST_NAME: doc.custName || doc.customer || '',
    PRODUCT_MODEL: doc.model || '',
    UNIT_STATUS: pick(doc, ['unitSts', 'unitStatus']),
    DEF_TYPE: doc.defMod || '',
    DEF_MOD_BRD_NAME: doc.defMod || '',
    MOD_BRD_NAME: doc.defMod || '',
    DEF_TYPE: doc.defType || '',
    DEF_GIR_NO: doc.defGir || '',
    'PART NUMBER': doc.partNo || '',
    PART_NO: doc.partNo || '',
    'ITEM DESCRIPTION': pickItemDescription(doc),
    REP_GIR_NO: doc.obRepGirNo || doc.repGirNo || '',
    'RE VALUE': doc.revalue || '',
    'DEF Part SNO': doc.obDefPartSno || doc.defPartSno || '',
    FINAL_REMARKS: pick(doc, ['finalRemarks', 'obFinalRemarks', 'remarks', 'techRemarks']),
    DESTINATION: doc.obDestination || doc.destination || '',
    'SHIPMENT REF NUMBER': doc.obShipComm || doc.obDcNo || doc.obRepGirNo || doc.estNo || '',
    'REF DATE': (doc.toEscalationQueuedAt || doc.srEscalationQueuedAt || doc.escalationQueuedAt) ? new Date(doc.toEscalationQueuedAt || doc.srEscalationQueuedAt || doc.escalationQueuedAt).toISOString().replace('T', ' ').replace('Z', '') : '',
  };
}

function normalizeToItems(items = []) {
  return (Array.isArray(items) ? items : []).map((item) => ({
    partNo: String(item?.partNo || '').trim(),
    description: String(item?.description || item?.itemDescription || item?.partsDescription || '').trim(),
    qty: Math.max(1, parseInt(item?.qty, 10) || 1),
  })).filter((item) => item.partNo);
}

function buildToEscalationRow(doc, items = []) {
  return {
    'Division Name': pick(doc, ['divisionName', 'division.name', 'division']),
    'DIVISION NAME': pick(doc, ['divisionName', 'division.name', 'division']),
    'SCH REF': pick(doc, ['scRno', 'scReNo', 'scRefNo']),
    SC_REF_NO: pick(doc, ['scRno', 'scReNo', 'scRefNo']),
    FRN_NO: doc.frnNo || '',
    STK_CUST: pickStockCustomer(doc),
    'STK/CUST': pickStockCustomer(doc),
    BRANCH: pick(doc, ['branch', 'reg', 'region']),
    CUST_NAME: pick(doc, ['custName', 'customer']),
    PRODUCT_MODEL: doc.model || '',
    UNIT_STATUS: pick(doc, ['unitSts', 'unitStatus']),
    DEF_GIR_NO: doc.defGir || '',
    MOD_BRD_NAME: doc.defMod || '',
    MODEL: doc.model || '',
    FINAL_REMARKS: doc.finalRemarks || '',
    TO_ITEMS: normalizeToItems(items),
    REF_DATE: (doc.toEscalationQueuedAt || new Date()).toISOString().replace('T', ' ').replace('Z', ''),
  };
}

function buildUrEscalationRow(doc) {
  const divisionName = pickClean(doc, ['divisionName', 'division.name', 'division.displayName', 'division']);
  const entryDate = pickEntryDate(doc);
  const repairEngineer = pickRepairEngineer(doc);
  const partNo = pick(doc, ['partNo', 'partNumber', 'PART_NO', 'PART NUMBER']);
  // stkCust: on UnderRepair it lives on the linked Service doc
  const stkCustVal = pick(doc, ['stkCust', 'stockCust', 'serviceId.stkCust']);
  // defType: actual type (PCB, Consumables, etc.) — from Service doc; defMod is the board name
  const defTypeVal = pick(doc, ['defType', 'serviceId.defType']);
  return {
    'Division Name': divisionName,
    'DIVISION NAME': divisionName,
    'SCH REF': pick(doc, ['scReNo', 'scRno', 'scRefNo']),
    SC_REF_NO: pick(doc, ['scReNo', 'scRno', 'scRefNo']),
    FRN_NO: doc.frnNo || '',
    ENTRY_DATE: entryDate,
    'ENTRY DATE': entryDate,
    'FRN ENTRY DATE': entryDate,
    DIVISION: divisionName,
    BRANCH: pick(doc, ['branch', 'reg', 'region']),
    SC_ENGINEER: doc.scEng || '',
    RA_ENGINEER: repairEngineer,
    REPAIR_ENGINEER: repairEngineer,
    SUPPLIER_NAME: doc.supplier || '',
    ENGINEER_ID: doc.eng || '',
    CUSTOMER_NAME: pick(doc, ['custName', 'customer']),
    STK_CUST: stkCustVal,
    'STK/CUST': stkCustVal,
    MODEL: doc.model || '',
    PRODUCT_MODEL: doc.model || '',
    UNIT_STATUS: pick(doc, ['unitSts', 'unitStatus']),
    DEF_TYPE: defTypeVal,                          // actual defect type: PCB, Consumables, etc.
    DEF_MOD_BRD_NAME: pick(doc, ['defMod', 'defModBrdName', 'serviceId.defMod']),  // board/module name
    MOD_BRD_NAME: pick(doc, ['defMod', 'defModBrdName', 'serviceId.defMod']),
    PART_NO: partNo,
    'Part No': partNo,
    'PART NUMBER': partNo,
    DEF_GIR_NO: doc.defGir || '',
    'ITEM DESCRIPTION': pickItemDescription(doc),
    REP_GIR_NO: doc.repGirNo || '',
    TYPE_OF_WORK: doc.urTypeWork || doc.typeWork || '',
    TYPE_OF_ACC: pick(doc, ['typeOfAcc', 'typeAcc', 'unitStatus', 'unitSts']),
    FINAL_REMARKS: pick(doc, ['finalRemarks', 'remarks', 'fieldRemarks']),
    TECHNICAL_REMARKS: pick(doc, ['techRemarks', 'fieldRemarks']),
    TECH_REMARKS: pick(doc, ['techRemarks', 'fieldRemarks']),
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
    Description: pick(doc, ['partsDescription', 'description', 'itemDescription', 'components', 'defMod']),
    'Description ': pick(doc, ['partsDescription', 'description', 'itemDescription', 'components', 'defMod']),
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
    UNIT_STATUS: pick(doc, ['unitStatus', 'unitSts']),
    DEF_TYPE: doc.defMod || '',
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
    'Vendor Name': pick(doc, ['supplier', 'vendorName']),
    Model: doc.model || '',
    'Customer name': doc.customer || doc.custName || '',
    'Unit Serial no.': doc.serialNo || '',
    'Unit Status': pick(doc, ['unitStatus', 'unitSts']),
    'Problem details': pick(doc, ['techRemarks', 'finalRemarks', 'fieldRemarks', 'remarks']),
    'Part no.': pick(doc, ['partNo', 'partNumber']),
    'Item Description': pick(doc, ['partsDescription', 'description', 'components', 'defMod']),
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
    UNIT_STATUS: pick(doc, ['unitStatus', 'unitSts']),
    DEF_TYPE: doc.defMod || '',
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

function isFilledCell(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function mergeEscalationRow(base = {}, queued = {}) {
  const merged = { ...(base || {}) };
  Object.entries(queued || {}).forEach(([key, value]) => {
    if (isFilledCell(value) || !isFilledCell(merged[key])) {
      merged[key] = value;
    }
  });
  ['STK_CUST', 'STK/CUST', 'CUST_NAME', 'CUSTOMER_NAME', 'ITEM DESCRIPTION'].forEach((key) => {
    if (isFilledCell(base[key])) {
      merged[key] = base[key];
    }
  });
  ['Division Name', 'DIVISION NAME', 'DIVISION'].forEach((key) => {
    const baseValue = cleanDisplayValue(base[key]);
    const mergedValue = cleanDisplayValue(merged[key]);
    if (baseValue && (!mergedValue || isObjectIdLike(merged[key]))) {
      merged[key] = baseValue;
    }
  });
  ['ENTRY_DATE', 'ENTRY DATE', 'FRN ENTRY DATE', 'RA_ENGINEER', 'REPAIR_ENGINEER'].forEach((key) => {
    if (isFilledCell(base[key]) && !isFilledCell(merged[key])) {
      merged[key] = base[key];
    }
  });
  Object.entries(base || {}).forEach(([key, value]) => {
    if (!isFilledCell(merged[key]) && isFilledCell(value)) {
      merged[key] = value;
    }
  });
  return merged;
}

function validObjectIds(queueDocs = [], moduleName = '') {
  return [...new Set(queueDocs
    .filter((doc) => (!moduleName || doc.module === moduleName) && doc.sourceId && mongoose.Types.ObjectId.isValid(doc.sourceId))
    .map((doc) => String(doc.sourceId)))];
}

async function loadSourceMap(Model, ids = []) {
  if (!ids.length) return new Map();
  const query = Model.find({ _id: { $in: ids } });
  if (['Service', 'Empfrn', 'EstimationPending'].includes(Model.modelName)) {
    query.populate({ path: 'division', select: 'name', strictPopulate: false });
  }
  // For models where stkCust lives on the linked serviceId, populate it too
  if (['Empfrn', 'EstimationPending'].includes(Model.modelName)) {
    query.populate({ path: 'serviceId', select: 'stkCust stockCust', strictPopulate: false });
  }
  const docs = await query.lean();
  return new Map(docs.map((doc) => [String(doc._id), doc]));
}

function hydratedQueueRow(queueDoc, sourceMap, builder) {
  const queued = queueDoc?.row || {};
  const source = sourceMap.get(String(queueDoc?.sourceId || ''));
  if (!source) return queued;
  return mergeEscalationRow(builder(source), queued);
}

async function collectEscalationData(slotWindow) {
  const queueDocs = await EscalationQueue.find({
    module: { $in: ['frn', 'est'] },
    queuedAt: { $lte: slotWindow.windowEnd }
  }).sort({ queuedAt: 1 }).lean();

  const [frnMap, estMap] = await Promise.all([
    loadSourceMap(Empfrn, validObjectIds(queueDocs, 'frn')),
    loadSourceMap(EstimationPending, validObjectIds(queueDocs, 'est')),
  ]);
  const frnRows = [];
  const estimationRows = [];
  queueDocs.forEach((doc) => {
    if (doc.module === 'frn') frnRows.push(hydratedQueueRow(doc, frnMap, buildFrnEscalationRow));
    if (doc.module === 'est') estimationRows.push(hydratedQueueRow(doc, estMap, buildEstimationEscalationRow));
  });

  return {
    frnRows,
    estimationRows,
    queueDocs,
  };
}

async function collectUrEscalationData(slotWindow) {
  const moduleName = slotWindow.category === 'ur_scrap' || reportTypeForEscalationSlot(slotWindow.slot) === 'ur_scrap'
    ? 'ur_scrap'
    : 'ur_followup';
  const queueDocs = await EscalationQueue.find({
    module: moduleName,
    queuedAt: { $lte: slotWindow.windowEnd }
  }).sort({ queuedAt: 1 }).lean();
  const serviceMap = await loadSourceMap(Service, validObjectIds(queueDocs, moduleName));

  if (moduleName === 'ur_scrap') {
    const missingIds = validObjectIds(queueDocs, moduleName).filter(id => !serviceMap.has(id));
    if (missingIds.length > 0) {
      const Scrap = require('../models/Scrap');
      const scrapMap = await loadSourceMap(Scrap, missingIds);
      for (const [k, v] of scrapMap.entries()) {
        serviceMap.set(k, v);
      }
    }
  }

  return {
    rows: queueDocs.map((doc) => hydratedQueueRow(doc, serviceMap, buildUrEscalationRow)),
    queueDocs,
  };
}

async function collectCustomEscalationData(slotWindow) {
  const queueDocs = await EscalationQueue.find({
    module: slotWindow.module,
    queuedAt: { $lte: slotWindow.windowEnd }
  }).sort({ queuedAt: 1 }).lean();

  return {
    rows: queueDocs.map((doc) => doc.row || {}),
    queueDocs,
  };
}

async function collectSrEscalationData(slotWindow) {
  const queueDocs = await EscalationQueue.find({
    module: { $in: ['sr_frn', 'sr_est'] },
    queuedAt: { $lte: slotWindow.windowEnd }
  }).sort({ queuedAt: 1 }).lean();

  const [frnMap, estMap] = await Promise.all([
    loadSourceMap(Empfrn, validObjectIds(queueDocs, 'sr_frn')),
    loadSourceMap(EstimationPending, validObjectIds(queueDocs, 'sr_est')),
  ]);
  const frnRows = [];
  const estimationRows = [];
  queueDocs.forEach((doc) => {
    if (doc.module === 'sr_frn') frnRows.push(hydratedQueueRow(doc, frnMap, buildFrnEscalationRow));
    if (doc.module === 'sr_est') estimationRows.push(hydratedQueueRow(doc, estMap, buildEstimationEscalationRow));
  });

  return { frnRows, estimationRows, queueDocs };
}

async function clearSrEscalationQueue(queueDocs = []) {
  if (!queueDocs.length) return;
  const queueIds = queueDocs.map((doc) => doc._id).filter(Boolean);

  const ops = [];
  if (queueIds.length) ops.push(EscalationQueue.deleteMany({ _id: { $in: queueIds } }));
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
    ops.push(mongoose.model('Service').updateMany(
      { _id: { $in: urIds } },
      { $set: { toEscalationQueuedAt: null, toEscalationQueuedBy: '' } }
    ));
  }
  await Promise.all(ops);
}

async function clearGenericEscalationQueue(queueDocs = []) {
  if (!queueDocs.length) return;
  const queueIds = queueDocs.map((doc) => doc._id).filter(Boolean);
  const frnIds = [...new Set(queueDocs.filter((doc) => doc.module === 'frn' && doc.sourceId).map((doc) => doc.sourceId))];
  const estIds = [...new Set(queueDocs.filter((doc) => doc.module === 'est' && doc.sourceId).map((doc) => doc.sourceId))];

  const ops = [];
  if (queueIds.length) ops.push(EscalationQueue.deleteMany({ _id: { $in: queueIds } }));
  if (frnIds.length) {
    ops.push(Empfrn.updateMany(
      { _id: { $in: frnIds } },
      { $set: { escalationQueuedAt: null, escalationQueuedBy: '' } }
    ));
  }
  if (estIds.length) {
    ops.push(EstimationPending.updateMany(
      { _id: { $in: estIds } },
      { $set: { escalationQueuedAt: null, escalationQueuedBy: '' } }
    ));
  }
  await Promise.all(ops);
}

async function clearUrCustomEscalationQueue(queueDocs = []) {
  if (!queueDocs.length) return;
  const queueIds = queueDocs
    .map((doc) => doc._id)
    .filter(Boolean);
  if (queueIds.length) {
    await EscalationQueue.deleteMany({ _id: { $in: queueIds } });
  }
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
  const isScrap = slotWindow.category === 'ur_scrap' || reportTypeForEscalationSlot(slotWindow.slot) === 'ur_scrap';
  const title = isScrap ? 'Weekly Scrap Escalation Report' : 'Daily Stock Escalation Report';
  const bodyLines = [
    isScrap ? 'SchillerIndia scrap escalation report' : 'SchillerIndia stock escalation report',
    '',
    `Slot: ${slotWindow.slotLabel}`,
    `Window (IST): ${formatIstStamp(slotWindow.windowStart)} to ${formatIstStamp(slotWindow.windowEnd)}`,
    `Records: ${data.rows.length}`,
    '',
    `Attached Excel contains the ${isScrap ? 'scrap' : 'stock'} escalation details.`,
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
        headers: isScrap ? SCRAP_ESCALATION_HEADERS : undefined,
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
    queuedAt: { $lte: slotWindow.windowEnd },
  }).sort({ queuedAt: 1 }).lean();
  const [frnMap, estMap, serviceMap] = await Promise.all([
    loadSourceMap(Empfrn, validObjectIds(rows, 'to_frn')),
    loadSourceMap(EstimationPending, validObjectIds(rows, 'to_est')),
    loadSourceMap(Service, validObjectIds(rows, 'to_ur')),
  ]);

  const frnRows = rows
    .filter((item) => item.module === 'to_frn')
    .map((item) => hydratedQueueRow(item, frnMap, (source) => buildToEscalationRow(source, item.row?.TO_ITEMS || [])));
  const estimationRows = rows
    .filter((item) => item.module === 'to_est')
    .map((item) => hydratedQueueRow(item, estMap, (source) => buildToEscalationRow(source, item.row?.TO_ITEMS || [])));
  const underRepairRows = rows
    .filter((item) => item.module === 'to_ur')
    .map((item) => hydratedQueueRow(item, serviceMap, (source) => buildToEscalationRow(source, item.row?.TO_ITEMS || [])));

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
    subject: `DR Replacement Escalation Report - ${slotWindow.slotLabel} - ${slotWindow.jobDate}`,
    body: [
      'SchillerIndia DR replacement escalation report',
      '',
      `Slot: ${slotWindow.slotLabel}`,
      `Window (IST): ${formatIstStamp(slotWindow.windowStart)} to ${formatIstStamp(slotWindow.windowEnd)}`,
      `Pending FRN DR records: ${data.frnRows.length}`,
      `SO Pending DR records: ${data.estimationRows.length}`,
      `Total records: ${total}`,
      '',
      'Attached Excel contains the combined DR replacement escalation details from Pending FRN and SO Pending.',
    ].join('\n'),
    sheets: [
      {
        name: 'DR Replacement',
        template: 'SR',
        headers: [
          'Division Name',
          'SCH REF',
          'FRN_NO',
          'STK_CUST',
          'BRANCH',
          'CUST_NAME',
          'PRODUCT_MODEL',
          'UNIT_STATUS',
          'DEF_GIR_NO',
          'PART_NO',
          'ITEM DESCRIPTION',
        ],
        rows: combinedRows,
      },
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
        'DIVISION NAME': row['Division Name'] || row['DIVISION NAME'] || '',
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
        'DIVISION NAME': row['Division Name'] || row['DIVISION NAME'] || '',
        'SCH REF': row['SCH REF'] || row.SC_REF_NO || '',
        FRN_NO: row.FRN_NO || '',
        STK_CUST: row.STK_CUST || '',
        BRANCH: row.BRANCH || '',
        CUST_NAME: row.CUST_NAME || '',
        PRODUCT_MODEL: row.PRODUCT_MODEL || row.MODEL || '',
        UNIT_STATUS: row.UNIT_STATUS || '',
        DEF_GIR_NO: row.DEF_GIR_NO || '',
        PART_NO: item.partNo || '',
        'ITEM DESCRIPTION': item.description || row['ITEM DESCRIPTION'] || '',
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
  if (fs.existsSync(PROJECT_PYTHON)) candidates.push({ command: PROJECT_PYTHON, argsPrefix: [] });
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
        if (error.killed || error.signal) {
          error.message = `Escalation mailer timed out after ${Math.round((options.timeout || MAIL_TIMEOUT_MS) / 1000)} seconds. Check SMTP sender settings and retry.`;
        }
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

function requireMailerDependency(name) {
  try {
    return require(name);
  } catch (error) {
    if (error && error.code === 'MODULE_NOT_FOUND') {
      error.message = `${name} is not installed. Run npm install in backend or redeploy so backend/package.json dependencies are installed.`;
    }
    throw error;
  }
}

function attachmentContentType(filePath) {
  return String(path.extname(filePath || '')).toLowerCase() === '.pdf'
    ? 'application/pdf'
    : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
}

function withMailTimeout(promise) {
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Escalation mailer timed out after ${Math.round(MAIL_TIMEOUT_MS / 1000)} seconds. Check SMTP sender settings and retry.`));
    }, MAIL_TIMEOUT_MS + 5000);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

async function buildWorkbookWithNode(payload, outputPath) {
  const ExcelJS = requireMailerDependency('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SchillerIndia Services';
  workbook.created = new Date();
  const sheets = Array.isArray(payload.sheets) && payload.sheets.length ? payload.sheets : [{ name: 'Report', rows: [] }];
  sheets.forEach((sheet, index) => {
    const rows = Array.isArray(sheet.rows) ? sheet.rows : [];
    const keys = [];
    rows.forEach((row) => {
      Object.keys(row || {}).forEach((key) => {
        if (!keys.includes(key)) keys.push(key);
      });
    });
    const worksheet = workbook.addWorksheet(String(sheet.name || sheet.template || `Sheet${index + 1}`).slice(0, 31));
    worksheet.addRow([String(payload.subject || 'Escalation Report')]);
    worksheet.addRow([String(payload.body || '').split(/\r?\n/).filter(Boolean).join(' | ')]);
    worksheet.addRow([]);
    if (!keys.length) {
      return;
    }
    worksheet.addRow(keys);
    rows.forEach((row) => worksheet.addRow(keys.map((key) => row?.[key] ?? '')));
    worksheet.getRow(1).font = { bold: true, size: 14 };
    worksheet.getRow(4).font = { bold: true };
    worksheet.columns = keys.map((key) => ({ width: Math.min(Math.max(String(key).length + 4, 14), 34) }));
  });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  await workbook.xlsx.writeFile(outputPath);
}

async function sendEscalationWorkbookWithNode(payload, outputPath, sender) {
  if (!fs.existsSync(outputPath)) {
    await buildWorkbookWithNode(payload, outputPath);
  }
  const nodemailer = requireMailerDependency('nodemailer');
  const port = Number(sender.smtpPort || 587);
  const to = Array.isArray(payload.to) && payload.to.length ? payload.to : splitCsv(process.env.ESCALATION_EMAIL_TO);
  const cc = splitCsv(process.env.ESCALATION_EMAIL_CC);
  if (!to.length) throw new Error('ESCALATION_EMAIL_TO is empty.');
  const transporter = nodemailer.createTransport({
    host: sender.smtpHost,
    port,
    secure: Boolean(sender.ssl) || port === 465,
    auth: {
      user: sender.smtpUser,
      pass: sender.smtpPass,
    },
    requireTLS: !sender.ssl,
    connectionTimeout: MAIL_TIMEOUT_MS,
    greetingTimeout: MAIL_TIMEOUT_MS,
    socketTimeout: MAIL_TIMEOUT_MS,
  });
  await withMailTimeout(transporter.sendMail({
    from: sender.fromEmail || sender.smtpUser,
    to,
    cc,
    subject: payload.subject || 'Escalation Report',
    text: payload.body || 'Please find the attached escalation report.',
    attachments: [{
      filename: path.basename(outputPath),
      path: outputPath,
      contentType: attachmentContentType(outputPath),
    }],
  }));
}

async function sendEscalationWorkbook(payload, outputPath, senderConfig = null) {
  try {
    const sender = senderConfig || await getReadyEscalationSenderConfig();
    return await runEscalationMailer(payload, outputPath, sender);
  } catch (error) {
    throw new Error(error.message || 'Escalation mail send failed. The report file was generated; please retry from escalation status.');
  }
}

function buildMailAcceptedFields(mailResult = {}) {
  if (Array.isArray(mailResult)) {
    const providers = new Set();
    const messageIds = [];
    const tos = [];
    mailResult.forEach(res => {
      const r = res.mailResult || res || {};
      if (r.provider) providers.add(r.provider);
      if (r.messageId) messageIds.push(r.messageId);
      if (r.to) tos.push(r.to);
    });
    const providerStr = Array.from(providers).join(', ') || 'provider';
    const parts = [
      `Accepted by ${providerStr} API`,
      messageIds.length ? `Message IDs: ${messageIds.join(', ')}` : '',
    ].filter(Boolean);
    return {
      message: parts.join(' | '),
      mailProvider: Array.from(providers).join(', '),
      mailMessageId: messageIds.join(', '),
      mailAcceptedTo: tos.join('; '),
    };
  }

  const result = mailResult.mailResult || mailResult || {};
  const provider = String(result.provider || '').trim();
  const messageId = String(result.messageId || '').trim();
  const acceptedTo = String(result.to || '').trim();
  const parts = [
    provider ? `Accepted by ${provider} API` : 'Mail accepted by provider',
    messageId ? `Message ID: ${messageId}` : '',
  ].filter(Boolean);
  return {
    message: parts.join(' | '),
    mailProvider: provider,
    mailMessageId: messageId,
    mailAcceptedTo: acceptedTo,
  };
}

async function sendEscalationSenderTest(toEmail = '') {
  const sender = await getReadyEscalationSenderConfig();
  const to = String(toEmail || sender.fromEmail || sender.smtpUser || '').trim();
  if (!to) throw new Error('Test receiver email is missing.');
  const outputPath = path.join(os.tmpdir(), `schiller-escalation-smtp-test-${Date.now()}.xlsx`);
  const payload = {
    to: [to],
    subject: '[SchillerIndia] Escalation sender test',
    body: 'This is a test email from the SchillerIndia escalation sender configuration.',
    format: 'xlsx',
    sheets: [
      {
        name: 'SMTP Test',
        rows: [
          {
            Status: 'SMTP sender test',
            From: sender.fromEmail,
            Host: `${sender.smtpHost}:${sender.smtpPort || '587'}`,
            Time: new Date().toISOString(),
          },
        ],
      },
    ],
  };
  try {
    await sendEscalationWorkbook(payload, outputPath, sender);
    return { to, from: sender.fromEmail, host: sender.smtpHost, port: sender.smtpPort || '587' };
  } finally {
    try { fs.unlinkSync(outputPath); } catch (_) {}
  }
}

function filterDataByDivisionAndRegion(data, division) {
  const targetDivStr = String(division || 'all').toLowerCase();
  if (targetDivStr === 'all' || !targetDivStr) return data;
  
  const targetDivs = targetDivStr.split(',').map(d => d.trim()).filter(Boolean);
  
  const filterRow = (row) => {
    const div = String(row['Division Name'] || row['DIVISION NAME'] || row['DIVISION'] || row.division || row.Division || '').toLowerCase().trim();
    if (!div) return false;
    return targetDivs.includes(div);
  };

  const result = { ...data };
  if (data.frnRows) result.frnRows = data.frnRows.filter(filterRow);
  if (data.estimationRows) result.estimationRows = data.estimationRows.filter(filterRow);
  if (data.underRepairRows) result.underRepairRows = data.underRepairRows.filter(filterRow);
  if (data.rows) result.rows = data.rows.filter(filterRow);
  return result;
}

async function dispatchEscalationGroups(slotWindow, data, recipientsConfig, payloadBuilder, baseReportPath, sender) {
  const groups = {};
  for (const rc of recipientsConfig) {
    const key = `${String(rc.division || 'all').toLowerCase()}|${String(rc.region || 'all').toLowerCase()}`;
    if (!groups[key]) groups[key] = { division: String(rc.division || 'all'), region: String(rc.region || 'all'), emails: new Set() };
    groups[key].emails.add(rc.email);
  }

  const results = [];
  const ext = require('path').extname(baseReportPath) || '.xlsx';
  const baseName = baseReportPath.slice(0, -ext.length);

  for (const key in groups) {
    const group = groups[key];
    const groupEmails = Array.from(group.emails);
    
    const filteredData = filterDataByDivisionAndRegion(data, group.division);
    const divSuffix = group.division === 'all' ? '' : `-${group.division.replace(/[^a-z0-9]/gi, '')}`;
    const reportPath = `${baseName}${divSuffix}${ext}`;
    
    const payload = payloadBuilder(slotWindow, filteredData);
    payload.to = groupEmails;
    
    const mailResult = await sendEscalationWorkbook(payload, reportPath, sender);
    results.push({ reportPath, mailResult });
  }
  return results;
}

async function runEscalationSlot(slot, options = {}) {
  if (!mongoose.connection || mongoose.connection.readyState !== 1) {
    return { ok: false, skipped: true, message: 'MongoDB is not connected.' };
  }

  const slotWindow = await getSlotWindow(slot, options.referenceDate || new Date());
  if (options.trigger === 'manual') slotWindow.windowEnd = options.referenceDate || new Date();
  const jobKey = buildJobKey(slotWindow);
  const prepared = await prepareEscalationRunLog(jobKey, {
    slot,
    category: 'main',
    trigger: options.trigger || 'scheduler',
    windowStart: slotWindow.windowStart,
    windowEnd: slotWindow.windowEnd,
  }, options);
  if (prepared.skip) return { ok: true, skipped: true, message: prepared.message, log: prepared.log };
  let log = prepared.log;

  try {
    const recipients = await getEscalationRecipients('main_combined');
    if (!recipients.length) {
      log = await EscalationRunLog.findByIdAndUpdate(log._id, { $set: { status: 'skipped', error: 'ESCALATION_EMAIL_TO is empty.' } }, { new: true });
      return { ok: false, skipped: true, message: 'ESCALATION_EMAIL_TO is not configured.', log };
    }

    const data = await collectEscalationData(slotWindow);
    const totalCount = data.frnRows.length + data.estimationRows.length;

    fs.mkdirSync(REPORT_DIR, { recursive: true });
    let reportPath = path.join(REPORT_DIR, `dispatch-escalation-${slotWindow.slot}-${slotWindow.jobDate}.xlsx`);
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
    const results = await dispatchEscalationGroups(slotWindow, data, recipients, buildMailPayload, reportPath, sender);
    const mailResults = results.map(r => r.mailResult).filter(Boolean);
    reportPath = results.map(r => r.reportPath).join(',');
    await clearGenericEscalationQueue(data.queueDocs || []);

    log = await EscalationRunLog.findByIdAndUpdate(
      log._id,
      {
        $set: {
          status: 'success',
          frnCount: data.frnRows.length,
          estCount: data.estimationRows.length,
          totalCount,
          reportPath,
          ...buildMailAcceptedFields(mailResults),
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

  const slotWindow = await getUrSlotWindow(slot, options.referenceDate || new Date());
  if (options.trigger === 'manual') slotWindow.windowEnd = options.referenceDate || new Date();
  const jobKey = buildJobKey(slotWindow);
  const prepared = await prepareEscalationRunLog(jobKey, {
    slot,
    category: slotWindow.category,
    trigger: options.trigger || 'scheduler',
    windowStart: slotWindow.windowStart,
    windowEnd: slotWindow.windowEnd,
  }, options);
  if (prepared.skip) return { ok: true, skipped: true, message: prepared.message, log: prepared.log };
  let log = prepared.log;

  try {
    const targetReportType = slotWindow.category === 'ur_scrap' ? 'ur_scrap' : 'ur_followup';
    const recipients = await getEscalationRecipients([targetReportType, 'ur_escalation']);
    if (!recipients.length) {
      log = await EscalationRunLog.findByIdAndUpdate(log._id, { $set: { status: 'skipped', error: 'ESCALATION_EMAIL_TO is empty.' } }, { new: true });
      return { ok: false, skipped: true, message: 'ESCALATION_EMAIL_TO is not configured.', log };
    }

    const data = await collectUrEscalationData(slotWindow);

    fs.mkdirSync(REPORT_DIR, { recursive: true });
    let reportPath = path.join(REPORT_DIR, slotWindow.reportName);
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
    const results = await dispatchEscalationGroups(slotWindow, data, recipients, buildUrMailPayload, reportPath, sender);
    const mailResults = results.map(r => r.mailResult).filter(Boolean);
    reportPath = results.map(r => r.reportPath).join(',');
    await clearUrCustomEscalationQueue(data.queueDocs || []);

    log = await EscalationRunLog.findByIdAndUpdate(
      log._id,
      {
        $set: {
          status: 'success',
          urCount: data.rows.length,
          totalCount: data.rows.length,
          reportPath,
          ...buildMailAcceptedFields(mailResults),
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

  const slotWindow = await getSrSlotWindow(slot, options.referenceDate || new Date());
  if (options.trigger === 'manual') slotWindow.windowEnd = options.referenceDate || new Date();
  const jobKey = buildJobKey(slotWindow);
  const prepared = await prepareEscalationRunLog(jobKey, {
    slot,
    category: 'sr',
    trigger: options.trigger || 'scheduler',
    windowStart: slotWindow.windowStart,
    windowEnd: slotWindow.windowEnd,
  }, options);
  if (prepared.skip) return { ok: true, skipped: true, message: prepared.message, log: prepared.log };
  let log = prepared.log;

  try {
    const recipients = await getEscalationRecipients('sr_escalation');
    if (!recipients.length) {
      log = await EscalationRunLog.findByIdAndUpdate(log._id, { $set: { status: 'skipped', error: 'ESCALATION_EMAIL_TO is empty.' } }, { new: true });
      return { ok: false, skipped: true, message: 'ESCALATION_EMAIL_TO is not configured.', log };
    }

    const data = await collectSrEscalationData(slotWindow);
    const totalCount = data.frnRows.length + data.estimationRows.length;

    fs.mkdirSync(REPORT_DIR, { recursive: true });
    let reportPath = path.join(REPORT_DIR, slotWindow.reportName);
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
    const results = await dispatchEscalationGroups(slotWindow, data, recipients, buildSrMailPayload, reportPath, sender);
    const mailResults = results.map(r => r.mailResult).filter(Boolean);
    reportPath = results.map(r => r.reportPath).join(',');
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
          ...buildMailAcceptedFields(mailResults),
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

  const slotWindow = await getToSlotWindow(slot, options.referenceDate || new Date());
  if (options.trigger === 'manual') slotWindow.windowEnd = options.referenceDate || new Date();
  const jobKey = buildJobKey(slotWindow);
  const prepared = await prepareEscalationRunLog(jobKey, {
    slot,
    category: 'to',
    trigger: options.trigger || 'scheduler',
    windowStart: slotWindow.windowStart,
    windowEnd: slotWindow.windowEnd,
  }, options);
  if (prepared.skip) return { ok: true, skipped: true, message: prepared.message, log: prepared.log };
  let log = prepared.log;

  try {
    const recipients = await getEscalationRecipients('to_escalation');
    if (!recipients.length) {
      log = await EscalationRunLog.findByIdAndUpdate(log._id, { $set: { status: 'skipped', error: 'ESCALATION_EMAIL_TO is empty.' } }, { new: true });
      return { ok: false, skipped: true, message: 'ESCALATION_EMAIL_TO is not configured.', log };
    }

    const data = await collectToEscalationData(slotWindow);
    const totalCount = data.frnRows.length + data.estimationRows.length + (data.underRepairRows || []).length;

    fs.mkdirSync(REPORT_DIR, { recursive: true });
    let reportPath = path.join(REPORT_DIR, slotWindow.reportName);
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
    const results = await dispatchEscalationGroups(slotWindow, data, recipients, buildToMailPayload, reportPath, sender);
    const mailResults = results.map(r => r.mailResult).filter(Boolean);
    reportPath = results.map(r => r.reportPath).join(',');
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
          ...buildMailAcceptedFields(mailResults),
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

  const slotWindow = await getCustomEscalationSlotWindow(slot, options.referenceDate || new Date());
  if (options.trigger === 'manual') slotWindow.windowEnd = options.referenceDate || new Date();
  const jobKey = buildJobKey(slotWindow);
  const prepared = await prepareEscalationRunLog(jobKey, {
    slot,
    category: slotWindow.category,
    trigger: options.trigger || 'scheduler',
    windowStart: slotWindow.windowStart,
    windowEnd: slotWindow.windowEnd,
  }, options);
  if (prepared.skip) return { ok: true, skipped: true, message: prepared.message, log: prepared.log };
  let log = prepared.log;

  try {
    const recipients = await getEscalationRecipients(slotWindow.reportType);
    if (!recipients.length) {
      log = await EscalationRunLog.findByIdAndUpdate(log._id, { $set: { status: 'skipped', error: 'ESCALATION_EMAIL_TO is empty.' } }, { new: true });
      return { ok: false, skipped: true, message: 'ESCALATION_EMAIL_TO is not configured.', log };
    }

    const data = await collectCustomEscalationData(slotWindow);

    fs.mkdirSync(REPORT_DIR, { recursive: true });
    let reportPath = path.join(REPORT_DIR, slotWindow.reportName);
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
    const results = await dispatchEscalationGroups(slotWindow, data, recipients, buildCustomMailPayload, reportPath, sender);
    const mailResults = results.map(r => r.mailResult).filter(Boolean);
    reportPath = results.map(r => r.reportPath).join(',');
    await clearUrCustomEscalationQueue(data.queueDocs || []);

    log = await EscalationRunLog.findByIdAndUpdate(
      log._id,
      {
        $set: {
          status: 'success',
          totalCount: data.rows.length,
          reportPath,
          ...buildMailAcceptedFields(mailResults),
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

  console.log('[Escalation] Scheduler armed with configurable escalation timings from Settings.');
  const { getReportTypeForSlot } = require('../utils/escalationSchedule');
  let schedulerBusy = false;
  const timer = setInterval(async () => {
    if (schedulerBusy) return;
    if (!mongoose.connection || mongoose.connection.readyState !== 1) return;
    schedulerBusy = true;
    try {
      const referenceDate = new Date();
      const slots = await getSlotsForCurrentTime(referenceDate);
      if (!slots.length) return;
      for (const slot of slots) {
        const reportType = getReportTypeForSlot(slot);
        let result;
        if (reportType === 'main_combined') {
          result = await runEscalationSlot(slot, { trigger: 'scheduler', referenceDate });
        } else if (reportType === 'sr_escalation') {
          result = await runSrEscalationSlot(slot, { trigger: 'scheduler', referenceDate });
        } else if (reportType === 'to_escalation') {
          result = await runToEscalationSlot(slot, { trigger: 'scheduler', referenceDate });
        } else if (reportType === 'ur_scrap' || reportType === 'ur_followup') {
          result = await runUrEscalationSlot(slot, { trigger: 'scheduler', referenceDate });
        } else {
          result = await runCustomEscalationSlot(slot, { trigger: 'scheduler', referenceDate });
        }
        if (result && !result.skipped) console.log(`[Escalation] ${slot} slot: ${result.message}`);
      }
    } catch (error) {
      console.error('[Escalation] Scheduler error:', error.message);
    } finally {
      schedulerBusy = false;
    }
  }, SCHEDULER_TICK_MS);

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
  sendEscalationSenderTest,
};
