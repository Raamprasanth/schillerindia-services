const fs = require('fs');

let servicePath = 'backend/services/performanceReviewService.js';
let serviceContent = fs.readFileSync(servicePath, 'utf8');

// 1. getNonSundayDates
serviceContent = serviceContent.replace(
  /function getNonSundayDates\(monthInfo\) \{\s*const days = \[\];\s*const date = new Date\(monthInfo\.year, monthInfo\.month - 1, 1\);\s*while \(date\.getMonth\(\) === monthInfo\.month - 1\) \{\s*if \(date\.getDay\(\) !== 0\) days\.push\(localDateKey\(date\)\);\s*date\.setDate\(date\.getDate\(\) \+ 1\);\s*\}\s*return days;\s*\}/,
  `function getNonSundayDates(monthInfo) {
  const days = [];
  const date = new Date(monthInfo.year, monthInfo.month - 1, 1);
  let saturdayCount = 0;
  while (date.getMonth() === monthInfo.month - 1) {
    if (date.getDay() === 6) saturdayCount++;
    const isThirdSaturday = (date.getDay() === 6 && saturdayCount === 3);
    
    if (date.getDay() !== 0 && !isThirdSaturday) days.push(localDateKey(date));
    date.setDate(date.getDate() + 1);
  }
  return days;
}`
);

// 2. dayKeyInMonth
serviceContent = serviceContent.replace(
  /if \(local\.getDay\(\) === 0\) return '';\s*return localDateKey\(local\);/,
  `if (local.getDay() === 0) return '';
  // Check if it's the third saturday
  if (local.getDay() === 6) {
    const day = local.getDate();
    // 1st saturday: 1-7, 2nd: 8-14, 3rd: 15-21
    if (day >= 15 && day <= 21) return '';
  }
  return localDateKey(local);`
);

// 3. getPerformanceReviewData (Employee scope)
// Need to add openCallReviewDays logic.
// Find:
// const dailyWorkDays = new Set();
// ...
// const currentActivityRows = [
//   makeActivityRow('Call entries updated', workingDays, callEntryDays.size, null, null),
//   makeActivityRow('Daily work updated', workingDays, dailyWorkDays.size, null, null),
// ];

// Inject openCallReviewDays fetching logic right before currentActivityRows
const searchStr = `  const currentActivityRows = [
    makeActivityRow('Call entries updated', workingDays, callEntryDays.size, null, null),
    makeActivityRow('Daily work updated', workingDays, dailyWorkDays.size, null, null),
  ];`;

const replaceStr = `  // Fetch TrackerSubmissions for OpenCallReview
  const openCallReviewDocs = await TrackerSubmission.find({ 
    employee: { $in: userIds }, 
    type: 'OpenCallReview', 
    month: monthInfo.monthKey 
  }).lean();
  const openCallReviewDays = new Set();
  for (const doc of openCallReviewDocs) {
    const key = dayKeyInMonth(doc.reportDate || doc.createdAt, monthInfo);
    if (workingDaySet.has(key)) openCallReviewDays.add(key);
  }

  const previousOpenCallReviewDocs = await TrackerSubmission.find({ 
    employee: { $in: userIds }, 
    type: 'OpenCallReview', 
    month: previousMonthInfo.monthKey 
  }).lean();
  const previousOpenCallReviewDays = new Set();
  for (const doc of previousOpenCallReviewDocs) {
    const key = dayKeyInMonth(doc.reportDate || doc.createdAt, previousMonthInfo);
    if (previousWorkingDaySet.has(key)) previousOpenCallReviewDays.add(key);
  }

  const currentActivityRows = [
    makeActivityRow('Call entries updated', workingDays, callEntryDays.size, null, null),
    makeActivityRow('Daily work updated', workingDays, dailyWorkDays.size, null, null),
    makeActivityRow('Open call review', workingDays, openCallReviewDays.size, null, null),
  ];
  currentActivityRows[2].prevRate = rate(previousOpenCallReviewDays.size, previousWorkingDayKeys.length);
  currentActivityRows[2].nextRate = targetNext(currentActivityRows[2].prevRate);`;

serviceContent = serviceContent.replace(searchStr, replaceStr);

fs.writeFileSync(servicePath, serviceContent);
console.log('Done');
