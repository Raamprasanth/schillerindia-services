const mongoose = require('mongoose');
require('dotenv').config({ path: './backend/.env' });

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/shcl').then(async () => {
  const TourSummary = require('./backend/models/TourSummary');
  const Employee = require('./backend/models/Employee');
  const User = require('./backend/models/User');

  try {
    const kaviEmps = await Employee.find({ name: /kaviyarasan/i }).lean();
    console.log('Found Kaviyarasan in Employees:', kaviEmps.map(e => ({ id: e._id, name: e.name, division: e.division, divisions: e.divisions })));
    
    const kaviUsers = await User.find({ name: /kaviyarasan/i }).lean();
    console.log('Found Kaviyarasan in Users:', kaviUsers.map(e => ({ id: e._id, name: e.name, division: e.division, divisions: e.divisions })));
    
    const kaviTours = await TourSummary.find({ createdBy: /kaviyarasan/i }).lean();
    console.log('Tours found by Kaviyarasan:', kaviTours.length);
    if(kaviTours.length > 0) {
       console.log('First 2 tours by Kaviyarasan:', kaviTours.slice(0, 2).map(t => ({ id: t._id, createdBy: t.createdBy, createdByDivision: t.createdByDivision, createdByDivisionKey: t.createdByDivisionKey })));
    }
  } catch(e) {
    console.error('DB Error:', e);
  }
  process.exit();
}).catch(e => console.log('Conn Error:', e));
