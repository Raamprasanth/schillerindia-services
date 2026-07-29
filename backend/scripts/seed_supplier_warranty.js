require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Scrap = require('../models/Scrap');

const sampleRecords = [
  {
    entryDate: '2026-07-28',
    scRno: 'SC-2026-001',
    scEng: 'Schiller Engineer',
    frnNo: 'FRN-9821',
    region: 'North',
    engineer: 'Rajesh Kumar',
    customer: 'Apollo Hospital',
    supplier: 'Schiller AG Switzerland',
    division: 'Medical Devices',
    srrRmaBltNo: 'RMA-45120',
    warrReportedDate: '2026-07-20',
    warrApprovedStatus: 'Yes',
    warrApprovedDate: '2026-07-22',
    defGir: 'GIR-8812',
    model: 'Cardiovit FT-1',
    unitSerialNo: 'FT1-99281',
    partNo: 'P-10029',
    description: 'ECG Main Board Defect',
    defPartSn: 'SN-BOARD-001',
    licenceVersion: 'v4.2.1',
    warrType: 'OW',
    supplierWarrStatus: 'IW',
    defInvoiceNoSupplier: 'INV-SUP-9012',
    shipDateFromSc: '2026-07-25',
    dcInvoiceNo: 'DC-8812',
    dcInvoiceDate: '2026-07-25',
    awbNo: 'AWB-771209',
    awbDate: '2026-07-26',
    repRepaired: 'Repaired and return',
    replacementReceivedStatus: 'received',
    replacementReceivedDate: '2026-07-28',
    billed: 'Yes',
    billedAmount: '15000',
    dateOfInstallation: '2025-01-15',
    doi: '2025-01-15',
    dateOfFailure: '2026-07-18',
    replacedSpareBySupp: 'Main Processing PCB',
    typeWork: 'RE-EXPORT',
    typeWorkSupplier: 'Re-Export Replacement',
    jobSheetStatus: 'Completed',
    jobSheetUpdated: true,
    jobSheetRows: [
      { repairDate: '2026-07-28', engineerName: 'Rajesh Kumar', observation: 'PCB replaced by supplier', repairActivity: 'Installed new PCB & calibrated ECG signals', timeSpent: '2 hrs', remark: 'Unit tested OK' },
      { repairDate: '', engineerName: '', observation: '', repairActivity: '', timeSpent: '', remark: '' },
      { repairDate: '', engineerName: '', observation: '', repairActivity: '', timeSpent: '', remark: '' },
      { repairDate: '', engineerName: '', observation: '', repairActivity: '', timeSpent: '', remark: '' },
      { repairDate: '', engineerName: '', observation: '', repairActivity: '', timeSpent: '', remark: '' }
    ]
  },
  {
    entryDate: '2026-07-29',
    scRno: 'SC-2026-002',
    scEng: 'Anil Mehta',
    frnNo: 'FRN-9822',
    region: 'South',
    engineer: 'Suresh Raina',
    customer: 'Fortis Healthcare',
    supplier: 'Schiller Medtech',
    division: 'Cardiology',
    srrRmaBltNo: 'RMA-45121',
    warrReportedDate: '2026-07-21',
    warrApprovedStatus: 'Yes',
    warrApprovedDate: '2026-07-23',
    defGir: 'GIR-8813',
    model: 'DEFIGARD Touch7',
    unitSerialNo: 'DT7-88319',
    partNo: 'P-10030',
    description: 'Display Panel Flicker & Touch Unresponsive',
    defPartSn: 'SN-DISP-002',
    licenceVersion: 'v3.1.0',
    warrType: 'CAMC',
    supplierWarrStatus: 'IW',
    defInvoiceNoSupplier: 'INV-SUP-9013',
    shipDateFromSc: '2026-07-26',
    dcInvoiceNo: 'DC-8813',
    dcInvoiceDate: '2026-07-26',
    awbNo: 'AWB-771210',
    awbDate: '2026-07-27',
    repRepaired: 'Replacement received',
    replacementReceivedStatus: 'pending from Re-Export',
    replacementReceivedDate: '',
    billed: 'No',
    billedAmount: '0',
    dateOfInstallation: '2024-05-10',
    doi: '2024-05-10',
    dateOfFailure: '2026-07-19',
    replacedSpareBySupp: 'Touch Display Module',
    typeWork: 'RE-EXPORT',
    typeWorkSupplier: 'Re-Export Warranty',
    jobSheetStatus: 'Pending',
    jobSheetUpdated: false,
    jobSheetRows: [
      { repairDate: '', engineerName: '', observation: '', repairActivity: '', timeSpent: '', remark: '' },
      { repairDate: '', engineerName: '', observation: '', repairActivity: '', timeSpent: '', remark: '' },
      { repairDate: '', engineerName: '', observation: '', repairActivity: '', timeSpent: '', remark: '' },
      { repairDate: '', engineerName: '', observation: '', repairActivity: '', timeSpent: '', remark: '' },
      { repairDate: '', engineerName: '', observation: '', repairActivity: '', timeSpent: '', remark: '' }
    ]
  }
];

async function seed() {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('MONGO_URI missing in .env');
      process.exit(1);
    }
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.');

    const count = await Scrap.countDocuments();
    if (count === 0) {
      console.log('Seeding demo records into Scrap collection...');
      await Scrap.insertMany(sampleRecords);
      console.log('✅ Successfully seeded 2 demo Supplier Warranty (Re-Export) records!');
    } else {
      console.log(`Scrap collection already contains ${count} records.`);
    }
  } catch (err) {
    console.error('Seeding error:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seed();
