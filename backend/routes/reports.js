// routes/reports.js
// ──────────────────────────────────────────────────────────────────────────
//  AI Reports API Routes — powered by Gemini
//
//  POST   /api/reports/generate        → generate new AI report
//  GET    /api/reports/history         → paginated report history
//  GET    /api/reports/stats           → quick stats for dashboard
//  GET    /api/reports/:id             → single report
//  DELETE /api/reports/:id             → delete report
// ──────────────────────────────────────────────────────────────────────────

const express = require('express');
const router  = express.Router();
const Report  = require('../models/Report');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { promisify } = require('util');
const { execFile } = require('child_process');
const execFileAsync = promisify(execFile);
const { getPerformanceReviewOptions, getPerformanceReviewData } = require('../services/performanceReviewService');
const { getNextKey } = require('../utils/geminiKeys');

let GoogleGenAI = null;
try { GoogleGenAI = require('@google/generative-ai'); } catch (e) {}

// Pull in your service data models (adjust paths to your project)
let Service, FRNRecord, UnderRepair, EstimationPending;
try { Service           = require('../models/Service'); }           catch(e){}
try { FRNRecord         = require('../models/FRNRecord'); }         catch(e){}
try { UnderRepair       = require('../models/UnderRepair'); }       catch(e){}
try { EstimationPending = require('../models/EstimationPending'); } catch(e){}

// ── JWT Auth ───────────────────────────────────────────────────────────────
const jwt = require('jsonwebtoken');

function verifyToken(req, res, next) {
  const auth  = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return res.status(401).json({ success:false, message:'No token provided.' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch(e) {
    return res.status(401).json({ success:false, message:'Invalid or expired token.' });
  }
}

function adminOrCoord(req, res, next) {
  const role = (req.user?.role || '').toLowerCase();
  if (!['admin','service coordinator','servicecoordinator'].includes(role))
    return res.status(403).json({ success:false, message:'Insufficient permissions.' });
  next();
}

// ── Gemini client factory (per-request, uses key rotator) ─────────────────
function createGenAI() {
  if (!GoogleGenAI) return null;
  try {
    const key = getNextKey();
    return new GoogleGenAI.GoogleGenerativeAI(key);
  } catch (e) {
    console.warn('[reports] No Gemini API key available:', e.message);
    return null;
  }
}

const PERFORMANCE_REVIEW_SCRIPT = path.join(__dirname, '..', 'scripts', 'generate_performance_review.py');
const PERFORMANCE_DIVISION_TEMPLATE = path.join(__dirname, '..', 'templates', 'performance-review-individual-division.xlsm');
const PERFORMANCE_PERSON_TEMPLATE = path.join(__dirname, '..', 'templates', 'performance-review-individual-person.xlsm');

// ══════════════════════════════════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════════════════════════════════

function getDateFilter(dateRange) {
  const now = new Date();
  if (dateRange?.days) {
    const from = new Date(now);
    from.setDate(from.getDate() - parseInt(dateRange.days));
    return { $gte: from.toISOString().split('T')[0] };
  }
  if (dateRange?.from && dateRange?.to) {
    return { $gte: dateRange.from, $lte: dateRange.to };
  }
  const from30 = new Date(now);
  from30.setDate(from30.getDate() - 30);
  return { $gte: from30.toISOString().split('T')[0] };
}

function buildDivisionFilter(division) {
  if (!division || division === 'all') return {};
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(String(division));
  const orConditions = [
    { divisionName: division },
    { 'division.name': division }
  ];
  if (isObjectId) {
    orConditions.push({ division: division });
  }
  return { $or: orConditions };
}

function buildRegionFilter(region) {
  if (!region || region === 'all') return {};
  return { $or: [{ reg: region }, { region: region }, { branch: new RegExp(region,'i') }] };
}

function calcDays(dateStr) {
  if (!dateStr) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000));
}

