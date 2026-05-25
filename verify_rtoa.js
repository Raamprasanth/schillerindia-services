const fs = require('fs');

['Rtoa.html', 'Rtcoa.html'].forEach(f => {
  const c = fs.readFileSync('frontend/public/' + f, 'utf8');
  console.log('\n=== ' + f + ' ===');

  if (f === 'Rtoa.html') {
    console.log('[' + (c.includes('align-items:stretch') ? 'OK' : 'FAIL') + '] overlay full-screen (stretch)');
    console.log('[' + (c.includes('width:100%;height:100%;border-radius:0') ? 'OK' : 'FAIL') + '] modal full width/height');
    console.log('[' + (c.includes('repeat(3,1fr)') ? 'OK' : 'FAIL') + '] form-grid 3 columns');
    console.log('[' + (c.includes('accent bar') || c.includes('linear-gradient(90deg,var(--rep)') ? 'OK' : 'FAIL') + '] accent bar');
  }

  if (f === 'Rtcoa.html') {
    console.log('[' + (c.includes("sortBy('entryDate')") ? 'OK' : 'FAIL') + '] Entry Date column');
    console.log('[' + (c.includes("sortBy('repairedBy')") ? 'OK' : 'FAIL') + '] Repaired By column');
    console.log('[' + (c.includes("sortBy('partNumber')") ? 'OK' : 'FAIL') + '] Part No column');
    console.log('[' + (c.includes("sortBy('problemObserved')") ? 'OK' : 'FAIL') + '] Problem Observed column');
    console.log('[' + (c.includes("sortBy('componentsUsed')") ? 'OK' : 'FAIL') + '] Components Used column');
    console.log('[' + (c.includes("sortBy('finalRemarks')") ? 'OK' : 'FAIL') + '] Final Remarks column');
    console.log('[' + (c.includes("d-entryDate") ? 'OK' : 'FAIL') + '] detail modal: entryDate');
    console.log('[' + (c.includes("d-repairedBy") ? 'OK' : 'FAIL') + '] detail modal: repairedBy');
    console.log('[' + (c.includes("d-problemObserved") ? 'OK' : 'FAIL') + '] detail modal: problemObserved');
    console.log('[' + (c.includes('f-division') && c.includes('f-repairedby') ? 'OK' : 'FAIL') + '] filter bar updated');
    console.log('[' + (c.includes("min-width:1600px") ? 'OK' : 'FAIL') + '] table min-width widened');
  }
});
