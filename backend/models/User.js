// models/User.js
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type:     String,
      required: [true, 'Name is required'],
      trim:     true,
    },
    email: {
      type:      String,
      required:  [true, 'User Name is required'],
      unique:    true,
      lowercase: true,
      trim:      true,
    },
    password: {
      type:      String,
      required:  [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
    },
    role: {
      type:    String,
      enum:    ['admin', 'employee', 'service_coordinator', 'fqc', 'pt'],
      default: 'employee',
    },

    userId: {
      type:    String,
      trim:    true,
      default: '',
    },

    // ── FIX: was ObjectId ref to 'Division' — changed to plain String ──
    // The frontend sends string values like "VENTILATOR", "ECG" etc.
    // Storing as ObjectId caused saves to silently fail / store null.
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
      type:    String,
      default: '',
      trim:    true,
    },
    isActive: {
      type:    Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// ── Hash password before saving ───────────────────────────
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  if (typeof this.password === 'string' && (this.password.startsWith('$2a$') || this.password.startsWith('$2b$') || this.password.startsWith('$2y$'))) {
    return next();
  }
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// ── Hash password on findOneAndUpdate ─────────────────────
userSchema.pre('findOneAndUpdate', async function (next) {
  const update = this.getUpdate();
  if (update.password) {
    update.password = await bcrypt.hash(update.password, 10);
    this.setUpdate(update);
  }
  next();
});

// ── Compare entered password with hashed password ─────────
userSchema.methods.matchPassword = function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
