const express = require('express');
const zlib = require('zlib');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

const FIELD_ALIASES = {
  scReNo: ['sc ref no', 'sc reference no', 'sc re no', 'service ref no', 'service reference'],
  frnNo: ['frn no', 'frn number'],
  frnDate: ['frn date'],
  serCommInwardDate: ['ser comm inward date', 'service comm inward date', 'commercial inward date'],
  rcvdDateSc: ['received date at sc', 'rcvd date sc', 'service centre rcvd date', 'service center rcvd date'],
  stockCust: ['stock / cust', 'stock cust', 'stock/customer'],
  region: ['region'],
  branch: ['branch'],
  engineer: ['engineer', 'field engineer'],
  dealer: ['dealer name', 'dealer'],
  customer: ['customer name', 'customer'],
  supplier: ['supplier'],
  model: ['model'],
  modelConfig: ['model configuration', 'configuration'],
  unitSl: ['unit sl no', 'unit serial no', 'serial no', 'unit s/n'],
  unitStatus: ['unit status', 'unit sts'],
  partNo: ['part number', 'part no'],
  modBrd: ['mod / brd name', 'mod brd name', 'module board name', 'board name'],
  defType: ['def type', 'defective type'],
  typeAcc: ['type of acc', 'type of account', 'account type'],
  doi: ['doi', 'date of installation', 'installation date'],
  defPartSno: ['def part sno', 'defective part sno', 'def part serial no'],
  defGirNo: ['def gir no', 'defective gir no'],
  repType: ['rep type', 'repair type'],
  repGirNo: ['rep gir sno', 'rep gir no', 'replacement gir no'],
  fieldRemarks: ['field remarks', 'remarks', 'complaint', 'problem reported'],
  commWarrDetails: ['comm warr details', 'commercial warranty details', 'warranty details'],
  obDetails: ['ob details', 'ob notes'],
};

function cleanText(text) {
  return String(text || '')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function decodePdfString(value) {
  return String(value || '')
    .replace(/\\([nrtbf()\\])/g, (_m, ch) => ({ n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '(': '(', ')': ')', '\\': '\\' }[ch] || ch))
    .replace(/\\([0-7]{1,3})/g, (_m, oct) => String.fromCharCode(parseInt(oct, 8)));
}

function extractStringsFromPdfText(text) {
  const out = [];
  const source = String(text || '');
  let match;
  const tj = /\((?:\\.|[^\\)])*\)\s*Tj/g;
  while ((match = tj.exec(source))) {
    out.push(decodePdfString(match[0].replace(/\)\s*Tj$/, '').slice(1)));
  }
  const tjArray = /\[((?:.|\n|\r)*?)\]\s*TJ/g;
  while ((match = tjArray.exec(source))) {
    const parts = match[1].match(/\((?:\\.|[^\\)])*\)/g) || [];
    if (parts.length) out.push(parts.map(p => decodePdfString(p.slice(1, -1))).join(''));
  }
  return out.join('\n');
}

function extractPdfText(buffer) {
  const chunks = [];
  const raw = buffer.toString('latin1');
  chunks.push(extractStringsFromPdfText(raw));
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match;
  while ((match = streamRegex.exec(raw))) {
    const bytes = Buffer.from(match[1], 'latin1');
    try {
      chunks.push(extractStringsFromPdfText(zlib.inflateSync(bytes).toString('latin1')));
    } catch (_err) {
      chunks.push(extractStringsFromPdfText(match[1]));
    }
  }
  return cleanText(chunks.filter(Boolean).join('\n'));
}

function labelPattern(label) {
  return label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*');
}

function findValue(text, labels) {
  for (const label of labels) {
    const pattern = new RegExp(`${labelPattern(label)}\\s*[:\\-]?\\s*([^\\n\\r|]{2,90})`, 'i');
    const match = text.match(pattern);
    if (match && match[1]) return match[1].replace(/\s{2,}.*/, '').trim();
  }
  return '';
}

