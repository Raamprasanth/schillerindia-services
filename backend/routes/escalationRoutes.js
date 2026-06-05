const express = require('express');
const router = express.Router();

const { protect, adminOnly } = require('../middleware/authMiddleware');
const EscalationRunLog = require('../models/EscalationRunLog');
const EscalationQueue = require('../models/EscalationQueue');
const { runEscalationSlot, runSrEscalationSlot, runToEscalationSlot, runUrEscalationSlot, runCustomEscalationSlot, getEscalationRecipients, getSrSlotWindow, getToSlotWindow } = require('../services/escalationService');
const { getEscalationLabelMap, labelFor, composeSlotLabel } = require('../utils/escalationLabels');
const { getEscalationTimeMap, parseTime, formatTimeLabel } = require('../utils/escalationSchedule');

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
const STALE_RUNNING_MS = Math.max(2 * 60 * 1000, parseInt(process.env.ESCALATION_STALE_RUNNING_MS || '150000', 10) || 150000);

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
  return parseTime(times?.[key], fallback);
}

function visibleLatestLog(log, activeTotal = 0) {
  if (!log) return null;
  const logTotal = Number(log.totalCount || 0);
  if (activeTotal === 0 && log.status === 'failed' && logTotal === 0 && !String(log.error || '').trim()) return null;
  return log;
}