// ── Fetch and shape data for the specific report type ────────────────────
async function gatherReportData(reportType, dateRange, filters) {
  const dateFilter = getDateFilter(dateRange);
  const divFilter  = buildDivisionFilter(filters?.division);
  const regFilter  = buildRegionFilter(filters?.region);
  const baseQuery  = { entryDate: dateFilter, ...divFilter, ...regFilter };

  let data = { type: reportType, records: [], summary: {} };

  try {
    switch (reportType) {

      case 'service_summary': {
        if (!Service) break;
        const records = await Service.find(baseQuery).lean().limit(500);
        const open    = records.filter(r => r.status !== 'completed' && r.status !== 'closed');
        const closed  = records.filter(r => r.status === 'completed' || r.status === 'closed');
        const overdue = open.filter(r => calcDays(r.entryDate) > 30);
        data.records = records.slice(0, 100);   // cap for prompt size
        data.summary = {
          total: records.length, open: open.length,
          closed: closed.length, overdue: overdue.length,
          avgDays: open.length ? Math.round(open.reduce((s,r)=>s+calcDays(r.entryDate),0)/open.length) : 0,
          byDivision: groupBy(records,'division'),
          byRegion:   groupBy(records,'reg'),
          byStatus:   groupBy(records,'status'),
        };
        break;
      }

      case 'pending_frn': {
        const model = FRNRecord || Service;
        if (!model) break;
        const q = FRNRecord
          ? { ...baseQuery }
          : { ...baseQuery, repType:'NA', unitSts:{ $in:['OW','LAMC','IW','EW','CAMC','STOCK','Demo','Repeat','Buy Back'] } };
        const records = await model.find(q).lean().limit(500);
        const overdue = records.filter(r => calcDays(r.entryDate) > 30);
        data.records = records.slice(0,100);
        data.summary = {
          total: records.length, overdue: overdue.length,
          avgPendingDays: records.length ? Math.round(records.reduce((s,r)=>s+calcDays(r.entryDate),0)/records.length) : 0,
          byDivision: groupBy(records,'division'),
          byEngineer: groupByTop(records,'scEng',10),
        };
        break;
      }

      case 'under_repair': {
        const model = UnderRepair || Service;
        if (!model) break;
        const q = UnderRepair ? baseQuery : { ...baseQuery, repType:'TO/ADV SO' };
        const records = await model.find(q).lean().limit(500);
        const overdue = records.filter(r => calcDays(r.entryDate) > 30);
        data.records = records.slice(0,100);
        data.summary = {
          total: records.length, overdue: overdue.length,
          byEngineer: groupByTop(records,'raEng',10),
          byDivision: groupBy(records,'division'),
        };
        break;
      }

      case 'ob_pending': {
        if (!Service) break;
        const records = await Service.find({
          ...baseQuery,
          movedToEstimation: { $ne: true },
          unitSts: { $in: ['OW','LAMC'] },
        }).lean().limit(500);
        data.records = records.slice(0,100);
        data.summary = {
          total: records.length,
          ow: records.filter(r=>r.unitSts==='OW').length,
          lamc: records.filter(r=>r.unitSts==='LAMC').length,
          overdue: records.filter(r=>calcDays(r.entryDate)>30).length,
          byBranch: groupByTop(records,'branch',10),
        };
        break;
      }

      case 'estimation_pending': {
        const model = EstimationPending || Service;
        if (!model) break;
        const q = EstimationPending ? baseQuery : { ...baseQuery, estPending: true };
        const records = await model.find(q).lean().limit(500);
        data.records = records.slice(0,100);
        data.summary = {
          total: records.length,
          totalValue: records.reduce((s,r)=>s+(r.estAmount||0),0),
          byDivision: groupBy(records,'division'),
        };
        break;
      }

      case 'engineer_performance': {
        if (!Service) break;
        const records = await Service.find(baseQuery).lean().limit(1000);
        const engMap = {};
        records.forEach(r => {
          const eng = r.scEng || r.eng || 'Unknown';
          if (!engMap[eng]) engMap[eng] = { name:eng, total:0, closed:0, overdue:0, avgDays:0, days:[] };
          engMap[eng].total++;
          if (r.status==='completed'||r.status==='closed') engMap[eng].closed++;
          const d = calcDays(r.entryDate);
          if (d>30 && r.status!=='completed') engMap[eng].overdue++;
          engMap[eng].days.push(d);
        });
        Object.values(engMap).forEach(e => {
          e.avgDays = e.days.length ? Math.round(e.days.reduce((a,b)=>a+b,0)/e.days.length) : 0;
          e.closureRate = e.total>0 ? Math.round(e.closed/e.total*100) : 0;
          delete e.days;
        });
        data.summary = {
          total: records.length,
          engineers: Object.values(engMap).sort((a,b)=>b.total-a.total).slice(0,20),
        };
        break;
      }

      case 'division_analytics': {
        if (!Service) break;
        const records = await Service.find(baseQuery).lean().limit(1000);
        data.summary = {
          total: records.length,
          byDivision: groupBy(records,'division'),
          overduByDiv: {},
          closureByDiv: {},
        };
        const divGroups = {};
        records.forEach(r => {
          const d = r.division||r.divisionName||'Other';
          if (!divGroups[d]) divGroups[d] = [];
          divGroups[d].push(r);
        });
        Object.entries(divGroups).forEach(([div,recs])=>{
          data.summary.overduByDiv[div]   = recs.filter(r=>calcDays(r.entryDate)>30&&r.status!=='completed').length;
          data.summary.closureByDiv[div]  = Math.round(recs.filter(r=>r.status==='completed'||r.status==='closed').length/recs.length*100);
        });
        break;
      }

      case 'escalation_report': {
        if (!Service) break;
        const allOpen = await Service.find({
          ...baseQuery,
          status: { $nin: ['completed','closed'] },
        }).lean().limit(500);
        const overdue = allOpen.filter(r => calcDays(r.entryDate) > 30);
        data.records  = overdue.slice(0,80);
        data.summary  = {
          totalOpen: allOpen.length,
          overdue30: overdue.length,
          overdue45: overdue.filter(r=>calcDays(r.entryDate)>45).length,
          overdue60: overdue.filter(r=>calcDays(r.entryDate)>60).length,
          byEngineer: groupByTop(overdue,'scEng',10),
          byDivision: groupBy(overdue,'division'),
        };
        break;
      }

      default: {
        if (Service) {
          const records = await Service.find(baseQuery).lean().limit(200);
          data.records  = records;
          data.summary  = { total: records.length };
        }
      }
    }
  } catch (err) {
    console.error('[Report] Data gather error:', err.message);
    data.error = err.message;
  }

  return data;
}

