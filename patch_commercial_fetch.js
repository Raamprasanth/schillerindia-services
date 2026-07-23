const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'backend', 'services', 'performanceReviewService.js');
let content = fs.readFileSync(file, 'utf8');

const targetOld = `  const services = await Service.find({ createdAt: { $gte: start, $lt: end } }).lean();
  const todrs = await Todr.find({ createdAt: { $gte: start, $lt: end } }).lean();
  const scPrfObs = await ScPrfOb.find({ createdAt: { $gte: start, $lt: end } }).lean();
  const scSrs = await ScSr.find({ createdAt: { $gte: start, $lt: end } }).lean();`;

const replacementNew = `  const isDateInRange = (date, s, e) => {
    if (!date || isNaN(date.getTime())) return false;
    return date.getTime() >= s.getTime() && date.getTime() < e.getTime();
  };

  const allServices = await Service.find().lean();
  const services = allServices.filter(s => isDateInRange(parseAnyDate(s.entryDate, s.createdAt), start, end));
  
  const allTodrs = await Todr.find().lean();
  const todrs = allTodrs.filter(t => isDateInRange(parseAnyDate(t.entryDate, t.createdAt), start, end));
  
  const allScPrfObs = await ScPrfOb.find().lean();
  const scPrfObs = allScPrfObs.filter(p => isDateInRange(parseAnyDate(p.entryDate, p.createdAt), start, end));
  
  const allScSrs = await ScSr.find().lean();
  const scSrs = allScSrs.filter(s => isDateInRange(parseAnyDate(s.date, s.createdAt), start, end));`;

if (content.includes('const services = await Service.find({ createdAt: { $gte: start, $lt: end } }).lean();')) {
  content = content.replace(targetOld, replacementNew);
  fs.writeFileSync(file, content, 'utf8');
  console.log('Successfully patched fetching logic.');
} else {
  console.log('Error: Could not find target fetching logic in performanceReviewService.js');
}
