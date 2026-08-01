// routes/authRoutes.js
// ══════════════════════════════════════════════════════════
//  SECURITY RULE:
//  - NO public registration allowed
//  - Only the first admin is created via seed.js
//  - Only a logged-in admin can add more admins, employees, or repair team members
//  - Everyone else gets BLOCKED
// ══════════════════════════════════════════════════════════

const express     = require('express');
const jwt         = require('jsonwebtoken');
const Admin       = require('../models/Admin');
const Employee    = require('../models/Employee');
const RepairTeam  = require('../models/Repairteam');
const User        = require('../models/User');
const { protect, adminOnly } = require('../middleware/authMiddleware');

const router = express.Router();

function normalizeDivisions(input, fallback = '') {
  const values = Array.isArray(input) ? input : (input ? [input] : []);
  if (fallback) values.push(fallback);
  return [...new Set(values.map(v => String(v || '').trim()).filter(Boolean))];
}

function primaryDivision(input, fallback = '') {
  return normalizeDivisions(input, fallback)[0] || '';
}

// ── Helper: Generate JWT Token ────────────────────────────
const generateToken = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

// ── Helper: safe response shapes (no password leaks) ──────
const safeAdmin = (a) => ({
  id:        a._id,
  name:      a.name,
  email:     a.email,
  adminId:   a.adminId,
  role:      a.role,
  isActive:  a.isActive,
  lastLogin: a.lastLogin,
});

// ── FIX 1: added division to safeEmployee response ────────
const safeEmployee = (e) => ({
  id:          e._id,
  name:        e.name,
  email:       e.email,
  employeeId:  e.employeeId,
  department:  e.department,
  designation: e.designation,
  division:    primaryDivision(e.divisions, e.division),
  divisions:   normalizeDivisions(e.divisions, e.division),
  assignedDivisions: normalizeDivisions(e.divisions, e.division),
  role:        e.role,
  isActive:    e.isActive,
  lastLogin:   e.lastLogin,
});

// ── FIX 2: added division to safeRepair response ──────────
const safeRepair = (r) => ({
  id:           r._id,
  name:         r.name,
  email:        r.email,
  repairTeamId: r.repairTeamId,
  department:   r.department,
  designation:  r.designation,
  division:     primaryDivision(r.divisions, r.division),
  divisions:    normalizeDivisions(r.divisions, r.division),
  assignedDivisions: normalizeDivisions(r.divisions, r.division),
  role:         r.role,
  isActive:     r.isActive,
  lastLogin:    r.lastLogin,
});

const safeServiceCoordinator = (u) => ({
  id:        u._id,
  name:      u.name,
  email:     u.email,
  userId:    u.userId || '',
  division:  primaryDivision(u.divisions, u.division),
  divisions: normalizeDivisions(u.divisions, u.division),
  assignedDivisions: normalizeDivisions(u.divisions, u.division),
  phone:     u.phone || '',
  role:      u.role,
  isActive:  u.isActive,
  lastLogin: u.lastLogin,
});

const safeFqc = (u) => ({
  id:        u._id,
  name:      u.name,
  email:     u.email,
  userId:    u.userId || '',
  division:  primaryDivision(u.divisions, u.division),
  divisions: normalizeDivisions(u.divisions, u.division),
  assignedDivisions: normalizeDivisions(u.divisions, u.division),
  phone:     u.phone || '',
  role:      u.role,
  isActive:  u.isActive,
  lastLogin: u.lastLogin,
});

const safePt = (u) => ({
  id:        u._id,
  name:      u.name,
  email:     u.email,
  userId:    u.userId || '',
  division:  primaryDivision(u.divisions, u.division),
  divisions: normalizeDivisions(u.divisions, u.division),
  assignedDivisions: normalizeDivisions(u.divisions, u.division),
  phone:     u.phone || '',
  role:      u.role,
  isActive:  u.isActive,
  lastLogin: u.lastLogin,
});


// ════════════════════════════════════════════════════════
//  BLOCK ALL PUBLIC SELF-REGISTRATION
// ════════════════════════════════════════════════════════
router.post('/register', (req, res) => {
  return res.status(403).json({
    success: false,
    message: 'Self-registration is not allowed. Contact your administrator.',
  });
});


