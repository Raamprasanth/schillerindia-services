const express = require('express');
const crypto = require('crypto');

const router = express.Router();

const { protect, adminOnly } = require('../middleware/authMiddleware');
const AppSetting = require('../models/AppSetting');
const {
  getEscalationLabelMap,
  saveEscalationLabelMap,
  getEscalationTypesWithLabels,
} = require('../utils/escalationLabels');
const {
  getEscalationTimeMap,
  saveEscalationTimeMap,
  getEscalationScheduleConfig,
  saveEscalationScheduleConfig,
  applyEscalationTimes,
} = require('../utils/escalationSchedule');
const { sendEscalationSenderTest } = require('../services/escalationService');

const ESCALATION_KEY = 'escalation_emails';
const ESCALATION_SENDER_KEY = 'escalation_sender';

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function splitCsv(value) {
  return String(value || '').split(',').map((item) => normalizeEmail(item)).filter(Boolean);
}

function isValidEmail(value) {
  return /^\S+@\S+\.\S+$/.test(value);
}

function normalizeEntry(entry = {}) {
  const email = normalizeEmail(entry.email);
  return {
    id: String(entry.id || crypto.randomUUID()),
    email,
    reportType: String(entry.reportType || 'main_combined').trim() || 'main_combined',
    division: String(entry.division || 'all').trim() || 'all',
    region: String(entry.region || 'all').trim() || 'all',
  };
}

function toBool(value, fallback) {
  if (value === undefined || value === null || value === '') return !!fallback;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n', 'off'].includes(normalized)) return false;
  return !!fallback;
}

