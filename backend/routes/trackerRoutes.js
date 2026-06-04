const express = require('express');
const router = express.Router();
const TrackerSubmission = require('../models/TrackerSubmission');
const User = require('../models/User');
const Division = require('../models/Division');
const { protect } = require('../middleware/authMiddleware');

// Get current month's submissions for the logged in employee
router.get('/me', protect, async (req, res) => {
  try {
    const { month } = req.query; // format: 'YYYY-MM'
    if (!month) return res.status(400).json({ success: false, message: 'Month is required' });

    const submissions = await TrackerSubmission.find({ employee: req.user._id, month }).lean();
    res.json({ success: true, submissions });
  } catch (error) {
    console.error('Error fetching tracker submissions:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Toggle a submission for a specific date
router.post('/submit', protect, async (req, res) => {
  try {
    const { type, reportDate, month, status } = req.body;
    if (!type || !reportDate || !month) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    if (status === 'submitted') {
      // Find employee's division
      const user = await User.findById(req.user._id).lean();
      
      await TrackerSubmission.findOneAndUpdate(
        { employee: req.user._id, type, reportDate },
        { 
          $set: { 
            month, 
            division: user.division 
          } 
        },
        { upsert: true, new: true }
      );
    } else {
      // Un-submit
      await TrackerSubmission.findOneAndDelete({ employee: req.user._id, type, reportDate });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error submitting tracker:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Helper to count days in a month
function countDaysInMonth(year, month, dayOfWeek) {
  let d = new Date(year, month - 1, 1);
  let count = 0;
  while (d.getMonth() === month - 1) {
    if (d.getDay() === dayOfWeek) {
      count++;
    }
    d.setDate(d.getDate() + 1);
  }
  return count;
}

// Get admin stats grouped by division
router.get('/stats', protect, async (req, res) => {
  try {
    const { month } = req.query; // format: 'YYYY-MM'
    if (!month) return res.status(400).json({ success: false, message: 'Month is required' });

    const [yearStr, monthStr] = month.split('-');
    const yearNum = parseInt(yearStr, 10);
    const monthNum = parseInt(monthStr, 10);

    const totalMondays = countDaysInMonth(yearNum, monthNum, 1); // 1 = Monday
    const totalTuesdays = countDaysInMonth(yearNum, monthNum, 2); // 2 = Tuesday

    // Get all employees and group them by division
    const employees = await User.find({ role: 'employee' }).populate('division').lean();
    
    const divisionsMap = {}; // divisionId -> { name, empCount }
    const noDivEmps = []; // employees without division

    employees.forEach(emp => {
      const divId = emp.division ? emp.division._id.toString() : 'unassigned';
      if (!divisionsMap[divId]) {
        divisionsMap[divId] = {
          id: divId,
          name: emp.division ? emp.division.name : 'Unassigned',
          empCount: 0,
          expectedCRM: 0,
          expectedPending: 0,
          actualCRM: 0,
          actualPending: 0
        };
      }
      divisionsMap[divId].empCount++;
      divisionsMap[divId].expectedCRM += totalTuesdays;
      divisionsMap[divId].expectedPending += totalMondays;
    });

    // Get all submissions for the month
    const submissions = await TrackerSubmission.find({ month }).lean();

    submissions.forEach(sub => {
      const divId = sub.division ? sub.division.toString() : 'unassigned';
      if (divisionsMap[divId]) {
        if (sub.type === 'CRM') divisionsMap[divId].actualCRM++;
        if (sub.type === 'PendingActivity') divisionsMap[divId].actualPending++;
      }
    });

    const results = Object.values(divisionsMap).map(div => {
      const crmPercent = div.expectedCRM > 0 ? Math.round((div.actualCRM / div.expectedCRM) * 100) : 0;
      const pendingPercent = div.expectedPending > 0 ? Math.round((div.actualPending / div.expectedPending) * 100) : 0;
      
      return {
        id: div.id,
        name: div.name,
        empCount: div.empCount,
        crmPercent: Math.min(100, crmPercent),
        pendingPercent: Math.min(100, pendingPercent)
      };
    });

    res.json({ success: true, stats: results });
  } catch (error) {
    console.error('Error fetching tracker stats:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
