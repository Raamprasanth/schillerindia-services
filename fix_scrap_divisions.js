const mongoose = require('mongoose');
const Scrap = require('./backend/models/Scrap');
const Service = require('./backend/models/Service');
const Division = require('./backend/models/Division');

async function fixScrapDivisions() {
  try {
    await mongoose.connect('mongodb://localhost:27017/shcl'); // Adjust DB URI if needed
    console.log('Connected to MongoDB');

    const scraps = await Scrap.find({ division: { $in: ['', null] }, serviceId: { $ne: null } });
    console.log(`Found ${scraps.length} scrap records with missing division.`);

    for (const scrap of scraps) {
      const svc = await Service.findById(scrap.serviceId).populate('division').lean();
      if (svc && svc.division) {
        const divisionName = typeof svc.division === 'object' ? svc.division.name : '';
        if (divisionName) {
          await Scrap.findByIdAndUpdate(scrap._id, { division: divisionName });
          console.log(`Updated Scrap ${scrap._id} with division: ${divisionName}`);
        }
      }
    }

    console.log('Finished fixing scrap records.');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

fixScrapDivisions();
