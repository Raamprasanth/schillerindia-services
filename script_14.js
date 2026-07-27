async function fetchCommercialData(usePeriod = false) {
  const month = usePeriod ? getPeriodValue('com') : document.getElementById('perf-com-month').value;
  if (!month) {
    toast('Please select a month first', 'error');
    return;
  }
  const selectedDiv = document.getElementById('perf-com-division') ? document.getElementById('perf-com-division').value : '';
  const res = document.getElementById('perf-com-result');
  res.innerHTML = '<div class="empty-sub">Loading commercial data...</div>';
  try {
    const r = await fetch('/api/reports/performance/commercial?month=' + month, {headers: hdrs()});
    const d = await r.json();
    if (!d.success) throw new Error(d.message);
    
    if (Object.keys(d.data).length === 0) {
      res.innerHTML = '<div class="empty-sub">No data available for this month.</div>';
      return;
    }
    
    let reportHtml = `<div style="display:flex;justify-content:space-between;margin-bottom:16px;">
      <h3 style="margin:0;font-family:'Syne',sans-serif;color:#0f172a;">Commercial Report - ${month}</h3>
      <button class="btn btn-green" onclick="exportCommercialPDF()"><i class="fas fa-file-pdf" style="margin-right:6px;"></i> Export PDF</button>
    </div>
    <div id="commercial-pdf-content" style="background:#fff;padding:20px;border-radius:8px;">`;
    const scRemarksBlock = `<div style="margin-top:20px;padding:15px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;"><label style="display:block;font-weight:600;margin-bottom:8px;font-size:13px;">SC Incharge Remarks (Optional)</label><textarea id="sc-remarks-commercial" style="width:100%;height:60px;padding:10px;border:1px solid #cbd5e1;border-radius:6px;font-family:Inter;font-size:13px;" placeholder="Enter remarks to include in the PDF export..."></textarea></div>`;
    
    // If all divisions or consolidated selected, generate an aggregated ALL DIVISIONS object
    if (!selectedDiv || selectedDiv === 'all' || selectedDiv === 'consolidated') {
      const allDivData = {};
      const metricKeys = [
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
      }
      d.data = { 'ALL DIVISIONS': allDivData, ...d.data };
    }

    // Sort divisions alphabetically, keeping ALL DIVISIONS at the top
    const divisions = Object.keys(d.data).sort((a,b) => {
      if (a === 'ALL DIVISIONS') return -1;
      if (b === 'ALL DIVISIONS') return 1;
      return a.localeCompare(b);
    });
    let hasData = false;
    for (const div of divisions) {
      if (div.toUpperCase() === 'UNKNOWN') continue;
      if (selectedDiv === 'consolidated' && div !== 'ALL DIVISIONS') continue;
      if (selectedDiv !== 'consolidated' && selectedDiv && selectedDiv !== 'all' && selectedDiv !== div) continue;
      hasData = true;
      const metrics = d.data[div];
      reportHtml += `<div style="margin-bottom:30px; page-break-inside: avoid;">
        <h4 style="margin:0 0 10px 0; background:#0f172a; color:#fff; padding:8px 12px; border-radius:4px;">${div}</h4>
        <table style="width:100%; border-collapse:collapse; border:1px solid #cbd5e1; font-family:'Inter',sans-serif; font-size:13px;">
          <thead>
            <tr>
              <th style="background:#f1f5f9; border:1px solid #cbd5e1; padding:10px; text-align:left;">Report Type</th>
              <th style="background:#f1f5f9; border:1px solid #cbd5e1; padding:10px; text-align:center;">&lt; 1 day</th>
              <th style="background:#f1f5f9; border:1px solid #cbd5e1; padding:10px; text-align:center;">1 to 2 days</th>
              <th style="background:#f1f5f9; border:1px solid #cbd5e1; padding:10px; text-align:center;">&gt; 2 days</th>
              <th style="background:#f1f5f9; border:1px solid #cbd5e1; padding:10px; text-align:center; color:#0f172a;">Total</th>
            </tr>
          </thead>
          <tbody>`;
          
      for (const m of [
        'FRN ( Inward - SVC )', 
        'TO ( Raised - Received )', 
        'TO/SO ( Entry - Received )', 
        'SR ( Raised - Received )',
        'DR ( Requested - Received )',
        'Field TO/SO ( ER Raised - Entry )',
        'Re-Export (Ship Date-DC Date)'
      ]) {
        const val = metrics[m];
        if (!val) continue; // safety check
        const t = val.total || 0;
        const p1 = t > 0 ? Math.round((val['< 1 day']/t)*100) : 0;
        const p2 = t > 0 ? Math.round((val['1 to 2 days']/t)*100) : 0;
        const p3 = t > 0 ? Math.round((val['> 2 days']/t)*100) : 0;
        
        reportHtml += `
            <tr>
              <td style="border:1px solid #cbd5e1; padding:10px; font-weight:600; color:#334155;">${m}</td>
              <td style="border:1px solid #cbd5e1; padding:10px; text-align:center;">${p1}% <br><span style="color:#64748b;font-size:11px;">(${val['< 1 day']})</span></td>
              <td style="border:1px solid #cbd5e1; padding:10px; text-align:center;">${p2}% <br><span style="color:#64748b;font-size:11px;">(${val['1 to 2 days']})</span></td>
              <td style="border:1px solid #cbd5e1; padding:10px; text-align:center;">${p3}% <br><span style="color:#64748b;font-size:11px;">(${val['> 2 days']})</span></td>
              <td style="border:1px solid #cbd5e1; padding:10px; text-align:center; font-weight:bold; color:#0f172a;">${t}</td>
            </tr>`;
      }
      reportHtml += `</tbody></table>`;
      
      reportHtml += `<h4 style="margin:20px 0 10px 0; font-size:14px; color:#334155;">Extended Durations</h4>
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
          <tbody>`;

      for (const m of ['Re-Export ( DC Date - AWB Date )']) {
        const val = metrics[m];
        if (!val) continue;
        const t = val.total || 0;
        const p1 = t > 0 ? Math.round((val['< 15 days']/t)*100) : 0;
        const p2 = t > 0 ? Math.round((val['15 to 30 days']/t)*100) : 0;
        const p3 = t > 0 ? Math.round((val['> 30 days']/t)*100) : 0;
        
        reportHtml += `
            <tr>
              <td style="border:1px solid #cbd5e1; padding:10px; font-weight:600; color:#334155;">${m}</td>
              <td style="border:1px solid #cbd5e1; padding:10px; text-align:center;">${p1}% <br><span style="color:#64748b;font-size:11px;">(${val['< 15 days']})</span></td>
              <td style="border:1px solid #cbd5e1; padding:10px; text-align:center;">${p2}% <br><span style="color:#64748b;font-size:11px;">(${val['15 to 30 days']})</span></td>
              <td style="border:1px solid #cbd5e1; padding:10px; text-align:center;">${p3}% <br><span style="color:#64748b;font-size:11px;">(${val['> 30 days']})</span></td>
              <td style="border:1px solid #cbd5e1; padding:10px; text-align:center; font-weight:bold; color:#0f172a;">${t}</td>
            </tr>`;
      }
      reportHtml += `</tbody></table></div>`;
    }
    
    reportHtml += `</div>`;
    
    if (!hasData) {
      res.innerHTML = '<div class="empty-sub">No commercial data found for the selected division in this month.</div>';
    } else {
      res.innerHTML = reportHtml;
    }
  } catch (e) {
    res.innerHTML = '<div style="color:red;padding:20px;">Error loading data: ' + e.message + '</div>';
  }
}

