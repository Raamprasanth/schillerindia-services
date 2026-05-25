/**
 * Run ONCE to create the first admin in MongoDB Atlas
 * Uses your existing Admin.js model
 * 
 * Place this file in your backend/ folder
 * Run: node seedAdmin.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('✅ Connected to MongoDB Atlas');

    // Use your exact Admin schema
    const AdminSchema = new mongoose.Schema({
      name:      { type: String, required: true, trim: true },
      email:     { type: String, required: true, unique: true, lowercase: true, trim: true },
      adminId:   { type: String, required: true, unique: true, uppercase: true, trim: true },
      password:  { type: String, required: true, select: false },
      role:      { type: String, default: 'admin', enum: ['admin', 'superadmin'] },
      isActive:  { type: Boolean, default: true },
      lastLogin: { type: Date },
    }, { timestamps: true });

    // Use existing model if already registered (avoids OverwriteModelError)
    const Admin = mongoose.models.Admin || mongoose.model('Admin', AdminSchema);

    const email = 'admin@schillerindia.com';
    const exists = await Admin.findOne({ email });

    if (exists) {
      console.log('ℹ️  Admin already exists:', email);
      console.log('   Try logging in at: http://localhost:5000/login.html');
      process.exit(0);
    }

    const hashed = await bcrypt.hash('admin123', 10);
    await Admin.create({
      name:     'Schiller Admin',
      email,
      adminId:  'ADMIN001',
      password: hashed,
      role:     'admin',
      isActive: true,
    });

    console.log('');
    console.log('🎉 Admin created successfully!');
    console.log('─────────────────────────────────');
    console.log('  Email   : admin@schillerindia.com');
    console.log('  Password: admin123');
    console.log('  Admin ID: ADMIN001');
    console.log('─────────────────────────────────');
    console.log('');
    console.log('👉 Go to: http://localhost:5000/login.html');
    console.log('   Log in, then go to User Management.');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ MongoDB Error:', err.message);
    process.exit(1);
  });