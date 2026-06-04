const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { getNextKey } = require('../utils/geminiKeys');

const router = express.Router();

const DEFAULT_DIAGNOSTIC_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash'
];

function getDiagnosticModels() {
  const configured = process.env.GEMINI_DIAGNOSTIC_MODEL || process.env.GEMINI_MODEL;
  const models = configured
    ? configured.split(',').map((model) => model.trim()).filter(Boolean)
    : [];
  for (const model of DEFAULT_DIAGNOSTIC_MODELS) {
    if (!models.includes(model)) models.push(model);
  }
  return models;
}

function isQuotaOrModelError(err) {
  const status = err?.status || err?.statusCode;
  const message = String(err?.message || '');
  return status === 429 || status === 404 || /quota|too many requests|not found|not supported/i.test(message);
}

function cleanGeminiError(err) {
  const message = String(err?.message || '');
  if (/quota|too many requests|429/i.test(message)) {
    return 'Gemini quota is exhausted for the configured model. Please use another Gemini API key, enable billing, or set GEMINI_DIAGNOSTIC_MODEL to an available Flash model.';
  }
  if (/api key/i.test(message)) {
    return 'Gemini API key is missing or invalid. Please check GEMINI_API_KEY in the backend environment.';
  }
  return 'AI diagnostics failed. Please try again or check the Gemini model/API key configuration.';
}

async function analyzeDefectWithGemini({ mimeType, base64 }) {
  const apiKey = getNextKey();

  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(apiKey);
  const prompt = `
You are an expert technical QA engineer and warranty inspector for medical devices and industrial electronics appliances.
Analyze the uploaded image of a defective component, board (PCB), or outer packaging.

Provide your technical assessment as a strictly structured JSON object. Return ONLY the JSON object, matching the structure below.
Every text value must include both English and Tamil, using this exact readable style:
English: ...
Tamil: ...
The JSON object must have exactly these keys:
{
  "technicalDiagnosis": "A professional and detailed description of the physical defects visible in the image (e.g. burn marks, corroded traces, bulging capacitors, water stains, cracks, impact damage, standard wear-and-tear). Include English and Tamil. Max 2-3 sentences per language.",
  "rootCause": "Inferred technical root cause of the failure (e.g., high-voltage electrical surge, overheating, liquid ingress, drop impact, component fatigue, standard wear-and-tear). Include English and Tamil. Max 1-2 sentences per language.",
  "warrantyFraudRisk": "low" | "medium" | "high",
  "warrantyRemarks": "Detailed warranty validation explanation. Highlight any clear indicators of user abuse, physical drop damage, liquid ingress, corrosion, unauthorized tampering/opening, or if it looks like standard in-warranty component failure. Include English and Tamil. Max 2 sentences per language."
}
  `;

  let lastError;
  for (const modelName of getDiagnosticModels()) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: 'application/json'
        }
      });

      const result = await model.generateContent([
        { text: prompt },
        { inlineData: { mimeType, data: base64 } },
      ]);

      const responseText = result.response.text().replace(/```json|```/g, '').trim();
      return JSON.parse(responseText);
    } catch (err) {
      lastError = err;
      console.warn(`[defect-analysis/analyze] ${modelName} failed:`, err.message);
      if (!isQuotaOrModelError(err)) break;
    }
  }

  throw new Error(cleanGeminiError(lastError));
}

function buildSearchLinks(searchQueries = []) {
  const uniqueQueries = [...new Set(searchQueries.map((query) => String(query || '').trim()).filter(Boolean))].slice(0, 4);
  return uniqueQueries.flatMap((query) => [
    {
      title: `Google: ${query}`,
      url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
      type: 'search'
    },
    {
      title: `Datasheets: ${query}`,
      url: `https://www.google.com/search?q=${encodeURIComponent(`${query} datasheet specifications`)}`,
      type: 'datasheet'
    }
  ]).slice(0, 6);
}

async function identifyRepairItemWithGemini({ mimeType, base64 }) {
  const apiKey = getNextKey();

  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(apiKey);
  const prompt = `
You are an expert repair technician for medical devices, electronics, mechanical spares, cables, sensors, PCBs, motors, valves, batteries, and service parts.
Analyze the uploaded image and identify the item or part as accurately as possible.

Return ONLY a valid JSON object with exactly these keys:
{
  "itemName": "Most likely item or part name. If uncertain, include 'Possible ...'",
  "category": "Short category such as PCB, sensor, cable, connector, power supply, pump, valve, display, battery, enclosure, mechanical spare, tool, unknown",
  "confidence": "low" | "medium" | "high",
  "visibleIdentifiers": ["Visible model numbers, labels, markings, component values, connector types, colors, or distinguishing features"],
  "description": "2-3 concise sentences explaining what the item appears to be and what visual evidence supports the identification.",
  "likelyUse": "1-2 concise sentences about where this item is commonly used in repair/service work.",
  "keySpecsToCheck": ["Practical specifications the repair team should verify before replacement or purchase"],
  "handlingTips": ["Safety, ESD, polarity, compatibility, cleaning, or inspection tips relevant to this item"],
  "searchQueries": ["3-4 specific web search queries to find datasheets, manuals, spares, or repair information for this item"]
}
If the image is unclear, be honest and list what extra photo angle or marking is needed.
  `;

  let lastError;
  for (const modelName of getDiagnosticModels()) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: 'application/json'
        }
      });

      const result = await model.generateContent([
        { text: prompt },
        { inlineData: { mimeType, data: base64 } },
      ]);

      const responseText = result.response.text().replace(/```json|```/g, '').trim();
      const analysis = JSON.parse(responseText);
      const searchQueries = Array.isArray(analysis.searchQueries) ? analysis.searchQueries : [];
      return {
        ...analysis,
        referenceLinks: buildSearchLinks(searchQueries)
      };
    } catch (err) {
      lastError = err;
      console.warn(`[defect-analysis/identify-item] ${modelName} failed:`, err.message);
      if (!isQuotaOrModelError(err)) break;
    }
  }

  throw new Error(cleanGeminiError(lastError));
}

router.post('/analyze', protect, async (req, res) => {
  try {
    const { mimeType = '', data = '' } = req.body || {};
    const base64 = String(data || '').replace(/^data:[^,]+,/, '');
    if (!base64) {
      return res.status(400).json({ success: false, message: 'Image data is missing.' });
    }
    if (!mimeType) {
      return res.status(400).json({ success: false, message: 'MimeType is missing.' });
    }

    const analysis = await analyzeDefectWithGemini({ mimeType, base64 });
    res.json({
      success: true,
      analysis
    });
  } catch (err) {
    console.error('[defect-analysis/analyze] Error:', err);
    res.status(500).json({ success: false, message: err.message || 'Defect analysis failed.' });
  }
});

router.post('/identify-item', protect, async (req, res) => {
  try {
    const { mimeType = '', data = '' } = req.body || {};
    const base64 = String(data || '').replace(/^data:[^,]+,/, '');
    if (!base64) {
      return res.status(400).json({ success: false, message: 'Image data is missing.' });
    }
    if (!mimeType || !String(mimeType).startsWith('image/')) {
      return res.status(400).json({ success: false, message: 'A valid image mimeType is required.' });
    }

    const analysis = await identifyRepairItemWithGemini({ mimeType, base64 });
    res.json({
      success: true,
      analysis
    });
  } catch (err) {
    console.error('[defect-analysis/identify-item] Error:', err);
    res.status(500).json({ success: false, message: err.message || 'Item identification failed.' });
  }
});

module.exports = router;
