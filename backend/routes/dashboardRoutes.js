// routes/dashboardRoutes.js
const router   = require('express').Router();
const Engineer = require('../models/engineerModel');
const Service  = require('../models/Service');
const Dealer   = require('../models/Dealer');
const Division = require('../models/Division');
const CompletedFRN = require('../models/CompletedFRN');
const SCCompletedFRN = require('../models/SCCompletedFRN');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { buildPerformanceInsight } = require('../services/performanceIndexService');

function divisionLabelFromDoc(doc = {}) {
  const division = doc.division;
  if (division && typeof division === 'object' && division.name) return String(division.name).trim();
  if (doc.divisionName) return String(doc.divisionName).trim();
  if (doc.reg) return String(doc.reg).trim();
  if (doc.region) return String(doc.region).trim();
  return 'Unassigned';
}

async function buildAdminDivisionBreakdown() {
  const [services, completedFrns] = await Promise.all([
    Service.find()
      .select('division divisionName reg region status')
      .populate('division', 'name')
      .lean(),
    CompletedFRN.find()
      .select('serviceId region')
      .lean(),
  ]);

  const serviceById = new Map(services.map((doc) => [String(doc._id), doc]));
  const rows = new Map();

  const ensure = (division) => {
    const key = division || 'Unassigned';
    if (!rows.has(key)) {
      rows.set(key, {
        division: key,
        serviceTotal: 0,
        pending: 0,
        inProgress: 0,
        completedServices: 0,
        escalated: 0,
        completedFrn: 0,
      });
    }
    return rows.get(key);
  };

  services.forEach((service) => {
    const row = ensure(divisionLabelFromDoc(service));
    row.serviceTotal += 1;
    if (service.status === 'pending') row.pending += 1;
    else if (service.status === 'in_progress') row.inProgress += 1;
    else if (service.status === 'completed') row.completedServices += 1;
    else if (service.status === 'escalated') row.escalated += 1;
  });

  completedFrns.forEach((doc) => {
    const source = serviceById.get(String(doc.serviceId || ''));
    const row = ensure(source ? divisionLabelFromDoc(source) : divisionLabelFromDoc(doc));
    row.completedFrn += 1;
  });

  return Array.from(rows.values()).sort((a, b) => {
    const totalA = a.serviceTotal + a.completedFrn;
    const totalB = b.serviceTotal + b.completedFrn;
    if (totalB !== totalA) return totalB - totalA;
    return a.division.localeCompare(b.division);
  });
}