function groupBy(arr, key) {
  const map = {};
  arr.forEach(r => {
    const v = r[key] || 'Unknown';
    map[v] = (map[v] || 0) + 1;
  });
  return map;
}

function groupByTop(arr, key, topN=10) {
  const grouped = groupBy(arr, key);
  return Object.entries(grouped)
    .sort((a,b)=>b[1]-a[1])
    .slice(0, topN)
    .reduce((o,[k,v])=>({...o,[k]:v}), {});
}

// ── Build AI system + user prompt ────────────────────────────────────────
function buildPrompt(reportType, params, data) {
  const formatInstructions = {
    detailed: 'Write a comprehensive detailed report with full analysis, tables, and recommendations.',
    summary:  'Write a concise executive summary (≤400 words) with only the top 3 insights and 3 action items.',
    technical:'Write a technical deep-dive with data tables, percentage breakdowns, and statistical observations.',
    action:   'Write an action-oriented report focusing entirely on what needs to be done NOW — no fluff, just priorities.',
  };

  const typeDescriptions = {
    service_summary:      'overall service operations summary',
    pending_frn:          'FRN (Field Repair Notice) pipeline analysis',
    under_repair:         'units currently under repair at service centre',
    ob_pending:           'outbound/OB pending items analysis',
    estimation_pending:   'estimation pending backlog analysis',
    engineer_performance: 'field engineer workload and performance analysis',
    division_analytics:   'per-division service analytics and comparison',
    escalation_report:    'escalation report for overdue and critical items',
  };

  const SYSTEM_PROMPT = `You are an expert service operations analyst for SchillerIndia, a medical equipment service company.
Your task is to generate a professional, insightful service report in Markdown format.

FORMATTING RULES:
- Use # for main title, ## for sections, ### for sub-sections
- Use tables for data comparisons
- Use **bold** for important numbers and insights
- Use > ✅ for positive findings, > ⚠ for warnings, > 🚨 for critical alerts
- Always end with "## AI Recommendations" with 3–5 specific, actionable points
- Write in professional business English
- Do NOT use filler phrases like "In conclusion" or "It is worth noting"
- Be direct, data-driven, and specific

${formatInstructions[params.format] || formatInstructions.detailed}`;

  const dataStr = JSON.stringify(data.summary, null, 2);
  const sampleRecords = (data.records||[]).slice(0,15).map(r=>
    `${r.scReNo||r.id}|${r.custName||r.customer||'?'}|${r.model||'?'}|${r.division||'?'}|${r.status||'?'}|${calcDays(r.entryDate)}d`
  ).join('\n');

  const USER_PROMPT = `Generate a ${typeDescriptions[reportType]||reportType} for SchillerIndia Services.

REPORT PARAMETERS:
- Date Range: ${params.dateRange?.days ? `Last ${params.dateRange.days} days` : `${params.dateRange?.from} to ${params.dateRange?.to}`}
- Division Filter: ${params.filters?.division || 'All'}
- Region Filter:   ${params.filters?.region   || 'All'}
- Format:          ${params.format}
- Report Title:    ${params.title || 'Auto-generate a suitable title'}

DATA SUMMARY:
${dataStr}

SAMPLE RECORDS (SC Ref|Customer|Model|Division|Status|PendingDays):
${sampleRecords || 'No records available — note this in the report.'}

${params.customPrompt ? `SPECIAL INSTRUCTIONS FROM USER:\n${params.customPrompt}` : ''}

Generate the complete report now:`;

  return { systemPrompt: SYSTEM_PROMPT, userPrompt: USER_PROMPT };
}

