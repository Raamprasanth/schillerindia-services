const express = require('express');
const router = express.Router();

const { protect, adminOnly } = require('../middleware/authMiddleware');
const EscalationRunLog = require('../models/EscalationRunLog');
const EscalationQueue = require('../models/EscalationQueue');
const { runEscalationSlot, runSrEscalationSlot, runToEscalationSlot, runUrEscalationSlot, runCustomEscalationSlot, getEscalationRecipients, getSrSlotWindow, getToSlotWindow } = require('../services/escalationService');

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

function getNextSupplierWarrantyRun(parts, referenceDate) {
  const weekday = toIstDate(referenceDate).getUTCDay();
  const minutes = parts.hour * 60 + parts.minute;
  const runMinutes = 20 * 60 + 30;
  if (weekday === 2 && minutes < runMinutes) return { parts, label: 'Tuesday 8:30 PM', startOffset: -4 };
  if (weekday === 5 && minutes < runMinutes) return { parts, label: 'Friday 8:30 PM', startOffset: -3 };
  const daysUntilTuesday = (9 - weekday) % 7 || 7;
  const daysUntilFriday = (12 - weekday) % 7 || 7;
  if (daysUntilTuesday < daysUntilFriday) {
    return { parts: addIstDays(parts, daysUntilTuesday), label: 'Tuesday 8:30 PM', startOffset: -4 };
  }
  return { parts: addIstDays(parts, daysUntilFriday), label: 'Friday 8:30 PM', startOffset: -3 };
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

function getActiveQueueWindow(referenceDate = new Date()) {
  const nowIst = getIstParts(referenceDate);
  const minutes = nowIst.hour * 60 + nowIst.minute;

  if (minutes < 690) {
    const prev = getPreviousIstDateParts(nowIst);
    return {
      slot: 'morning',
      slotLabel: 'Morning',
      nextRunLabel: '11:30 AM',
      windowStart: makeUtcFromIst(prev.year, prev.month, prev.day, 16, 1, 0, 0),
      windowEnd: referenceDate,
      windowDate: `${nowIst.year}-${pad(nowIst.month)}-${pad(nowIst.day)}`,
    };
  }

  if (minutes < 960) {
    return {
      slot: 'evening',
      slotLabel: 'Evening',
      nextRunLabel: '4:00 PM',
      windowStart: makeUtcFromIst(nowIst.year, nowIst.month, nowIst.day, 11, 30, 0, 0),
      windowEnd: referenceDate,
      windowDate: `${nowIst.year}-${pad(nowIst.month)}-${pad(nowIst.day)}`,
    };
  }

  const next = getNextIstDateParts(nowIst);
  return {
    slot: 'morning',
    slotLabel: 'Morning',
    nextRunLabel: '11:30 AM',
    windowStart: makeUtcFromIst(nowIst.year, nowIst.month, nowIst.day, 16, 1, 0, 0),
    windowEnd: referenceDate,
    windowDate: `${next.year}-${pad(next.month)}-${pad(next.day)}`,
  };
}

function getActiveUrFollowupQueueWindow(referenceDate = new Date()) {
  const nowIst = getIstParts(referenceDate);
  const minutes = nowIst.hour * 60 + nowIst.minute;

  if (minutes < 1200) {
    const prev = getPreviousIstDateParts(nowIst);
    return {
      slot: 'ur_followup',
      slotLabel: 'Daily UR Follow-up',
      nextRunLabel: '8:00 PM',
      windowStart: makeUtcFromIst(prev.year, prev.month, prev.day, 20, 0, 0, 0),
      windowEnd: referenceDate,
      windowDate: `${nowIst.year}-${pad(nowIst.month)}-${pad(nowIst.day)}`,
    };
  }

  const next = getNextIstDateParts(nowIst);
  return {
    slot: 'ur_followup',
    slotLabel: 'Daily UR Follow-up',
    nextRunLabel: '8:00 PM',
    windowStart: makeUtcFromIst(nowIst.year, nowIst.month, nowIst.day, 20, 0, 0, 0),
    windowEnd: referenceDate,
    windowDate: `${next.year}-${pad(next.month)}-${pad(next.day)}`,
  };
}

function getActiveUrScrapQueueWindow(referenceDate = new Date()) {
  const nowIstDate = toIstDate(referenceDate);
  const nowParts = getIstParts(referenceDate);
  const thisSunday = getPreviousSundayIstDateParts(nowParts);
  const thisSundayRunAt = makeUtcFromIst(thisSunday.year, thisSunday.month, thisSunday.day, 11, 0, 0, 0);

  if (referenceDate < thisSundayRunAt) {
    const lastSundayBase = toIstDate(new Date(thisSundayRunAt.getTime() - 7 * 24 * 60 * 60 * 1000));
    return {
      slot: 'ur_scrap',
      slotLabel: 'Weekly Scrap',
      nextRunLabel: 'Sunday 11:00 AM',
      windowStart: makeUtcFromIst(lastSundayBase.getUTCFullYear(), lastSundayBase.getUTCMonth() + 1, lastSundayBase.getUTCDate(), 11, 0, 0, 0),
      windowEnd: referenceDate,
      windowDate: `${thisSunday.year}-${pad(thisSunday.month)}-${pad(thisSunday.day)}`,
    };
  }

  const nextSundayBase = toIstDate(new Date(thisSundayRunAt.getTime() + 7 * 24 * 60 * 60 * 1000));
  return {
    slot: 'ur_scrap',
    slotLabel: 'Weekly Scrap',
    nextRunLabel: 'Sunday 11:00 AM',
    windowStart: thisSundayRunAt,
    windowEnd: referenceDate,
    windowDate: `${nextSundayBase.getUTCFullYear()}-${pad(nextSundayBase.getUTCMonth() + 1)}-${pad(nextSundayBase.getUTCDate())}`,
  };
}

function getActiveSrQueueWindow(referenceDate = new Date()) {
  const nowIst = getIstParts(referenceDate);
  const minutes = nowIst.hour * 60 + nowIst.minute;

  if (minutes < 660) {
    const prev = getPreviousIstDateParts(nowIst);
    return {
      slot: 'sr_morning',
      slotLabel: 'SR Morning',
      nextRunLabel: '11:00 AM',
      windowStart: makeUtcFromIst(prev.year, prev.month, prev.day, 16, 0, 0, 0),
      windowEnd: referenceDate,
      queueKey: 'morning',
      windowDate: `${nowIst.year}-${pad(nowIst.month)}-${pad(nowIst.day)}`,
    };
  }

  if (minutes < 900) {
    return {
      slot: 'sr_afternoon',
      slotLabel: 'SR Afternoon',
      nextRunLabel: '3:00 PM',
      windowStart: makeUtcFromIst(nowIst.year, nowIst.month, nowIst.day, 11, 0, 0, 0),
      windowEnd: referenceDate,
      queueKey: 'afternoon',
      windowDate: `${nowIst.year}-${pad(nowIst.month)}-${pad(nowIst.day)}`,
    };
  }

  const next = getNextIstDateParts(nowIst);
  return {
    slot: 'sr_morning',
    slotLabel: 'SR Morning',
    nextRunLabel: '11:00 AM',
    windowStart: makeUtcFromIst(nowIst.year, nowIst.month, nowIst.day, 16, 0, 0, 0),
    windowEnd: referenceDate,
    queueKey: 'morning',
    windowDate: `${next.year}-${pad(next.month)}-${pad(next.day)}`,
  };
}

function getActiveToQueueWindow(referenceDate = new Date()) {
  const nowIst = getIstParts(referenceDate);
  const minutes = nowIst.hour * 60 + nowIst.minute;

  if (minutes < 660) {
    const prev = getPreviousIstDateParts(nowIst);
    return {
      slot: 'to_morning',
      slotLabel: 'TO Morning',
      nextRunLabel: '11:00 AM',
      windowStart: makeUtcFromIst(prev.year, prev.month, prev.day, 16, 30, 0, 0),
      windowEnd: referenceDate,
      queueKey: 'morning',
      windowDate: `${nowIst.year}-${pad(nowIst.month)}-${pad(nowIst.day)}`,
    };
  }

  if (minutes < 990) {
    return {
      slot: 'to_evening',
      slotLabel: 'TO Evening',
      nextRunLabel: '4:30 PM',
      windowStart: makeUtcFromIst(nowIst.year, nowIst.month, nowIst.day, 11, 0, 0, 0),
      windowEnd: referenceDate,
      queueKey: 'evening',
      windowDate: `${nowIst.year}-${pad(nowIst.month)}-${pad(nowIst.day)}`,
    };
  }

  const next = getNextIstDateParts(nowIst);
  return {
    slot: 'to_morning',
    slotLabel: 'TO Morning',
    nextRunLabel: '11:00 AM',
    windowStart: makeUtcFromIst(nowIst.year, nowIst.month, nowIst.day, 16, 30, 0, 0),
    windowEnd: referenceDate,
    queueKey: 'morning',
    windowDate: `${next.year}-${pad(next.month)}-${pad(next.day)}`,
  };
}

function getActiveCustomQueueWindow(config, referenceDate = new Date()) {
  const nowIst = getIstParts(referenceDate);
  if (config.slot === 'supplier_warranty') {
    const run = getNextSupplierWarrantyRun(nowIst, referenceDate);
    const start = addIstDays(run.parts, run.startOffset);
    return {
      slot: config.slot,
      slotLabel: run.label.includes('Tuesday') ? 'Supplier Warranty Tuesday' : 'Supplier Warranty Friday',
      nextRunLabel: run.label,
      windowStart: makeUtcFromIst(start.year, start.month, start.day, 20, 31, 0, 0),
      windowEnd: referenceDate,
      windowDate: `${run.parts.year}-${pad(run.parts.month)}-${pad(run.parts.day)}`,
    };
  }
  const minutes = nowIst.hour * 60 + nowIst.minute;
  const runMinutes = config.runHour * 60 + config.runMinute;

  if (minutes < runMinutes) {
    const prev = getPreviousIstDateParts(nowIst);
    return {
      slot: config.slot,
      slotLabel: config.slotLabel,
      nextRunLabel: config.nextRunLabel,
      windowStart: makeUtcFromIst(prev.year, prev.month, prev.day, config.runHour, config.runMinute, 0, 0),
      windowEnd: referenceDate,
      windowDate: `${nowIst.year}-${pad(nowIst.month)}-${pad(nowIst.day)}`,
    };
  }

  const next = getNextIstDateParts(nowIst);
  return {
    slot: config.slot,
    slotLabel: config.slotLabel,
    nextRunLabel: config.nextRunLabel,
    windowStart: makeUtcFromIst(nowIst.year, nowIst.month, nowIst.day, config.runHour, config.runMinute, 0, 0),
    windowEnd: referenceDate,
    windowDate: `${next.year}-${pad(next.month)}-${pad(next.day)}`,
  };
}

router.get('/status', protect, async (req, res) => {
  const latest = await EscalationRunLog.findOne({
    $or: [{ category: 'main' }, { category: { $exists: false } }],
  }).sort({ createdAt: -1 }).lean();
  const queueWindow = getActiveQueueWindow(new Date());
  const recipients = await getEscalationRecipients('main_combined');
  const [frnQueued, estQueued] = await Promise.all([
    EscalationQueue.countDocuments({ module: 'frn', queuedAt: { $gte: queueWindow.windowStart, $lte: queueWindow.windowEnd } }),
    EscalationQueue.countDocuments({ module: 'est', queuedAt: { $gte: queueWindow.windowStart, $lte: queueWindow.windowEnd } }),
  ]);
  res.json({
    latest: latest || null,
    recipients,
    queue: {
      slot: queueWindow.slot,
      slotLabel: queueWindow.slotLabel,
      nextRunLabel: queueWindow.nextRunLabel,
      windowDate: queueWindow.windowDate,
      frnCount: frnQueued,
      estCount: estQueued,
      totalCount: frnQueued + estQueued,
    },
  });
});

router.get('/status/under-repair', protect, async (req, res) => {
  const [scrapRecipients, followupRecipients] = await Promise.all([
    getEscalationRecipients('ur_scrap'),
    getEscalationRecipients('ur_followup'),
  ]);
  const [latestScrap, latestFollowup] = await Promise.all([
    EscalationRunLog.findOne({ category: 'ur_scrap' }).sort({ createdAt: -1 }).lean(),
    EscalationRunLog.findOne({ category: 'ur_followup' }).sort({ createdAt: -1 }).lean(),
  ]);

  const scrapQueueWindow = getActiveUrScrapQueueWindow(new Date());
  const followupQueueWindow = getActiveUrFollowupQueueWindow(new Date());

  const [scrapQueued, followupQueued] = await Promise.all([
    EscalationQueue.countDocuments({ module: 'ur_scrap', queuedAt: { $gte: scrapQueueWindow.windowStart, $lte: scrapQueueWindow.windowEnd } }),
    EscalationQueue.countDocuments({ module: 'ur_followup', queuedAt: { $gte: followupQueueWindow.windowStart, $lte: followupQueueWindow.windowEnd } }),
  ]);

  res.json({
    recipients: Array.from(new Set([...(scrapRecipients || []), ...(followupRecipients || [])])),
    scrap: {
      recipients: scrapRecipients,
      latest: latestScrap || null,
      queue: {
        slot: scrapQueueWindow.slot,
        slotLabel: scrapQueueWindow.slotLabel,
        nextRunLabel: scrapQueueWindow.nextRunLabel,
        windowDate: scrapQueueWindow.windowDate,
        totalCount: scrapQueued,
      },
    },
    followup: {
      recipients: followupRecipients,
      latest: latestFollowup || null,
      queue: {
        slot: followupQueueWindow.slot,
        slotLabel: followupQueueWindow.slotLabel,
        nextRunLabel: followupQueueWindow.nextRunLabel,
        windowDate: followupQueueWindow.windowDate,
        totalCount: followupQueued,
      },
    },
  });
});

router.get('/status/sr', protect, async (req, res) => {
  const recipients = await getEscalationRecipients('sr_escalation');
  const [latestMorning, latestAfternoon] = await Promise.all([
    EscalationRunLog.findOne({ slot: 'sr_morning', category: 'sr' }).sort({ createdAt: -1 }).lean(),
    EscalationRunLog.findOne({ slot: 'sr_afternoon', category: 'sr' }).sort({ createdAt: -1 }).lean(),
  ]);
  const activeQueueWindow = getActiveSrQueueWindow(new Date());
  const [activeFrn, activeEst] = await Promise.all([
    EscalationQueue.countDocuments({ module: 'sr_frn', queuedAt: { $gte: activeQueueWindow.windowStart, $lte: activeQueueWindow.windowEnd } }),
    EscalationQueue.countDocuments({ module: 'sr_est', queuedAt: { $gte: activeQueueWindow.windowStart, $lte: activeQueueWindow.windowEnd } }),
  ]);
  const activeTotal = activeFrn + activeEst;
  const morningData = activeQueueWindow.queueKey === 'morning'
    ? { frnCount: activeFrn, estCount: activeEst, totalCount: activeTotal, windowDate: activeQueueWindow.windowDate }
    : { frnCount: 0, estCount: 0, totalCount: 0, windowDate: getSrSlotWindow('sr_morning', new Date()).jobDate };
  const afternoonData = activeQueueWindow.queueKey === 'afternoon'
    ? { frnCount: activeFrn, estCount: activeEst, totalCount: activeTotal, windowDate: activeQueueWindow.windowDate }
    : { frnCount: 0, estCount: 0, totalCount: 0, windowDate: getSrSlotWindow('sr_afternoon', new Date()).jobDate };
  res.json({
    recipients,
    morning: {
      latest: latestMorning || null,
      queue: {
        slot: 'sr_morning',
        slotLabel: 'SR Morning',
        nextRunLabel: '11:00 AM',
        windowDate: morningData.windowDate,
        frnCount: morningData.frnCount,
        estCount: morningData.estCount,
        totalCount: morningData.totalCount,
      },
    },
    afternoon: {
      latest: latestAfternoon || null,
      queue: {
        slot: 'sr_afternoon',
        slotLabel: 'SR Afternoon',
        nextRunLabel: '3:00 PM',
        windowDate: afternoonData.windowDate,
        frnCount: afternoonData.frnCount,
        estCount: afternoonData.estCount,
        totalCount: afternoonData.totalCount,
      },
    },
  });
});

router.get('/status/to', protect, async (req, res) => {
  const recipients = await getEscalationRecipients('to_escalation');
  const [latestMorning, latestEvening] = await Promise.all([
    EscalationRunLog.findOne({ slot: 'to_morning', category: 'to' }).sort({ createdAt: -1 }).lean(),
    EscalationRunLog.findOne({ slot: 'to_evening', category: 'to' }).sort({ createdAt: -1 }).lean(),
  ]);
  const activeQueueWindow = getActiveToQueueWindow(new Date());
  const [activeFrn, activeEst] = await Promise.all([
    EscalationQueue.countDocuments({ module: 'to_frn', queuedAt: { $gte: activeQueueWindow.windowStart, $lte: activeQueueWindow.windowEnd } }),
    EscalationQueue.countDocuments({ module: 'to_est', queuedAt: { $gte: activeQueueWindow.windowStart, $lte: activeQueueWindow.windowEnd } }),
  ]);
  const activeTotal = activeFrn + activeEst;
  const morningData = activeQueueWindow.queueKey === 'morning'
    ? { frnCount: activeFrn, estCount: activeEst, totalCount: activeTotal, windowDate: activeQueueWindow.windowDate }
    : { frnCount: 0, estCount: 0, totalCount: 0, windowDate: getToSlotWindow('to_morning', new Date()).jobDate };
  const eveningData = activeQueueWindow.queueKey === 'evening'
    ? { frnCount: activeFrn, estCount: activeEst, totalCount: activeTotal, windowDate: activeQueueWindow.windowDate }
    : { frnCount: 0, estCount: 0, totalCount: 0, windowDate: getToSlotWindow('to_evening', new Date()).jobDate };
  res.json({
    recipients,
    morning: {
      latest: latestMorning || null,
      queue: {
        slot: 'to_morning',
        slotLabel: 'TO Morning',
        nextRunLabel: '11:00 AM',
        windowDate: morningData.windowDate,
        frnCount: morningData.frnCount,
        estCount: morningData.estCount,
        totalCount: morningData.totalCount,
      },
    },
    evening: {
      latest: latestEvening || null,
      queue: {
        slot: 'to_evening',
        slotLabel: 'TO Evening',
        nextRunLabel: '4:30 PM',
        windowDate: eveningData.windowDate,
        frnCount: eveningData.frnCount,
        estCount: eveningData.estCount,
        totalCount: eveningData.totalCount,
      },
    },
  });
});

router.get('/status/:kind', protect, async (req, res) => {
  const config = CUSTOM_ESCALATION_STATUS[String(req.params.kind || '').toLowerCase()];
  if (!config) return res.status(404).json({ message: 'Escalation status not found.' });

  const [recipients, latest] = await Promise.all([
    getEscalationRecipients(config.reportType),
    EscalationRunLog.findOne({ category: config.category }).sort({ createdAt: -1 }).lean(),
  ]);
  const queueWindow = getActiveCustomQueueWindow(config, new Date());
  const totalCount = await EscalationQueue.countDocuments({
    module: config.module,
    queuedAt: { $gte: queueWindow.windowStart, $lte: queueWindow.windowEnd },
  });

  res.json({
    recipients,
    latest: latest || null,
    queue: {
      slot: queueWindow.slot,
      slotLabel: queueWindow.slotLabel,
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
