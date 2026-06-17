const express = require('express');
const router = express.Router();

const { protect, adminOnly } = require('../middleware/authMiddleware');
const EscalationRunLog = require('../models/EscalationRunLog');
const EscalationQueue = require('../models/EscalationQueue');
const { runEscalationSlot, runSrEscalationSlot, runToEscalationSlot, runUrEscalationSlot, runCustomEscalationSlot, getEscalationRecipients, getSrSlotWindow, getToSlotWindow } = require('../services/escalationService');
const { getEscalationLabelMap, labelFor, composeSlotLabel } = require('../utils/escalationLabels');
const { getEscalationTimeMap, getEscalationScheduleConfig, getEnabledSlotsForReportType, isEscalationReportAllowedOnDay, parseTime, formatTimeLabel } = require('../utils/escalationSchedule');

const IST_OFFSET_MINUTES = 330;
const IST_OFFSET_MS = IST_OFFSET_MINUTES * 60 * 1000;
const CUSTOM_ESCALATION_STATUS = {
  'prf-ob': {
    module: 'prf_ob',
    category: 'prf_ob',
    reportType: 'prf_ob_escalation',
    slot: 'prf_ob',
    slotLabel: 'PRF/OB Daily',
    nextRunLabel: '4:30 PM',
    runHour: 16,
    runMinute: 30,
  },
  'supplier-warranty': {
    module: 'supplier_warranty',
    category: 'supplier_warranty',
    reportType: 'supplier_warranty_escalation',
    slot: 'supplier_warranty',
    slotLabel: 'Supplier Warranty Tue/Fri',
    nextRunLabel: 'Tue/Fri 8:30 PM',
    runHour: 20,
    runMinute: 30,
  },
  'external-repair': {
    module: 'external_repair',
    category: 'external_repair',
    reportType: 'external_repair_escalation',
    slot: 'external_repair',
    slotLabel: 'External Repair Daily',
    nextRunLabel: '3:30 PM',
    runHour: 15,
    runMinute: 30,
  },
};
const MAIL_TIMEOUT_MS = Math.max(30000, parseInt(process.env.ESCALATION_MAIL_TIMEOUT_MS || '120000', 10) || 120000);
const DEFAULT_STALE_RUNNING_MS = Math.max(10 * 60 * 1000, MAIL_TIMEOUT_MS * 4 + 60 * 1000);
const STALE_RUNNING_MS = Math.max(60 * 1000, parseInt(process.env.ESCALATION_STALE_RUNNING_MS || String(DEFAULT_STALE_RUNNING_MS), 10) || DEFAULT_STALE_RUNNING_MS);

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