function buildFallbackReport(reportType, params, data) {
  const typeLabels = {
    service_summary: 'Service Summary',
    pending_frn: 'Pending FRN Analysis',
    under_repair: 'Under Repair Analysis',
    ob_pending: 'OB Pending Analysis',
    estimation_pending: 'Estimation Pending Analysis',
    engineer_performance: 'Engineer Performance Analysis',
    division_analytics: 'Division Analytics',
    escalation_report: 'Escalation Report',
  };
  const label = typeLabels[reportType] || 'Service Report';
  const period = params.dateRange?.days
    ? `Last ${params.dateRange.days} days`
    : `${params.dateRange?.from || '-'} to ${params.dateRange?.to || '-'}`;
  const division = params.filters?.division && params.filters.division !== 'all'
    ? params.filters.division
    : 'All Divisions';
  const region = params.filters?.region && params.filters.region !== 'all'
    ? params.filters.region
    : 'All Regions';
  const summary = data.summary || {};
  const lines = [
    `# ${label}`,
    `**Period:** ${period}`,
    `**Division:** ${division}`,
    `**Region:** ${region}`,
    '',
    '## Executive Overview',
    `Generated from live SchillerIndia report data${data.error ? ` with partial fallback because of data issue: ${data.error}` : '.'}`,
    '',
    '## Key Metrics',
  ];

  Object.entries(summary).forEach(([key, value]) => {
    if (value === null || value === undefined) return;
    if (typeof value === 'number' || typeof value === 'string') {
      lines.push(`- **${String(key).replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase())}:** \`${value}\``);
    }
  });

  const byDivision = summary.byDivision && typeof summary.byDivision === 'object' ? summary.byDivision : null;
  if (byDivision && Object.keys(byDivision).length) {
    lines.push('', '## Division Snapshot', '| Division | Count |', '|---|---:|');
    Object.entries(byDivision).slice(0, 12).forEach(([k, v]) => lines.push(`| ${k} | ${v} |`));
  }

  const byEngineer = summary.byEngineer && typeof summary.byEngineer === 'object' ? summary.byEngineer : null;
  if (byEngineer && Object.keys(byEngineer).length) {
    lines.push('', '## Engineer Snapshot', '| Engineer | Count |', '|---|---:|');
    Object.entries(byEngineer).slice(0, 12).forEach(([k, v]) => lines.push(`| ${k} | ${v} |`));
  }

  lines.push(
    '',
    '## AI Recommendations',
    '> ✅ Review the highest-volume division first and compare it with open and overdue counts.',
    '> ⚠ Focus follow-up on engineers or divisions with overdue work appearing repeatedly in this report.',
    '> ✅ Use this report together with escalation queues to prioritize same-day action.'
  );

  return lines.join('\n');
}


