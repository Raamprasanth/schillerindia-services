const jwt      = require('jsonwebtoken');
const Admin    = require('../models/Admin');
const Employee = require('../models/Employee');
const RepairTeam = require('../models/Repairteam');

function withDivisionAccess(user, defaultRole, collection) {
  const divisions = Array.isArray(user.divisions) ? user.divisions : [];
  const normalized = [...new Set([...divisions, user.division].map(v => String(v || '').trim()).filter(Boolean))];
  return {
    ...user,
    division: normalized[0] || user.division || '',
    divisions: normalized,
    assignedDivisions: normalized,
    role: String(user.role || defaultRole || '').toLowerCase(),
    _collection: collection,
  };
}

function applyActiveDivision(req, user) {
  const requested = String(req.headers['x-active-division'] || req.headers['x-schiller-division'] || '').trim();
  const assigned = Array.isArray(user.assignedDivisions) ? user.assignedDivisions : [];
  const role = String(user.role || '').toLowerCase();
  const canSwitch = role === 'employee' || role === 'service_team' || String(user._collection || '') === 'Employee';

  if (!requested || !canSwitch || !assigned.length) return { ok: true, user };

  let match = assigned.find(d => d.toLowerCase() === requested.toLowerCase());
  if (!match) {
    match = assigned[0] || String(user.division || '').trim();
  }
  
  if (!match) return { ok: true, user };

  return {
    ok: true,
    user: {
      ...user,
      activeDivision: match,
      division: match,
      divisions: [match],
      assignedDivisions: assigned,
    },
  };
}

// ── Try to find a user across all three collections ──────
async function findUserById(id) {
  // Check Admin first (most common login)
  let user = await Admin.findById(id).select('-password').lean();
  if (user) return withDivisionAccess(user, 'admin', 'Admin');

  // Check Employee next
  user = await Employee.findById(id).select('-password').lean();
  if (user) return withDivisionAccess(user, 'employee', 'Employee');

  // Check RepairTeam next
  user = await RepairTeam.findById(id).select('-password').lean();
  if (user) return withDivisionAccess(user, 'repair_team', 'RepairTeam');

  // Fallback: check User collection (if it exists)
  try {
    const User = require('../models/User');
    user = await User.findById(id).select('-password').lean();
    if (user) return withDivisionAccess(user, '', 'User');
  } catch(e) {
    // User model may not exist — ignore
  }

  return null;
}

// ════════════════════════════════════════════════════════
//  protect — verify JWT and attach user to req.user
// ════════════════════════════════════════════════════════
const protect = async (req, res, next) => {
  const auth = req.headers.authorization;

  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Not authorized — no token' });
  }

  const token = auth.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user    = await findUserById(decoded.id);

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found — please log in again' });
    }

    if (user.isActive === false) {
      return res.status(401).json({ success: false, message: 'Your account has been deactivated' });
    }

    const activeDivisionResult = applyActiveDivision(req, user);
    if (!activeDivisionResult.ok) {
      return res.status(activeDivisionResult.status).json({ success: false, message: activeDivisionResult.message });
    }

    req.user = activeDivisionResult.user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError')
      return res.status(401).json({ success: false, message: 'Session expired — please log in again' });
    if (err.name === 'JsonWebTokenError')
      return res.status(401).json({ success: false, message: 'Invalid token — please log in again' });
    return res.status(401).json({ success: false, message: 'Token invalid or expired' });
  }
};

// ════════════════════════════════════════════════════════
//  adminOnly — must be admin or superadmin role
// ════════════════════════════════════════════════════════
const adminOnly = (req, res, next) => {
  const role = String(req.user?.role || '').toLowerCase();
  const isAdminCollectionUser = String(req.user?._collection || '') === 'Admin';
  if (!req.user || (!isAdminCollectionUser && role !== 'admin' && role !== 'superadmin' && role !== 'administrator')) {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
};

// ════════════════════════════════════════════════════════
//  repairTeamOrAdmin — must be repair_team or admin
// ════════════════════════════════════════════════════════
const repairTeamOrAdmin = (req, res, next) => {
  const role = String(req.user?.role || '').toLowerCase();
  const isAdminCollectionUser = String(req.user?._collection || '') === 'Admin';
  if (!req.user || (!isAdminCollectionUser && role !== 'admin' && role !== 'superadmin' && role !== 'administrator' && role !== 'repair' && role !== 'repair_team')) {
    return res.status(403).json({ success: false, message: 'Repair Team or Admin access required' });
  }
  next();
};

// ════════════════════════════════════════════════════════
//  employeeOrAdmin — must be employee, service_coordinator, or admin
// ════════════════════════════════════════════════════════
const employeeOrAdmin = (req, res, next) => {
  const role = String(req.user?.role || '').toLowerCase();
  const isAdminCollection = String(req.user?._collection || '') === 'Admin';
  const isEmployeeCollection = String(req.user?._collection || '') === 'Employee';
  if (!req.user || (!isAdminCollection && !isEmployeeCollection && role !== 'admin' && role !== 'superadmin' && role !== 'administrator' && role !== 'employee' && role !== 'service_coordinator')) {
    return res.status(403).json({ success: false, message: 'Employee or Admin access required' });
  }
  next();
};

// ════════════════════════════════════════════════════════
//  repairTeamOrEmployeeOrAdmin — must be employee, repair_team, or admin
// ════════════════════════════════════════════════════════
const repairTeamOrEmployeeOrAdmin = (req, res, next) => {
  const role = String(req.user?.role || '').toLowerCase();
  const isAdminCollection = String(req.user?._collection || '') === 'Admin';
  const isEmployeeCollection = String(req.user?._collection || '') === 'Employee';
  const isRepairTeamCollection = String(req.user?._collection || '') === 'RepairTeam';
  
  if (!req.user || (
    !isAdminCollection && 
    !isEmployeeCollection && 
    !isRepairTeamCollection && 
    role !== 'admin' && 
    role !== 'superadmin' && 
    role !== 'administrator' && 
    role !== 'employee' && 
    role !== 'service_coordinator' && 
    role !== 'repair' && 
    role !== 'repair_team'
  )) {
    return res.status(403).json({ success: false, message: 'Repair Team, Employee, or Admin access required' });
  }
  next();
};

module.exports = { protect, adminOnly, repairTeamOrAdmin, employeeOrAdmin, repairTeamOrEmployeeOrAdmin };