async function exportCommercialPDF() {
  const el = document.getElementById('commercial-pdf-content');
  if (!el) return;
  
  const month = document.getElementById('perf-com-month').value || 'Report';
  const div = document.getElementById('perf-com-division').value;
  const divisionLabel = div || 'All Divisions';
  
  const scRemarks = document.getElementById('sc-remarks-commercial')?.value || '';
    await generatePremiumPDF(el.innerHTML, 'COMMERCIAL PERFORMANCE REPORT', divisionLabel, month, 'Commercial_Performance', scRemarks);
}

async function fetchRepairTeamData(usePeriod = false) {
  const month = usePeriod ? getPeriodValue('rt') : document.getElementById('perf-repairteam-month').value;
  if (!month) {
    toast('Please select a month first', 'error');
    return;
  }
  const res = document.getElementById('perf-repairteam-result');
  res.innerHTML = '<div class="empty-sub">Loading repair team data...</div>';
  try {
    const r = await fetch('/api/reports/performance/repairteam?month=' + month, {headers: hdrs()});
    const d = await r.json();
    if (!d.success) throw new Error(d.message);
    
    if (Object.keys(d.data).length === 0) {
      res.innerHTML = '<div class="empty-sub">No data available for this month.</div>';
      return;
    }
    
    let reportHtml = `<div style="display:flex;justify-content:space-between;margin-bottom:16px;">
      <h3 style="margin:0;font-family:'Syne',sans-serif;color:#0f172a;">Repair Team Report - ${month}</h3>
      <button class="btn btn-green" onclick="exportRepairTeamPDF()"><i class="fas fa-file-pdf" style="margin-right:6px;"></i> Export PDF</button>
    </div>
    <div id="repairteam-pdf-content" style="background:#fff;padding:20px;border-radius:8px;">`;
    const scRemarksBlock = `<div style="margin-top:20px;padding:15px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;"><label style="display:block;font-weight:600;margin-bottom:8px;font-size:13px;">SC Incharge Remarks (Optional)</label><textarea id="sc-remarks-repairteam" style="width:100%;height:60px;padding:10px;border:1px solid #cbd5e1;border-radius:6px;font-family:Inter;font-size:13px;" placeholder="Enter remarks to include in the PDF export..."></textarea></div>`;
    
    const divisions = Object.keys(d.data);
    let hasData = false;
    for (const div of divisions) {
      hasData = true;
      const metrics = d.data[div];
      reportHtml += `<div style="margin-bottom:30px; page-break-inside: avoid;">
        <table style="width:100%; border-collapse:collapse; border:1px solid #cbd5e1; font-family:'Inter',sans-serif; font-size:13px;">
          <thead>
            <tr>
              <th style="background:#f1f5f9; border:1px solid #cbd5e1; padding:10px; text-align:left;">Report Type</th>
              <th style="background:#f1f5f9; border:1px solid #cbd5e1; padding:10px; text-align:center;">&lt; 1 day</th>
              <th style="background:#f1f5f9; border:1px solid #cbd5e1; padding:10px; text-align:center;">1 to 3 days</th>
              <th style="background:#f1f5f9; border:1px solid #cbd5e1; padding:10px; text-align:center;">&gt; 3 days</th>
              <th style="background:#f1f5f9; border:1px solid #cbd5e1; padding:10px; text-align:center; color:#0f172a;">RP</th>
              <th style="background:#f1f5f9; border:1px solid #cbd5e1; padding:10px; text-align:center; color:#0f172a;">Total</th>
            </tr>
          </thead>
          <tbody>`;
      let totalL1 = 0, total1to3 = 0, totalG3 = 0, totalRP = 0, totalCount = 0;
      for (const m of ['Pending FRN', 'OB Pending', 'Under Repair', 'Re-Repair']) {
        const val = metrics[m];
        if (!val) continue;
        const t = val.total || 0;
        const p1 = t > 0 ? Math.round((val['< 1 day']/t)*100) : 0;
        const p2 = t > 0 ? Math.round((val['1 to 3 days']/t)*100) : 0;
        const p3 = t > 0 ? Math.round((val['> 3 days']/t)*100) : 0;
        const prp = t > 0 ? Math.round(((val.RP || 0)/t)*100) : 0;
        
        reportHtml += `
            <tr>
              <td style="border:1px solid #cbd5e1; padding:10px; font-weight:600; color:#334155;">${m}</td>
              <td style="border:1px solid #cbd5e1; padding:10px; text-align:center;">${p1}% <br><span style="color:#64748b;font-size:11px;">(${val['< 1 day']})</span></td>
              <td style="border:1px solid #cbd5e1; padding:10px; text-align:center;">${p2}% <br><span style="color:#64748b;font-size:11px;">(${val['1 to 3 days']})</span></td>
              <td style="border:1px solid #cbd5e1; padding:10px; text-align:center;">${p3}% <br><span style="color:#64748b;font-size:11px;">(${val['> 3 days']})</span></td>
              <td style="border:1px solid #cbd5e1; padding:10px; text-align:center; font-weight:bold; color:#0f172a;">${prp}% <br><span style="color:#64748b;font-size:11px;font-weight:normal;">(${val.RP || 0})</span></td>
              <td style="border:1px solid #cbd5e1; padding:10px; text-align:center; font-weight:bold; color:#0f172a;">${t}</td>
            </tr>`;
            
        totalL1 += val['< 1 day'] || 0;
        total1to3 += val['1 to 3 days'] || 0;
        totalG3 += val['> 3 days'] || 0;
        totalRP += val.RP || 0;
        totalCount += t;
      }
      
      const avgP1 = totalCount > 0 ? Math.round((totalL1/totalCount)*100) : 0;
      const avgP2 = totalCount > 0 ? Math.round((total1to3/totalCount)*100) : 0;
      const avgP3 = totalCount > 0 ? Math.round((totalG3/totalCount)*100) : 0;
      const avgPRP = totalCount > 0 ? Math.round((totalRP/totalCount)*100) : 0;
      
      // The user wants remarks based on both < 1 day and 1 to 3 days averages
      const perfScore = avgP1 + avgP2;
      let performanceRemark = 'Very Poor';
      if (perfScore >= 91) performanceRemark = 'Outstanding';
      else if (perfScore >= 81) performanceRemark = 'Excellent';
      else if (perfScore >= 61) performanceRemark = 'Very Good';
      else if (perfScore >= 41) performanceRemark = 'Satisfactory';
      else if (perfScore >= 21) performanceRemark = 'Needs Improvement';
      
      let pColor = 'red';
      if (perfScore >= 81) pColor = 'green';
      else if (perfScore >= 41) pColor = 'orange';
      
      reportHtml += `
            <tr style="background:#e2e8f0;">
              <td style="border:1px solid #cbd5e1; padding:10px; font-weight:bold; color:#0f172a;">Overall Average</td>
              <td style="border:1px solid #cbd5e1; padding:10px; text-align:center; font-weight:bold;">${avgP1}% <br><span style="color:#64748b;font-size:11px;">(${totalL1})</span></td>
              <td style="border:1px solid #cbd5e1; padding:10px; text-align:center; font-weight:bold;">${avgP2}% <br><span style="color:#64748b;font-size:11px;">(${total1to3})</span></td>
              <td style="border:1px solid #cbd5e1; padding:10px; text-align:center; font-weight:bold;">${avgP3}% <br><span style="color:#64748b;font-size:11px;">(${totalG3})</span></td>
              <td style="border:1px solid #cbd5e1; padding:10px; text-align:center; font-weight:bold; color:#0f172a;">${avgPRP}% <br><span style="color:#64748b;font-size:11px;font-weight:normal;">(${totalRP})</span></td>
              <td style="border:1px solid #cbd5e1; padding:10px; text-align:center; font-weight:bold; color:#0f172a;">${totalCount}</td>
            </tr>
            <tr style="background:#e2e8f0;">
              <td colspan="4" style="border:1px solid #cbd5e1; padding:10px; text-align:right; font-weight:bold; color:#0f172a;">Combined Performance (&lt; 1 day &amp; 1-3 days): <span style="color:#0077cc;">${perfScore}%</span></td>
              <td colspan="2" style="border:1px solid #cbd5e1; padding:10px; text-align:right; font-weight:bold; color:#0f172a;">Performance Remark: <span style="color:${pColor};">${performanceRemark}</span></td>
            </tr>
          </tbody></table></div>`;
    }
    
    reportHtml += scRemarksBlock + `</div>`;
    
    if (!hasData) {
      res.innerHTML = '<div class="empty-sub">No repair team data found for this month.</div>';
    } else {
      res.innerHTML = reportHtml;
    }
  } catch (e) {
    res.innerHTML = '<div style="color:red;padding:20px;">Error loading data: ' + e.message + '</div>';
  }
}

