const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: 'c:/Users/raamp/OneDrive/Desktop/shcl/backend/.env' });

async function run() {
  const uri = process.env.MONGO_URI;
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const empHashed = await bcrypt.hash('emp123', 10);

  const resEmp = await db.collection('employees').updateMany(
    {},
    { $set: { password: empHashed, isActive: true } }
  );
  console.log(`✅ Updated ${resEmp.modifiedCount || resEmp.matchedCount} Employees in 'employees' collection to password: emp123`);

  const resUsers = await db.collection('users').updateMany(
    {},
    { $set: { password: empHashed, isActive: true } }
  );
  console.log(`✅ Updated ${resUsers.modifiedCount || resUsers.matchedCount} Users in 'users' collection to password: emp123`);

  process.exit(0);
}

run().catch(err => {
  console.error('Update error:', err);
  process.exit(1);
});
