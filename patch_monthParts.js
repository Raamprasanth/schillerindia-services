const fs = require('fs');

const FILE_PATH = 'backend/services/performanceReviewService.js';
let content = fs.readFileSync(FILE_PATH, 'utf8');

const oldMonthParts = `function monthParts(month) {
  const match = String(month || '').match(/^(\\d{4})-(\\d{2})$/);
  if (!match) throw new Error('Month must be in YYYY-MM format.');
  const year = Number(match[1]);
  const monthIndex = Number(match[2]);
  const start = new Date(Date.UTC(year, monthIndex - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
  const shortMonth = start.toLocaleString('en-IN', { month: 'short', timeZone: 'UTC' });
  const longMonth = start.toLocaleString('en-IN', { month: 'long', timeZone: 'UTC' });
  return {
    year,
    month: monthIndex,
    start,
    end,
    monthKey: \`\${year}-\${String(monthIndex).padStart(2, '0')}\`,
    shortMonth,
    longMonth,
    label: \`\${shortMonth} \${year}\`,
  };
}`;

const newMonthParts = `function monthParts(month) {
  const str = String(month || '').trim();
  const matchMonth = str.match(/^(\\d{4})-(\\d{2})$/);
  const matchQuarter = str.match(/^(\\d{4})-Q([1-4])$/);
  const matchHalf = str.match(/^(\\d{4})-H([1-2])$/);
  const matchAnnual = str.match(/^(\\d{4})-A$/);

  let year, start, end, shortMonth, longMonth, label, periodKey;

  if (matchMonth) {
    year = Number(matchMonth[1]);
    const monthIndex = Number(matchMonth[2]);
    start = new Date(Date.UTC(year, monthIndex - 1, 1, 0, 0, 0, 0));
    end = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
    shortMonth = start.toLocaleString('en-IN', { month: 'short', timeZone: 'UTC' });
    longMonth = start.toLocaleString('en-IN', { month: 'long', timeZone: 'UTC' });
    label = \`\${shortMonth} \${year}\`;
    periodKey = \`\${year}-\${String(monthIndex).padStart(2, '0')}\`;
    return {
      year, month: monthIndex, start, end, monthKey: periodKey, shortMonth, longMonth, label
    };
  } else if (matchQuarter) {
    year = Number(matchQuarter[1]);
    const q = Number(matchQuarter[2]);
    start = new Date(Date.UTC(year, (q - 1) * 3, 1, 0, 0, 0, 0));
    end = new Date(Date.UTC(year, q * 3, 1, 0, 0, 0, 0));
    label = \`Q\${q} \${year}\`;
    periodKey = \`\${year}-Q\${q}\`;
    shortMonth = \`Q\${q}\`;
    longMonth = \`Quarter \${q}\`;
  } else if (matchHalf) {
    year = Number(matchHalf[1]);
    const h = Number(matchHalf[2]);
    start = new Date(Date.UTC(year, (h - 1) * 6, 1, 0, 0, 0, 0));
    end = new Date(Date.UTC(year, h * 6, 1, 0, 0, 0, 0));
    label = \`H\${h} \${year}\`;
    periodKey = \`\${year}-H\${h}\`;
    shortMonth = \`H\${h}\`;
    longMonth = \`Half \${h}\`;
  } else if (matchAnnual) {
    year = Number(matchAnnual[1]);
    start = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
    end = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0, 0));
    label = \`Year \${year}\`;
    periodKey = \`\${year}-A\`;
    shortMonth = \`\${year}\`;
    longMonth = \`\${year}\`;
  } else {
    throw new Error('Month must be in YYYY-MM, YYYY-Qx, YYYY-Hx, or YYYY-A format.');
  }

  return {
    year,
    month: matchMonth ? Number(matchMonth[2]) : null,
    start,
    end,
    monthKey: periodKey,
    shortMonth,
    longMonth,
    label
  };
}`;

content = content.replace(oldMonthParts, newMonthParts);
fs.writeFileSync(FILE_PATH, content);
console.log('Successfully patched backend date parsing logic.');
