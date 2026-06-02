const fs = require('fs');
const html = fs.readFileSync('frontend/public/ecbir.html', 'utf8');
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);

if (scriptMatch) {
  let js = scriptMatch[1];
  
  // Replace DOM dependencies
  js = js.replace(/document\.getElementById\([^)]*\)(\|\|\{\})?\.textContent/g, "mockEl.textContent");
  js = js.replace(/document\.getElementById\([^)]*\)\.innerHTML/g, "mockEl.innerHTML");
  js = js.replace(/document\.getElementById\([^)]*\)\.value/g, "mockEl.value");
  js = js.replace(/document\.querySelectorAll\([^)]*\)\.forEach/g, "mockQuery.forEach");
  js = js.replace(/window\.location\.href/g, "mockWin.href");
  js = js.replace(/showToast\([^)]*\)/g, "console.log('toast')");
  
  const mockEl = { textContent: '', innerHTML: '', value: '' };
  const mockQuery = { forEach: () => {} };
  const mockWin = { href: '' };
  
  const rawData = [
    {
      "_id": "6a1e83c772ea4eed2e299d2a",
      "birRefNo": "BIR-REF 015",
      "__v": 0,
      "accChangeRemarks": "",
      "accessoryDetails": "No change in accessories",
      "approvedDate": "",
      "cnrCirculation": "",
      "cnrRefNo": "",
      "cnrReleaseDate": "",
      "configuration": "1144",
      "createdAt": "2026-06-02T07:18:31.730Z",
      "createdBy": "69ff89c9440f3979808cf64f",
      "defUnitReceivedDate": "",
      "division": "ANESTHESIA",
      "finalStatus": "Closed",
      "fqcFinalRemarks": "",
      "fqcInwardDate": "2026-05-28",
      "fqcObservation": "",
      "fqcRemarks": "Change in software version",
      "hwChangeRemarks": "wvwadv",
      "hwChanges": "edvawv",
      "invoiceDate": "2026-05-29",
      "invoiceNo": "55194",
      "inwardDate": "2026-05-29",
      "model": "AEON7200A - 2G",
      "presSwVersion": "1.4",
      "prevSwVersion": "1.2",
      "productTeamRemarks": "",
      "psEngineer": "",
      "psVerificationDate": "",
      "receivedQty": "150",
      "replacementShipDate": "",
      "requiredParts": "",
      "rootCause": "",
      "scActionPlan": "",
      "scEngineer": "Aravindh",
      "scInwardDate": "",
      "scObservation": "na",
      "serial": "446546",
      "serviceManualUpdate": "Yes",
      "shipDateToFqc": "",
      "supplier": "AEONMED",
      "swChangeRemarks": "",
      "techRemarks": "na",
      "tentativeDate": "",
      "tsVerificationDate": "2026-06-02",
      "updatedAt": "2026-06-02T07:18:31.730Z",
      "updatedBy": "69ff849d440f3979808cf5c2",
      "userManualUpdate": "Yes"
    }
  ];

  try {
    eval(js);
    console.log("Evaluated JS successfully.");
    const merged = mergeClosedLists(rawData, []);
    console.log("Merged:", merged.length);
    allData = merged;
    updateStats();
    console.log("Stats updated.");
    applyFilters();
    console.log("Filters applied.");
  } catch(e) {
    console.error("Error during execution:", e);
  }
}
