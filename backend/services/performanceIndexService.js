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

function buildManualInsight(metrics, scopeLabel) {
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
    source: 'manual',
  };
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
  return {
    ...buildManualInsight(metrics, scopeLabel),
    metrics,
  };
}

module.exports = {
  buildPerformanceInsight,
};
