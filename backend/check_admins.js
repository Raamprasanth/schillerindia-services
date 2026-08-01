require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const Admin = require('./models/Admin');

  // List all admins (without password)
  const admins = await Admin.find({}).select('+password');
  console.log('\n=== ADMINS IN DATABASE ===');
  console.log('Count:', admins.length);
  admins.forEach(a => {
    console.log(`  Name: ${a.name}`);
    console.log(`  Email: ${a.email}`);
    console.log(`  AdminId: ${a.adminId}`);
    console.log(`  Role: ${a.role}`);
    console.log(`  isActive: ${a.isActive}`);
    console.log(`  HasPassword: ${!!a.password}`);
    console.log('  ---');
  });

  // Also list all Users (SC/FQC/PT roles)
  const User = require('./models/User');
  const users = await User.find({});
  console.log('\n=== USERS IN DATABASE ===');
  console.log('Count:', users.length);
  users.slice(0, 5).forEach(u => {
    console.log(`  Name: ${u.name}, Email: ${u.email}, Role: ${u.role}, Active: ${u.isActive}`);
  });

  process.exit(0);
}).catch(err => {
  console.error('DB Error:', err.message);
  process.exit(1);
});
