const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Employee = require('../models/Employee');
const RepairTeam = require('../models/Repairteam');
const ServiceMessageThread = require('../models/ServiceMessageThread');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

let serviceMessageIndexReady = null;

function isOldThreadUniqueIndex(index = {}) {
  const key = index.key || {};
  const keyNames = Object.keys(key);
  return index.unique === true &&
    key.coordinatorId === 1 &&
    key.employeeId === 1 &&
    key.employeeModel === 1 &&
    key.division === undefined &&
    keyNames.length === 3;
}

async function ensureServiceMessageDivisionIndex() {
  if (!serviceMessageIndexReady) {
    serviceMessageIndexReady = (async () => {
      const indexes = await ServiceMessageThread.collection.indexes();
      for (const index of indexes) {
        if (isOldThreadUniqueIndex(index)) {
          await ServiceMessageThread.collection.dropIndex(index.name);
        }
      }
      await ServiceMessageThread.collection.createIndex(
        { coordinatorId: 1, employeeId: 1, employeeModel: 1, division: 1 },
        { unique: true, name: 'coordinator_employee_model_division_unique' }
      );
    })().catch((err) => {
      serviceMessageIndexReady = null;
      throw err;
    });
  }
  return serviceMessageIndexReady;
}

function userKey(user) {
  return String(user?._id || user?.id || '');
}

function userModel(user) {
  if (user?._collection === 'Employee') return 'Employee';
  if (user?._collection === 'RepairTeam') return 'RepairTeam';
  return 'User';
}

function normalizeRole(user) {
  return String(user?.role || '').toLowerCase();
}

function canUseMessages(user) {
  const role = normalizeRole(user);
  return role === 'service_coordinator' || role === 'employee' || role === 'admin' || role === 'superadmin' || role === 'pt' || role === 'fqc' || role === 'repair' || role === 'repair_team';
}

function isCoordinator(user) {
  const role = normalizeRole(user);
  return role === 'service_coordinator' || role === 'admin' || role === 'superadmin';
}

function isParticipant(thread, user) {
  const id = userKey(user);
  const model = userModel(user);
  return String(thread.coordinatorId) === id ||
    (String(thread.employeeId) === id && String(thread.employeeModel || 'Employee') === model) ||
    isCoordinator(user);
}

function buildRecipient(emp, source) {
  return {
    id: emp._id,
    source,
    name: emp.name || emp.email || 'User',
    email: emp.email || '',
    division: emp.division || (Array.isArray(emp.divisions) ? emp.divisions[0] : '') || '',
    divisions: Array.isArray(emp.divisions) ? emp.divisions : [],
    role: emp.role || (source === 'Employee' ? 'employee' : ''),
    designation: emp.designation || '',
  };
}

function normalizeDivisionName(value) {
  return String(value || '').trim();
}

function recipientDivisions(recipient = {}) {
  const values = [];
  if (recipient.division) values.push(recipient.division);
  if (Array.isArray(recipient.divisions)) values.push(...recipient.divisions);
  return Array.from(new Set(values.map(normalizeDivisionName).filter(Boolean)));
}

function canonicalDivisionMap(values = []) {
  const map = new Map();
  values.map(normalizeDivisionName).filter(Boolean).forEach((value) => {
    const key = value.toLowerCase();
    if (!map.has(key)) map.set(key, value);
  });
  return map;
}

function userDivisions(user = {}) {
  return [
    user.activeDivision,
    user.division,
    ...(Array.isArray(user.divisions) ? user.divisions : []),
  ].map(normalizeDivisionName).filter(Boolean);
}

function resolveThreadDivision(requestedDivision, recipient = {}, user = {}) {
  const requested = normalizeDivisionName(requestedDivision);
  const divisions = recipientDivisions(recipient);
  const divisionMap = canonicalDivisionMap(divisions);
  if (requested) {
    const matched = divisionMap.get(requested.toLowerCase());
    if (divisions.length && !matched) {
      const err = new Error('Selected recipient does not belong to this division.');
      err.status = 400;
      throw err;
    }
    return matched || requested;
  }
  if (divisions.length === 1) return divisions[0];
  if (divisions.length > 1) {
    const senderDivision = userDivisions(user)
      .map(value => divisionMap.get(value.toLowerCase()))
      .find(Boolean);
    return senderDivision || divisions[0];
  }
  return '';
}

