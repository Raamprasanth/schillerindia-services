require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Scrap = require('../models/Scrap');
const Csw = require('../models/Csw');
const Service = require('../models/Service');
const EmpFRN = require('../models/EmpFRN');
const EstimationPending = require('../models/EstimationPending');
const UnderRepair = require('../models/UnderRepair');
const Division = require('../models/Division');

async function runBackfill() {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/schillerindia';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.');

    // 1. Backfill Scrap records
    const scraps = await Scrap.find({ $or: [{ division: '' }, { division: null }, { division: { $exists: false } }] });
    console.log(`Found ${scraps.length} Scrap records with missing division.`);

    let scrapUpdatedCount = 0;
    for (const scrap of scraps) {
      let divName = '';
      if (scrap.serviceId) {
        const svc = await Service.findById(scrap.serviceId).populate('division').lean();
        if (svc) {
          if (svc.division) {
            divName = typeof svc.division === 'object' ? (svc.division.name || svc.division.displayName) : svc.division;
          }
          if (!divName) divName = svc.divisionName || '';
        }
      }
      if (!divName && scrap.frnNo) {
        const frn = await EmpFRN.findOne({ frnNo: scrap.frnNo }).lean();
        if (frn) divName = frn.division || frn.divisionName || '';
      }
      if (!divName && scrap.frnNo) {
        const est = await EstimationPending.findOne({ frnNo: scrap.frnNo }).lean();
        if (est) divName = est.division || est.divisionName || '';
      }
      if (!divName && scrap.frnNo) {
        const ur = await UnderRepair.findOne({ frnNo: scrap.frnNo }).lean();
        if (ur) divName = ur.division || ur.divisionName || '';
      }

      if (divName) {
        await Scrap.updateOne({ _id: scrap._id }, { $set: { division: divName.trim() } });
        scrapUpdatedCount++;
      }
    }
    console.log(`Updated ${scrapUpdatedCount}/${scraps.length} Scrap records with division.`);

    // 2. Backfill CSW records
    const csws = await Csw.find({ $or: [{ division: '' }, { division: null }, { division: { $exists: false } }] });
    console.log(`Found ${csws.length} CSW records with missing division.`);

    let cswUpdatedCount = 0;
    for (const csw of csws) {
      let divName = '';
      if (csw.serviceId) {
        const svc = await Service.findById(csw.serviceId).populate('division').lean();
        if (svc) {
          if (svc.division) {
            divName = typeof svc.division === 'object' ? (svc.division.name || svc.division.displayName) : svc.division;
          }
          if (!divName) divName = svc.divisionName || '';
        }
      }
      if (divName) {
        await Csw.updateOne({ _id: csw._id }, { $set: { division: divName.trim() } });
        cswUpdatedCount++;
      }
    }
    console.log(`Updated ${cswUpdatedCount}/${csws.length} CSW records with division.`);

  } catch (err) {
    console.error('Backfill error:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('Done.');
    process.exit(0);
  }
}

runBackfill();
