const fs = require('fs');
const file = 'backend/services/performanceReviewService.js';
let code = fs.readFileSync(file, 'utf8');

const newFunction = `
async function getAllEmployeesPerformanceData({ monthInfo }) {
  const workingDayKeys = getNonSundayDates(monthInfo);
  const workingDaySet = new Set(workingDayKeys);
  const workingDays = workingDayKeys.length;
  const monthStartKey = monthInfo.monthKey + '-01';
  const monthEndDate = new Date(monthInfo.year, monthInfo.month, 0);
  const monthEndKey = localDateKey(monthEndDate);

  const User = require('../models/User');
  const Employee = require('../models/Employee');
  const Ecall = require('../models/Ecall');
  const Eclose = require('../models/Eclose');
  const EmpDailyWork = require('../models/EmpDailyWork');
  const TrackerSubmission = require('../models/TrackerSubmission');

  const employees = await Employee.find({ isActive: { $ne: false } }).select('_id name email employeeId').lean();

  const monthDateFilter = {
    $or: [
      { callDate: { $gte: monthStartKey, $lte: monthEndKey } },
      { entryDate: { $gte: monthStartKey, $lte: monthEndKey } },
      { closeDate: { $gte: monthStartKey, $lte: monthEndKey } },
      { createdAt: { $gte: monthInfo.start, $lt: monthInfo.end } },
    ],
  };

  const [openCallDocs, closedCallDocs, dailyWorkDocs, openCallReviews] = await Promise.all([
    Ecall.find(monthDateFilter).lean(),
    Eclose.find(monthDateFilter).lean(),
    EmpDailyWork.find({
      $or: [
        { date: { $gte: monthStartKey, $lte: monthEndKey } },
        { createdAt: { $gte: monthInfo.start, $lt: monthInfo.end } },
      ],
    }).lean(),
    TrackerSubmission.find({ month: monthInfo.monthKey, type: 'OpenCallReview' }).lean(),
  ]);

  const allCalls = [...openCallDocs, ...closedCallDocs];
  const results = [];
  
  for (const emp of employees) {
    const userIds = [String(emp._id)];
    
    const callDays = new Set();
    for (const doc of allCalls) {
      if (recordMatchesEmployeeEntry(doc, emp.name, userIds)) {
        const key = dayKeyInMonth(doc.callDate || doc.entryDate || doc.closeDate || doc.createdAt, monthInfo);
        if (workingDaySet.has(key)) callDays.add(key);
      }
    }

    const workDays = new Set();
    for (const doc of dailyWorkDocs) {
      if (recordMatchesEmployeeEntry(doc, emp.name, userIds)) {
        const key = dayKeyInMonth(doc.date || doc.createdAt, monthInfo);
        if (workingDaySet.has(key)) workDays.add(key);
      }
    }

    const reviewDays = new Set();
    for (const doc of openCallReviews) {
      if (String(doc.employee) === String(emp._id) || (doc.employeeName && String(doc.employeeName).toLowerCase() === String(emp.name).toLowerCase())) {
        if (workingDaySet.has(doc.reportDate)) reviewDays.add(doc.reportDate);
      }
    }
    
    const callScore = callDays.size;
    const workScore = workDays.size;
    const reviewScore = reviewDays.size;
    
    const totalTracked = workingDays * 3;
    const completedCount = callScore + workScore + reviewScore;
    const completionRate = totalTracked > 0 ? Math.round((completedCount / totalTracked) * 100) : 0;
    
    let remark = 'Needs Improvement';
    if (completionRate >= 90) remark = 'Excellent';
    else if (completionRate >= 75) remark = 'Good';
    else if (completionRate >= 60) remark = 'Average';
    
    results.push({
      employee: emp.name,
      workingDays,
      callScore,
      workScore,
      reviewScore,
      completionRate,
      remark
    });
  }
  
  return {
    month: monthInfo.label,
    workingDays,
    employees: results
  };
}
`;

// Inject new function before getPerformanceReviewData
code = code.replace('async function getPerformanceReviewData', newFunction + '\nasync function getPerformanceReviewData');

// Replace getSimpleEmployeePerformanceData call with getAllEmployeesPerformanceData
code = code.replace(
  `    if (scope === 'employee') {
      return getSimpleEmployeePerformanceData({
        monthInfo,
        employee: selectedEmployee?.name || employee,
        selectedDivision,
      });
    }`,
  `    if (scope === 'employee') {
      return getAllEmployeesPerformanceData({ monthInfo });
    }`
);

fs.writeFileSync(file, code);
console.log('Backend logic updated for Individual Analysis');
