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
    const { type, reportDates, month, status } = req.body;
    if (!type || !reportDates || !Array.isArray(reportDates) || !month) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    if (status === 'submitted') {
      const division = req.user.division || '';
      
      const bulkOps = reportDates.map(date => ({
        updateOne: {
          filter: { employee: req.user._id, type, reportDate: date },
          update: { $set: { month, division: division } },
          upsert: true
        }
      }));
      if (bulkOps.length > 0) {
        await TrackerSubmission.bulkWrite(bulkOps);
      }
    } else {
      // Un-submit
      await TrackerSubmission.deleteMany({ employee: req.user._id, type, reportDate: { $in: reportDates } });
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
      // division is a string now, e.g. "VENTILATOR"
      const divName = (emp.division && emp.division.trim() !== '') ? emp.division : 'Unassigned';
      if (!divisionsMap[divName]) {
        divisionsMap[divName] = {
          id: divName,
          name: divName,
          empCount: 0,
          employees: [], // Keep track of employees to calculate missing
          reports: reportDefinitions.reduce((acc, report) => {
            acc[report.type] = {
              type: report.type,
              label: report.label,
              schedule: report.schedule,
              expected: 0,
              actual: 0,
              employeeActuals: {} // Map employeeId -> actual submissions
            };
            return acc;
          }, {})
        };
      }
      divisionsMap[divName].empCount++;
      divisionsMap[divName].employees.push({ id: emp._id.toString(), name: emp.name });
      reportDefinitions.forEach(report => {
        divisionsMap[divName].reports[report.type].expected += report.expectedPerEmployee;
      });
    });

    // Get all submissions for the month
    const TrackerSubmission = require('../models/TrackerSubmission');
    const submissions = await TrackerSubmission.find({ month }).lean();

    submissions.forEach(sub => {
      // sub.division is a string
      const divName = (sub.division && sub.division.trim() !== '') ? sub.division : 'Unassigned';
      const division = divisionsMap[divName];
      if (division && division.reports[sub.type]) {
        division.reports[sub.type].actual++;
        const empIdStr = sub.employee ? sub.employee.toString() : null;
        if (empIdStr) {
          division.reports[sub.type].employeeActuals[empIdStr] = (division.reports[sub.type].employeeActuals[empIdStr] || 0) + 1;
        }
      }
    });

    const results = Object.values(divisionsMap).map(div => {
      const reports = reportDefinitions.map(report => {
        const item = div.reports[report.type];
        const percent = item.expected > 0 ? Math.round((item.actual / item.expected) * 100) : 0;
        
        // Calculate missing employees for this report
        const missingNames = [];
        const requiredCount = report.expectedPerEmployee;
        if (requiredCount > 0) {
          div.employees.forEach(emp => {
            const actualForEmp = item.employeeActuals[emp.id] || 0;
            if (actualForEmp < requiredCount) {
              missingNames.push(emp.name);
            }
          });
        }
        
        return {
          type: item.type,
          label: item.label,
          schedule: item.schedule,
          expected: item.expected,
          actual: item.actual,
          percent: Math.min(100, percent),
          complete: item.expected > 0 && item.actual >= item.expected,
          missingNames
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
