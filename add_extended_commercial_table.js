const fs = require('fs');

// PATCH backend/services/performanceReviewService.js
let prs = fs.readFileSync('backend/services/performanceReviewService.js', 'utf8');

const categorizeOld = `const categorize = (diff) => {
    if (diff === null || isNaN(diff)) return null;
    if (diff < 1) return '< 1 day';
    if (diff <= 2) return '1 to 2 days';
    return '> 2 days';
  };`;
const categorizeNew = `const categorize = (diff) => {
    if (diff === null || isNaN(diff)) return null;
    if (diff < 1) return '< 1 day';
    if (diff <= 2) return '1 to 2 days';
    return '> 2 days';
  };

  const categorize15_30 = (diff) => {
    if (diff === null || isNaN(diff)) return null;
    if (diff < 15) return '< 15 days';
    if (diff <= 30) return '15 to 30 days';
    return '> 30 days';
  };`;
prs = prs.replace(categorizeOld, categorizeNew);

const ensureDivOld = `'Re-Export (Ship Date-DC Date)': { '< 1 day': 0, '1 to 2 days': 0, '> 2 days': 0, total: 0 }
      };`;
const ensureDivNew = `'Re-Export (Ship Date-DC Date)': { '< 1 day': 0, '1 to 2 days': 0, '> 2 days': 0, total: 0 },
        'Re-Export ( DC Date - AWB Date )': { '< 15 days': 0, '15 to 30 days': 0, '> 30 days': 0, total: 0 }
      };`;
prs = prs.replace(ensureDivOld, ensureDivNew);

const scrapLoopOld = `for (const s of scraps) {
    const diff = getDiff(s.dcInvoiceDate, s.shipDateFromSc);
    const cat = categorize(diff);
    if (cat) {
      const divName = s.division || 'Unknown';
      const divData = ensureDivision(divName);
      divData['Re-Export (Ship Date-DC Date)'][cat]++;
      divData['Re-Export (Ship Date-DC Date)'].total++;
    }
  }`;
const scrapLoopNew = `for (const s of scraps) {
    const diff = getDiff(s.dcInvoiceDate, s.shipDateFromSc);
    const cat = categorize(diff);
    if (cat) {
      const divName = s.division || 'Unknown';
      const divData = ensureDivision(divName);
      divData['Re-Export (Ship Date-DC Date)'][cat]++;
      divData['Re-Export (Ship Date-DC Date)'].total++;
    }

    const diff2 = getDiff(s.dcInvoiceDate, s.awbDate);
    const cat2 = categorize15_30(diff2);
    if (cat2) {
      const divName = s.division || 'Unknown';
      const divData = ensureDivision(divName);
      divData['Re-Export ( DC Date - AWB Date )'][cat2]++;
      divData['Re-Export ( DC Date - AWB Date )'].total++;
    }
  }`;
prs = prs.replace(scrapLoopOld, scrapLoopNew);
fs.writeFileSync('backend/services/performanceReviewService.js', prs);


// PATCH frontend/public/Reports.html
let html = fs.readFileSync('frontend/public/Reports.html', 'utf8');

const allDivsOld = `const metricKeys = [
          'FRN ( Inward - SVC )', 
          'TO ( Raised - Received )', 
          'TO/SO ( Entry - Received )', 
          'SR ( Raised - Received )',
          'DR ( Requested - Received )',
          'Field TO/SO ( ER Raised - Entry )',
          'Re-Export (Ship Date-DC Date)'
        ];
        for (const m of metricKeys) {
          allDivData[m] = { '< 1 day': 0, '1 to 2 days': 0, '> 2 days': 0, total: 0 };
        }
        for (const div in d.data) {
          if (div === 'ALL DIVISIONS') continue;
          for (const m of metricKeys) {
            if (d.data[div][m]) {
              allDivData[m]['< 1 day'] += d.data[div][m]['< 1 day'] || 0;
              allDivData[m]['1 to 2 days'] += d.data[div][m]['1 to 2 days'] || 0;
              allDivData[m]['> 2 days'] += d.data[div][m]['> 2 days'] || 0;
              allDivData[m].total += d.data[div][m].total || 0;
            }
          }
        }`;