function normalizeDate(value) {
  const v = String(value || '').trim();
  if (!v) return '';
  let match = v.match(/\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\b/);
  if (match) {
    const dd = match[1].padStart(2, '0');
    const mm = match[2].padStart(2, '0');
    const yyyy = match[3].length === 2 ? `20${match[3]}` : match[3];
    return `${yyyy}-${mm}-${dd}`;
  }
  match = v.match(/\b(\d{4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})\b/);
  if (match) return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
  return '';
}

function normalizeChoice(value, choices) {
  const v = String(value || '').trim();
  if (!v) return '';
  const exact = choices.find(c => c.toLowerCase() === v.toLowerCase());
  if (exact) return exact;
  const loose = choices.find(c => v.toLowerCase().includes(c.toLowerCase()));
  return loose || v;
}

function normalizeFieldKey(key) {
  const raw = String(key || '').trim();
  if (Object.prototype.hasOwnProperty.call(FIELD_ALIASES, raw)) return raw;
  const compact = raw.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    const candidates = [field, ...aliases].map(item => String(item).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim());
    if (candidates.includes(compact)) return field;
  }
  return '';
}

function normalizeExtractedFields(input) {
  const fields = {};
  const source = input && typeof input === 'object' && input.fields && typeof input.fields === 'object'
    ? input.fields
    : input;
  Object.entries(source || {}).forEach(([key, value]) => {
    const normalizedKey = normalizeFieldKey(key);
    if (!normalizedKey) return;
    const text = String(value || '').trim();
    if (text) fields[normalizedKey] = text;
  });
  Object.entries(FIELD_ALIASES).forEach(([key, aliases]) => {
    if (fields[key]) return;
    const value = findValue(String(input?.rawText || ''), aliases);
    if (value) fields[key] = value;
  });
  ['frnDate', 'serCommInwardDate', 'rcvdDateSc', 'doi'].forEach(key => {
    if (fields[key]) fields[key] = normalizeDate(fields[key]);
  });
  if (fields.stockCust) fields.stockCust = normalizeChoice(fields.stockCust, ['STK', 'CUST', 'STOCK']);
  if (fields.stockCust === 'STOCK') fields.stockCust = 'STK';
  if (fields.unitStatus) fields.unitStatus = normalizeChoice(fields.unitStatus, ['Repeat', 'Demo', 'OW', 'IW', 'EW', 'LAMC', 'CAMC', 'STOCK']);
  if (fields.repType) fields.repType = normalizeChoice(fields.repType, ['NA', 'TO/ADV SO', 'BS/SO']);
  if (fields.defType) fields.defType = normalizeChoice(fields.defType, ['Spare', 'PCB', 'Sub Unit', 'Consumables', 'Unit']);
  if (fields.typeAcc) fields.typeAcc = normalizeChoice(fields.typeAcc, ['NA', 'Local', 'Repaired', 'Imported']);
  return fields;
}

function extractFieldsFromText(text) {
  const fields = {};
  Object.entries(FIELD_ALIASES).forEach(([key, aliases]) => {
    const value = findValue(text, aliases);
    if (value) fields[key] = value;
  });
  return normalizeExtractedFields(fields);
}

