// models/Report.js
// ──────────────────────────────────────────────────────────────────────────
//  Report model — stores AI-generated reports with full metadata,
//  filters used, AI prompt, generated content and usage stats.
// ──────────────────────────────────────────────────────────────────────────

const mongoose = require('mongoose');

// ── Sub-schema: Date range used for the report ────────────────────────────
const DateRangeSchema = new mongoose.Schema({
  days: { type: Number, default: null },    // e.g. 30 (last 30 days)
  from: { type: String, default: null },    // ISO date "YYYY-MM-DD"
  to:   { type: String, default: null },    // ISO date "YYYY-MM-DD"
}, { _id: false });

// ── Sub-schema: Filters applied ───────────────────────────────────────────
const FiltersSchema = new mongoose.Schema({
  division: { type: String, default: 'all' },
  region:   { type: String, default: 'all' },
  engineer: { type: String, default: null  },
  status:   { type: String, default: null  },
}, { _id: false });

// ── Sub-schema: AI usage stats ────────────────────────────────────────────
const AIUsageSchema = new mongoose.Schema({
  model:            { type: String, default: 'claude-sonnet-4-20250514' },
  inputTokens:      { type: Number, default: 0 },
  outputTokens:     { type: Number, default: 0 },
  generationTimeMs: { type: Number, default: 0 },   // ms
}, { _id: false });

// ── Main Report Schema ────────────────────────────────────────────────────
const ReportSchema = new mongoose.Schema(
  {
    // ── Identity ──────────────────────────────────────────────────────────
    title: {
      type:    String,
      trim:    true,
      default: '',
    },
    reportType: {
      type:     String,
      required: [true, 'Report type is required'],
      trim:     true,
      enum: [
        'service_summary',
        'pending_frn',
        'under_repair',
        'ob_pending',
        'estimation_pending',
        'engineer_performance',
        'division_analytics',
        'escalation_report',
        'custom',
      ],
    },

    // ── Parameters ────────────────────────────────────────────────────────
    dateRange:    { type: DateRangeSchema,  default: () => ({}) },
    filters:      { type: FiltersSchema,    default: () => ({}) },
    format: {
      type:    String,
      default: 'detailed',
      enum:    ['detailed', 'summary', 'technical', 'action'],
    },

    // ── AI input / output ─────────────────────────────────────────────────
    customPrompt:   { type: String, trim: true, default: '' },
    systemPrompt:   { type: String, trim: true, default: '' },  // full system prompt sent to Claude
    dataContext:    { type: String, default: '' },               // raw data summary sent to AI
    content:        { type: String, default: '' },               // final generated report (markdown)
    aiUsage:        { type: AIUsageSchema, default: () => ({}) },

    // ── Status ────────────────────────────────────────────────────────────
    status: {
      type:    String,
      default: 'completed',
      enum:    ['generating', 'completed', 'failed'],
    },
    errorMessage: { type: String, default: '' },

    // ── Audit ─────────────────────────────────────────────────────────────
    generatedBy: { type: String, trim: true, default: '' },
    createdBy:   { type: String, trim: true, default: '' },

    // ── Summary stats embedded for quick display ──────────────────────────
    summary: {
      totalRecords:  { type: Number, default: 0 },
      openRecords:   { type: Number, default: 0 },
      closedRecords: { type: Number, default: 0 },
      overdueCount:  { type: Number, default: 0 },
      keyMetrics:    { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
    },
  },
  {
    timestamps:  true,
    collection:  'reports',
  }
);

// ── Indexes ────────────────────────────────────────────────────────────────
ReportSchema.index({ reportType: 1 });
ReportSchema.index({ status:     1 });
ReportSchema.index({ createdAt: -1 });
ReportSchema.index({ generatedBy: 1 });

// ── Virtual: short ID for display ─────────────────────────────────────────
ReportSchema.virtual('shortId').get(function(){
  return this._id.toString().slice(-8).toUpperCase();
});

module.exports = mongoose.model('Report', ReportSchema);