async function exportRepairTeamPDF() {
  const el = document.getElementById('repairteam-pdf-content');
  if (!el) return;
  
  const month = document.getElementById('perf-repairteam-month').value || 'Report';
  const divisionLabel = 'All Divisions';
  
  const scRemarks = document.getElementById('sc-remarks-repairteam')?.value || '';
    await generatePremiumPDF(el.innerHTML, 'REPAIR TEAM PERFORMANCE REPORT', '', month, 'RepairTeam_Performance', scRemarks);
}
async function generatePremiumPDF(reportHtml, title, divisionLabel, monthLabel, filenamePrefix, scRemarks = '') {
  const jsPDFLib = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
  if (!jsPDFLib) { toast('PDF library not loaded', 'error'); return; }
  const doc = new jsPDFLib('l', 'mm', 'a4'); 

  const drawHeaderAndBorder = () => {
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.rect(10, 10, 277, 190);
    try {
      const logoEl = new Image();
      logoEl.src = 'logo.png';
      doc.addImage(logoEl, 'PNG', 15, 13, 40, 8); 
    } catch(e){}
    
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(title, 280, 18, { align: "right" });
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    
      const divText = divisionLabel && divisionLabel.toLowerCase() !== 'all divisions' ? `Division: ${divisionLabel}   |   ` : '';
      doc.text(`${divText}Month: ${monthLabel}`, 280, 24, { align: "right" });
    
    doc.setLineWidth(0.5);
    doc.setDrawColor(0, 0, 0);
    doc.line(10, 28, 287, 28);
  };

  const wrapper = document.createElement('div');
  wrapper.style.position = 'fixed';
  wrapper.style.left = '-9999px';
  wrapper.style.top = '0px';
  wrapper.innerHTML = reportHtml;
  document.body.appendChild(wrapper);

  try {
    const blocks = wrapper.querySelectorAll('h3, h4, table');
    let currentY = 34;
    let pagesDrawn = 0;
    
    blocks.forEach((el) => {
      if (el.tagName.toLowerCase() === 'h4' || el.tagName.toLowerCase() === 'h3') {
        if (currentY > 170) {
          doc.addPage();
          currentY = 34;
        }
        if (doc.internal.getNumberOfPages() > pagesDrawn) {
          drawHeaderAndBorder();
          pagesDrawn = doc.internal.getNumberOfPages();
        }
        
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(255, 255, 255);
        doc.setFillColor(15, 23, 42);
        
        const txt = el.innerText.trim();
        if (txt) {
           doc.rect(14, currentY, 269, 7, 'F');
           doc.text(txt, 16, currentY + 5);
           currentY += 9;
        }
      } else if (el.tagName.toLowerCase() === 'table') {
        doc.autoTable({
          html: el,
          startY: currentY,
          margin: { left: 14, right: 14 },
          theme: 'grid',
          useCss: false, 
          headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
          styles: { font: 'helvetica', fontSize: 9, cellPadding: 3, lineColor: [203, 213, 225], lineWidth: 0.1, textColor: [15, 23, 42] },
          columnStyles: {
            0: { halign: 'left', fontStyle: 'bold' },
            1: { halign: 'center' },
            2: { halign: 'center' },
            3: { halign: 'center' },
            4: { halign: 'center' },
            5: { halign: 'center' },
            6: { halign: 'center' },
            7: { halign: 'center' }
          },
          didDrawPage: function (data) {
            if (doc.internal.getNumberOfPages() > pagesDrawn) {
              drawHeaderAndBorder();
              pagesDrawn = doc.internal.getNumberOfPages();
            }
          }
        });
        currentY = doc.lastAutoTable.finalY + 8;
      }
    });

    if (blocks.length === 0) {
       drawHeaderAndBorder();
       doc.setFontSize(12);
       doc.setTextColor(0, 0, 0);
       doc.text("No data available for this report.", 14, 40);
    }

    // Append SC Incharge Remarks if provided
    if (scRemarks && scRemarks.trim()) {
      // Check if we need a new page
      if (currentY > 170) {
        doc.addPage();
        drawHeaderAndBorder();
        currentY = 34;
      }
      const remarksBoxY = currentY + 4;
      doc.setDrawColor(203, 213, 225);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(14, remarksBoxY, 269, 22, 2, 2, 'FD');
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(100, 116, 139);
      doc.text("SC INCHARGE REMARKS:", 18, remarksBoxY + 7);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(15, 23, 42);
      const splitRemarks = doc.splitTextToSize(scRemarks.trim(), 255);
      doc.text(splitRemarks, 18, remarksBoxY + 14);
    }

    const safeFilename = `${filenamePrefix}_${divisionLabel}_${monthLabel}`.replace(/[^a-zA-Z0-9_-]/g, '_') + '.pdf';
    doc.save(safeFilename);
    toast('PDF export completed!', 'success');
  } finally {
    document.body.removeChild(wrapper);
  }
}

