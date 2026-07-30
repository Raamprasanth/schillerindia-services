require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const CompletedFRN = require('../models/CompletedFRN');

const sampleCompletedFRNs = [
  {
    entryDate: '2026-07-20',
    scRno: 'SCR-2026-101',
    scEng: 'Rajesh Sharma',
    frnNo: 'FRN-8801',
    region: 'North',
    eng: 'Vikram Singh',
    customer: 'Max Super Speciality Hospital',
    model: 'Cardiovit AT-102 G2',
    unitStatus: 'IW',
    partNo: 'P-50021',
    defMod: 'Main Processing Board',
    defGir: 'GIR-9001',
    raEng: 'Suresh Kumar',
    typeWork: 'Repaired',
    pdays: 4,
    closedBy: 'Schiller Admin',
    closedAt: new Date('2026-07-24')
  },
  {
    entryDate: '2026-07-22',
    scRno: 'SCR-2026-102',
    scEng: 'Anil Verma',
    frnNo: 'FRN-8802',
    region: 'South',
    eng: 'Ramesh Babu',
    customer: 'Apollo Multispeciality Hospital',
    model: 'DEFIGARD Touch 7',
    unitStatus: 'CAMC',
    partNo: 'P-50022',
    defMod: 'Touch Display Assembly',
    defGir: 'GIR-9002',
    raEng: 'Praveen Nair',
    typeWork: 'Repaired',
    pdays: 3,
    closedBy: 'Schiller Admin',
    closedAt: new Date('2026-07-25')
  },
  {
    entryDate: '2026-07-25',
    scRno: 'SCR-2026-103',
    scEng: 'Pooja Hegde',
    frnNo: 'FRN-8803',
    region: 'West',
    eng: 'Amit Joshi',
    customer: 'Kokilaben Dhirubhai Ambani Hospital',
    model: 'FRED PA-1 Defibrillator',
    unitStatus: 'OW',
    partNo: 'P-50023',
    defMod: 'Power Supply Board',
    defGir: 'GIR-9003',
    raEng: 'Sunil Patil',
    typeWork: 'Scrapped',
    pdays: 5,
    closedBy: 'Schiller Admin',
    closedAt: new Date('2026-07-30')
  }
];

async function seedCompletedFRNs() {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('MONGO_URI missing in .env');
      process.exit(1);
    }
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.');

    const count = await CompletedFRN.countDocuments();
    if (count === 0) {
      console.log('Seeding demo records into CompletedFRN collection...');
      await CompletedFRN.insertMany(sampleCompletedFRNs);
      console.log('✅ Successfully seeded 3 Completed FRN records with Engineer and Part No details!');
    } else {
      console.log(`CompletedFRN collection already contains ${count} records.`);
    }
  } catch (err) {
    console.error('Seeding error:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seedCompletedFRNs();
