/**
 * geminiKeys.js — Round-robin Gemini API key rotator.
 *
 * Reads up to 5 keys from environment variables:
 *   GEMINI_API_KEY_1 … GEMINI_API_KEY_5
 *
 * Falls back gracefully to the legacy single-key variables so that
 * existing deployments keep working without any .env changes.
 *
 * Usage:
 *   const { getNextKey } = require('../utils/geminiKeys');
 *   const apiKey = getNextKey();
 */

'use strict';

function loadKeys() {
  const keys = [];

  // Primary slot-based keys (GEMINI_API_KEY_1 … GEMINI_API_KEY_5)
  for (let i = 1; i <= 5; i++) {
    const k = (process.env[`GEMINI_API_KEY_${i}`] || '').trim();
    if (k) keys.push(k);
  }

  // Legacy fallback: GEMINI_API_KEY / GEMINI_API_KEY_BACKUP / GOOGLE_API_KEY
  const legacy = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_BACKUP,
    process.env.GOOGLE_API_KEY,
    process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  ];
  for (const k of legacy) {
    const trimmed = (k || '').trim();
    if (trimmed && !keys.includes(trimmed)) {
      keys.push(trimmed);
    }
  }

  return keys;
}

let _index = 0;

/**
 * Returns the next available Gemini API key using round-robin rotation.
 * Throws if no keys are configured.
 */
function getNextKey() {
  const keys = loadKeys();
  if (!keys.length) {
    throw new Error(
      'No Gemini API key is configured. ' +
      'Set at least GEMINI_API_KEY_1 (or GEMINI_API_KEY) in the backend .env file.'
    );
  }
  const key = keys[_index % keys.length];
  _index = (_index + 1) % keys.length;
  return key;
}

/**
 * Returns all configured API keys (useful for diagnostics / health checks).
 */
function getAllKeys() {
  return loadKeys();
}

module.exports = { getNextKey, getAllKeys };
