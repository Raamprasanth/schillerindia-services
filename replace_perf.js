const fs = require('fs');

const file = 'c:/Users/Raamprasanth/OneDrive/Desktop/shcl/frontend/public/Reports.html';
const lines = fs.readFileSync(file, 'utf8').split('\n');

// Find the start of renderDivisionPerfSummary
const startIdx = lines.findIndex(l => l.includes('function renderDivisionPerfSummary(data,params) {'));
// Find the end of renderPerfSummary
const endIdx = lines.findIndex((l, i) => i > startIdx && l.includes('document.getElementById(\'perf-pane-summary\').innerHTML = html;')) + 2;

if (startIdx === -1 || endIdx < startIdx) {
  console.error("Could not find boundaries");
  process.exit(1);
}

const newCode = `
function generatePerfAnalysisHtml(data, params, scopeType) {
  const rate = data.summary?.completionRate || data.completionRate || 0;
  let remark = 'Needs Improvement';
  if (rate >= 90) remark = 'Excellent';
  else if (rate >= 75) remark = 'Good';
  else if (rate >= 60) remark = 'Average';

  const rows = data.activityRows || data.activities || [];
  const getRow = (label) => rows.find(r => (r.label||'').toLowerCase() === label.toLowerCase()) || {};
  const getVal = (r, key, fallback='-') => r[key] !== undefined && r[key] !== null ? r[key] : fallback;
  const pct = (r, key) => {
    let v = r[key];
    if(v===undefined || v===null) return '-';
    return Math.round(v * (key.includes('Rate') ? 100 : 1)) + '%';
  };

  const rFrn = getRow('Pending frn');
  const rFrnCon = getRow('pending FRN con');
  const rSo = getRow('SO Pending');
  const rRepair = getRow('Under Repair');
  const rTo = getRow('TO/SO');
  const rNonSaleable = getRow('Non-Saleable');
  const rBir = getRow('BIR list');
  const rEst = getRow('Estimation');

  const cWeekly = data.compliance?.weeklyCrm ?? 0;
  const cPending = data.compliance?.pendingActivity ?? 0;
  const cNonSaleableTracker = data.compliance?.nonSaleable ?? 0;
  const cSupWarr = data.compliance?.supplierWarranty ?? 0;
  const cCritical = data.compliance?.criticalPending ?? 0;
  const cPI = data.compliance?.purchaseIndent ?? 0;
  const c5S = data.compliance?.fiveSRate ?? 0;
  const cRR = data.compliance?.repairReport ?? 0;

  const monthLabel = params.month || '';
  const employeeLabel = data.employee || params.employee || '';
  const divisionLabel = data.division || params.division || '';

  var [yearStr, mStr] = (params.month || '').split('-');
  var yearNum = parseInt(yearStr, 10);
  var monthNum = parseInt(mStr, 10) - 1;

  var tuesdays = [], mondays = [];
  var d02 = '-', d03 = '-', d05 = '-', d16 = '-';
  if (!isNaN(yearNum) && !isNaN(monthNum)) {
    let d = new Date(yearNum, monthNum, 1);
    while (d.getMonth() === monthNum) {
      const fDate = String(d.getDate()).padStart(2,'0') + '-' + mStr + '-' + yearStr;
      if (d.getDay() === 2) tuesdays.push(fDate);
      if (d.getDay() === 1) mondays.push(fDate);
      d.setDate(d.getDate() + 1);
    }
    d02 = '02-' + mStr + '-' + yearStr;
    d03 = '03-' + mStr + '-' + yearStr;
    d05 = '05-' + mStr + '-' + yearStr;
    d16 = '16-' + mStr + '-' + yearStr;
  }
  
  var checkSub = (type, ds) => {
    if (!ds || ds === '-') return \\\`<div style="text-align:center;color:#94a3b8;font-size:12px;">-</div>\\\`;
    const parts = ds.split('-');
    if (parts.length !== 3) return ds;
    const backendDate = \\\`\\\${parts[2]}-\\\${parts[1]}-\\\${parts[0]}\\\`;
    const subs = (data.compliance && data.compliance.trackerSubmissions && data.compliance.trackerSubmissions[type]) || [];
    
    let countOrHasSub = false;
    let label = '';
    
    if (scopeType === 'division') {
      const uniqueEmps = new Set(subs.filter(s => s.date === backendDate).map(s => s.emp));
      countOrHasSub = uniqueEmps.size > 0;
      label = countOrHasSub ? uniqueEmps.size + ' Submitted' : 'Not Submitted';
    } else {
      countOrHasSub = subs.some(s => s.date === backendDate);
      label = countOrHasSub ? 'Submitted' : 'Not Submitted';
    }

    return \\\`<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:8px 6px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; width:100%; box-sizing:border-box;">
      <div style="font-size:11px; font-weight:700; color:#475569; margin-bottom:6px; letter-spacing:0.5px;">\\\${ds}</div>
      <div style="font-size:11px; font-weight:700; padding:4px 8px; border-radius:6px; width:100%; text-align:center; box-sizing:border-box; \\\${countOrHasSub ? 'background:#dcfce7; color:#166534; border:1px solid #bbf7d0;' : 'background:#fee2e2; color:#991b1b; border:1px solid #fecaca;'}">
        \\\${label}
      </div>
    </div>\\\`;
  };

  const makeRow = (title, r, isAlt) => \\\`
    <tr style="background-color:\\\${isAlt ? '#f8fafc' : '#ffffff'};">
      <td style="border:1px solid #cbd5e1; padding:12px 16px; text-align:left; font-weight:600; color:#334155; font-size:13px;">\\\${title}</td>
      <td style="border:1px solid #cbd5e1; padding:12px 16px; text-align:center; color:#475569; font-size:13px;">\\\${getVal(r, 'total')}</td>
      <td style="border:1px solid #cbd5e1; padding:12px 16px; text-align:center; color:#059669; font-weight:700; font-size:13px;">\\\${getVal(r, 'withinTarget')}</td>
      <td style="border:1px solid #cbd5e1; padding:12px 16px; text-align:center; color:#0f172a; font-weight:700; font-size:13px;">\\\${pct(r, 'completionPercent')}</td>
      <td style="border:1px solid #cbd5e1; padding:12px 16px; text-align:center; color:#64748b; font-size:13px;">\\\${pct(r, 'prevRate')}</td>
      <td style="border:1px solid #cbd5e1; padding:12px 16px; text-align:center; color:#3730a3; font-weight:700; background-color:\\\${isAlt ? '#eef2ff' : '#f5f7ff'}; font-size:13px;">\\\${pct(r, 'nextRate')}</td>
    </tr>
  \\\`;

  const topTable = \\\`
    <table style="width:100%; border-collapse:collapse; border:1px solid #cbd5e1; font-family:'Inter',system-ui,sans-serif; margin-bottom:28px; border-radius:8px; box-shadow:0 1px 3px rgba(0,0,0,0.05); overflow:hidden;">
      <thead>
        <tr>
          <th colspan="4" rowspan="2" style="background-color:#0f172a; color:#ffffff; font-size:16px; font-weight:700; letter-spacing:1px; text-transform:uppercase; border:1px solid #334155; padding:16px 20px; text-align:left; width:65%;">PERFORMANCE REVIEW</th>
          <th style="background-color:#f1f5f9; color:#475569; text-align:right; border:1px solid #cbd5e1; padding:12px 16px; font-weight:600; font-size:13px;">For the month of</th>
          <th style="background-color:#ffffff; color:#0f172a; border:1px solid #cbd5e1; padding:12px 16px; font-weight:700; font-size:14px; min-width:120px; text-align:center;">\\\${monthLabel}</th>
        </tr>
        <tr>
          <th style="background-color:#f1f5f9; color:#475569; text-align:right; border:1px solid #cbd5e1; padding:12px 16px; font-weight:600; font-size:13px;">\\\${scopeType === 'division' ? 'Division' : 'Employee'}</th>
          <th style="background-color:#ffffff; color:#0f172a; border:1px solid #cbd5e1; padding:12px 16px; font-weight:700; font-size:14px; text-align:center;">\\\${scopeType === 'division' ? divisionLabel : employeeLabel}</th>
        </tr>
        <tr>
          <th rowspan="2" style="background-color:#f8fafc; color:#334155; border:1px solid #cbd5e1; padding:14px 16px; text-align:left; font-weight:700; font-size:13px;">Activity</th>
          <th rowspan="2" style="background-color:#f8fafc; color:#334155; border:1px solid #cbd5e1; padding:14px 16px; text-align:center; font-weight:700; font-size:13px; line-height:1.4;">Total Inward<br><span style="color:#ef4444; font-size:11px; font-weight:600;">(If NA mark zero)</span></th>
          <th rowspan="2" style="background-color:#f8fafc; color:#334155; border:1px solid #cbd5e1; padding:14px 16px; text-align:center; font-weight:700; font-size:13px; line-height:1.4;">Executions within<br>target date</th>
          <th rowspan="2" style="background-color:#f8fafc; color:#334155; border:1px solid #cbd5e1; padding:14px 16px; text-align:center; font-weight:700; font-size:13px; line-height:1.4;">% of Executions<br>out of target date</th>
          <th colspan="2" style="background-color:#f8fafc; color:#334155; border:1px solid #cbd5e1; padding:14px 16px; text-align:center; font-weight:700; font-size:13px;">Target Percentage</th>
        </tr>
        <tr>
          <th style="background-color:#f8fafc; color:#475569; border:1px solid #cbd5e1; padding:10px; text-align:center; font-weight:700; font-size:12px;">Prev Month</th>
          <th style="background-color:#eef2ff; color:#3730a3; border:1px solid #cbd5e1; padding:10px; text-align:center; font-weight:800; font-size:12px;">Next Month</th>
        </tr>
      </thead>
      <tbody>
        \\\${makeRow('Pending frn', rFrn, false)}
        \\\${makeRow('pending FRN con', rFrnCon, true)}
        \\\${makeRow('SO Pending', rSo, false)}
        \\\${makeRow('Under Repair', rRepair, true)}
        \\\${makeRow('TO/SO', rTo, false)}
        \\\${makeRow('Non-Saleable', rNonSaleable, true)}
        \\\${makeRow('BIR list', rBir, false)}
        \\\${makeRow('Estimation', rEst, true)}
      </tbody>
    </table>
  \\\`;

  const bottomTable = \\\`
    <table style="width:100%; border-collapse:collapse; border:1px solid #cbd5e1; font-family:'Inter',system-ui,sans-serif; border-radius:8px; box-shadow:0 1px 3px rgba(0,0,0,0.05); overflow:hidden;">
      <tbody>
        <tr>
          <td rowspan="5" style="border:1px solid #cbd5e1; background-color:#f8fafc; padding:16px; text-align:left; font-weight:700; color:#334155; font-size:13px; width:20%;">Weekly CRM Reports</td>
          <td style="border:1px solid #cbd5e1; padding:10px; vertical-align:middle; width:15%;">\\\${checkSub('CRM', tuesdays[0])}</td>
          <td rowspan="5" style="border:1px solid #cbd5e1; background-color:#f8fafc; padding:16px; text-align:left; font-weight:700; color:#334155; font-size:13px; width:20%;">Pending activity on<br>Monday</td>
          <td style="border:1px solid #cbd5e1; padding:10px; vertical-align:middle; width:15%;">\\\${checkSub('PendingActivity', mondays[0])}</td>
          <td rowspan="4" style="border:1px solid #cbd5e1; background-color:#f8fafc; padding:16px; text-align:left; font-weight:700; color:#334155; font-size:13px; line-height:1.4; width:15%;">Non-Saleable<br><span style="color:#ef4444; font-size:11px; font-weight:600;">If NA mark NA</span></td>
          <td style="border:1px solid #cbd5e1; padding:10px; vertical-align:middle; width:15%;">\\\${checkSub('NonSaleable', d02)}</td>
        </tr>
        <tr>
          <td style="border:1px solid #cbd5e1; padding:10px; vertical-align:middle;">\\\${checkSub('CRM', tuesdays[1])}</td>
          <td style="border:1px solid #cbd5e1; padding:10px; vertical-align:middle;">\\\${checkSub('PendingActivity', mondays[1])}</td>
          <td style="border:1px solid #cbd5e1; padding:10px; vertical-align:middle;">\\\${checkSub('NonSaleable', d16)}</td>
        </tr>
        <tr>
          <td style="border:1px solid #cbd5e1; padding:10px; vertical-align:middle;">\\\${checkSub('CRM', tuesdays[2])}</td>
          <td style="border:1px solid #cbd5e1; padding:10px; vertical-align:middle;">\\\${checkSub('PendingActivity', mondays[2])}</td>
          <td style="border:1px solid #cbd5e1; padding:10px; vertical-align:middle; background-color:#f8fafc;"></td>
        </tr>
        <tr>
          <td style="border:1px solid #cbd5e1; padding:10px; vertical-align:middle;">\\\${checkSub('CRM', tuesdays[3])}</td>
          <td style="border:1px solid #cbd5e1; padding:10px; vertical-align:middle;">\\\${checkSub('PendingActivity', mondays[3])}</td>
          <td style="border:1px solid #cbd5e1; padding:10px; vertical-align:middle; background-color:#f8fafc;"></td>
        </tr>
        <tr>
          <td style="border:1px solid #cbd5e1; padding:10px; vertical-align:middle;">\\\${checkSub('CRM', tuesdays[4])}</td>
          <td style="border:1px solid #cbd5e1; padding:10px; vertical-align:middle;">\\\${checkSub('PendingActivity', mondays[4])}</td>
          <td style="border:1px solid #cbd5e1; padding:12px; font-weight:800; background-color:#e0e7ff; color:#3730a3; font-size:15px; text-align:center;">\\\${cNonSaleableTracker}%</td>
        </tr>
        <tr>
          <td colspan="2" style="border:1px solid #cbd5e1; padding:14px; font-weight:800; background-color:#e0e7ff; color:#3730a3; font-size:15px; text-align:center;">\\\${cWeekly}%</td>
          <td colspan="2" style="border:1px solid #cbd5e1; padding:14px; font-weight:800; background-color:#e0e7ff; color:#3730a3; font-size:15px; text-align:center;">\\\${cPending}%</td>
          <td colspan="2" style="border:1px solid #cbd5e1; padding:14px; background-color:#f1f5f9;"></td>
        </tr>

        <tr>
          <td colspan="3" style="border:1px solid #cbd5e1; background-color:#f8fafc; padding:16px; text-align:left; font-weight:700; color:#334155; font-size:13px; line-height:1.4;">Supplier Warranty transaction<br><span style="color:#ef4444; font-size:11px; font-weight:600;">If NA mark NA</span></td>
          <td colspan="3" style="border:1px solid #cbd5e1; background-color:#f8fafc; padding:16px; text-align:left; font-weight:700; color:#334155; font-size:13px; line-height:1.4;">Critical Pending report<br><span style="color:#ef4444; font-size:11px; font-weight:600;">If NA mark NA</span></td>
        </tr>
        <tr>
          <td colspan="3" style="border:1px solid #cbd5e1; padding:12px; vertical-align:middle;">
            <div style="display:flex; justify-content:space-evenly; align-items:center; gap:16px;">
              <div style="flex:1;">\\\${checkSub('SupplierWarranty', d03)}</div>
              <div style="flex:1;">\\\${checkSub('SupplierWarranty', d16)}</div>
            </div>
          </td>
          <td colspan="3" style="border:1px solid #cbd5e1; padding:12px; vertical-align:middle;">
            <div style="display:flex; justify-content:center; align-items:center; width:50%; margin:0 auto;">
              \\\${checkSub('CriticalPendingReport', d02)}
            </div>
          </td>
        </tr>
        <tr>
          <td colspan="3" style="border:1px solid #cbd5e1; padding:14px; font-weight:800; background-color:#e0e7ff; color:#3730a3; font-size:15px; text-align:center;">\\\${cSupWarr}%</td>
          <td colspan="3" style="border:1px solid #cbd5e1; padding:14px; font-weight:800; background-color:#e0e7ff; color:#3730a3; font-size:15px; text-align:center;">\\\${cCritical}%</td>
        </tr>

        <tr>
          <td colspan="3" rowspan="2" style="border:1px solid #cbd5e1; background-color:#f8fafc; padding:16px; text-align:left; font-weight:700; color:#334155; font-size:13px; line-height:1.4; vertical-align:middle;">
            Purchase indent request to commercial<br><span style="color:#ef4444; font-size:11px; font-weight:600;">If NA mark NA</span>
            <div style="margin-top:16px; display:flex; justify-content:center; width:60%; margin-left:auto; margin-right:auto;">
              \\\${checkSub('PIRequest', d05)}
            </div>
          </td>
          <td colspan="2" style="border:1px solid #cbd5e1; background-color:#f8fafc; padding:16px; text-align:left; font-weight:700; color:#334155; font-size:13px; vertical-align:middle;">5s Rate</td>
          <td style="border:1px solid #cbd5e1; padding:16px; font-weight:800; background-color:#e0e7ff; color:#3730a3; font-size:15px; text-align:center; vertical-align:middle;">\\\${c5S}%</td>
        </tr>
        <tr>
          <td colspan="2" style="border:1px solid #cbd5e1; background-color:#f8fafc; padding:16px; text-align:left; font-weight:700; color:#334155; font-size:13px; vertical-align:middle;">Repair Report</td>
          <td style="border:1px solid #cbd5e1; padding:16px; font-weight:800; background-color:#e0e7ff; color:#3730a3; font-size:15px; text-align:center; vertical-align:middle;">\\\${cRR}%</td>
        </tr>
        <tr>
          <td colspan="3" style="border:1px solid #cbd5e1; padding:18px; font-weight:900; background-color:#e0e7ff; color:#3730a3; font-size:18px; text-align:center;">\\\${cPI}%</td>
          <td colspan="3" style="border:1px solid #cbd5e1; padding:18px; font-weight:900; font-size:18px; text-align:center; color:\\\${rate>=75?'#059669':'#ef4444'}; background-color:\\\${rate>=75?'#ecfdf5':'#fef2f2'}; text-transform:uppercase; letter-spacing:1px;">
            \\\${remark}
          </td>
        </tr>
      </tbody>
    </table>
  \\\`;

  return \\\`
    <div style="font-family:'Inter',system-ui,sans-serif; background:#ffffff; border-radius:16px; border:1px solid #e2e8f0; padding:32px; color:#1e293b; width:100%; box-sizing:border-box;">
      <div style="display:flex; align-items:flex-end; justify-content:space-between; margin-bottom:28px; border-bottom:2px solid #e2e8f0; padding-bottom:16px;">
        <div>
          <h2 style="margin:0 0 4px 0; font-size:24px; font-weight:800; color:#0f172a; letter-spacing:-0.5px;">\\\${scopeType === 'division' ? 'Division' : 'Employee'} Performance Analysis</h2>
          <div style="font-size:13px; color:#64748b; font-weight:500;">Comprehensive monthly execution review</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:12px; font-weight:600; color:#64748b; margin-bottom:4px; text-transform:uppercase; letter-spacing:0.5px;">\\\${scopeType === 'division' ? 'Division' : 'Employee'}: <span style="color:#0f172a; font-size:14px;">\\\${scopeType === 'division' ? divisionLabel : employeeLabel}</span></div>
          <div style="font-size:12px; font-weight:600; color:#64748b; text-transform:uppercase; letter-spacing:0.5px;">Month: <span style="color:#0f172a; font-size:14px;">\\\${monthLabel}</span></div>
        </div>
      </div>
      \\\${scopeType === 'employee' ? '<div class="submission-panel" id="perf-submission-panel"></div>' : ''}
      <div class="perf-review-table-container">
        \\\${topTable}
        \\\${bottomTable}
      </div>
      <div style="margin-top:24px; display:flex; justify-content:flex-end; gap:12px;">
        <button class="btn btn-green" style="padding:10px 18px; font-weight:600; border-radius:8px; font-size:13px;" onclick="exportPDF('\\\${scopeType === 'division' ? 'div' : 'emp'}')">
          <i class="fas fa-file-pdf" style="margin-right:6px;"></i> Export \\\${scopeType === 'division' ? 'Division ' : ''}PDF
        </button>
      </div>
    </div>
  \\\`;
}

function renderDivisionPerfSummary(data,params) {
  if(!data){
    document.getElementById('perf-pane-div-summary').innerHTML='<div class="empty-state"><div class="empty-icon">&#128196;</div><div class="empty-title">No Data</div></div>';
    return;
  }
  window._lastPerfDivData = data;
  const html = generatePerfAnalysisHtml(data, params, 'division');
  document.getElementById('perf-pane-div-summary').innerHTML = html;
  if(typeof loadDivisionReportSubmissions === 'function') loadDivisionReportSubmissions(params);
}

function renderPerfSummary(data,params) {
  if(!data){
    document.getElementById('perf-pane-summary').innerHTML='<div class="empty-state"><div class="empty-icon">&#128196;</div><div class="empty-title">No Data</div></div>';
    return;
  }
  const html = generatePerfAnalysisHtml(data, params, 'employee');
  document.getElementById('perf-pane-summary').innerHTML = html;
}
`;

lines.splice(startIdx, endIdx - startIdx, newCode);
fs.writeFileSync(file, lines.join('\n'), 'utf8');
console.log('Successfully replaced functions');