async function fetchProductTeamData(usePeriod = false) {
  const month = usePeriod ? getPeriodValue('pt') : document.getElementById('perf-productteam-month').value;
  if (!month) {
    toast('Please select a month first', 'error');
    return;
  }
  const res = document.getElementById('perf-productteam-result');
  res.innerHTML = '<div class="empty-sub">Loading product team data...</div>';
  try {
    const r = await fetch('/api/reports/performance/productteam?month=' + month, {headers: hdrs()});
    const d = await r.json();
    if (!d.success) throw new Error(d.message);
    
    const { employees, birData } = d.data;
    
    let reportHtml = `<div style="display:flex;justify-content:space-between;margin-bottom:16px;">
      <h3 style="margin:0;font-family:'Syne',sans-serif;color:#0f172a;">Product Team Report - ${month}</h3>
      <button class="btn btn-green" onclick="exportProductTeamPDF()"><i class="fas fa-file-pdf" style="margin-right:6px;"></i> Export PDF</button>
    </div>
    <div id="productteam-pdf-content" style="background:#fff;padding:20px;border-radius:8px;">
      <h3 style="text-align:center; font-family:'Syne',sans-serif; margin-bottom:20px;">Product Team Performance Analysis - ${d.data.month}</h3>
      
      <!-- Employee Table -->
      <h4 style="font-family:'Inter',sans-serif; margin-bottom:10px;">Employee Performance (Total Working Days: ${d.data.workingDays})</h4>
      <table style="width:100%; border-collapse:collapse; border:1px solid #cbd5e1; font-family:'Inter',sans-serif; font-size:13px; margin-bottom:30px;">
        <thead>
          <tr>
            <th style="background:#f1f5f9; border:1px solid #cbd5e1; padding:10px; text-align:left;">Employee</th>
            <th style="background:#f1f5f9; border:1px solid #cbd5e1; padding:10px; text-align:center;">PT Call (Entered)</th>
            <th style="background:#f1f5f9; border:1px solid #cbd5e1; padding:10px; text-align:center;">PT Daily Work (Entered)</th>
            <th style="background:#f1f5f9; border:1px solid #cbd5e1; padding:10px; text-align:center;">Overall %</th>
            <th style="background:#f1f5f9; border:1px solid #cbd5e1; padding:10px; text-align:left;">Remark</th>
          </tr>
        </thead>
        <tbody>
`;

    for (const emp of employees) {
      reportHtml += `
          <tr>
            <td style="border:1px solid #cbd5e1; padding:10px; font-weight:600;">${emp.employee}</td>
            <td style="border:1px solid #cbd5e1; padding:10px; text-align:center;">${emp.callScore}</td>
            <td style="border:1px solid #cbd5e1; padding:10px; text-align:center;">${emp.workScore}</td>
            <td style="border:1px solid #cbd5e1; padding:10px; text-align:center; font-weight:700;">${emp.completionRate}%</td>
            <td style="border:1px solid #cbd5e1; padding:10px;">${emp.remark}</td>
          </tr>
      `;
    }
    
    reportHtml += `
        </tbody>
      </table>
        <!-- BIR List Table -->
      <h4 style="font-family:'Inter',sans-serif; margin-bottom:10px;">BIR List Tracker (< 7 Days)</h4>
      <table style="width:100%; border-collapse:collapse; border:1px solid #cbd5e1; font-family:'Inter',sans-serif; font-size:13px;">
        <thead>
          <tr>
            <th style="background:#f1f5f9; border:1px solid #cbd5e1; padding:10px; text-align:center;">Total BIR Created</th>
            <th style="background:#f1f5f9; border:1px solid #cbd5e1; padding:10px; text-align:center;">Moved to PTCBIR (< 7 Days)</th>
            <th style="background:#f1f5f9; border:1px solid #cbd5e1; padding:10px; text-align:center;">Completion %</th>
            <th style="background:#f1f5f9; border:1px solid #cbd5e1; padding:10px; text-align:left;">Remark</th>
          </tr>
        </thead>
        <tbody>
`;

    for (const bir of birData) {
      reportHtml += `
          <tr>
            <td style="border:1px solid #cbd5e1; padding:10px; text-align:center;">${bir.total}</td>
            <td style="border:1px solid #cbd5e1; padding:10px; text-align:center;">${bir.completed}</td>
            <td style="border:1px solid #cbd5e1; padding:10px; text-align:center; font-weight:700;">${bir.rate}%</td>
            <td style="border:1px solid #cbd5e1; padding:10px;">${bir.remark}</td>
          </tr>
      `;
    }

    reportHtml += `
        </tbody>
      </table>
    </div>`;

    res.innerHTML = reportHtml;

  } catch (error) {
    console.error(error);
    res.innerHTML = `<div class="empty-sub" style="color:#ef4444;">Failed to load data: ${error.message}</div>`;
  }
}

async function exportProductTeamPDF() {
  const el = document.getElementById('productteam-pdf-content');
  if (!el) return;
  const month = document.getElementById('perf-productteam-month').value || 'Report';
  const scRemarks = document.getElementById('sc-remarks-productteam')?.value || '';
    await generatePremiumPDF(el.innerHTML, 'PRODUCT TEAM PERFORMANCE REPORT', '', month, 'ProductTeam_Performance', scRemarks);
}