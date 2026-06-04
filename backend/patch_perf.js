const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'services', 'performanceReviewService.js');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add model imports
const importsToAdd = `
const EPrfOb = require('../models/EPrfOb');
const Ecr = require('../models/Ecr');
const FqcNonsaleable = require('../models/FqcNonsaleable');
const FqcNonSaleableFs = require('../models/FqcNonSaleableFs');
const Bir = require('../models/Bir');
const ClosedBir = require('../models/ClosedBir');
`;
content = content.replace("const Division = require('../models/Division');", "const Division = require('../models/Division');" + importsToAdd);

// 2. Modify data fetching block
const oldFetchBlock = `  const [underRepairDocs, estimationDocs, completedDocs, scCompletedDocs, scrapDocs] = await Promise.all([
    UnderRepair.find(scope === 'division'
      ? {}
      : {
          $or: [
            { engineer: new RegExp(\`^\${safeRegex(employee)}\$\`, 'i') },
            { scEng: new RegExp(\`^\${safeRegex(employee)}\$\`, 'i') },
            { raEng: new RegExp(\`^\${safeRegex(employee)}\$\`, 'i') },
          ],
        }).lean(),
    EstimationPending.find(scope === 'division'
      ? {}
      : {
          $or: [
            { submittedBy: new RegExp(\`^\${safeRegex(employee)}\$\`, 'i') },
            { scEng: new RegExp(\`^\${safeRegex(employee)}\$\`, 'i') },
            { eng: new RegExp(\`^\${safeRegex(employee)}\$\`, 'i') },
          ],
        }).lean(),
    CompletedFRN.find(relatedFilter).lean(),
    SCCompletedFRN.find(relatedFilter).lean(),
    Scrap.find(scope === 'division'
      ? {}
      : {
          $or: [
            { addedBy: new RegExp(\`^\${safeRegex(employee)}\$\`, 'i') },
            { scEng: new RegExp(\`^\${safeRegex(employee)}\$\`, 'i') },
            { engineer: new RegExp(\`^\${safeRegex(employee)}\$\`, 'i') },
          ],
        }).lean(),
  ]);`;

const newFetchBlock = `  const empRegex = new RegExp(\`^\${safeRegex(employee)}\$\`, 'i');
  const [underRepairDocs, estimationDocs, completedDocs, scCompletedDocs, scrapDocs, eprfobDocs, ecrDocs, fqcNonsaleableDocs, fqcNonSaleableFsDocs, birDocs, closedBirDocs] = await Promise.all([
    UnderRepair.find(scope === 'division' ? {} : { $or: [{ engineer: empRegex }, { scEng: empRegex }, { raEng: empRegex }] }).lean(),
    EstimationPending.find(scope === 'division' ? {} : { $or: [{ submittedBy: empRegex }, { scEng: empRegex }, { eng: empRegex }] }).lean(),
    CompletedFRN.find(relatedFilter).lean(),
    SCCompletedFRN.find(relatedFilter).lean(),
    Scrap.find(scope === 'division' ? {} : { $or: [{ addedBy: empRegex }, { scEng: empRegex }, { engineer: empRegex }] }).lean(),
    EPrfOb.find(scope === 'division' ? {} : { engineer: empRegex }).lean(),
    Ecr.find().lean(),
    FqcNonsaleable.find(scope === 'division' ? {} : { $or: [{ engineer: empRegex }, { scEngineer: empRegex }] }).lean(),
    FqcNonSaleableFs.find().lean(),
    Bir.find(scope === 'division' ? {} : { $or: [{ engineer: empRegex }, { scEngineer: empRegex }] }).lean(),
    ClosedBir.find().lean(),
  ]);`;
content = content.replace(oldFetchBlock, newFetchBlock);

// 3. Replace rows calculations
// Locate currentActivityRows = [ ... ]
const rowsCalcRegex = /const currentActivityRows = \[([\s\S]*?)\];/;

