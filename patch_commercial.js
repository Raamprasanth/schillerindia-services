const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'backend', 'services', 'performanceReviewService.js');
let content = fs.readFileSync(filePath, 'utf8');

const newFunction = `

async function getCommercialPerformanceData({ month }) {
  const monthInfo = monthParts(month);
  
  const Service = require('../models/Service');
  const Todr = require('../models/Todr');
  const ScPrfOb = require('../models/ScPrfOb');
  const ScSr = require('../models/ScSr');

  const parseDateString = (d) => {
    if (!d) return null;
    if (d instanceof Date) return isNaN(d.getTime()) ? null : d;
    if (typeof d === 'string') {
      let parts = d.split('-');
      if (parts.length === 3) {
        if (parts[0].length === 4) return new Date(d); 
        if (parts[2].length === 4) return new Date(\`\${parts[2]}-\${parts[1]}-\${parts[0]}\`); 
      }
      return new Date(d);
    }
    return null;
  };

  const getDiff = (d1, d2) => {
    const date1 = parseDateString(d1);
    const date2 = parseDateString(d2);
    if (!date1 || !date2 || isNaN(date1.getTime()) || isNaN(date2.getTime())) return null;
    const utc1 = Date.UTC(date1.getFullYear(), date1.getMonth(), date1.getDate());
    const utc2 = Date.UTC(date2.getFullYear(), date2.getMonth(), date2.getDate());
    return (utc2 - utc1) / (1000 * 60 * 60 * 24);
  };

  const categorize = (diff) => {
    if (diff === null || isNaN(diff)) return null;
    if (diff < 1) return '< 1 day';
    if (diff >= 1 && diff <= 2) return '1 to 2 days';
    return '> 2 days';
  };

  // Ensure start and end cover the whole month
  const start = monthInfo.start;
  const end = monthInfo.end;

  const services = await Service.find({ createdAt: { $gte: start, $lt: end } }).lean();
  const todrs = await Todr.find({ createdAt: { $gte: start, $lt: end } }).lean();
  const scPrfObs = await ScPrfOb.find({ createdAt: { $gte: start, $lt: end } }).lean();
  const scSrs = await ScSr.find({ createdAt: { $gte: start, $lt: end } }).lean();

  const divisionsMap = {};
  const ensureDivision = (div) => {
    const d = (div || 'Unknown').trim();
    if (!divisionsMap[d]) {
      divisionsMap[d] = {
        FRN: { '< 1 day': 0, '1 to 2 days': 0, '> 2 days': 0, total: 0 },
        TO: { '< 1 day': 0, '1 to 2 days': 0, '> 2 days': 0, total: 0 },
        'TO/SO': { '< 1 day': 0, '1 to 2 days': 0, '> 2 days': 0, total: 0 },
        SR: { '< 1 day': 0, '1 to 2 days': 0, '> 2 days': 0, total: 0 }
      };
    }
    return divisionsMap[d];
  };

  for (const s of services) {
    const cat = categorize(getDiff(s.serComm, s.rcvdDate));
    if (cat) {
      const divData = ensureDivision(s.division);
      divData['FRN'][cat]++;
      divData['FRN'].total++;
    }
  }

  for (const t of todrs) {
    const cat = categorize(getDiff(t.toRaisedDate, t.sparesReceivedDate));
    if (cat) {
      // todr might not have a direct division, let's try to map if it's there
      // wait, Todr doesn't have division directly. I'll just group under "All" or if it has sourceModule.
      const divData = ensureDivision(t.division || t.sourceModule || 'All');
      divData['TO'][cat]++;
      divData['TO'].total++;
    }
  }

  for (const p of scPrfObs) {
    const cat = categorize(getDiff(p.entryDate, p.receivedDate));
    if (cat) {
      const divData = ensureDivision(p.division);
      divData['TO/SO'][cat]++;
      divData['TO/SO'].total++;
    }
  }

  for (const s of scSrs) {
    const cat = categorize(getDiff(s.toRaisedDate, s.sparesReceivedDate));
    if (cat) {
      const divData = ensureDivision(s.division);
      divData['SR'][cat]++;
      divData['SR'].total++;
    }
  }

  return divisionsMap;
}
`;

content = content.replace('module.exports = {', newFunction + '\nmodule.exports = {\n  getCommercialPerformanceData,');

fs.writeFileSync(filePath, content, 'utf8');
console.log('patched performanceReviewService.js');
