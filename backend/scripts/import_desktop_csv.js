const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Service = require('../models/Service');
const EmpFRN = require('../models/EmpFRN');
const UnderRepair = require('../models/UnderRepair');
const CompletedFRN = require('../models/CompletedFRN');

function parseCSVLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur.trim());
  return result;
}

function parseCSV(content) {
  const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (!lines.length) return [];
  const headers = parseCSVLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCSVLine(lines[i]);
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = vals[idx] || '';
    });
    rows.push(obj);
  }
  return rows;
}

async function runImport() {
  const desktopFile = 'C:\\Users\\raamp\\OneDrive\\Desktop\\all-services-2026-07-30 (3).csv';
  if (!fs.existsSync(desktopFile)) {
    console.error('File not found:', desktopFile);
    process.exit(1);
  }

  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('MONGO_URI missing');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB Atlas...');

  // Clear previous temporary service imports to avoid duplicates
  await Service.deleteMany({});
  await UnderRepair.deleteMany({});
  await CompletedFRN.deleteMany({});
  await EmpFRN.deleteMany({});

  const content = fs.readFileSync(desktopFile, 'utf-8');
  const rows = parseCSV(content);
  console.log(`Parsed ${rows.length} rows from Desktop CSV...`);

  const servicesBatch = [];
  const validEnums = [
    'Repaired','Unit Returned','External Repair','Scrapped',
    'Upgrade','Under Repair','Completed','Given to PSP',
    'RE-Export','Returned as it is','No Fault','OB Pending'
  ];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const customerName = r['CUST_NAME'] || r['CUSTOMER'] || 'Unknown Customer';
    
    let typeVal = r['TYPE_OF_WORK'] || r['TYPE'] || 'Repaired';
    if (!validEnums.includes(typeVal)) {
      if (typeVal.toLowerCase().includes('under repair')) typeVal = 'Under Repair';
      else if (typeVal.toLowerCase().includes('scrap')) typeVal = 'Scrapped';
      else typeVal = 'Repaired';
    }

    const scRefNo = r['SC_REF_NO'] || ('SCR-2026-' + (1000 + i));

    servicesBatch.push({
      serviceId: 'SVC-2026-' + String(i + 100).padStart(4, '0'),
      scReNo: scRefNo,
      scEng: r['SC_ENGINEER'] || '',
      frnNo: r['FRN_NO'] || ('FRN-' + (8000 + i)),
      frnDate: r['FRN_DATE'] || '',
      serComm: r['SER_COMM_INWARD_DATE'] || '',
      rcvdDate: r['SER_CENTRE_RECEIVED_DATE'] || r['ENTRY DATE'] || '',
      entryDate: r['ENTRY DATE'] || '',
      stkCust: r['STK_CUST'] || '',
      reg: r['REGION'] || '',
      branch: r['BRANCH'] || '',
      eng: r['ENGINEER'] || '',
      dealer: r['DEALER_NAME'] || '',
      custName: customerName,
      customer: customerName,
      supplier: r['SUPPLIER_NAME'] || '',
      model: r['PRODUCT_MODEL'] || '',
      unitSl: r['UNIT_SLNO'] || '',
      unitSts: r['UNIT_STATUS'] || '',
      doi: r['DOD'] || '',
      defMod: r['DEF_MOD_BRD_NAME'] || '',
      partNo: r['Part no'] || '',
      defPartSno: r['DEF_PART_SN'] || '',
      defType: r['DEF_TYPE'] || '',
      typeAcc: r['TYPE_OF_ACC'] || '',
      defGir: r['DEF_GIR_NO'] || '',
      repType: r['REP_TYPE'] || '',
      repGirNo: r['REP_GIR_NO'] || '',
      bscon: r['BSCON'] || '',
      fieldRemarks: r['FIELD_REMARKS'] || '',
      techRemarks: r['TECHNICAL_REMARKS'] || '',
      components: r['COMPONENTS_USEDFOR_REPAIR'] || '',
      repairedDate: r['REPAIRED_BRD_STK_DATE'] || '',
      finalRemarks: r['FINAL_REMARKS'] || '',
      typeWork: r['TYPE_OF_WORK'] || '',
      shipSc: r['SHIP_DATE_FROM_SERVICE_CENTRE'] || '',
      commWarrDetails: r['Comm Warr details'] || '',
      type: typeVal,
      status: typeVal === 'Under Repair' ? 'in_progress' : (typeVal === 'Completed' || typeVal === 'Repaired' ? 'completed' : 'pending'),
    });
  }

  console.log(`Inserting ${servicesBatch.length} Service records in bulk...`);
  const insertedServices = await Service.insertMany(servicesBatch);
  console.log(`✅ Bulk inserted ${insertedServices.length} Service documents into Atlas!`);

  // Build secondary collections in bulk
  const urBatch = [];
  const cfrnBatch = [];
  const efrnBatch = [];

  insertedServices.forEach(svc => {
    if (svc.type === 'Under Repair') {
      urBatch.push({
        serviceId: svc._id,
        scRno: svc.scReNo || 'SCR-NA',
        frnNo: svc.frnNo || 'FRN-NA',
        region: svc.reg || 'General',
        eng: svc.eng || 'Engineer',
        engineer: svc.eng || 'Engineer',
        customer: svc.customer,
        custName: svc.custName,
        model: svc.model || 'N/A',
        unitStatus: svc.unitSts || 'N/A',
        partNo: svc.partNo || 'N/A',
        defMod: svc.defMod || 'N/A',
        entryDate: svc.entryDate || '2026-07-30',
        status: 'UNDER REPAIR',
        typeWork: 'UNDER REPAIR',
      });
    } else if (svc.type === 'Repaired' || svc.type === 'Completed') {
      cfrnBatch.push({
        entryDate: svc.entryDate || '2026-07-30',
        scRno: svc.scReNo || 'SCR-NA',
        scEng: svc.scEng || 'Service Engineer',
        frnNo: svc.frnNo || 'FRN-NA',
        region: svc.reg || 'General',
        eng: svc.eng || 'Engineer',
        customer: svc.customer,
        model: svc.model || 'N/A',
        unitStatus: svc.unitSts || 'N/A',
        partNo: svc.partNo || 'N/A',
        defMod: svc.defMod || 'N/A',
        defGir: svc.defGir || '-',
        raEng: svc.raEng || svc.eng || 'Engineer',
        typeWork: svc.typeWork || 'Repaired',
        closedBy: 'Desktop Import',
        closedAt: new Date(),
      });
    } else {
      efrnBatch.push({
        serviceId: svc._id,
        scRno: svc.scReNo || 'SCR-NA',
        frnNo: svc.frnNo || 'FRN-NA',
        region: svc.reg || 'General',
        eng: svc.eng || 'Engineer',
        customer: svc.customer,
        custName: svc.custName,
        model: svc.model || 'N/A',
        unitStatus: svc.unitSts || 'N/A',
        partNo: svc.partNo || 'N/A',
        defMod: svc.defMod || 'N/A',
        entryDate: svc.entryDate || '2026-07-30',
        status: 'pending',
      });
    }
  });

  if (urBatch.length) await UnderRepair.insertMany(urBatch);
  if (cfrnBatch.length) await CompletedFRN.insertMany(cfrnBatch);
  if (efrnBatch.length) await EmpFRN.insertMany(efrnBatch);

  console.log(`\n🎉 DESKTOP CSV IMPORT SUCCESSFUL!`);
  console.log(`  - Services: ${insertedServices.length}`);
  console.log(`  - Pending FRNs: ${efrnBatch.length}`);
  console.log(`  - Under Repair: ${urBatch.length}`);
  console.log(`  - Completed FRNs: ${cfrnBatch.length}`);
  process.exit(0);
}

runImport().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});
