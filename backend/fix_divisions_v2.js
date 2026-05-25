const mongoose = require('mongoose');
require('dotenv').config();

async function fix() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to DB');

  const Service = require('./models/Service');
  const Division = require('./models/Division');
  const Employee = require('./models/Employee');

  const servicesWithoutDivision = await Service.find({ division: null });
  console.log('Found ' + servicesWithoutDivision.length + ' services without division.');

  let fixed = 0;
  for (const svc of servicesWithoutDivision) {
    const candidateNames = [
      svc.submittedBy,
      svc.scEng,
      svc.eng,
    ].filter(Boolean);

    for (const candidate of candidateNames) {
      const escaped = String(candidate).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const emp = await Employee.findOne({ name: new RegExp('^' + escaped + '$', 'i') });
      if (!emp || !emp.division) continue;

      const div = await Division.findOne({ name: new RegExp('^' + emp.division + '$', 'i') });
      if (!div) continue;

      await Service.updateOne({ _id: svc._id }, { $set: { division: div._id } });
      fixed++;
      break;
    }
  }

  console.log('Fixed ' + fixed + ' records.');
  process.exit(0);
}

fix().catch(console.error);
