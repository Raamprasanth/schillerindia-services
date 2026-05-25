const express = require('express');
const crypto = require('crypto');

const router = express.Router();

const { protect, adminOnly } = require('../middleware/authMiddleware');
const AppSetting = require('../models/AppSetting');

const ESCALATION_KEY = 'escalation_emails';
const ESCALATION_SENDER_KEY = 'escalation_sender';
const ESCALATION_TYPES = [
  { value: 'all_escalation', label: 'All Escalation' },
  { value: 'main_combined', label: 'Main Combined Escalation' },
  { value: 'pending_frn', label: 'Pending FRN Escalation' },
  { value: 'estimation_pending', label: 'Estimation Pending Escalation' },
  { value: 'sr_escalation', label: 'SR Escalation' },
  { value: 'to_escalation', label: 'TO Escalation' },
  { value: 'ur_followup', label: 'Under Repair Stock / Follow-up Escalation' },
  { value: 'ur_scrap', label: 'Under Repair Scrap Escalation' },
  { value: 'prf_ob_escalation', label: 'PRF/OB Escalation' },
  { value: 'supplier_warranty_escalation', label: 'Supplier Warranty Escalation' },
  { value: 'external_repair_escalation', label: 'External Repair Escalation' },
];

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

function normalizeSenderConfig(config = {}, existing = {}) {
  const smtpPass = String(config.smtpPass ?? '').trim();
  const fallbackPass = String(existing.smtpPass ?? '').trim();
  return {
    fromEmail: normalizeEmail(config.fromEmail || existing.fromEmail || process.env.ESCALATION_EMAIL_FROM || process.env.ESCALATION_SMTP_USER),
    smtpHost: String(config.smtpHost || existing.smtpHost || process.env.ESCALATION_SMTP_HOST || '').trim(),
    smtpPort: String(config.smtpPort || existing.smtpPort || process.env.ESCALATION_SMTP_PORT || '587').trim() || '587',
    smtpUser: normalizeEmail(config.smtpUser || existing.smtpUser || process.env.ESCALATION_SMTP_USER || ''),
    smtpPass: smtpPass || fallbackPass || String(process.env.ESCALATION_SMTP_PASS || '').trim(),
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

function buildResponse(entries) {
  return {
    success: true,
    entries,
    emails: entries.map((item) => item.email),
    escalationTypes: ESCALATION_TYPES,
  };
}

router.use(protect);

router.get('/escalation-emails', async (req, res) => {
  try {
    const entries = await getEffectiveEntries();
    res.json(buildResponse(entries));
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

router.post('/escalation-emails', async (req, res) => {
  try {
    const nextEntry = normalizeEntry(req.body);
    if (!isValidEmail(nextEntry.email)) {
      return res.status(400).json({ success: false, message: 'Valid email is required.' });
    }

    const current = await getEffectiveEntries();
    if (current.some((item) => item.email === nextEntry.email)) {
      return res.status(409).json({ success: false, message: 'Email already exists.' });
    }

    const next = [...current, nextEntry];
    const saved = await AppSetting.findOneAndUpdate(
      { key: ESCALATION_KEY },
      { $set: { value: next, updatedBy: req.user?.name || '' } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(201).json(buildResponse(Array.isArray(saved.value) ? saved.value.map(normalizeEntry) : next));
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
    if (current.some((item, index) => index !== idx && item.email === updatedEntry.email)) {
      return res.status(409).json({ success: false, message: 'Email already exists.' });
    }

    const next = current.slice();
    next[idx] = updatedEntry;
    const saved = await AppSetting.findOneAndUpdate(
      { key: ESCALATION_KEY },
      { $set: { value: next, updatedBy: req.user?.name || '' } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json(buildResponse(Array.isArray(saved.value) ? saved.value.map(normalizeEntry) : next));
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

    res.json(buildResponse(Array.isArray(saved.value) ? saved.value.map(normalizeEntry) : next));
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

module.exports = router;
