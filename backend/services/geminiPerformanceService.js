const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function buildLabel(score) {
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Strong';
  if (score >= 55) return 'Stable';
  if (score >= 40) return 'Needs Attention';
  return 'Critical';
}

function formatSummary(scopeLabel, metrics, score) {
  const backlogText = metrics.openCount === 0
    ? 'No open cases are pending right now.'
    : `${metrics.openCount} open cases are pending with an average aging of ${metrics.avgOpenAgeDays} days.`;

  return `${scopeLabel} is at ${score}/100 with ${metrics.completionRate}% completion, ${metrics.escalationRate}% escalation, and ${backlogText}`;
}

function buildHeuristic(metrics, scopeLabel) {
  const completionWeight = metrics.completionRate * 0.38;
  const escalationPenalty = metrics.escalationRate * 0.22;
  const agingPenalty = Math.min(metrics.avgOpenAgeDays, 30) * 0.7;
  const backlogPenalty = Math.min(metrics.openCount, 20) * 0.8;
  const stabilityBonus = metrics.completedCount > 0 ? 8 : 0;
  const activityBonus = metrics.totalCases > 0 ? 7 : 0;

  const score = clamp(
    Math.round(45 + completionWeight + stabilityBonus + activityBonus - escalationPenalty - agingPenalty - backlogPenalty),
    0,
    100
  );

  return {
    score,
    label: buildLabel(score),
    summary: formatSummary(scopeLabel, metrics, score),
    source: 'calculated',
  };
}

function extractJson(text) {
  if (!text) return null;

  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');

  if (start === -1 || end === -1 || end < start) return null;

  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function askGemini(scopeLabel, metrics, heuristic) {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) return null;

  const prompt = [
    'You are scoring employee service performance for an internal dashboard.',
    `Scope: ${scopeLabel}`,
    'Return only JSON with keys: score, label, summary.',
    'Score must be an integer from 0 to 100.',
    'Label must be one of: Excellent, Strong, Stable, Needs Attention, Critical.',
    'Summary must be one concise sentence.',
    `Baseline score: ${heuristic.score}`,
    `Metrics: ${JSON.stringify(metrics)}`,
  ].join('\n');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(DEFAULT_MODEL)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
          },
        }),
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Gemini HTTP ${response.status}: ${text.slice(0, 200)}`);
    }

    const payload = await response.json();
    const text = payload?.candidates?.[0]?.content?.parts?.map(part => part?.text || '').join('') || '';
    const parsed = extractJson(text);

    if (!parsed) return null;

    const score = clamp(Math.round(toNumber(parsed.score) || heuristic.score), 0, 100);
    const label = typeof parsed.label === 'string' && parsed.label.trim()
      ? parsed.label.trim()
      : buildLabel(score);
    const summary = typeof parsed.summary === 'string' && parsed.summary.trim()
      ? parsed.summary.trim()
      : heuristic.summary;

    return { score, label, summary, source: 'gemini' };
  } catch (error) {
    console.warn(`Gemini performance insight failed for ${scopeLabel}:`, error.message);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeMetrics(metrics) {
  const totalCases = toNumber(metrics.totalCases);
  const completedCount = toNumber(metrics.completedCount);
  const pendingCount = toNumber(metrics.pendingCount);
  const inProgressCount = toNumber(metrics.inProgressCount);
  const escalatedCount = toNumber(metrics.escalatedCount);
  const openCount = toNumber(metrics.openCount);
  const avgOpenAgeDays = clamp(Math.round(toNumber(metrics.avgOpenAgeDays)), 0, 999);
  const completionRate = totalCases > 0 ? Math.round((completedCount / totalCases) * 100) : 0;
  const escalationRate = totalCases > 0 ? Math.round((escalatedCount / totalCases) * 100) : 0;

  return {
    totalCases,
    completedCount,
    pendingCount,
    inProgressCount,
    escalatedCount,
    openCount,
    avgOpenAgeDays,
    completionRate,
    escalationRate,
  };
}

async function buildPerformanceInsight(scopeLabel, rawMetrics) {
  const metrics = normalizeMetrics(rawMetrics);
  const heuristic = buildHeuristic(metrics, scopeLabel);
  const aiInsight = await askGemini(scopeLabel, metrics, heuristic);
  const finalInsight = aiInsight || heuristic;

  return {
    ...finalInsight,
    metrics,
  };
}

module.exports = {
  buildPerformanceInsight,
};
