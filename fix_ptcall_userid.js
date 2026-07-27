const mongoose = require('mongoose');
require('dotenv').config({ path: './backend/.env' });

const PtCallRegister = require('./backend/models/PtCallRegister');
const User = require('./backend/models/User');

async function run() {
  await mongoose.connect('mongodb+srv://supportqvs_db_user:fx58tCqbju9YSyB9@cluster1.qshoy0k.mongodb.net/iqc?appName=Cluster1');
  console.log('Connected to DB');

  const calls = await PtCallRegister.find({ $or: [{ userId: { $exists: false } }, { userId: null }] });
  console.log(`Found ${calls.length} PT call records with missing userId.`);

  let updated = 0;
  for (const call of calls) {
    if (call.submittedBy) {
      const user = await User.findOne({ name: new RegExp('^' + call.submittedBy + '$', 'i') });
      if (user) {
        await PtCallRegister.updateOne(
          { _id: call._id },
          { $set: { userId: user._id, createdBy: user._id } }
        );
        updated++;
      }
    }
  }
  console.log(`Updated ${updated} PT call records with userId.`);
  process.exit(0);
}

run().catch(console.error);
