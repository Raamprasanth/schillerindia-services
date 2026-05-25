const mongoose = require('mongoose');
require('dotenv').config({ path: './backend/.env' });

async function fix() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/shcl');
  console.log('Connected to DB');

  const Service = require('./backend/models/Service');
  const Division = require('./backend/models/Division');
  const Employee = require('./backend/models/Employee');

  const servicesWithoutDivision = await Service.find({ division: { $in: [null, undefined] } });
  console.log(`Found ${servicesWithoutDivision.length} services without division.`);

  let fixed = 0;
  for (const svc of servicesWithoutDivision) {
    if (svc.submittedBy) {
      const emp = await Employee.findOne({ name: svc.submittedBy });
      if (emp && emp.division) {
        const div = await Division.findOne({ name: new RegExp('^' + emp.division + '$', 'i') });
        if (div) {
          svc.division = div._id;
          await svc.save();
          fixed++;
        }
      }
    }
  }

  console.log(`Fixed ${fixed} records.`);
  process.exit(0);
}

fix().catch(console.error);