function threadSummary(thread, currentUser) {
  const id = userKey(currentUser);
  const last = thread.messages?.[thread.messages.length - 1];
  const unreadCount = (thread.messages || []).filter(m => String(m.senderId) !== id && !(m.readBy || []).includes(id)).length;
  const peerName = String(thread.coordinatorId) === id
    ? (thread.employeeName || 'Recipient')
    : (thread.coordinatorName || 'Service Coordinator');
  return {
    _id: thread._id,
    division: thread.division,
    coordinatorId: thread.coordinatorId,
    coordinatorName: thread.coordinatorName,
    employeeId: thread.employeeId,
    employeeModel: thread.employeeModel,
    employeeName: thread.employeeName,
    employeeEmail: thread.employeeEmail,
    lastMessage: thread.lastMessage,
    lastMessageAt: thread.lastMessageAt,
    unreadCount,
    lastSenderName: last?.senderName || '',
    peerName,
  };
}

router.get('/employees', async (req, res) => {
  try {
    if (!isCoordinator(req.user)) {
      return res.status(403).json({ success: false, message: 'Service coordinator access required' });
    }
    const division = String(req.query.division || '').trim();
    const userFilter = { role: 'employee', isActive: { $ne: false } };
    const employeeFilter = { isActive: { $ne: false } };
    const repairFilter = { isActive: { $ne: false } };
    if (division) {
      userFilter.$or = [{ division }, { divisions: division }];
      employeeFilter.$or = [{ division }, { divisions: division }];
      repairFilter.$or = [{ division }, { divisions: division }];
    }
    const [users, employees, repairs] = await Promise.all([
      User.find(userFilter).select('name email division divisions role').sort({ name: 1 }).lean(),
      Employee.find(employeeFilter).select('name email division divisions role employeeId designation').sort({ name: 1 }).lean(),
      RepairTeam.find(repairFilter).select('name email division divisions role designation').sort({ name: 1 }).lean(),
    ]);
    const seen = new Set();
    const list = [
      ...users.map(u => ({ ...u, source: 'User' })),
      ...employees.map(e => ({ ...e, source: 'Employee' })),
      ...repairs.map(r => ({ ...r, source: 'RepairTeam' }))
    ]
      .filter(emp => {
        const key = `${emp.source}:${emp._id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map(emp => ({
        id: emp._id,
        source: emp.source,
        name: emp.name || emp.email || 'Employee',
        email: emp.email || '',
        division: emp.division || (Array.isArray(emp.divisions) ? emp.divisions[0] : '') || '',
        divisions: Array.isArray(emp.divisions) ? emp.divisions : [],
        designation: emp.designation || '',
      }));
    res.json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load employees', error: err.message });
  }
});

router.get('/recipients', async (req, res) => {
  try {
    if (!canUseMessages(req.user)) return res.status(403).json({ success: false, message: 'Not allowed' });
    const division = String(req.query.division || '').trim();
    const team = String(req.query.team || '').trim();
    const currentId = userKey(req.user);

    let users = [];
    let employees = [];
    let repairs = [];

    const userFilter = { isActive: { $ne: false } };
    const employeeFilter = { isActive: { $ne: false } };
    const repairFilter = { isActive: { $ne: false } };

    if (division) {
      userFilter.$or = [{ division }, { divisions: division }];
      employeeFilter.$or = [{ division }, { divisions: division }];
      repairFilter.$or = [{ division }, { divisions: division }];
    }

    let queryUsers = false;
    let queryEmployees = false;
    let queryRepairs = false;

    if (!team) {
      // Default / fallback: query everything
      queryUsers = true;
      queryEmployees = true;
      queryRepairs = true;
      userFilter.role = { $in: ['employee', 'service_coordinator', 'pt'] };
    } else if (team === 'service_team') {
      queryUsers = true;
      queryEmployees = true;
      userFilter.role = 'employee';
    } else if (team === 'repair_team') {
      queryRepairs = true;
    } else if (team === 'product_team') {
      queryUsers = true;
      userFilter.role = 'pt';
    } else if (team === 'service_coordinator') {
      queryUsers = true;
      userFilter.role = 'service_coordinator';
    }

    const promises = [];
    if (queryUsers) {
      promises.push(User.find(userFilter).select('name email division divisions role').sort({ name: 1 }).lean().then(data => ({ type: 'User', data })));
    }
    if (queryEmployees) {
      promises.push(Employee.find(employeeFilter).select('name email division divisions role employeeId designation').sort({ name: 1 }).lean().then(data => ({ type: 'Employee', data })));
    }
    if (queryRepairs) {
      promises.push(RepairTeam.find(repairFilter).select('name email division divisions role designation').sort({ name: 1 }).lean().then(data => ({ type: 'RepairTeam', data })));
    }

    const results = await Promise.all(promises);
    results.forEach(r => {
      if (r.type === 'User') users = r.data;
      else if (r.type === 'Employee') employees = r.data;
      else if (r.type === 'RepairTeam') repairs = r.data;
    });

    const list = [
      ...users.map(u => buildRecipient(u, 'User')),
      ...employees.map(e => buildRecipient(e, 'Employee')),
      ...repairs.map(r => buildRecipient(r, 'RepairTeam')),
    ].filter(r => String(r.id) !== currentId);

    res.json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load recipients', error: err.message });
  }
});

router.get('/threads', async (req, res) => {
  try {
    if (!canUseMessages(req.user)) return res.status(403).json({ success: false, message: 'Not allowed' });
    await ensureServiceMessageDivisionIndex();
    const id = userKey(req.user);
    const model = userModel(req.user);
    const division = normalizeDivisionName(req.query.division);
    const filter = isCoordinator(req.user)
      ? { $or: [{ coordinatorId: id }, { employeeId: id, employeeModel: model }] }
      : { $or: [{ employeeId: id, employeeModel: model }, { coordinatorId: id }] };
    if (division) filter.division = division;
    const threads = await ServiceMessageThread.find(filter).sort({ lastMessageAt: -1 }).lean();
    res.json({ success: true, data: threads.map(t => threadSummary(t, req.user)) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load message threads', error: err.message });
  }
});



router.post('/threads', async (req, res) => {
  try {
    if (!canUseMessages(req.user)) return res.status(403).json({ success: false, message: 'Not allowed' });
    await ensureServiceMessageDivisionIndex();
    const employeeId = String(req.body.employeeId || req.body.recipientId || '').trim();
    const employeeModel = String(req.body.employeeModel || req.body.recipientModel || req.body.source || 'Employee').trim();
    const text = String(req.body.message || '').trim();
    if (!employeeId || !text) return res.status(400).json({ success: false, message: 'Employee and message are required' });

    let EmployeeModel;
    if (employeeModel === 'User') EmployeeModel = User;
    else if (employeeModel === 'RepairTeam') EmployeeModel = RepairTeam;
    else EmployeeModel = Employee;
    const employee = await EmployeeModel.findById(employeeId).select('name email division divisions designation role').lean();
    if (!employee) return res.status(404).json({ success: false, message: 'Recipient not found' });
    const threadDivision = resolveThreadDivision(req.body.division, employee, req.user);

    let finalCoordinatorId, finalEmployeeId, finalEmployeeModel, finalCoordinatorName, finalEmployeeName, finalEmployeeEmail;
    const senderId = userKey(req.user);
    const senderIsCoordinator = isCoordinator(req.user);
    const recipientIsCoordinator = employeeModel === 'User' && employee.role && ['admin', 'superadmin', 'service_coordinator'].includes(employee.role.toLowerCase());

    if (senderIsCoordinator && !recipientIsCoordinator) {
      finalCoordinatorId = senderId;
      finalCoordinatorName = req.user.name || 'Service Coordinator';
      finalEmployeeId = employeeId;
      finalEmployeeModel = employeeModel;
      finalEmployeeName = employee.name || employee.email || 'Recipient';
      finalEmployeeEmail = employee.email || '';
    } else if (!senderIsCoordinator && recipientIsCoordinator) {
      finalCoordinatorId = employeeId;
      finalCoordinatorName = employee.name || employee.email || 'Service Coordinator';
      finalEmployeeId = senderId;
      finalEmployeeModel = userModel(req.user);
      finalEmployeeName = req.user.name || req.user.email || 'Service Team';
      finalEmployeeEmail = req.user.email || '';
    } else {
      if (senderId < employeeId) {
        finalCoordinatorId = senderId;
        finalCoordinatorName = req.user.name || (senderIsCoordinator ? 'Service Coordinator' : 'Service Team');
        finalEmployeeId = employeeId;
        finalEmployeeModel = employeeModel;
        finalEmployeeName = employee.name || employee.email || 'Recipient';
        finalEmployeeEmail = employee.email || '';
      } else {
        finalCoordinatorId = employeeId;
        finalCoordinatorName = employee.name || employee.email || 'Recipient';
        finalEmployeeId = senderId;
        finalEmployeeModel = userModel(req.user);
        finalEmployeeName = req.user.name || req.user.email || (senderIsCoordinator ? 'Service Coordinator' : 'Service Team');
        finalEmployeeEmail = req.user.email || '';
      }
    }

    const message = {
      senderId,
      senderModel: userModel(req.user),
      senderName: req.user.name || 'Service Coordinator',
      senderRole: normalizeRole(req.user),
      text,
      readBy: [senderId],
    };
    const thread = await ServiceMessageThread.findOneAndUpdate(
      { coordinatorId: finalCoordinatorId, employeeId: finalEmployeeId, employeeModel: finalEmployeeModel, division: threadDivision },
      {
        $setOnInsert: {
          coordinatorId: finalCoordinatorId,
          coordinatorName: finalCoordinatorName,
          employeeId: finalEmployeeId,
          employeeModel: finalEmployeeModel,
          employeeName: finalEmployeeName,
          employeeEmail: finalEmployeeEmail,
          division: threadDivision,
        },
        $set: { lastMessage: text, lastMessageAt: new Date() },
        $push: { messages: message },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();
    res.status(201).json({ success: true, data: threadSummary(thread, req.user) });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.status ? err.message : 'Failed to send message: ' + err.message, error: err.message });
  }
});

router.get('/threads/:id', async (req, res) => {
  try {
    const thread = await ServiceMessageThread.findById(req.params.id);
    if (!thread) return res.status(404).json({ success: false, message: 'Thread not found' });
    if (!isParticipant(thread, req.user)) return res.status(403).json({ success: false, message: 'Not allowed' });
    const id = userKey(req.user);
    let changed = false;
    thread.messages.forEach(msg => {
      if (String(msg.senderId) !== id && !msg.readBy.includes(id)) {
        msg.readBy.push(id);
        changed = true;
      }
    });
    if (changed) await thread.save();
    res.json({ success: true, data: thread.toObject() });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load conversation', error: err.message });
  }
});

router.post('/threads/:id/messages', async (req, res) => {
  try {
    const text = String(req.body.message || '').trim();
    if (!text) return res.status(400).json({ success: false, message: 'Message is required' });
    const thread = await ServiceMessageThread.findById(req.params.id);
    if (!thread) return res.status(404).json({ success: false, message: 'Thread not found' });
    if (!isParticipant(thread, req.user)) return res.status(403).json({ success: false, message: 'Not allowed' });
    const senderId = userKey(req.user);
    thread.messages.push({
      senderId,
      senderModel: userModel(req.user),
      senderName: req.user.name || 'User',
      senderRole: normalizeRole(req.user),
      text,
      readBy: [senderId],
    });
    thread.lastMessage = text;
    thread.lastMessageAt = new Date();
    await thread.save();
    res.status(201).json({ success: true, data: thread.toObject() });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to send reply: ' + err.message, error: err.message });
  }
});

router.delete('/threads/:id/messages', async (req, res) => {
  try {
    const thread = await ServiceMessageThread.findById(req.params.id);
    if (!thread) return res.status(404).json({ success: false, message: 'Thread not found' });
    if (!isParticipant(thread, req.user)) return res.status(403).json({ success: false, message: 'Not allowed' });
    
    thread.messages = [];
    thread.lastMessage = 'Messages cleared';
    await thread.save();
    
    res.json({ success: true, message: 'Messages cleared successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to clear messages', error: err.message });
  }
});

module.exports = router;