function parseJsonObject(text) {
  const cleaned = String(text || '').replace(/```json|```/gi, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (_err) {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw _err;
  }
}

function simplifyGeminiError(err) {
  const text = String(err?.message || err || '').replace(/\s+/g, ' ').trim();
  if (!text) return 'AI extraction failed.';
  if (/429|quota|rate.?limit|too many requests/i.test(text)) {
    return 'Gemini quota is over. Enable billing or use another Gemini API key, then retry.';
  }
  if (/api key|permission|unauth|forbidden|403|401/i.test(text)) {
    return 'Gemini API key is invalid or not allowed. Check GEMINI_API_KEY in backend .env.';
  }
  if (/not found|404|model/i.test(text)) {
    return 'Gemini model is not available for this API key. Set SERVICE_DOC_GEMINI_MODEL=gemini-2.5-flash and restart.';
  }
  if (/fetch|network|ENOTFOUND|ECONN|ETIMEDOUT|EAI_AGAIN/i.test(text)) {
    return 'Backend cannot reach Gemini. Check internet/DNS/firewall on the server.';
  }
  return text.slice(0, 220);
}

async function extractWithGemini({ mimeType, base64 }) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) return null;
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(apiKey);
  const preferred = process.env.SERVICE_DOC_GEMINI_MODEL || process.env.GEMINI_DOCUMENT_MODEL || '';
  const modelNames = [...new Set([preferred, 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest', 'gemini-flash-lite-latest'].filter(Boolean))];
  const prompt = [
    'You are reading a Schiller India service entry form. The document may be a phone photo, scanned PDF, or handwritten form.',
    'Extract all clearly readable service-entry fields. Read handwriting carefully, including mixed uppercase/lowercase text and numbers.',
    'Return only one JSON object. Use exactly these keys when present:',
    Object.keys(FIELD_ALIASES).join(', '),
    'Use yyyy-mm-dd for dates.',
    'For dropdown-like values normalize to the closest valid option when obvious: stockCust STK/CUST, unitStatus Repeat/Demo/OW/IW/EW/LAMC/CAMC/STOCK, repType NA/TO/ADV SO/BS/SO, defType Spare/PCB/Sub Unit/Consumables/Unit, typeAcc NA/Local/Repaired/Imported.',
    'If a value is not readable, omit that key. Do not guess.'
  ].join('\n');
  let lastError = null;
  for (const modelName of modelNames) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
        },
      });
      const result = await model.generateContent([
        { text: prompt },
        { inlineData: { mimeType, data: base64 } },
      ]);
      const responseText = result.response.text();
      return normalizeExtractedFields(parseJsonObject(responseText));
    } catch (err) {
      lastError = err;
      console.warn(`[service-documents/extract] ${modelName} failed:`, simplifyGeminiError(err));
    }
  }
  throw lastError || new Error('AI extraction failed.');
}

router.post('/extract', protect, async (req, res) => {
  try {
    const { fileName = '', mimeType = '', data = '' } = req.body || {};
    const base64 = String(data || '').replace(/^data:[^,]+,/, '');
    if (!base64) return res.status(400).json({ success: false, message: 'File data missing.' });
    const effectiveMimeType = String(mimeType || '').trim()
      || (/\.pdf$/i.test(fileName) ? 'application/pdf' : '')
      || (/\.(jpe?g)$/i.test(fileName) ? 'image/jpeg' : '')
      || (/\.png$/i.test(fileName) ? 'image/png' : '')
      || (/\.webp$/i.test(fileName) ? 'image/webp' : '')
      || 'image/jpeg';

    let rawText = '';
    let source = 'local';
    const buffer = Buffer.from(base64, 'base64');

    if (/pdf/i.test(effectiveMimeType) || /\.pdf$/i.test(fileName)) {
      rawText = extractPdfText(buffer);
    }

    let fields = rawText ? extractFieldsFromText(rawText) : {};
    let aiError = '';
    if (!Object.keys(fields).length || /^image\//i.test(effectiveMimeType)) {
      const geminiFields = await extractWithGemini({ mimeType: effectiveMimeType, base64 }).catch((err) => {
        aiError = simplifyGeminiError(err);
        console.warn('[service-documents/extract] AI extraction skipped:', aiError);
        return null;
      });
      if (geminiFields && typeof geminiFields === 'object') {
        fields = { ...fields, ...geminiFields };
        source = 'gemini';
      }
    }

    res.json({
      success: true,
      source,
      fields,
      aiError,
      rawText: rawText.slice(0, 4000),
      message: Object.keys(fields).length
        ? `Extracted ${Object.keys(fields).length} field(s).`
        : (aiError ? `AI could not read this upload: ${aiError}` : 'No readable fields found. Fill the details manually.'),
    });
  } catch (err) {
    console.error('[service-documents/extract]', err);
    res.status(500).json({ success: false, message: err.message || 'Extraction failed.' });
  }
});

module.exports = router;