// ── Helper: find user across collections by name, email, or ID (case-insensitive) ──
async function findUserByIdentifier(identifier, primaryRole) {
  const cleanId = String(identifier || '').trim();
  if (!cleanId) return null;
  const escaped = cleanId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex   = new RegExp(`^${escaped}$`, 'i');

  const configs = [
    { model: Admin,       idField: 'adminId',      safeFn: safeAdmin,              type: 'admin' },
    { model: Employee,    idField: 'employeeId',   safeFn: safeEmployee,           type: 'employee' },
    { model: RepairTeam,  idField: 'repairTeamId', safeFn: safeRepair,             type: 'repair' },
    { model: User,        idField: 'userId',       safeFn: safeServiceCoordinator, type: 'user' },
  ];

  // Sort configs so the model corresponding to primaryRole is queried first
  configs.sort((a, b) => {
    const isAPrimary = a.type === primaryRole || (['service_coordinator', 'fqc', 'pt'].includes(primaryRole) && a.type === 'user');
    const isBPrimary = b.type === primaryRole || (['service_coordinator', 'fqc', 'pt'].includes(primaryRole) && b.type === 'user');
    if (isAPrimary && !isBPrimary) return -1;
    if (!isAPrimary && isBPrimary) return 1;
    return 0;
  });

  for (const cfg of configs) {
    const query = {
      $or: [
        { email: regex },
        { [cfg.idField]: regex },
        { name: regex },
      ],
    };
    if (cfg.model === User && ['service_coordinator', 'fqc', 'pt'].includes(primaryRole)) {
      query.role = primaryRole;
    }

    const doc = await cfg.model.findOne(query).select('+password');
    if (doc) {
      let safeFn = cfg.safeFn;
      if (cfg.model === User) {
        if (doc.role === 'fqc') safeFn = safeFqc;
        else if (doc.role === 'pt') safeFn = safePt;
        else safeFn = safeServiceCoordinator;
      }
      return { doc, safeFn };
    }
  }

  // Fallback search across User collection without role restriction
  const userFallback = await User.findOne({
    $or: [{ email: regex }, { userId: regex }, { name: regex }],
  }).select('+password');

  if (userFallback) {
    let safeFn = safeServiceCoordinator;
    if (userFallback.role === 'fqc') safeFn = safeFqc;
    else if (userFallback.role === 'pt') safeFn = safePt;
    return { doc: userFallback, safeFn };
  }

  return null;
}

// ── Generic login handler ──
async function handleLogin(req, res, targetRole) {
  const { identifier, password } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({
      success: false,
      message: 'Please provide your User Name, ID, or email and password.',
    });
  }

  try {
    const found = await findUserByIdentifier(identifier, targetRole);

    if (!found) {
      return res.status(401).json({
        success: false,
        message: 'Invalid User Name, ID, or password.',
      });
    }

    const { doc, safeFn } = found;

    if (!doc.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Contact the system administrator.',
      });
    }

    const isMatch = await doc.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid User Name, ID, or password.',
      });
    }

    doc.lastLogin = new Date();
    await doc.save({ validateBeforeSave: false });

    return res.status(200).json({
      success: true,
      message: `Welcome back, ${doc.name}!`,
      data: {
        ...safeFn(doc),
        token: generateToken(doc._id, doc.role),
      },
    });

  } catch (err) {
    console.error(`Login error (${targetRole}):`, err.message);
    return res.status(500).json({ success: false, message: 'Server error. Try again later.' });
  }
}

// ════════════════════════════════════════════════════════
//  LOGIN ROUTES
// ════════════════════════════════════════════════════════
router.post('/admin/login',               (req, res) => handleLogin(req, res, 'admin'));
router.post('/employee/login',            (req, res) => handleLogin(req, res, 'employee'));
router.post('/repair/login',              (req, res) => handleLogin(req, res, 'repair'));
router.post('/service-coordinator/login', (req, res) => handleLogin(req, res, 'service_coordinator'));
router.post('/fqc/login',                  (req, res) => handleLogin(req, res, 'fqc'));


