require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Scrap = require('../models/Scrap');
const Division = require('../models/Division');
const User = require('../models/User');

async function testQuery() {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/schillerindia';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.');

    // 1. Total records in Scrap
    const totalDocs = await Scrap.find().lean();
    console.log(`Total Scrap documents in DB: ${totalDocs.length}`);
    if (totalDocs.length > 0) {
      console.log('Scrap docs summary:');
      totalDocs.forEach((d, i) => {
        console.log(`[${i+1}] ID: ${d._id}, FRN: "${d.frnNo}", Cust: "${d.customer}", Model: "${d.model}", Div: "${d.division}", TypeWork: "${d.typeWork}", EntryDate: "${d.entryDate}", scEng: "${d.scEng}"`);
      });
    }

    // 2. Test Admin role query
    const adminDocs = await Scrap.find({}).sort({ entryDate: -1, createdAt: -1 }).lean();
    console.log(`\nAdmin query result count: ${adminDocs.length}`);

    // 3. Test non-admin user query
    const sampleUser = await User.findOne({ role: { $nin: ['admin', 'superadmin'] } }).lean();
    if (sampleUser) {
      console.log(`\nTesting query for Employee user: "${sampleUser.name}", Division: "${sampleUser.division}"`);
      // Simulate scrapRoutes.js query logic
      const divDoc = await Division.findOne({ $or: [{ name: sampleUser.division }, { displayName: sampleUser.division }] }).lean();
      const empName = String(sampleUser.name || '').trim();
      const ownerOr = [];
      if (empName) {
        ownerOr.push({ scEng: empName });
        ownerOr.push({ engineer: empName });
        ownerOr.push({ addedBy: empName });
      }

      const query = {};
      if (divDoc) {
        const divisionRegex = new RegExp('^' + String(divDoc.name).replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&') + '$', 'i');
        const divClause = {
          $or: [
            { division: divisionRegex },
            { division: { $exists: false } },
            { division: '' }
          ]
        };
        query.$and = [
          divClause,
          ownerOr.length ? { $or: [ { division: divisionRegex }, ...ownerOr ] } : {}
        ];
      } else if (ownerOr.length > 0) {
        query.$or = ownerOr;
      }
      console.log('Employee query filter:', JSON.stringify(query));
      const empDocs = await Scrap.find(query).sort({ entryDate: -1, createdAt: -1 }).lean();
      console.log(`Employee query result count: ${empDocs.length}`);
    } else {
      console.log('\nNo non-admin user found to test employee query.');
    }

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

testQuery();