function pad(value) {
  return String(value).padStart(2, '0');
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

function visibleLatestLog(log, activeTotal = 0) {
  if (!log) return null;
  const logTotal = Number(log.totalCount || 0);
  if (activeTotal === 0 && log.status === 'failed' && logTotal === 0 && !String(log.error || '').trim()) return null;
  return log;
}

async function getOrderedConfiguredSlots(reportType, fallbackSlots, fallbackTimes, times = null) {
  const [timeMap, scheduleConfig] = await Promise.all([
    times ? Promise.resolve(times) : getEscalationTimeMap(),
    getEscalationScheduleConfig(),
  ]);
  const enabled = getEnabledSlotsForReportType(reportType, scheduleConfig);
  const slots = (enabled.length ? enabled : fallbackSlots).map((slot, index) => {
    const time = scheduledTime(timeMap, slot, fallbackTimes[slot] || '00:00');
    return { slot, time, order: fallbackSlots.indexOf(slot) + 1 || index + 1 };
  });
  return slots.sort((a, b) => a.time.minutes - b.time.minutes || a.order - b.order);
}

async function getActiveConfiguredQueueWindow(reportType, fallbackSlots, fallbackTimes, labelPrefix, referenceDate = new Date()) {
  const nowIst = getIstParts(referenceDate);
  const scheduleConfig = await getEscalationScheduleConfig();
  const slots = await getOrderedConfiguredSlots(reportType, fallbackSlots, fallbackTimes);
  const candidates = [];
  for (let offset = 0; offset <= 7; offset += 1) {
    const parts = addIstDays(nowIst, offset);
    const dayUtc = makeUtcFromIst(parts.year, parts.month, parts.day, 0, 0, 0, 0);
    const weekday = toIstDate(dayUtc).getUTCDay();
    if (!isEscalationReportAllowedOnDay(reportType, weekday, scheduleConfig)) continue;
    slots.forEach((item) => {
      const runAt = makeUtcFromIst(parts.year, parts.month, parts.day, item.time.hour, item.time.minute, 0, 0);
      if (runAt > referenceDate) candidates.push({ ...item, parts, runAt });
    });
  }
  const active = candidates.sort((a, b) => a.runAt - b.runAt)[0] || { ...slots[0], parts: nowIst, runAt: referenceDate };
  const prevBase = getPreviousIstDateParts(active.parts);
  const dayName = toIstDate(active.runAt).toLocaleDateString('en-US', { weekday: 'long' });

  return {
    slot: active.slot,
    slotLabel: `${labelPrefix ? `${labelPrefix} ` : ''}Send Time ${active.order}`,
    nextRunLabel: `${dayName} ${formatTimeLabel(active.time.value)}`,
    windowStart: makeUtcFromIst(prevBase.year, prevBase.month, prevBase.day, 0, 0, 0, 0),
    windowEnd: referenceDate,
    queueKey: `send${active.order}`,
    windowDate: `${active.parts.year}-${pad(active.parts.month)}-${pad(active.parts.day)}`,
  };
}

async function markStaleRunningEscalations(req, res, next) {
  try {
    const staleBefore = new Date(Date.now() - STALE_RUNNING_MS);
    await EscalationRunLog.updateMany(
      { status: 'running', updatedAt: { $lt: staleBefore } },
      {
        $set: {
          status: 'failed',
          error: 'Escalation mail did not finish within the expected time. Check the configured mail provider/API key and retry.',
        },
      }
    );
  } catch (error) {
    console.warn('[escalation-status] stale running cleanup failed:', error.message);
  }
  next();
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

function getNextIstDateParts(parts) {
  const current = makeUtcFromIst(parts.year, parts.month, parts.day, 0, 0, 0, 0);
  const next = toIstDate(new Date(current.getTime() + 24 * 60 * 60 * 1000));
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
}

function addIstDays(parts, days) {
  const current = makeUtcFromIst(parts.year, parts.month, parts.day, 0, 0, 0, 0);
  const shifted = toIstDate(new Date(current.getTime() + days * 24 * 60 * 60 * 1000));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function getNextSupplierWarrantyRun(parts, referenceDate, times = {}) {
  const weekday = toIstDate(referenceDate).getUTCDay();
  const minutes = parts.hour * 60 + parts.minute;
  const run = scheduledTime(times, 'supplier_warranty', '20:30');
  const runLabel = formatTimeLabel(run.value);
  if (weekday === 2 && minutes < run.minutes) return { parts, label: `Tuesday ${runLabel}`, startOffset: -4, run };
  if (weekday === 5 && minutes < run.minutes) return { parts, label: `Friday ${runLabel}`, startOffset: -3, run };
  const daysUntilTuesday = (9 - weekday) % 7 || 7;
  const daysUntilFriday = (12 - weekday) % 7 || 7;
  if (daysUntilTuesday < daysUntilFriday) {
    return { parts: addIstDays(parts, daysUntilTuesday), label: `Tuesday ${runLabel}`, startOffset: -4, run };
  }
  return { parts: addIstDays(parts, daysUntilFriday), label: `Friday ${runLabel}`, startOffset: -3, run };
}

function getPreviousSundayIstDateParts(parts) {
  const current = makeUtcFromIst(parts.year, parts.month, parts.day, 0, 0, 0, 0);
  const currentIst = toIstDate(current);
  const weekday = currentIst.getUTCDay();
  const sunday = toIstDate(new Date(current.getTime() - weekday * 24 * 60 * 60 * 1000));
  return {
    year: sunday.getUTCFullYear(),
    month: sunday.getUTCMonth() + 1,
    day: sunday.getUTCDate(),
  };
}

async function getActiveQueueWindow(referenceDate = new Date()) {
  return getActiveConfiguredQueueWindow(
    'main_combined',
    ['morning', 'evening'],
    { morning: '11:30', evening: '18:15' },
    '',
    referenceDate
  );
}

async function getActiveUrFollowupQueueWindow(referenceDate = new Date()) {
  return getActiveConfiguredQueueWindow(
    'ur_followup',
    ['ur_followup'],
    { ur_followup: '20:00' },
    'Daily Stock Follow-up',
    referenceDate
  );
}

async function getActiveUrScrapQueueWindow(referenceDate = new Date()) {
  return getActiveConfiguredQueueWindow(
    'ur_scrap',
    ['ur_scrap'],
    { ur_scrap: '11:00' },
    'Weekly Scrap',
    referenceDate
  );
}

async function getActiveSrQueueWindow(referenceDate = new Date()) {
  return getActiveConfiguredQueueWindow(
    'sr_escalation',
    ['sr_morning', 'sr_afternoon'],
    { sr_morning: '11:00', sr_afternoon: '15:00' },
    'SR',
    referenceDate
  );
}

async function getActiveToQueueWindow(referenceDate = new Date()) {
  return getActiveConfiguredQueueWindow(
    'to_escalation',
    ['to_morning', 'to_evening'],
    { to_morning: '11:00', to_evening: '16:30' },
    'TO',
    referenceDate
  );
}

async function getActiveCustomQueueWindow(config, referenceDate = new Date()) {
  const nowIst = getIstParts(referenceDate);
  const times = await getEscalationTimeMap();
  const run = scheduledTime(times, config.slot, `${pad(config.runHour)}:${pad(config.runMinute)}`);
  const resolvedConfig = { ...config, runHour: run.hour, runMinute: run.minute, nextRunLabel: formatTimeLabel(run.value) };
  if (config.slot === 'supplier_warranty') {
    const supplierRun = getNextSupplierWarrantyRun(nowIst, referenceDate, times);
    const start = addIstDays(supplierRun.parts, supplierRun.startOffset);
    return {
      slot: config.slot,
      slotLabel: supplierRun.label.includes('Tuesday') ? 'Supplier Warranty Tuesday' : 'Supplier Warranty Friday',
      nextRunLabel: supplierRun.label,
      windowStart: makeUtcFromIst(start.year, start.month, start.day, supplierRun.run.hour, supplierRun.run.minute + 1, 0, 0),
      windowEnd: referenceDate,
      windowDate: `${supplierRun.parts.year}-${pad(supplierRun.parts.month)}-${pad(supplierRun.parts.day)}`,
    };
  }
  const minutes = nowIst.hour * 60 + nowIst.minute;
  const runMinutes = resolvedConfig.runHour * 60 + resolvedConfig.runMinute;

  if (minutes < runMinutes) {
    const prev = getPreviousIstDateParts(nowIst);
    return {
      slot: config.slot,
      slotLabel: resolvedConfig.slotLabel,
      nextRunLabel: resolvedConfig.nextRunLabel,
      windowStart: makeUtcFromIst(prev.year, prev.month, prev.day, resolvedConfig.runHour, resolvedConfig.runMinute, 0, 0),
      windowEnd: referenceDate,
      windowDate: `${nowIst.year}-${pad(nowIst.month)}-${pad(nowIst.day)}`,
    };
  }

  const next = getNextIstDateParts(nowIst);
  return {
    slot: config.slot,
    slotLabel: resolvedConfig.slotLabel,
    nextRunLabel: resolvedConfig.nextRunLabel,
    windowStart: makeUtcFromIst(nowIst.year, nowIst.month, nowIst.day, resolvedConfig.runHour, resolvedConfig.runMinute, 0, 0),
    windowEnd: referenceDate,
    windowDate: `${next.year}-${pad(next.month)}-${pad(next.day)}`,
  };
}

router.use('/status', protect, markStaleRunningEscalations);

router.get('/status', protect, async (req, res) => {
  const labels = await getEscalationLabelMap();
  const latest = await EscalationRunLog.findOne({
    $or: [{ category: 'main' }, { category: { $exists: false } }],
  }).sort({ createdAt: -1 }).lean();
  const queueWindow = await getActiveQueueWindow(new Date());
  const recipients = await getEscalationRecipients('main_combined');
  const [frnQueued, estQueued] = await Promise.all([
    EscalationQueue.countDocuments({ module: 'frn', queuedAt: { $lte: queueWindow.windowEnd } }),
    EscalationQueue.countDocuments({ module: 'est', queuedAt: { $lte: queueWindow.windowEnd } }),
  ]);
  const totalQueued = frnQueued + estQueued;
  res.json({
    label: labelFor(labels, 'main_combined'),
    latest: visibleLatestLog(latest, totalQueued),
    recipients,
    queue: {
      slot: queueWindow.slot,
      slotLabel: composeSlotLabel(labels, 'main_combined', queueWindow.slotLabel),
      nextRunLabel: queueWindow.nextRunLabel,
      windowDate: queueWindow.windowDate,
      frnCount: frnQueued,
      estCount: estQueued,
      totalCount: totalQueued,
    },
  });
});

router.get('/status/under-repair', protect, async (req, res) => {
  const labels = await getEscalationLabelMap();
  const [scrapRecipients, followupRecipients] = await Promise.all([
    getEscalationRecipients('ur_scrap'),
    getEscalationRecipients('ur_followup'),
  ]);
  const [latestScrap, latestFollowup] = await Promise.all([
    EscalationRunLog.findOne({ category: 'ur_scrap' }).sort({ createdAt: -1 }).lean(),
    EscalationRunLog.findOne({ category: 'ur_followup' }).sort({ createdAt: -1 }).lean(),
  ]);

  const scrapQueueWindow = await getActiveUrScrapQueueWindow(new Date());
  const followupQueueWindow = await getActiveUrFollowupQueueWindow(new Date());

  const [scrapQueued, followupQueued] = await Promise.all([
    EscalationQueue.countDocuments({ module: 'ur_scrap', queuedAt: { $lte: scrapQueueWindow.windowEnd } }),
    EscalationQueue.countDocuments({ module: 'ur_followup', queuedAt: { $lte: followupQueueWindow.windowEnd } }),
  ]);

  res.json({
    labels: {
      scrap: labelFor(labels, 'ur_scrap'),
      followup: labelFor(labels, 'ur_followup'),
    },
    recipients: Array.from(new Set([...(scrapRecipients || []), ...(followupRecipients || [])])),
    scrap: {
      recipients: scrapRecipients,
      latest: visibleLatestLog(latestScrap, scrapQueued),
      queue: {
        slot: scrapQueueWindow.slot,
        slotLabel: composeSlotLabel(labels, 'ur_scrap', scrapQueueWindow.slotLabel),
        nextRunLabel: scrapQueueWindow.nextRunLabel,
        windowDate: scrapQueueWindow.windowDate,
        totalCount: scrapQueued,
      },
    },
    followup: {
      recipients: followupRecipients,
      latest: visibleLatestLog(latestFollowup, followupQueued),
      queue: {
        slot: followupQueueWindow.slot,
        slotLabel: composeSlotLabel(labels, 'ur_followup', followupQueueWindow.slotLabel),
        nextRunLabel: followupQueueWindow.nextRunLabel,
        windowDate: followupQueueWindow.windowDate,
        totalCount: followupQueued,
      },
    },
  });
});

router.get('/status/sr', protect, async (req, res) => {
  const labels = await getEscalationLabelMap();
  const recipients = await getEscalationRecipients('sr_escalation');
  const latest = await EscalationRunLog.findOne({ category: 'sr' }).sort({ createdAt: -1 }).lean();
  const activeQueueWindow = await getActiveSrQueueWindow(new Date());
  
  const [activeFrn, activeEst] = await Promise.all([
    EscalationQueue.countDocuments({ module: 'sr_frn', queuedAt: { $lte: activeQueueWindow.windowEnd } }),
    EscalationQueue.countDocuments({ module: 'sr_est', queuedAt: { $lte: activeQueueWindow.windowEnd } }),
  ]);
  const totalCount = activeFrn + activeEst;

  res.json({
    label: labelFor(labels, 'sr_escalation'),
    recipients,
    latest: visibleLatestLog(latest, totalCount),
    queue: {
      slot: activeQueueWindow.slot,
      slotLabel: composeSlotLabel(labels, 'sr_escalation', activeQueueWindow.slotLabel),
      nextRunLabel: activeQueueWindow.nextRunLabel,
      windowDate: activeQueueWindow.windowDate,
      frnCount: activeFrn,
      estCount: activeEst,
      totalCount: totalCount,
    },
  });
});

router.get('/status/to', protect, async (req, res) => {
  const labels = await getEscalationLabelMap();
  const recipients = await getEscalationRecipients('to_escalation');
  const latest = await EscalationRunLog.findOne({ category: 'to' }).sort({ createdAt: -1 }).lean();
  const activeQueueWindow = await getActiveToQueueWindow(new Date());
  
  const [activeFrn, activeEst, activeUr] = await Promise.all([
    EscalationQueue.countDocuments({ module: 'to_frn', queuedAt: { $lte: activeQueueWindow.windowEnd } }),
    EscalationQueue.countDocuments({ module: 'to_est', queuedAt: { $lte: activeQueueWindow.windowEnd } }),
    EscalationQueue.countDocuments({ module: 'to_ur', queuedAt: { $lte: activeQueueWindow.windowEnd } }),
  ]);
  const totalCount = activeFrn + activeEst + activeUr;

  res.json({
    label: labelFor(labels, 'to_escalation'),
    recipients,
    latest: visibleLatestLog(latest, totalCount),
    queue: {
      slot: activeQueueWindow.slot,
      slotLabel: composeSlotLabel(labels, 'to_escalation', activeQueueWindow.slotLabel),
      nextRunLabel: activeQueueWindow.nextRunLabel,
      windowDate: activeQueueWindow.windowDate,
      frnCount: activeFrn,
      estCount: activeEst,
      urCount: activeUr,
      totalCount: totalCount,
    },
  });
});

router.get('/status/:kind', protect, async (req, res) => {
  const config = CUSTOM_ESCALATION_STATUS[String(req.params.kind || '').toLowerCase()];
  if (!config) return res.status(404).json({ message: 'Escalation status not found.' });
  const labels = await getEscalationLabelMap();

  const [recipients, latest] = await Promise.all([
    getEscalationRecipients(config.reportType),
    EscalationRunLog.findOne({ category: config.category }).sort({ createdAt: -1 }).lean(),
  ]);
  const queueWindow = await getActiveCustomQueueWindow(config, new Date());
  const totalCount = await EscalationQueue.countDocuments({
    module: config.module,
    queuedAt: { $lte: queueWindow.windowEnd },
  });

  res.json({
    label: labelFor(labels, config.reportType),
    recipients,
    latest: visibleLatestLog(latest, totalCount),
    queue: {
      slot: queueWindow.slot,
      slotLabel: composeSlotLabel(labels, config.reportType, queueWindow.slotLabel),
      nextRunLabel: queueWindow.nextRunLabel,
      windowDate: queueWindow.windowDate,
      totalCount,
    },
  });
});

router.use(protect, adminOnly);

router.post('/run-now', async (req, res) => {
  try {
    const slot = String(req.body.slot || 'morning').toLowerCase();
    if (!['morning', 'evening', 'sr_morning', 'sr_afternoon', 'to_morning', 'to_evening', 'ur_scrap', 'ur_followup', 'prf_ob', 'supplier_warranty', 'external_repair'].includes(slot)) {
      return res.status(400).json({ success: false, message: 'slot must be morning, evening, sr_morning, sr_afternoon, to_morning, to_evening, ur_scrap, ur_followup, prf_ob, supplier_warranty, or external_repair' });
    }
    const runner = slot === 'morning' || slot === 'evening'
      ? runEscalationSlot
      : slot === 'sr_morning' || slot === 'sr_afternoon'
        ? runSrEscalationSlot
        : slot === 'to_morning' || slot === 'to_evening'
          ? runToEscalationSlot
        : slot === 'ur_scrap' || slot === 'ur_followup'
          ? runUrEscalationSlot
        : runCustomEscalationSlot;
    const result = await runner(slot, {
      trigger: 'manual',
      force: Boolean(req.body.force),
    });
    res.json({ success: result.ok, ...result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/last', async (req, res) => {
  const logs = await EscalationRunLog.find().sort({ createdAt: -1 }).limit(10).lean();
  res.json(logs);
});

module.exports = router;
