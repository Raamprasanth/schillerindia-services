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

// ── GET /api/dashboard/admin ────────────────────
router.get('/admin', protect, adminOnly, async (req, res) => {
  try {
    const [
      totalEngineers, activeEngineers,
      totalServices, activeServices, pendingServices, completedServices, escalatedServices,
      totalDealers, activeDealers,
      totalDivisions,
      recentServices,
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
    ]);

    // Last 7 days service counts
    const weeklyData = [];
    for (let i = 6; i >= 0; i--) {
      const from = new Date(); from.setDate(from.getDate() - i); from.setHours(0, 0, 0, 0);
      const to   = new Date(from); to.setHours(23, 59, 59, 999);
      const count = await Service.countDocuments({ createdAt: { $gte: from, $lte: to } });
      const externalCount = await SCCompletedFRN.countDocuments({ typeWork: { $regex: /external/i }, createdAt: { $gte: from, $lte: to } });
      const supplierCount = await SCCompletedFRN.countDocuments({ typeWork: { $regex: /supplier/i }, createdAt: { $gte: from, $lte: to } });
      const completedFrnCount = await CompletedFRN.countDocuments({ createdAt: { $gte: from, $lte: to } });
      weeklyData.push({ date: from.toLocaleDateString('en-IN', { weekday: 'short' }), count, externalCount, supplierCount, completedFrnCount });
    }

    res.json({
      stats: {
        totalEngineers, activeEngineers,
        totalServices, activeServices, pendingServices, completedServices, escalatedServices,
        totalDealers, activeDealers, totalDivisions,
      },
      recentServices,
      weeklyData,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
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
