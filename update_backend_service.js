const fs = require('fs');
const file = 'backend/services/performanceReviewService.js';
let code = fs.readFileSync(file, 'utf8');

const newFunction = `
async function getProductTeamPerformanceData({ month }) {
  const monthInfo = monthParts(month);
  const start = monthInfo.start;
  const end = monthInfo.end;
  
  const User = require('../models/User');
  const PtCall = require('../models/PtCall');
  const PtDailyWork = require('../models/PtDailyWork');
  const Bir = require('../models/Bir');
  const PtClosedBir = require('../models/PtClosedBir');
  const Division = require('../models/Division');
  
  const getDiff = (d1, d2) => {
    const date1 = parseAnyDate(d1);
    const date2 = parseAnyDate(d2);
    if (!date1 || !date2 || isNaN(date1.getTime()) || isNaN(date2.getTime())) return null;
    const utc1 = Date.UTC(date1.getFullYear(), date1.getMonth(), date1.getDate());
    const utc2 = Date.UTC(date2.getFullYear(), date2.getMonth(), date2.getDate());
    return (utc2 - utc1) / (1000 * 60 * 60 * 24);
  };
  
  const escapeRegExp = (s) => s.replace(/[.*+?^$\{()|[\\]\\\\]/g, '\\\\$&');
  
  const workingDayKeys = getNonSundayDates(monthInfo);
  const workingDaySet = new Set(workingDayKeys);
  const workingDays = workingDayKeys.length;
  
  // 1. Fetch Product Team Members
  const ptUsers = await User.find({ role: 'pt' }).lean();
  
  // 2. PT Employee Performance
  const employeesData = [];
  
  // Cache all docs for the month to avoid N+1 queries
  const ptCalls = await PtCall.find({
    $or: [
      { callDate: { $regex: monthInfo.monthKey } },
      { entryDate: { $regex: monthInfo.monthKey } }
    ]
  }).lean();
  
  const ptDailyWorks = await PtDailyWork.find({
    date: { $regex: monthInfo.monthKey }
  }).lean();
  
  for (const user of ptUsers) {
    const empRegex = new RegExp('^' + escapeRegExp(user.name) + '$', 'i');
    
    // PT Calls
    const callDays = new Set();
    for (const doc of ptCalls) {
      if (empRegex.test(doc.engineer)) {
        const key = dayKeyInMonth(doc.callDate || doc.entryDate, monthInfo);
        if (workingDaySet.has(key)) callDays.add(key);
      }
    }
    
    // PT Daily Work
    const workDays = new Set();
    for (const doc of ptDailyWorks) {
      if (empRegex.test(doc.addedBy) || empRegex.test(doc.team)) {
        const key = dayKeyInMonth(doc.date, monthInfo);
        if (workingDaySet.has(key)) workDays.add(key);
      }
    }
    
    const callScore = callDays.size;
    const workScore = workDays.size;
    const totalTracked = workingDays * 2;
    const completedCount = callScore + workScore;
    const completionRate = Math.round((completedCount / totalTracked) * 100);
    let remark = 'Needs Improvement';
    if (completionRate >= 90) remark = 'Excellent';
    else if (completionRate >= 75) remark = 'Good';
    else if (completionRate >= 60) remark = 'Average';
    
    employeesData.push({
      employee: user.name,
      workingDays,
      callScore,
      workScore,
      completionRate,
      remark
    });
  }
  
  // 3. BIR List Tracker
  const divisions = await Division.find().sort({ name: 1 }).lean();
  const birData = [];
  
  const fbirs = await Bir.find({ createdAt: { $gte: start, $lt: end } }).lean();
  const ptcbirs = await PtClosedBir.find({
    birRef: { $in: fbirs.map(b => b.birRef).filter(Boolean) }
  }).lean();
  
  for (const div of divisions) {
    const divFbirs = fbirs.filter(b => (b.division || '').toLowerCase() === div.name.toLowerCase());
    if (divFbirs.length === 0) continue;
    
    let withinTargetCount = 0;
    
    for (const fbir of divFbirs) {
      if (!fbir.birRef) continue;
      const ptcbir = ptcbirs.find(p => p.birRef === fbir.birRef);
      if (ptcbir) {
        const diff = getDiff(fbir.createdAt, ptcbir.createdAt);
        if (diff !== null && diff <= 7) {
          withinTargetCount++;
        }
      }
    }
    
    const total = divFbirs.length;
    const rate = Math.round((withinTargetCount / total) * 100);
    let remark = 'Needs Improvement';
    if (rate >= 90) remark = 'Excellent';
    else if (rate >= 75) remark = 'Good';
    else if (rate >= 60) remark = 'Average';
    
    birData.push({
      division: div.name,
      total,
      completed: withinTargetCount,
      rate,
      remark
    });
  }
  
  return {
    month: monthInfo.label,
    workingDays,
    employees: employeesData,
    birData
  };
}
`;

if (!code.includes('getProductTeamPerformanceData')) {
  code = code.replace(
    'module.exports = {',
    newFunction + '\nmodule.exports = {\n  getProductTeamPerformanceData,'
  );
  fs.writeFileSync(file, code);
  console.log('Added getProductTeamPerformanceData to performanceReviewService.js');
} else {
  console.log('getProductTeamPerformanceData already exists.');
}
