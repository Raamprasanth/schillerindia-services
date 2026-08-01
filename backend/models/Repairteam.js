// models/RepairTeam.js

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const repairTeamSchema = new mongoose.Schema({
  name: {
    type:     String,
    required: [true, 'Name is required'],
    trim:     true,
  },
  email: {
    type:      String,
    required:  [true, 'Email is required'],
    unique:    true,
    lowercase: true,
    trim:      true,
  },
  repairTeamId: {
    type:      String,
    required:  [true, 'Repair Team ID is required'],
    unique:    true,
    uppercase: true,
    trim:      true,
  },
  password: {
    type:      String,
    required:  [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select:    false,
  },
  department:  { type: String, default: 'Repair Centre' },
  designation: { type: String, default: 'Repair Technician' },
  // ── ADDED: division field ─────────────────────────────
  division:    { type: String, trim: true, default: '' },
  divisions:   {
    type: [String],
    default: [],
    set: (values) => Array.isArray(values)
      ? [...new Set(values.map(v => String(v || '').trim()).filter(Boolean))]
      : [],
  },
  phone:       { type: String, default: '' },
  role:        { type: String, default: 'repair' },
  isActive:    { type: Boolean, default: true },
  lastLogin:   { type: Date },
}, { timestamps: true });

// Hash password before save
repairTeamSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  if (typeof this.password === 'string' && (this.password.startsWith('$2a$') || this.password.startsWith('$2b$') || this.password.startsWith('$2y$'))) {
    return next();
  }
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
repairTeamSchema.methods.matchPassword = async function (entered) {
  return bcrypt.compare(entered, this.password);
};

module.exports = mongoose.model('RepairTeam', repairTeamSchema);