const newRowsCalc = `const currentActivityRows = [
    makeActivityRow('W/CAMC/STOCK - PCB, Sub units, Units & Spares', 
        pcbRows.length, 
        countWithinTarget(pcbRows, 3)
    ),
    makeActivityRow('OB/LAMC', 
        filteredEstimation.length, 
        filteredEstimation.filter((record) => {
            const startDate = parseAnyDate(record.entryDate, record.createdAt);
            const endDate = parseAnyDate(record.estUpdatedAt || record.estDate || record.createdAt, record.createdAt);
            const days = diffDays(startDate, endDate);
            return days !== null && days <= 3;
        }).length
    ),
    makeActivityRow('Under Reapir', 
        filteredUnderRepair.length, 
        countUnderRepairWithinTarget(filteredUnderRepair, 7)
    ),
    makeActivityRow('PRF', 
        eprfobDocs.length, 
        eprfobDocs.filter((record) => {
            const startDate = parseAnyDate(record.entryDate, record.createdAt);
            const ecrMatch = ecrDocs.find(e => String(e.serviceId) === String(record.serviceId));
            const endDate = ecrMatch ? parseAnyDate(ecrMatch.createdAt, ecrMatch.closedAt) : null;
            if(!endDate) return false;
            const days = diffDays(startDate, endDate);
            return days !== null && days <= 3;
        }).length
    ),
    makeActivityRow('Non-Saleable', 
        fqcNonsaleableDocs.length, 
        fqcNonsaleableDocs.filter((record) => {
            const startDate = parseAnyDate(record.entryDate, record.fqcInDate);
            const fsMatch = fqcNonSaleableFsDocs.find(f => String(f.modelSn) === String(record.modelSn) || String(f._id) === String(record._id));
            const endDate = fsMatch ? parseAnyDate(fsMatch.createdAt, fsMatch.fqcInDate) : null;
            if(!endDate) return false;
            const days = diffDays(startDate, endDate);
            return days !== null && days <= 5;
        }).length
    ),
    makeActivityRow('BIR List', 
        birDocs.length, 
        birDocs.filter((record) => {
            const startDate = parseAnyDate(record.entryDate, record.createdAt);
            const cbMatch = closedBirDocs.find(c => String(c.serviceId) === String(record.serviceId) || String(c.birId) === String(record._id));
            const endDate = cbMatch ? parseAnyDate(cbMatch.createdAt, cbMatch.closedAt) : null;
            if(!endDate) return false;
            const days = diffDays(startDate, endDate);
            return days !== null && days <= 7;
        }).length
    ),
  ];`;
content = content.replace(rowsCalcRegex, newRowsCalc);

// 4. Update previous within counters to match the new 6 rows
const prevRowsCalcOld = /const previousRows = \[\s*previousIwCamcStock\.filter\(\(record\) => !isConsumable\(record\)\),\s*previousIwCamcStock\.filter\(\(record\) => isConsumable\(record\)\),\s*previousServices\.filter\(\(record\) => \['OW', 'LAMC'\]\.includes\(normalizeUpper\(record\.unitSts\)\)\),\s*previousServices\.filter\(\(record\) => \/PRF\/i\.test\(String\(record\.typeReport \|\| record\.repType \|\| record\.type \|\| ''\)\)\),\s*previousScrap,\s*previousUnderRepairRows,\s*previousBirRows,\s*previousReExportRows,\s*previousEstimation,\s*\];/;
const prevRowsCalcNew = `const previousRows = [
    previousIwCamcStock.filter((record) => !isConsumable(record)),
    previousEstimation,
    previousUnderRepairRows,
    previousServices.filter((record) => /PRF/i.test(String(record.typeReport || record.repType || record.type || ''))),
    previousScrap, // Fallback for Non-Saleable previous
    previousBirRows,
  ];`;
content = content.replace(prevRowsCalcOld, prevRowsCalcNew);

const prevCountersOld = /const previousWithinCounters = \[[\s\S]*?\];/;
const prevCountersNew = `const previousWithinCounters = [
    (rows) => countWithinTarget(rows, 3), // Pending FRN
    (rows) => countEstimationWithinTarget(rows), // OB/LAMC
    (rows) => countUnderRepairWithinTarget(rows, 7), // Under Repair
    (rows) => countWithinTarget(rows, 3), // PRF
    (rows) => countScrapWithinTarget(rows, 5), // Non-Saleable
    (rows) => countWithinTarget(rows, 7), // BIR List
  ];`;
content = content.replace(prevCountersOld, prevCountersNew);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully patched performanceReviewService.js');