// ════════════════════════════════════════════════════════
//  ADD NEW ADMIN
// ════════════════════════════════════════════════════════
router.post('/admin/add', protect, adminOnly, async (req, res) => {
  const { name, email, adminId, password } = req.body;

  if (!name || !email || !adminId || !password) {
    return res.status(400).json({
      success: false,
      message: 'Please provide name, email, adminId, and password.',
    });
  }

  try {
    const exists = await Admin.findOne({
      $or: [
        { email:   email.toLowerCase() },
        { adminId: adminId.toUpperCase() },
      ],
    });

    if (exists) {
      return res.status(409).json({
        success: false,
        message: 'An admin with this email or ID already exists.',
      });
    }

    const admin = await Admin.create({
      name,
      email:   email.toLowerCase().trim(),
      adminId: adminId.toUpperCase().trim(),
      password,
    });

    return res.status(201).json({
      success: true,
      message: `Admin "${admin.name}" created successfully.`,
      data:    safeAdmin(admin),
    });

  } catch (err) {
    console.error('Add admin error:', err.message);
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message).join(', ');
      return res.status(400).json({ success: false, message: messages });
    }
    return res.status(500).json({ success: false, message: err.message });
  }
});


// ════════════════════════════════════════════════════════
//  ADD NEW EMPLOYEE
// ════════════════════════════════════════════════════════
router.post('/employee/add', protect, adminOnly, async (req, res) => {
  // ── FIX 3: extract division from req.body ──────────────
  const { name, email, employeeId, password, department, designation, phone, division, divisions } = req.body;

  if (!name || !email || !employeeId || !password) {
    return res.status(400).json({
      success: false,
      message: 'Please provide name, email, employeeId, and password.',
    });
  }

  try {
    const exists = await Employee.findOne({
      $or: [
        { email:      email.toLowerCase() },
        { employeeId: employeeId.toUpperCase() },
      ],
    });

    if (exists) {
      return res.status(409).json({
        success: false,
        message: 'An employee with this email or ID already exists.',
      });
    }

    const assignedDivisions = normalizeDivisions(divisions, division);
    const employee = await Employee.create({
      name,
      email:       email.toLowerCase().trim(),
      employeeId:  employeeId.toUpperCase().trim(),
      password,
      department:  department  || 'General',
      designation: designation || 'Staff',
      phone:       phone       || '',
      division:    primaryDivision(assignedDivisions, division),
      divisions:   assignedDivisions,
    });

    return res.status(201).json({
      success: true,
      message: `Employee "${employee.name}" added successfully.`,
      data:    safeEmployee(employee),
    });

  } catch (err) {
    console.error('Add employee error:', err.message);
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message).join(', ');
      return res.status(400).json({ success: false, message: messages });
    }
    return res.status(500).json({ success: false, message: err.message });
  }
});


// ════════════════════════════════════════════════════════
//  ADD NEW REPAIR TEAM MEMBER
// ════════════════════════════════════════════════════════
router.post('/repair/add', protect, adminOnly, async (req, res) => {
  // ── FIX 4: extract division from req.body ──────────────
  const { name, email, repairTeamId, password, department, designation, phone, division, divisions } = req.body;

  if (!name || !email || !repairTeamId || !password) {
    return res.status(400).json({
      success: false,
      message: 'Please provide name, email, repairTeamId, and password.',
    });
  }

  try {
    const exists = await RepairTeam.findOne({
      $or: [
        { email:        email.toLowerCase() },
        { repairTeamId: repairTeamId.toUpperCase() },
      ],
    });

    if (exists) {
      return res.status(409).json({
        success: false,
        message: 'A repair team member with this email or ID already exists.',
      });
    }

    const assignedDivisions = normalizeDivisions(divisions, division);
    const member = await RepairTeam.create({
      name,
      email:        email.toLowerCase().trim(),
      repairTeamId: repairTeamId.toUpperCase().trim(),
      password,
      department:   department  || 'Repair Centre',
      designation:  designation || 'Repair Technician',
      phone:        phone       || '',
      division:     primaryDivision(assignedDivisions, division),
      divisions:    assignedDivisions,
    });

    return res.status(201).json({
      success: true,
      message: `Repair team member "${member.name}" added successfully.`,
      data:    safeRepair(member),
    });

  } catch (err) {
    console.error('Add repair team error:', err.message);
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message).join(', ');
      return res.status(400).json({ success: false, message: messages });
    }
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/service-coordinator/add', protect, adminOnly, async (req, res) => {
  const { name, email, userId, password, phone, division, divisions } = req.body;

  if (!name || !email || !userId || !password) {
    return res.status(400).json({
      success: false,
      message: 'Please provide name, email, userId, and password.',
    });
  }

  try {
    const exists = await User.findOne({
      role: 'service_coordinator',
      $or: [
        { email:  email.toLowerCase() },
        { userId: userId.toUpperCase() },
      ],
    });

    if (exists) {
      return res.status(409).json({
        success: false,
        message: 'A service coordinator with this email or ID already exists.',
      });
    }

    const assignedDivisions = normalizeDivisions(divisions, division);
    const user = await User.create({
      name,
      email: email.toLowerCase().trim(),
      userId: userId.toUpperCase().trim(),
      password,
      phone: phone || '',
      division: primaryDivision(assignedDivisions, division),
      divisions: assignedDivisions,
      role: 'service_coordinator',
    });

    return res.status(201).json({
      success: true,
      message: `Service coordinator "${user.name}" added successfully.`,
      data: safeServiceCoordinator(user),
    });

  } catch (err) {
    console.error('Add service coordinator error:', err.message);
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message).join(', ');
      return res.status(400).json({ success: false, message: messages });
    }
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ════════════════════════════════════════════════════════
//  PT LOGIN
// ════════════════════════════════════════════════════════
router.post('/pt/login', (req, res) => handleLogin(req, res, 'pt'));