function summarizePerformanceRows(data) {
  const rows = Array.isArray(data?.activityRows) ? data.activityRows : [];
  return {
    month: data?.month,
    monthLabel: data?.monthLabel,
    scope: data?.scope,
    division: data?.division || '',
    employee: data?.employee || '',
    employeeDivision: data?.employeeDivision || '',
    totalTracked: data?.summary?.totalTracked || 0,
    completedCount: data?.summary?.completedCount || 0,
    pendingCount: data?.summary?.pendingCount || 0,
    completionRate: data?.summary?.completionRate || 0,
    criticalPendingCount: data?.summary?.criticalPendingCount || 0,
    serviceCount: data?.summary?.serviceCount || 0,
    underRepairCount: data?.summary?.underRepairCount || 0,
    estimationCount: data?.summary?.estimationCount || 0,
    scrapCount: data?.summary?.scrapCount || 0,
    narratives: data?.narratives || {},
    activities: rows.map((row) => ({
      label: row.label,
      total: row.total || 0,
      withinTarget: row.withinTarget || 0,
      completionPercent: row.total ? Math.round((row.withinTarget / row.total) * 100) : 0,
    })),
    row14: data?.row14 || null,
    row15: data?.row15 || null,
  };
}

// ══════════════════════════════════════════════════════════════════════════
//  POST /api/reports/generate
// ══════════════════════════════════════════════════════════════════════════
router.post('/generate', verifyToken, async (req, res) => {
  const startTime = Date.now();
  const {
    reportType,
    dateRange   = { days: 30 },
    filters     = {},
    format      = 'detailed',
    customPrompt= '',
    title       = '',
  } = req.body;

  if (!reportType) {
    return res.status(400).json({ success: false, message: 'reportType is required.' });
  }

  // Create a placeholder report record
  let report;
  try {
    report = await Report.create({
      reportType,
      dateRange,
      filters,
      format,
      customPrompt,
      title,
      status:      'generating',
      generatedBy: req.user?.name || req.user?.id || 'system',
      createdBy:   req.user?.name || req.user?.id || 'system',
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }

  try {
    // 1 — Gather data from MongoDB
    const data = await gatherReportData(reportType, dateRange, filters);

    // 2 — Build prompts
    const { systemPrompt, userPrompt } = buildPrompt(
      reportType, { reportType, dateRange, filters, format, customPrompt, title }, data
    );

    let generatedContent = '';
    let aiUsage = {
      model: 'fallback-local',
      inputTokens: 0,
      outputTokens: 0,
      generationTimeMs: 0,
    };

    const { getAllKeys } = require('../utils/geminiKeys');
    const https = require('https');
    const allKeys = getAllKeys();
    const groqKey = allKeys.find(k => k.startsWith('gsk_')) || process.env.GEMINI_API_KEY_2;

    if (groqKey) {
      try {
        const groqData = await new Promise((resolve, reject) => {
          const req = https.request('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${groqKey}`
            }
          }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
              if (res.statusCode >= 200 && res.statusCode < 300) {
                try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
              } else {
                reject(new Error(`Groq API Error: ${res.statusCode} ${body}`));
              }
            });
          });
          req.on('error', reject);
          req.write(JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            temperature: 0.3
          }));
          req.end();
        });

        generatedContent = groqData.choices?.[0]?.message?.content || '';

        aiUsage = {
          model: 'llama-3.3-70b-versatile (Groq)',
          inputTokens: groqData.usage?.prompt_tokens || 0,
          outputTokens: groqData.usage?.completion_tokens || 0,
          generationTimeMs: Date.now() - startTime,
        };
      } catch (err) {
        console.error('[reports] Groq API failed:', err);
        generatedContent = buildFallbackReport(reportType, { reportType, dateRange, filters, format, customPrompt, title }, data);
      }
    } else {
      generatedContent = buildFallbackReport(reportType, { reportType, dateRange, filters, format, customPrompt, title }, data);
    }

    // Extract auto-generated title from first # heading if not provided
    let finalTitle = title;
    if (!finalTitle) {
      const match = generatedContent.match(/^#\s+(.+)$/m);
      finalTitle = match ? match[1].trim() : `${reportType.replace(/_/g,' ')} — ${new Date().toLocaleDateString('en-IN',{month:'short',year:'numeric'})}`;
    }

    const genTimeMs = Date.now() - startTime;

    // 4 — Update report record
    report.title        = finalTitle;
    report.content      = generatedContent;
    report.systemPrompt = systemPrompt;
    report.dataContext  = JSON.stringify(data.summary);
    report.status       = 'completed';
    aiUsage.generationTimeMs = genTimeMs;
    report.aiUsage      = aiUsage;
    report.summary = {
      totalRecords:  data.summary?.total    || 0,
      openRecords:   data.summary?.open     || 0,
      closedRecords: data.summary?.closed   || 0,
      overdueCount:  data.summary?.overdue  || data.summary?.overdue30 || 0,
    };
    await report.save();

    return res.json({
      ...report.toObject(),
      generationTimeMs: genTimeMs,
    });

  } catch (err) {
    console.error('[Report] Generation error:', err.message);
    report.status       = 'failed';
    report.errorMessage = err.message;
    await report.save().catch(() => {});

    return res.status(500).json({
      success: false,
      message: err.message,
      reportId: report._id,
    });
  }
});

