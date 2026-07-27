const fs = require('fs');

// Patch performanceReviewService.js
let prs = fs.readFileSync('backend/services/performanceReviewService.js', 'utf8');
prs = prs.replace(/Re-Export \( SVC Ship Date - Comm DC Date \)/g, 'Re-Export (Ship Date-DC Date)');
fs.writeFileSync('backend/services/performanceReviewService.js', prs);

// Patch Reports.html
let html = fs.readFileSync('frontend/public/Reports.html', 'utf8');
html = html.replace(/Re-Export \( SVC Ship Date - Comm DC Date \)/g, 'Re-Export (Ship Date-DC Date)');

// Add to metricKeys
const oldMetricKeys = `const metricKeys = [
          'FRN ( Inward - SVC )', 
          'TO ( Raised - Received )', 
          'TO/SO ( Entry - Received )', 
          'SR ( Raised - Received )',
          'DR ( Requested - Received )',
          'Field TO/SO ( ER Raised - Entry )'
        ];`;
const newMetricKeys = `const metricKeys = [
          'FRN ( Inward - SVC )', 
          'TO ( Raised - Received )', 
          'TO/SO ( Entry - Received )', 
          'SR ( Raised - Received )',
          'DR ( Requested - Received )',
          'Field TO/SO ( ER Raised - Entry )',
          'Re-Export (Ship Date-DC Date)'
        ];`;
html = html.replace(oldMetricKeys, newMetricKeys);
fs.writeFileSync('frontend/public/Reports.html', html);

console.log('Renamed Re-Export metric.');
