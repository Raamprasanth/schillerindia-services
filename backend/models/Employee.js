// models/Employee.js

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const EmployeeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'User Name is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    employeeId: {
      type: String,
      required: [true, 'Employee ID is required'],
      unique: true,
      uppercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    department: {
      type: String,
      trim: true,
      default: 'General',
    },
    designation: {
      type: String,
      trim: true,
      default: 'Staff',
    },
    // ── ADDED: division field ─────────────────────────────
    division: {
      type:    String,
      trim:    true,
      default: '',
    },
    divisions: {
      type:    [String],
      default: [],
      set:     (values) => Array.isArray(values)
        ? [...new Set(values.map(v => String(v || '').trim()).filter(Boolean))]
        : [],
    },
    phone: {
      type: String,
      trim: true,
    },
    role: {
      type: String,
      default: 'employee',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
    },
  },
  { timestamps: true }
);

// ── Hash password before saving ──
EmployeeSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  if (typeof this.password === 'string' && (this.password.startsWith('$2a$') || this.password.startsWith('$2b$') || this.password.startsWith('$2y$'))) {
    return next();
  }
  const salt    = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// ── Method to compare passwords ──
EmployeeSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('Employee', EmployeeSchema);