async function markStaleRunningEscalations(req, res, next) {
  try {
    const staleBefore = new Date(Date.now() - STALE_RUNNING_MS);
    await EscalationRunLog.updateMany(
      { status: 'running', updatedAt: { $lt: staleBefore } },
      {
        $set: {
          status: 'failed',
          error: 'Escalation timed out before mail completion. Check SMTP sender settings and retry.',
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
  const nowIst = getIstParts(referenceDate);
  const minutes = nowIst.hour * 60 + nowIst.minute;
  const times = await getEscalationTimeMap();
  const sendTime1 = scheduledTime(times, 'morning', '11:30');
  const sendTime2 = scheduledTime(times, 'evening', '18:15');
  const beforeFirst = minutes < sendTime1.minutes;
  const beforeSecond = minutes < sendTime2.minutes;
  const active = beforeFirst ? sendTime1 : beforeSecond ? sendTime2 : sendTime1;
  const slot = beforeFirst ? 'morning' : beforeSecond ? 'evening' : 'morning';
  const order = slot === 'evening' ? 2 : 1;
  const base = beforeFirst ? getPreviousIstDateParts(nowIst) : nowIst;

  return {
    slot,
    slotLabel: `Send Time ${order}`,
    nextRunLabel: formatTimeLabel(active.value),
    windowStart: makeUtcFromIst(base.year, base.month, base.day, 0, 0, 0, 0),
    windowEnd: referenceDate,
    windowDate: `${nowIst.year}-${pad(nowIst.month)}-${pad(nowIst.day)}`,
  };
}

async function getActiveUrFollowupQueueWindow(referenceDate = new Date()) {
  const nowIst = getIstParts(referenceDate);
  const minutes = nowIst.hour * 60 + nowIst.minute;
  const times = await getEscalationTimeMap();
  const run = scheduledTime(times, 'ur_followup', '20:00');

  if (minutes < run.minutes) {
    const prev = getPreviousIstDateParts(nowIst);
    return {
      slot: 'ur_followup',
      slotLabel: 'Daily UR Follow-up',
      nextRunLabel: formatTimeLabel(run.value),
      windowStart: makeUtcFromIst(prev.year, prev.month, prev.day, run.hour, run.minute, 0, 0),
      windowEnd: referenceDate,
      windowDate: `${nowIst.year}-${pad(nowIst.month)}-${pad(nowIst.day)}`,
    };
  }

  const next = getNextIstDateParts(nowIst);
  return {
    slot: 'ur_followup',
    slotLabel: 'Daily UR Follow-up',
    nextRunLabel: formatTimeLabel(run.value),
    windowStart: makeUtcFromIst(nowIst.year, nowIst.month, nowIst.day, run.hour, run.minute, 0, 0),
    windowEnd: referenceDate,
    windowDate: `${next.year}-${pad(next.month)}-${pad(next.day)}`,
  };
}

async function getActiveUrScrapQueueWindow(referenceDate = new Date()) {
  const times = await getEscalationTimeMap();
  const run = scheduledTime(times, 'ur_scrap', '11:00');
  const nowIstDate = toIstDate(referenceDate);
  const nowParts = getIstParts(referenceDate);
  const thisSunday = getPreviousSundayIstDateParts(nowParts);
  const thisSundayRunAt = makeUtcFromIst(thisSunday.year, thisSunday.month, thisSunday.day, run.hour, run.minute, 0, 0);

  if (referenceDate < thisSundayRunAt) {
    const lastSundayBase = toIstDate(new Date(thisSundayRunAt.getTime() - 7 * 24 * 60 * 60 * 1000));
    return {
      slot: 'ur_scrap',
      slotLabel: 'Weekly Scrap',
      nextRunLabel: `Sunday ${formatTimeLabel(run.value)}`,
      windowStart: makeUtcFromIst(lastSundayBase.getUTCFullYear(), lastSundayBase.getUTCMonth() + 1, lastSundayBase.getUTCDate(), run.hour, run.minute, 0, 0),
      windowEnd: referenceDate,
      windowDate: `${thisSunday.year}-${pad(thisSunday.month)}-${pad(thisSunday.day)}`,
    };
  }

  const nextSundayBase = toIstDate(new Date(thisSundayRunAt.getTime() + 7 * 24 * 60 * 60 * 1000));
  return {
    slot: 'ur_scrap',
    slotLabel: 'Weekly Scrap',
    nextRunLabel: `Sunday ${formatTimeLabel(run.value)}`,
    windowStart: thisSundayRunAt,
    windowEnd: referenceDate,
    windowDate: `${nextSundayBase.getUTCFullYear()}-${pad(nextSundayBase.getUTCMonth() + 1)}-${pad(nextSundayBase.getUTCDate())}`,
  };
}

async function getActiveSrQueueWindow(referenceDate = new Date()) {
  const nowIst = getIstParts(referenceDate);
  const minutes = nowIst.hour * 60 + nowIst.minute;
  const times = await getEscalationTimeMap();
  const sendTime1 = scheduledTime(times, 'sr_morning', '11:00');
  const sendTime2 = scheduledTime(times, 'sr_afternoon', '15:00');
  const beforeFirst = minutes < sendTime1.minutes;
  const beforeSecond = minutes < sendTime2.minutes;
  const active = beforeFirst ? sendTime1 : beforeSecond ? sendTime2 : sendTime1;
  const slot = beforeFirst ? 'sr_morning' : beforeSecond ? 'sr_afternoon' : 'sr_morning';
  const order = slot === 'sr_afternoon' ? 2 : 1;
  const base = beforeFirst ? getPreviousIstDateParts(nowIst) : nowIst;

  return {
    slot,
    slotLabel: `SR Send Time ${order}`,
    nextRunLabel: formatTimeLabel(active.value),
    windowStart: makeUtcFromIst(base.year, base.month, base.day, 0, 0, 0, 0),
    windowEnd: referenceDate,
    queueKey: `send${order}`,
    windowDate: `${nowIst.year}-${pad(nowIst.month)}-${pad(nowIst.day)}`,
  };
}

async function getActiveToQueueWindow(referenceDate = new Date()) {
  const nowIst = getIstParts(referenceDate);
  const minutes = nowIst.hour * 60 + nowIst.minute;
  const times = await getEscalationTimeMap();
  const sendTime1 = scheduledTime(times, 'to_morning', '11:00');
  const sendTime2 = scheduledTime(times, 'to_evening', '16:30');
  const beforeFirst = minutes < sendTime1.minutes;
  const beforeSecond = minutes < sendTime2.minutes;
  const active = beforeFirst ? sendTime1 : beforeSecond ? sendTime2 : sendTime1;
  const slot = beforeFirst ? 'to_morning' : beforeSecond ? 'to_evening' : 'to_morning';
  const order = slot === 'to_evening' ? 2 : 1;
  const base = beforeFirst ? getPreviousIstDateParts(nowIst) : nowIst;

  return {
    slot,
    slotLabel: `TO Send Time ${order}`,
    nextRunLabel: formatTimeLabel(active.value),
    windowStart: makeUtcFromIst(base.year, base.month, base.day, 0, 0, 0, 0),
    windowEnd: referenceDate,
    queueKey: `send${order}`,
    windowDate: `${nowIst.year}-${pad(nowIst.month)}-${pad(nowIst.day)}`,
  };
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
  const times = await getEscalationTimeMap();
  const srSendTime1Label = formatTimeLabel(scheduledTime(times, 'sr_morning', '11:00').value);
  const srSendTime2Label = formatTimeLabel(scheduledTime(times, 'sr_afternoon', '15:00').value);
  const recipients = await getEscalationRecipients('sr_escalation');
  const [latestMorning, latestAfternoon] = await Promise.all([
    EscalationRunLog.findOne({ slot: 'sr_morning', category: 'sr' }).sort({ createdAt: -1 }).lean(),
    EscalationRunLog.findOne({ slot: 'sr_afternoon', category: 'sr' }).sort({ createdAt: -1 }).lean(),
  ]);
  const activeQueueWindow = await getActiveSrQueueWindow(new Date());
  const [activeFrn, activeEst] = await Promise.all([
    EscalationQueue.countDocuments({ module: 'sr_frn', queuedAt: { $lte: activeQueueWindow.windowEnd } }),
    EscalationQueue.countDocuments({ module: 'sr_est', queuedAt: { $lte: activeQueueWindow.windowEnd } }),
  ]);
  const activeTotal = activeFrn + activeEst;
  const sendTime1Data = activeQueueWindow.queueKey === 'send1'
    ? { frnCount: activeFrn, estCount: activeEst, totalCount: activeTotal, windowDate: activeQueueWindow.windowDate }
    : { frnCount: 0, estCount: 0, totalCount: 0, windowDate: (await getSrSlotWindow('sr_morning', new Date())).jobDate };
  const sendTime2Data = activeQueueWindow.queueKey === 'send2'
    ? { frnCount: activeFrn, estCount: activeEst, totalCount: activeTotal, windowDate: activeQueueWindow.windowDate }
    : { frnCount: 0, estCount: 0, totalCount: 0, windowDate: (await getSrSlotWindow('sr_afternoon', new Date())).jobDate };
  res.json({
    label: labelFor(labels, 'sr_escalation'),
    recipients,
    morning: {
      latest: visibleLatestLog(latestMorning, sendTime1Data.totalCount),
      queue: {
        slot: 'sr_morning',
        slotLabel: composeSlotLabel(labels, 'sr_escalation', 'SR Send Time 1'),
        nextRunLabel: srSendTime1Label,
        windowDate: sendTime1Data.windowDate,
        frnCount: sendTime1Data.frnCount,
        estCount: sendTime1Data.estCount,
        totalCount: sendTime1Data.totalCount,
      },
    },
    afternoon: {
      latest: visibleLatestLog(latestAfternoon, sendTime2Data.totalCount),
      queue: {
        slot: 'sr_afternoon',
        slotLabel: composeSlotLabel(labels, 'sr_escalation', 'SR Send Time 2'),
        nextRunLabel: srSendTime2Label,
        windowDate: sendTime2Data.windowDate,
        frnCount: sendTime2Data.frnCount,
        estCount: sendTime2Data.estCount,
        totalCount: sendTime2Data.totalCount,
      },
    },
  });
});

router.get('/status/to', protect, async (req, res) => {
  const labels = await getEscalationLabelMap();
  const times = await getEscalationTimeMap();
  const toSendTime1Label = formatTimeLabel(scheduledTime(times, 'to_morning', '11:00').value);
  const toSendTime2Label = formatTimeLabel(scheduledTime(times, 'to_evening', '16:30').value);
  const recipients = await getEscalationRecipients('to_escalation');
  const [latestMorning, latestEvening] = await Promise.all([
    EscalationRunLog.findOne({ slot: 'to_morning', category: 'to' }).sort({ createdAt: -1 }).lean(),
    EscalationRunLog.findOne({ slot: 'to_evening', category: 'to' }).sort({ createdAt: -1 }).lean(),
  ]);
  const activeQueueWindow = await getActiveToQueueWindow(new Date());
  const [activeFrn, activeEst, activeUr] = await Promise.all([
    EscalationQueue.countDocuments({ module: 'to_frn', queuedAt: { $lte: activeQueueWindow.windowEnd } }),
    EscalationQueue.countDocuments({ module: 'to_est', queuedAt: { $lte: activeQueueWindow.windowEnd } }),
    EscalationQueue.countDocuments({ module: 'to_ur', queuedAt: { $lte: activeQueueWindow.windowEnd } }),
  ]);
  const activeTotal = activeFrn + activeEst + activeUr;
  const sendTime1Data = activeQueueWindow.queueKey === 'send1'
    ? { frnCount: activeFrn, estCount: activeEst, urCount: activeUr, totalCount: activeTotal, windowDate: activeQueueWindow.windowDate }
    : { frnCount: 0, estCount: 0, urCount: 0, totalCount: 0, windowDate: (await getToSlotWindow('to_morning', new Date())).jobDate };
  const sendTime2Data = activeQueueWindow.queueKey === 'send2'
    ? { frnCount: activeFrn, estCount: activeEst, urCount: activeUr, totalCount: activeTotal, windowDate: activeQueueWindow.windowDate }
    : { frnCount: 0, estCount: 0, urCount: 0, totalCount: 0, windowDate: (await getToSlotWindow('to_evening', new Date())).jobDate };
  res.json({
    label: labelFor(labels, 'to_escalation'),
    recipients,
    morning: {
      latest: visibleLatestLog(latestMorning, sendTime1Data.totalCount),
      queue: {
        slot: 'to_morning',
        slotLabel: composeSlotLabel(labels, 'to_escalation', 'TO Send Time 1'),
        nextRunLabel: toSendTime1Label,
        windowDate: sendTime1Data.windowDate,
        frnCount: sendTime1Data.frnCount,
        estCount: sendTime1Data.estCount,
        urCount: sendTime1Data.urCount,
        totalCount: sendTime1Data.totalCount,
      },
    },
    evening: {
      latest: visibleLatestLog(latestEvening, sendTime2Data.totalCount),
      queue: {
        slot: 'to_evening',
        slotLabel: composeSlotLabel(labels, 'to_escalation', 'TO Send Time 2'),
        nextRunLabel: toSendTime2Label,
        windowDate: sendTime2Data.windowDate,
        frnCount: sendTime2Data.frnCount,
        estCount: sendTime2Data.estCount,
        urCount: sendTime2Data.urCount,
        totalCount: sendTime2Data.totalCount,
      },
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