function normalizeSmtpPassword(password, config = {}) {
  const value = String(password || '').trim();
  const host = String(config.smtpHost || '').toLowerCase();
  const user = String(config.smtpUser || config.fromEmail || '').toLowerCase();
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

function normalizeSenderConfig(config = {}, existing = {}) {
  const smtpHost = String(config.smtpHost || existing.smtpHost || process.env.ESCALATION_SMTP_HOST || '').trim();
  const smtpUser = normalizeEmail(config.smtpUser || existing.smtpUser || process.env.ESCALATION_SMTP_USER || '');
  const fromEmail = normalizeEmail(config.fromEmail || existing.fromEmail || process.env.ESCALATION_EMAIL_FROM || process.env.ESCALATION_SMTP_USER);
  const smtpPass = normalizeSmtpPassword(config.smtpPass ?? '', { smtpHost, smtpUser, fromEmail });
  const fallbackPass = String(existing.smtpPass ?? '').trim();
  return {
    fromEmail,
    smtpHost,
    smtpPort: String(config.smtpPort || existing.smtpPort || process.env.ESCALATION_SMTP_PORT || '587').trim() || '587',
    smtpUser,
    smtpPass: smtpPass || normalizeSmtpPassword(fallbackPass || process.env.ESCALATION_SMTP_PASS || '', { smtpHost, smtpUser, fromEmail }),
    startTls: toBool(config.startTls, existing.startTls ?? String(process.env.ESCALATION_SMTP_STARTTLS || 'true').trim().toLowerCase() !== 'false'),
    ssl: toBool(config.ssl, existing.ssl ?? String(process.env.ESCALATION_SMTP_SSL || 'false').trim().toLowerCase() === 'true'),
  };
}

function sanitizeSenderResponse(config = {}) {
  return {
    success: true,
    sender: {
      fromEmail: String(config.fromEmail || '').trim(),
      smtpHost: String(config.smtpHost || '').trim(),
      smtpPort: String(config.smtpPort || '587').trim() || '587',
      smtpUser: String(config.smtpUser || '').trim(),
      startTls: !!config.startTls,
      ssl: !!config.ssl,
      hasPassword: !!String(config.smtpPass || '').trim(),
    },
  };
}

async function getEmailSetting() {
  return AppSetting.findOne({ key: ESCALATION_KEY });
}

async function getSenderSetting() {
  return AppSetting.findOne({ key: ESCALATION_SENDER_KEY });
}

async function getEffectiveEntries() {
  const doc = await getEmailSetting();
  const stored = Array.isArray(doc?.value) ? doc.value : [];
  const normalizedStored = stored
    .map((item) => {
      if (typeof item === 'string') {
        return normalizeEntry({ email: item });
      }
      return normalizeEntry(item);
    })
    .filter((item) => item.email);

  if (normalizedStored.length) return normalizedStored;

  return splitCsv(process.env.ESCALATION_EMAIL_TO).map((email) => normalizeEntry({ email }));
}

async function buildResponse(entries) {
  return {
    success: true,
    entries,
    emails: entries.map((item) => item.email),
    escalationTypes: await getEscalationTypesWithLabels(),
  };
}

router.use(protect);

router.get('/escalation-emails', async (req, res) => {
  try {
    const entries = await getEffectiveEntries();
    res.json(await buildResponse(entries));
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/escalation-labels', async (req, res) => {
  try {
    const labels = await getEscalationLabelMap();
    const times = await getEscalationTimeMap();
    const scheduleConfig = await getEscalationScheduleConfig();
    res.json({
      success: true,
      labels,
      times,
      scheduleConfig,
      escalationTypes: await getEscalationTypesWithLabels(),
      escalationTimes: applyEscalationTimes(times, scheduleConfig),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.use(adminOnly);

router.get('/escalation-sender', async (req, res) => {
  try {
    const doc = await getSenderSetting();
    const sender = normalizeSenderConfig(doc?.value || {});
    res.json(sanitizeSenderResponse(sender));
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/storage', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    let totalBytes = 0;
    let freeBytes = 0;

    try {
      const dbStats = await mongoose.connection.db.command({ dbStats: 1 });
      if (dbStats && dbStats.fsTotalSize) {
        totalBytes = dbStats.fsTotalSize;
        freeBytes = dbStats.fsTotalSize - dbStats.fsUsedSize;
      }
    } catch (dbErr) {
      console.error('Could not fetch DB stats:', dbErr.message);
    }

    if (!totalBytes) {
      const fs = require('fs').promises;
      const path = require('path');
      const stats = await fs.statfs(path.resolve(__dirname, '../../'));
      totalBytes = stats.blocks * stats.bsize;
      freeBytes = stats.bavail * stats.bsize;
    }

    res.json({
      success: true,
      totalBytes,
      freeBytes
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


router.post('/escalation-emails', async (req, res) => {
  try {
    const nextEntry = normalizeEntry(req.body);
    if (!isValidEmail(nextEntry.email)) {
      return res.status(400).json({ success: false, message: 'Valid email is required.' });
    }

    const current = await getEffectiveEntries();
    if (current.some((item) => item.email === nextEntry.email && item.reportType === nextEntry.reportType && item.division === nextEntry.division && item.region === nextEntry.region)) {
      return res.status(409).json({ success: false, message: 'Email already exists for this escalation type.' });
    }

    const next = [...current, nextEntry];
    const saved = await AppSetting.findOneAndUpdate(
      { key: ESCALATION_KEY },
      { $set: { value: next, updatedBy: req.user?.name || '' } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(201).json(await buildResponse(Array.isArray(saved.value) ? saved.value.map(normalizeEntry) : next));
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/escalation-emails/:id', async (req, res) => {
  try {
    const targetId = String(req.params.id || '').trim();
    if (!targetId) {
      return res.status(400).json({ success: false, message: 'Entry id is required.' });
    }

    const current = await getEffectiveEntries();
    const idx = current.findIndex((item) => item.id === targetId);
    if (idx === -1) {
      return res.status(404).json({ success: false, message: 'Entry not found.' });
    }

    const updatedEntry = normalizeEntry({ ...current[idx], ...req.body, id: targetId });
    if (!isValidEmail(updatedEntry.email)) {
      return res.status(400).json({ success: false, message: 'Valid email is required.' });
    }
    if (current.some((item, index) => index !== idx && item.email === updatedEntry.email && item.reportType === updatedEntry.reportType && item.division === updatedEntry.division && item.region === updatedEntry.region)) {
      return res.status(409).json({ success: false, message: 'Email already exists for this escalation type.' });
    }

    const next = current.slice();
    next[idx] = updatedEntry;
    const saved = await AppSetting.findOneAndUpdate(
      { key: ESCALATION_KEY },
      { $set: { value: next, updatedBy: req.user?.name || '' } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json(await buildResponse(Array.isArray(saved.value) ? saved.value.map(normalizeEntry) : next));
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/escalation-emails/:id', async (req, res) => {
  try {
    const targetId = String(req.params.id || '').trim();
    if (!targetId) {
      return res.status(400).json({ success: false, message: 'Entry id is required.' });
    }

    const current = await getEffectiveEntries();
    const next = current.filter((item) => item.id !== targetId);
    if (next.length === current.length) {
      return res.status(404).json({ success: false, message: 'Entry not found.' });
    }

    const saved = await AppSetting.findOneAndUpdate(
      { key: ESCALATION_KEY },
      { $set: { value: next, updatedBy: req.user?.name || '' } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json(await buildResponse(Array.isArray(saved.value) ? saved.value.map(normalizeEntry) : next));
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/escalation-labels', async (req, res) => {
  try {
    const labels = await saveEscalationLabelMap(req.body?.labels || req.body || {}, req.user?.name || '');
    const times = req.body?.times
      ? await saveEscalationTimeMap(req.body.times, req.user?.name || '')
      : await getEscalationTimeMap();
    const scheduleConfig = req.body?.scheduleConfig || req.body?.runCounts
      ? await saveEscalationScheduleConfig(req.body.scheduleConfig || { runCounts: req.body.runCounts }, req.user?.name || '')
      : await getEscalationScheduleConfig();
    res.json({
      success: true,
      labels,
      times,
      scheduleConfig,
      escalationTypes: await getEscalationTypesWithLabels(),
      escalationTimes: applyEscalationTimes(times, scheduleConfig),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/escalation-sender', async (req, res) => {
  try {
    const currentDoc = await getSenderSetting();
    const currentValue = currentDoc?.value && typeof currentDoc.value === 'object' ? currentDoc.value : {};
    const sender = normalizeSenderConfig(req.body || {}, currentValue);

    if (!isValidEmail(sender.fromEmail)) {
      return res.status(400).json({ success: false, message: 'Valid sender email is required.' });
    }
    if (!hasApiMailProviderConfigured()) {
      if (!sender.smtpHost) {
        return res.status(400).json({ success: false, message: 'SMTP host is required.' });
      }
      if (!sender.smtpPort || Number.isNaN(Number(sender.smtpPort))) {
        return res.status(400).json({ success: false, message: 'Valid SMTP port is required.' });
      }
      if (!isValidEmail(sender.smtpUser)) {
        return res.status(400).json({ success: false, message: 'Valid SMTP user is required.' });
      }
      if (!String(sender.smtpPass || '').trim()) {
        return res.status(400).json({ success: false, message: 'SMTP password is required.' });
      }
    }

    const saved = await AppSetting.findOneAndUpdate(
      { key: ESCALATION_SENDER_KEY },
      { $set: { value: sender, updatedBy: req.user?.name || '' } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json(sanitizeSenderResponse(saved?.value || sender));
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/escalation-sender/test', async (req, res) => {
  try {
    const result = await sendEscalationSenderTest(req.body?.to || '');
    res.json({
      success: true,
      message: `Test mail sent to ${result.to}.`,
      result,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Sender test failed.' });
  }
});

module.exports = router;
