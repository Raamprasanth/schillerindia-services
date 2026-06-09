const express = require('express');
const router = express.Router();
const TrackerSubmission = require('../models/TrackerSubmission');
const User = require('../models/User');
const Division = require('../models/Division');
const { protect } = require('../middleware/authMiddleware');

// Get current month's submissions for the logged in employee's division
router.get('/me', protect, async (req, res) => {
  try {
    const { month } = req.query; // format: 'YYYY-MM'
    if (!month) return res.status(400).json({ success: false, message: 'Month is required' });

    const division = req.user.division || '';
    if (!division) {
      return res.json({ success: true, submissions: [] });
    }

    const submissions = await TrackerSubmission.find({ division, month })
      .populate('employee', 'name')
      .lean();

    const formattedSubmissions = submissions.map(sub => ({
      ...sub,
      submittedByName: sub.employee ? sub.employee.name : 'Unknown'
    }));

    res.json({ success: true, submissions: formattedSubmissions });
  } catch (error) {
    console.error('Error fetching tracker submissions:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Toggle a submission for a specific date
router.post('/submit', protect, async (req, res) => {
  try {
    const { type, reportDates, month, status } = req.body;
    if (!type || !reportDates || !Array.isArray(reportDates) || !month) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const division = req.user.division || '';
    if (!division) {
      return res.status(400).json({ success: false, message: 'You must be assigned to a division to submit reports.' });
    }

    if (status === 'submitted') {
      const bulkOps = reportDates.map(date => ({
        updateOne: {
          filter: { division, type, reportDate: date },
          update: { $setOnInsert: { employee: req.user._id, month } },
          upsert: true
        }
      }));
      if (bulkOps.length > 0) {
        await TrackerSubmission.bulkWrite(bulkOps);
      }
    } else {
      // Un-submit
      await TrackerSubmission.deleteMany({ division, type, reportDate: { $in: reportDates } });
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

function countDatesInMonth(year, month, dates) {
  const lastDay = new Date(year, month, 0).getDate();
  return dates.filter(day => day >= 1 && day <= lastDay).length;
}

function buildReportDefinitions(year, month) {
  return [
    {
      type: 'CRM',
      label: 'CRM Reports',
      schedule: 'Every Tuesday',
      expectedPerEmployee: countDaysInMonth(year, month, 2)
    },
    {
      type: 'PendingActivity',
      label: 'Pending Activity',
      schedule: 'Every Monday',
      expectedPerEmployee: countDaysInMonth(year, month, 1)
    },
    {
      type: 'NonSaleable',
      label: 'Non Saleable',
      schedule: '2 and 16',
      expectedPerEmployee: countDatesInMonth(year, month, [2, 16])
    },
    {
      type: 'SupplierWarranty',
      label: 'Supplier Warranty',
      schedule: '3 and 16',
      expectedPerEmployee: countDatesInMonth(year, month, [3, 16])
    },
    {
      type: 'CriticalPendingReport',
      label: 'Critical Pending Report',
      schedule: '2',
      expectedPerEmployee: countDatesInMonth(year, month, [2])
    },
    {
      type: 'PIRequest',
      label: 'PI Request',
      schedule: '5',
      expectedPerEmployee: countDatesInMonth(year, month, [5])
    }
  ];
}

// Get admin stats grouped by division
router.get('/stats', protect, async (req, res) => {
  try {
    const { month } = req.query; // format: 'YYYY-MM'
    if (!month) return res.status(400).json({ success: false, message: 'Month is required' });

    const [yearStr, monthStr] = month.split('-');
    const yearNum = parseInt(yearStr, 10);
    const monthNum = parseInt(monthStr, 10);

    const reportDefinitions = buildReportDefinitions(yearNum, monthNum);

    // Employees are now primarily in the Employee collection. We should fetch from Employee.
    const Employee = require('../models/Employee');
    const employees = await Employee.find({ role: 'employee' }).lean();
    
    const divisionsMap = {}; // division name -> { name, empCount }

    employees.forEach(emp => {
      const divName = (emp.division && emp.division.trim() !== '') ? emp.division : 'Unassigned';
      if (!divisionsMap[divName]) {
        divisionsMap[divName] = {
          id: divName,
          name: divName,
          empCount: 0,
          reports: reportDefinitions.reduce((acc, report) => {
            acc[report.type] = {
              type: report.type,
              label: report.label,
              schedule: report.schedule,
              expected: report.expectedPerEmployee, // Set once per division
              actual: 0
            };
            return acc;
          }, {})
        };
      }
      divisionsMap[divName].empCount++;
    });

    // Get all submissions for the month
    const TrackerSubmission = require('../models/TrackerSubmission');
    const submissions = await TrackerSubmission.find({ month }).lean();

    submissions.forEach(sub => {
      const divName = (sub.division && sub.division.trim() !== '') ? sub.division : 'Unassigned';
      const division = divisionsMap[divName];
      if (division && division.reports[sub.type]) {
        division.reports[sub.type].actual++;
      }
    });

    const results = Object.values(divisionsMap).map(div => {
      const reports = reportDefinitions.map(report => {
        const item = div.reports[report.type];
        const percent = item.expected > 0 ? Math.round((item.actual / item.expected) * 100) : 0;
        
        return {
          type: item.type,
          label: item.label,
          schedule: item.schedule,
          expected: item.expected,
          actual: item.actual,
          percent: Math.min(100, percent),
          complete: item.expected > 0 && item.actual >= item.expected,
          missingNames: [] // Not applicable at division level anymore
        };
      });
      const reportByType = reports.reduce((acc, report) => {
        acc[report.type] = report;
        return acc;
      }, {});
      
      return {
        id: div.id,
        name: div.name,
        empCount: div.empCount,
        expectedCRM: reportByType.CRM.expected,
        actualCRM: reportByType.CRM.actual,
        expectedPending: reportByType.PendingActivity.expected,
        actualPending: reportByType.PendingActivity.actual,
        crmPercent: reportByType.CRM.percent,
        pendingPercent: reportByType.PendingActivity.percent,
        reports
      };
    });

    res.json({ success: true, stats: results });
  } catch (error) {
    console.error('Error fetching tracker stats:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
