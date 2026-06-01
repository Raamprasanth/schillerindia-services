const mongoose = require('mongoose');
const Ctodr = require('./backend/models/Ctodr');
const Todr = require('./backend/models/Todr');
const Empfrn = require('./backend/models/Empfrn');
require('dotenv').config({ path: './backend/.env' });

async function fixModels() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to DB');

  let updatedCtodr = 0;
  const ctodrs = await Ctodr.find({});
  for (const c of ctodrs) {
    if (c.sourceId) {
      const emp = await Empfrn.findById(c.sourceId);
      if (emp && emp.defMod && c.model !== emp.defMod) {
        c.model = emp.defMod;
        await c.save();
        updatedCtodr++;
      }
    }
  }
  console.log(`Updated ${updatedCtodr} Ctodr records.`);

  let updatedTodr = 0;
  const todrs = await Todr.find({});
  for (const t of todrs) {
    if (t.sourceId) {
      const emp = await Empfrn.findById(t.sourceId);
      if (emp && emp.defMod && t.model !== emp.defMod) {
        t.model = emp.defMod;
        await t.save();
        updatedTodr++;
      }
    }
  }
  console.log(`Updated ${updatedTodr} Todr records.`);

  process.exit(0);
}

fixModels().catch(console.error);
