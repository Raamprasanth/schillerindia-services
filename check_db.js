const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/schillerindia', { useNewUrlParser: true, useUnifiedTopology: true })
.then(async () => {
  const User = require('./backend/models/User');
  const Employee = require('./backend/models/Employee');
  console.log('User count:', await User.countDocuments());
  console.log('Employee count:', await Employee.countDocuments());
  console.log('Active Employees:', await Employee.countDocuments({ isActive: { $ne: false } }));
  process.exit(0);
}).catch(console.error);