// ── GET /api/dashboard/admin ────────────────────
router.get('/admin', protect, adminOnly, async (req, res) => {
  try {
    const [
      totalEngineers, activeEngineers,
      totalServices, activeServices, pendingServices, completedServices, escalatedServices,
      totalDealers, activeDealers,
      totalDivisions,
      recentServices,
      divisionBreakdown,
    ] = await Promise.all([
      Engineer.countDocuments(),
      Engineer.countDocuments({ status: 'active' }),
      Service.countDocuments(),
      Service.countDocuments({ status: 'in_progress' }),
      Service.countDocuments({ status: 'pending' }),
      Service.countDocuments({ status: 'completed' }),
      Service.countDocuments({ status: 'escalated' }),
      Dealer.countDocuments(),
      Dealer.countDocuments({ status: 'active' }),
      Division.countDocuments(),
      Service.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('engineer', 'name')
        .populate('division', 'name'),
      buildAdminDivisionBreakdown(),
    ]);

    // Last 7 days service counts (parallel execution for max speed)
    const dayPromises = [];
    for (let i = 6; i >= 0; i--) {
      const from = new Date(); from.setDate(from.getDate() - i); from.setHours(0, 0, 0, 0);
      const to   = new Date(from); to.setHours(23, 59, 59, 999);
      const dayLabel = from.toLocaleDateString('en-IN', { weekday: 'short' });
      
      dayPromises.push(
        Promise.all([
          Service.countDocuments({ createdAt: { $gte: from, $lte: to } }),
          SCCompletedFRN.countDocuments({ typeWork: { $regex: /external/i }, createdAt: { $gte: from, $lte: to } }),
          SCCompletedFRN.countDocuments({ typeWork: { $regex: /supplier/i }, createdAt: { $gte: from, $lte: to } }),
          CompletedFRN.countDocuments({ createdAt: { $gte: from, $lte: to } }),
        ]).then(([count, externalCount, supplierCount, completedFrnCount]) => ({
          date: dayLabel, count, externalCount, supplierCount, completedFrnCount
        }))
      );
    }
    const weeklyData = await Promise.all(dayPromises);

    if (res.headersSent) return;
    res.json({
      stats: {
        totalEngineers, activeEngineers,
        totalServices, activeServices, pendingServices, completedServices, escalatedServices,
        totalDealers, activeDealers, totalDivisions,
      },
      recentServices,
      weeklyData,
      divisionBreakdown,
    });
  } catch (err) {
    if (res.headersSent) return;
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/dashboard/employee ─────────────────
router.get('/employee', protect, async (req, res) => {
  try {
    const { getDivisionFilter, getServiceIdsFilter } = require('../utils/visibility');
    const visibilityFilter = await getDivisionFilter(req.user);
    const completedVisibilityFilter = await getServiceIdsFilter(req.user);
    const engineerName = (req.user?.name || '').trim();
    const engineerOwnFilter = engineerName
      ? {
          ...visibilityFilter,
          submittedBy: engineerName,
        }
      : visibilityFilter;

    const openStatuses = ['pending', 'in_progress', 'escalated'];
    const [pending, inProgress, recentServices, divisionOpenDocs, engineerPending, engineerInProgress, engineerEscalated, engineerOpenDocs, divisionEscalated, divisionCompletedFrnCount, ownServiceIds] = await Promise.all([
      Service.countDocuments({ ...visibilityFilter, status: 'pending' }),
      Service.countDocuments({ ...visibilityFilter, status: 'in_progress' }),
      Service.find(visibilityFilter).sort({ createdAt: -1 }).limit(5).populate('division', 'name'),
      Service.find({ ...visibilityFilter, status: { $in: openStatuses } }).select('entryDate createdAt'),
      Service.countDocuments({ ...engineerOwnFilter, status: 'pending' }),
      Service.countDocuments({ ...engineerOwnFilter, status: 'in_progress' }),
      Service.countDocuments({ ...engineerOwnFilter, status: 'escalated' }),
      Service.find({ ...engineerOwnFilter, status: { $in: openStatuses } }).select('entryDate createdAt'),
      Service.countDocuments({ ...visibilityFilter, status: 'escalated' }),
      CompletedFRN.countDocuments(completedVisibilityFilter),
      Service.find(engineerOwnFilter).select('_id').lean(),
    ]);
    const ownServiceIdStrings = ownServiceIds.map(doc => String(doc._id));
    const engineerCompletedFrnCount = ownServiceIdStrings.length
      ? await CompletedFRN.countDocuments({ serviceId: { $in: ownServiceIdStrings } })
      : 0;
    const divisionOpenCount = divisionOpenDocs.length;
    const engineerOpenCount = engineerOpenDocs.length;
    const assigned = divisionOpenCount + divisionCompletedFrnCount;
    const completed = divisionCompletedFrnCount;
    const engineerTotal = engineerOpenCount + engineerCompletedFrnCount;
    const engineerCompleted = engineerCompletedFrnCount;
    const completionRate = assigned > 0 ? Math.round((completed / assigned) * 100) : 0;
    const ageInDays = (doc) => {
      const base = doc?.entryDate || doc?.createdAt;
      if (!base) return 0;
      const diff = Math.floor((Date.now() - new Date(base).getTime()) / 86400000);
      return Number.isFinite(diff) ? Math.max(0, diff) : 0;
    };

    const divisionAvgOpenAgeDays = divisionOpenDocs.length
      ? Math.round(divisionOpenDocs.reduce((sum, doc) => sum + ageInDays(doc), 0) / divisionOpenDocs.length)
      : 0;
    const engineerAvgOpenAgeDays = engineerOpenDocs.length
      ? Math.round(engineerOpenDocs.reduce((sum, doc) => sum + ageInDays(doc), 0) / engineerOpenDocs.length)
      : 0;

    const [engineerPerformance, divisionPerformance] = await Promise.all([
      buildPerformanceInsight('Engineer Performance', {
        totalCases: engineerTotal,
        completedCount: engineerCompleted,
        pendingCount: engineerPending,
        inProgressCount: engineerInProgress,
        escalatedCount: engineerEscalated,
        openCount: engineerOpenCount,
        avgOpenAgeDays: engineerAvgOpenAgeDays,
      }),
      buildPerformanceInsight('Division Performance', {
        totalCases: assigned,
        completedCount: completed,
        pendingCount: pending,
        inProgressCount: inProgress,
        escalatedCount: divisionEscalated,
        openCount: divisionOpenCount,
        avgOpenAgeDays: divisionAvgOpenAgeDays,
      }),
    ]);

    res.json({
      stats: { assigned, completed, pending, inProgress, completionRate },
      recentServices,
      performance: {
        engineer: engineerPerformance,
        division: divisionPerformance,
      },
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