// ══════════════════════════════════════════════════════════════════════════
//  GET /api/reports/stats
// ══════════════════════════════════════════════════════════════════════════
router.get('/performance/options', verifyToken, async (req, res) => {
  try {
    const options = await getPerformanceReviewOptions();
    return res.json({ success: true, ...options });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/performance/summary', verifyToken, async (req, res) => {
  try {
    const { scope, month, division, employee } = req.query;
    const data = await getPerformanceReviewData({ scope, month, division, employee });
    return res.json({ success: true, data: summarizePerformanceRows(data) });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});


router.get('/stats', verifyToken, async (req, res) => {
  try {
    const [total, thisMonthCount, avgPipeline] = await Promise.all([
      Report.countDocuments({ status: 'completed' }),
      Report.countDocuments({
        status:    'completed',
        createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
      }),
      Report.aggregate([
        { $match: { status:'completed', 'aiUsage.generationTimeMs':{ $gt:0 } } },
        { $group: { _id: null, avg: { $avg: '$aiUsage.generationTimeMs' } } },
      ]),
    ]);

    // Count by type
    const typeCounts = await Report.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: '$reportType', count: { $sum: 1 } } },
    ]);
    const typeMap = typeCounts.reduce((o, t) => ({ ...o, [t._id]: t.count }), {});

    const avgMs   = avgPipeline[0]?.avg || 8000;

    return res.json({
      total,
      thisMonth: thisMonthCount,
      avgTime:   Math.round(avgMs / 1000),
      typeCounts: typeMap,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════
//  GET /api/reports/history
// ══════════════════════════════════════════════════════════════════════════
router.get('/history', verifyToken, async (req, res) => {
  try {
    const { page=1, limit=20, reportType, status } = req.query;
    const filter = {};
    if (reportType) filter.reportType = reportType;
    if (status)     filter.status     = status;

    const total   = await Report.countDocuments(filter);
    const reports = await Report.find(filter)
      .sort({ createdAt: -1 })
      .skip((parseInt(page)-1)*parseInt(limit))
      .limit(parseInt(limit))
      .select('-content -systemPrompt -dataContext')   // exclude large fields from list
      .lean();

    return res.json({
      reports,
      pagination: {
        total,
        page:  parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════
//  GET /api/reports/:id
// ══════════════════════════════════════════════════════════════════════════
router.get('/:id([0-9a-fA-F]{24})', verifyToken, async (req, res) => {
  try {
    const report = await Report.findById(req.params.id).lean();
    if (!report) return res.status(404).json({ success:false, message:'Report not found.' });
    return res.json(report);
  } catch (err) {
    return res.status(500).json({ success:false, message: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════
//  DELETE /api/reports/:id
// ══════════════════════════════════════════════════════════════════════════
router.delete('/:id([0-9a-fA-F]{24})', verifyToken, async (req, res) => {
  try {
    const deleted = await Report.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success:false, message:'Report not found.' });
    return res.json({ success:true, message:'Report deleted.' });
  } catch (err) {
    return res.status(500).json({ success:false, message: err.message });
  }
});

// --------------------------------------------------------------------------
//  GET /api/reports/analytics
// --------------------------------------------------------------------------
router.get('/analytics', verifyToken, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);
    const dateFilter = { $gte: fromDate.toISOString().split('T')[0] };

    // We will aggregate calls, FRNs, BIRs
    // Since models might be missing, we do our best
    let Service, FRNRecord, Bir;
    try { Service = require('../models/Service'); } catch(e){}
    try { FRNRecord = require('../models/FRNRecord'); } catch(e){}
    try { Bir = require('../models/Bir'); } catch(e){}

    // 1. Division Distribution (Using Service)
    let divisions = [];
    if (Service) {
      const divData = await Service.aggregate([
        { $match: { entryDate: dateFilter } },
        { $group: { _id: '$division', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);
      divisions = divData.map(d => ({ division: d._id || 'Unknown', count: d.count }));
    }

    // 2. Engineer Performance (Top 10 completed tasks)
    let engineers = [];
    if (Service) {
      const engData = await Service.aggregate([
        { $match: { entryDate: dateFilter, status: { $in: ['completed', 'closed'] } } },
        { $group: { _id: { $cond: [{ $eq: ['$scEng', null] }, '$eng', '$scEng'] }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]);
      engineers = engData.filter(e => e._id).map(e => ({ name: e._id, count: e.count }));
    }

    // 3. Trends (Last X days grouped by date)
    // We'll query all and group in JS to handle different models
    let trendsMap = {};
    for (let i=0; i<days; i++) {
      let d = new Date();
      d.setDate(d.getDate() - i);
      trendsMap[d.toISOString().split('T')[0]] = { calls: 0, frns: 0, birs: 0 };
    }

    if (Service) {
      const calls = await Service.find({ entryDate: dateFilter }).select('entryDate').lean();
      calls.forEach(c => {
        const d = c.entryDate ? c.entryDate.split('T')[0] : '';
        if (trendsMap[d]) trendsMap[d].calls++;
      });
    }

    if (FRNRecord) {
      const frns = await FRNRecord.find({ entryDate: dateFilter }).select('entryDate').lean();
      frns.forEach(c => {
        const d = c.entryDate ? c.entryDate.split('T')[0] : '';
        if (trendsMap[d]) trendsMap[d].frns++;
      });
    }

    if (Bir) {
      const birs = await Bir.find({ createdAt: { $gte: fromDate } }).select('createdAt').lean();
      birs.forEach(c => {
        const d = new Date(c.createdAt).toISOString().split('T')[0];
        if (trendsMap[d]) trendsMap[d].birs++;
      });
    }

    const trends = Object.keys(trendsMap).sort().map(date => ({
      date,
      calls: trendsMap[date].calls,
      frns: trendsMap[date].frns,
      birs: trendsMap[date].birs
    }));

    res.json({ trends, divisions, engineers });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