const allDivsNew = `const metricKeys = [
          'FRN ( Inward - SVC )', 
          'TO ( Raised - Received )', 
          'TO/SO ( Entry - Received )', 
          'SR ( Raised - Received )',
          'DR ( Requested - Received )',
          'Field TO/SO ( ER Raised - Entry )',
          'Re-Export (Ship Date-DC Date)'
        ];
        const metricKeysExt = ['Re-Export ( DC Date - AWB Date )'];
        
        for (const m of metricKeys) {
          allDivData[m] = { '< 1 day': 0, '1 to 2 days': 0, '> 2 days': 0, total: 0 };
        }
        for (const m of metricKeysExt) {
          allDivData[m] = { '< 15 days': 0, '15 to 30 days': 0, '> 30 days': 0, total: 0 };
        }
        
        for (const div in d.data) {
          if (div === 'ALL DIVISIONS') continue;
          for (const m of metricKeys) {
            if (d.data[div][m]) {
              allDivData[m]['< 1 day'] += d.data[div][m]['< 1 day'] || 0;
              allDivData[m]['1 to 2 days'] += d.data[div][m]['1 to 2 days'] || 0;
              allDivData[m]['> 2 days'] += d.data[div][m]['> 2 days'] || 0;
              allDivData[m].total += d.data[div][m].total || 0;
            }
          }
          for (const m of metricKeysExt) {
            if (d.data[div][m]) {
              allDivData[m]['< 15 days'] += d.data[div][m]['< 15 days'] || 0;
              allDivData[m]['15 to 30 days'] += d.data[div][m]['15 to 30 days'] || 0;
              allDivData[m]['> 30 days'] += d.data[div][m]['> 30 days'] || 0;
              allDivData[m].total += d.data[div][m].total || 0;
            }
          }
        }`;
html = html.replace(allDivsOld, allDivsNew);

const renderOld = `      }
      reportHtml += \`</tbody></table></div>\`;
    }`;
const renderNew = `      }
      reportHtml += \`</tbody></table>\`;
      
      reportHtml += \`<h4 style="margin:20px 0 10px 0; font-size:14px; color:#334155;">Extended Durations</h4>
        <table style="width:100%; border-collapse:collapse; border:1px solid #cbd5e1; font-family:'Inter',sans-serif; font-size:13px;">
          <thead>
            <tr>
              <th style="background:#f1f5f9; border:1px solid #cbd5e1; padding:10px; text-align:left;">Report Type</th>
              <th style="background:#f1f5f9; border:1px solid #cbd5e1; padding:10px; text-align:center;">&lt; 15 days</th>
              <th style="background:#f1f5f9; border:1px solid #cbd5e1; padding:10px; text-align:center;">15 to 30 days</th>
              <th style="background:#f1f5f9; border:1px solid #cbd5e1; padding:10px; text-align:center;">&gt; 30 days</th>
              <th style="background:#f1f5f9; border:1px solid #cbd5e1; padding:10px; text-align:center; color:#0f172a;">Total</th>
            </tr>
          </thead>
          <tbody>\`;

      for (const m of ['Re-Export ( DC Date - AWB Date )']) {
        const val = metrics[m];
        if (!val) continue;
        const t = val.total || 0;
        const p1 = t > 0 ? Math.round((val['< 15 days']/t)*100) : 0;
        const p2 = t > 0 ? Math.round((val['15 to 30 days']/t)*100) : 0;
        const p3 = t > 0 ? Math.round((val['> 30 days']/t)*100) : 0;
        
        reportHtml += \`
            <tr>
              <td style="border:1px solid #cbd5e1; padding:10px; font-weight:600; color:#334155;">\${m}</td>
              <td style="border:1px solid #cbd5e1; padding:10px; text-align:center;">\${p1}% <br><span style="color:#64748b;font-size:11px;">(\${val['< 15 days']})</span></td>
              <td style="border:1px solid #cbd5e1; padding:10px; text-align:center;">\${p2}% <br><span style="color:#64748b;font-size:11px;">(\${val['15 to 30 days']})</span></td>
              <td style="border:1px solid #cbd5e1; padding:10px; text-align:center;">\${p3}% <br><span style="color:#64748b;font-size:11px;">(\${val['> 30 days']})</span></td>
              <td style="border:1px solid #cbd5e1; padding:10px; text-align:center; font-weight:bold; color:#0f172a;">\${t}</td>
            </tr>\`;
      }
      reportHtml += \`</tbody></table></div>\`;
    }`;
html = html.replace(renderOld, renderNew);
fs.writeFileSync('frontend/public/Reports.html', html);

console.log('Successfully patched files.');
