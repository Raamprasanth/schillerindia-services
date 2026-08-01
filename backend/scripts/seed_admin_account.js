const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: 'c:/Users/raamp/OneDrive/Desktop/shcl/backend/.env' });

async function seedAdmin() {
  const uri = process.env.MONGO_URI;
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const hashed = await bcrypt.hash('admin123', 10);
  
  await db.collection('admins').updateOne(
    { adminId: 'ADMIN001' },
    {
      $set: {
        name: 'Schiller Admin',
        email: 'admin@schillerindia.com',
        adminId: 'ADMIN001',
        password: hashed,
        role: 'admin',
        isActive: true
      }
    },
    { upsert: true }
  );

  console.log('✅ Created/Updated Admin Account (ADMIN001 / admin123)');
  process.exit(0);
}

seedAdmin().catch(err => {
  console.error('Seed Admin error:', err);
  process.exit(1);
});