router.post('/fqc/add', protect, adminOnly, async (req, res) => {
  const { name, email, userId, password, division } = req.body;

  if (!name || !email || !userId || !password) {
    return res.status(400).json({
      success: false,
      message: 'Please provide name, email, userId, and password.',
    });
  }

  try {
    const exists = await User.findOne({
      role: 'fqc',
      $or: [
        { email:  email.toLowerCase() },
        { userId: userId.toUpperCase() },
      ],
    });

    if (exists) {
      return res.status(409).json({
        success: false,
        message: 'An FQC user with this email or ID already exists.',
      });
    }

    const user = await User.create({
      name,
      email: email.toLowerCase().trim(),
      userId: userId.toUpperCase().trim(),
      password,
      division: division || '',
      role: 'fqc',
    });

    return res.status(201).json({
      success: true,
      message: `FQC user "${user.name}" added successfully.`,
      data: safeFqc(user),
    });

  } catch (err) {
    console.error('Add FQC user error:', err.message);
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message).join(', ');
      return res.status(400).json({ success: false, message: messages });
    }
    return res.status(500).json({ success: false, message: err.message });
  }
});


// ════════════════════════════════════════════════════════
//  ADD NEW PT USER
// ════════════════════════════════════════════════════════
router.post('/pt/add', protect, adminOnly, async (req, res) => {
  const { name, email, userId, password, division } = req.body;
  if (!name || !email || !userId || !password) {
    return res.status(400).json({ success: false, message: 'Please provide name, email, userId, and password.' });
  }
  try {
    const exists = await User.findOne({
      role: 'pt',
      $or: [
        { email:  email.toLowerCase() },
        { userId: userId.toUpperCase() },
      ],
    });
    if (exists) {
      return res.status(409).json({ success: false, message: 'A PT user with this email or ID already exists.' });
    }
    const user = await User.create({
      name,
      email:    email.toLowerCase().trim(),
      userId:   userId.toUpperCase().trim(),
      password,
      division: division || '',
      role:     'pt',
    });
    return res.status(201).json({
      success: true,
      message: `PT user "${user.name}" added successfully.`,
      data:    safePt(user),
    });
  } catch (err) {
    console.error('Add PT user error:', err.message);
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message).join(', ');
      return res.status(400).json({ success: false, message: messages });
    }
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ════════════════════════════════════════════════════════
//  LIST ALL EMPLOYEES
// ════════════════════════════════════════════════════════
router.get('/employees', protect, adminOnly, async (req, res) => {
  try {
    const employees = await Employee.find()
      .select('-password')
      .sort({ createdAt: -1 });
    return res.status(200).json({
      success: true,
      count:   employees.length,
      data:    employees,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});


// ════════════════════════════════════════════════════════
//  LIST ALL REPAIR TEAM MEMBERS
// ════════════════════════════════════════════════════════
router.get('/repair/members', protect, adminOnly, async (req, res) => {
  try {
    const members = await RepairTeam.find()
      .select('-password')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count:   members.length,
      data:    members,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});


// ════════════════════════════════════════════════════════
//  DEACTIVATE ACCOUNT
// ════════════════════════════════════════════════════════
router.put('/deactivate/:type/:id', protect, adminOnly, async (req, res) => {
  try {
    if (req.user._id.toString() === req.params.id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot deactivate your own account.',
      });
    }

    let Model;
    if (req.params.type === 'admin') Model = Admin;
    else if (req.params.type === 'repair') Model = RepairTeam;
    else if (req.params.type === 'service_coordinator' || req.params.type === 'fqc' || req.params.type === 'pt') Model = User;
    else Model = Employee;

    const user = await Model.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    if (!user.isActive) {
      return res.status(400).json({
        success: false,
        message: `"${user.name}" is already deactivated.`,
      });
    }

    user.isActive = false;
    await user.save({ validateBeforeSave: false });

    return res.status(200).json({
      success: true,
      message: `Account for "${user.name}" has been deactivated. They can no longer login.`,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});


// ════════════════════════════════════════════════════════
//  REACTIVATE ACCOUNT
// ════════════════════════════════════════════════════════
router.put('/reactivate/:type/:id', protect, adminOnly, async (req, res) => {
  try {
    let Model;
    if (req.params.type === 'admin') Model = Admin;
    else if (req.params.type === 'repair') Model = RepairTeam;
    else if (req.params.type === 'service_coordinator' || req.params.type === 'fqc' || req.params.type === 'pt') Model = User;
    else Model = Employee;

    const user = await Model.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    if (user.isActive) {
      return res.status(400).json({
        success: false,
        message: `"${user.name}" is already active.`,
      });
    }

    user.isActive = true;
    await user.save({ validateBeforeSave: false });

    return res.status(200).json({
      success: true,
      message: `Account for "${user.name}" has been reactivated.`,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});


// ════════════════════════════════════════════════════════
//  GET MY PROFILE
// ════════════════════════════════════════════════════════
router.get('/me', protect, (req, res) => {
  return res.status(200).json({ success: true, data: req.user });
});


// ════════════════════════════════════════════════════════
//  GET ALL USERS (Admins + Employees + Repair Team merged)
// ════════════════════════════════════════════════════════
router.get('/users', protect, adminOnly, async (req, res) => {
  try {
    const [admins, employees, repairMembers, serviceCoordinators, fqcUsers, ptUsers] = await Promise.all([
      Admin.find().select('-password').sort({ createdAt: -1 }),
      Employee.find().select('-password').sort({ createdAt: -1 }),
      RepairTeam.find().select('-password').sort({ createdAt: -1 }),
      User.find({ role: 'service_coordinator' }).select('-password').sort({ createdAt: -1 }),
      User.find({ role: 'fqc' }).select('-password').sort({ createdAt: -1 }),
      User.find({ role: 'pt' }).select('-password').sort({ createdAt: -1 }),
    ]);

    const allUsers = [
      ...admins.map(a => ({ ...a.toObject(), _collection: 'admin' })),
      ...employees.map(e => ({ ...e.toObject(), _collection: 'employee' })),
      ...repairMembers.map(r => ({ ...r.toObject(), _collection: 'repair' })),
      ...serviceCoordinators.map(u => ({ ...u.toObject(), _collection: 'service_coordinator' })),
      ...fqcUsers.map(u => ({ ...u.toObject(), _collection: 'fqc' })),
      ...ptUsers.map(u => ({ ...u.toObject(), _collection: 'pt' })),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return res.status(200).json({
      success: true,
      count:   allUsers.length,
      data:    allUsers,
    });
  } catch (err) {
    console.error('Get users error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});


// ════════════════════════════════════════════════════════
//  UPDATE USER BY ID
//  PUT /api/auth/users/:id
// ════════════════════════════════════════════════════════
router.put('/users/:id', protect, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;

    // ── FIX 5: added division to destructuring ─────────────
    const { name, email, password, isActive, department, designation, phone,
            adminId, employeeId, repairTeamId, division, divisions } = req.body;

    // Try Admin → Employee → RepairTeam
    let user = await Admin.findById(id);
    let type = 'Admin';

    if (!user) {
      user = await Employee.findById(id);
      type = 'Employee';
    }

    if (!user) {
      user = await RepairTeam.findById(id);
      type = 'Repair';
    }

    if (!user) {
      user = await User.findOne({ _id: id, role: 'service_coordinator' });
      type = 'ServiceCoordinator';
    }

    if (!user) {
      user = await User.findOne({ _id: id, role: 'fqc' });
      type = 'FQC';
    }

    if (!user) {
      user = await User.findOne({ _id: id, role: 'pt' });
      type = 'PT';
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Common fields
    if (name     !== undefined) user.name     = name;
    if (email    !== undefined) user.email    = email.toLowerCase().trim();
    if (isActive !== undefined) user.isActive = isActive;
    if (phone    !== undefined) user.phone    = phone;

    if (password && password.trim().length >= 6)
      user.password = password.trim();

    // Type-specific fields
    if (type === 'Admin' && adminId !== undefined)
      user.adminId = adminId.toUpperCase().trim();

    if (type === 'Employee') {
      if (department  !== undefined) user.department  = department;
      if (designation !== undefined) user.designation = designation;
      if (employeeId  !== undefined) user.employeeId  = employeeId.toUpperCase().trim();
      // ── FIX 6: save division for Employee ─────────────────
      if (division !== undefined || divisions !== undefined) {
        const assignedDivisions = normalizeDivisions(divisions, division !== undefined ? division : '');
        user.divisions = assignedDivisions;
        user.division = primaryDivision(assignedDivisions, division);
      }
    }

    if (type === 'Repair') {
      if (department    !== undefined) user.department    = department;
      if (designation   !== undefined) user.designation   = designation;
      if (repairTeamId  !== undefined) user.repairTeamId  = repairTeamId.toUpperCase().trim();
      // ── FIX 7: save division for Repair ───────────────────
      if (division !== undefined || divisions !== undefined) {
        const assignedDivisions = normalizeDivisions(divisions, division !== undefined ? division : '');
        user.divisions = assignedDivisions;
        user.division = primaryDivision(assignedDivisions, division);
      }
    }

    if (type === 'ServiceCoordinator') {
      if (division !== undefined || divisions !== undefined) {
        const assignedDivisions = normalizeDivisions(divisions, division !== undefined ? division : '');
        user.divisions = assignedDivisions;
        user.division = primaryDivision(assignedDivisions, division);
      }
      if (phone !== undefined) user.phone = phone;
      if (req.body.userId !== undefined) user.userId = String(req.body.userId || '').toUpperCase().trim();
      user.role = 'service_coordinator';
    }

    if (type === 'FQC') {
      if (division !== undefined || divisions !== undefined) {
        const assignedDivisions = normalizeDivisions(divisions, division !== undefined ? division : '');
        user.divisions = assignedDivisions;
        user.division = primaryDivision(assignedDivisions, division);
      }
      if (req.body.userId !== undefined) user.userId = String(req.body.userId || '').toUpperCase().trim();
      user.role = 'fqc';
    }

    if (type === 'PT') {
      if (division !== undefined || divisions !== undefined) {
        const assignedDivisions = normalizeDivisions(divisions, division !== undefined ? division : '');
        user.divisions = assignedDivisions;
        user.division = primaryDivision(assignedDivisions, division);
      }
      if (req.body.userId !== undefined) user.userId = String(req.body.userId || '').toUpperCase().trim();
      user.role = 'pt';
    }

    await user.save({ validateBeforeSave: true });

    const result = user.toObject();
    delete result.password;
    result._collection = type === 'ServiceCoordinator' ? 'service_coordinator' : type === 'FQC' ? 'fqc' : type === 'PT' ? 'pt' : type.toLowerCase();

    return res.status(200).json({
      success: true,
      message: `${type} "${user.name}" updated successfully.`,
      data:    result,
    });

  } catch (err) {
    console.error('Update user error:', err.message);
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message).join(', ');
      return res.status(400).json({ success: false, message: messages });
    }
    return res.status(500).json({ success: false, message: err.message });
  }
});


// ════════════════════════════════════════════════════════
//  DELETE A USER BY ID
// ════════════════════════════════════════════════════════
router.delete('/users/:id', protect, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user._id.toString() === id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account.',
      });
    }

    let deleted = await Admin.findByIdAndDelete(id);
    let type    = 'Admin';

    if (!deleted) {
      deleted = await Employee.findByIdAndDelete(id);
      type    = 'Employee';
    }

    if (!deleted) {
      deleted = await RepairTeam.findByIdAndDelete(id);
      type    = 'Repair Team Member';
    }

    if (!deleted) {
      deleted = await User.findOneAndDelete({ _id: id, role: 'service_coordinator' });
      type    = 'Service Coordinator';
    }

    if (!deleted) {
      deleted = await User.findOneAndDelete({ _id: id, role: 'fqc' });
      type    = 'FQC';
    }

    if (!deleted) {
      deleted = await User.findOneAndDelete({ _id: id, role: 'pt' });
      type    = 'PT';
    }

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'User not found in any collection.',
      });
    }

    return res.status(200).json({
      success: true,
      message: `${type} "${deleted.name}" has been deleted and can no longer log in.`,
    });
  } catch (err) {
    console.error('Delete user error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});


module.exports = router;
