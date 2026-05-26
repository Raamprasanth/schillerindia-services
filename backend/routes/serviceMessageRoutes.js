const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Employee = require('../models/Employee');
const ServiceMessageThread = require('../models/ServiceMessageThread');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

function userKey(user) {
  return String(user?._id || user?.id || '');
}

function userModel(user) {
  return user?._collection === 'Employee' ? 'Employee' : 'User';
}

function normalizeRole(user) {
  return String(user?.role || '').toLowerCase();
}

function canUseMessages(user) {
  const role = normalizeRole(user);
  return role === 'service_coordinator' || role === 'employee' || role === 'admin' || role === 'superadmin' || role === 'pt' || role === 'fqc';
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
    if (division) {
      userFilter.$or = [{ division }, { divisions: division }];
      employeeFilter.$or = [{ division }, { divisions: division }];
    }
    const [users, employees] = await Promise.all([
      User.find(userFilter).select('name email division divisions role').sort({ name: 1 }).lean(),
      Employee.find(employeeFilter).select('name email division divisions role employeeId designation').sort({ name: 1 }).lean(),
    ]);
    const seen = new Set();
    const list = [...users.map(u => ({ ...u, source: 'User' })), ...employees.map(e => ({ ...e, source: 'Employee' }))]
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
    const currentId = userKey(req.user);
    const userFilter = { role: { $in: ['employee', 'service_coordinator'] }, isActive: { $ne: false } };
    const employeeFilter = { isActive: { $ne: false } };
    if (division) {
      userFilter.$or = [{ division }, { divisions: division }];
      employeeFilter.$or = [{ division }, { divisions: division }];
    }
    const [users, employees] = await Promise.all([
      User.find(userFilter).select('name email division divisions role').sort({ name: 1 }).lean(),
      Employee.find(employeeFilter).select('name email division divisions role employeeId designation').sort({ name: 1 }).lean(),
    ]);
    const list = [
      ...users.map(u => buildRecipient(u, 'User')),
      ...employees.map(e => buildRecipient(e, 'Employee')),
    ].filter(r => String(r.id) !== currentId);
    res.json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load recipients', error: err.message });
  }
});

router.get('/threads', async (req, res) => {
  try {
    if (!canUseMessages(req.user)) return res.status(403).json({ success: false, message: 'Not allowed' });
    const id = userKey(req.user);
    const model = userModel(req.user);
    const filter = isCoordinator(req.user)
      ? { $or: [{ coordinatorId: id }, { employeeId: id, employeeModel: model }] }
      : { $or: [{ employeeId: id, employeeModel: model }, { coordinatorId: id }] };
    const threads = await ServiceMessageThread.find(filter).sort({ lastMessageAt: -1 }).lean();
    res.json({ success: true, data: threads.map(t => threadSummary(t, req.user)) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load message threads', error: err.message });
  }
});

router.post('/threads', async (req, res) => {
  try {
    if (!canUseMessages(req.user)) return res.status(403).json({ success: false, message: 'Not allowed' });
    const employeeId = String(req.body.employeeId || req.body.recipientId || '').trim();
    const employeeModel = String(req.body.employeeModel || req.body.recipientModel || req.body.source || 'Employee').trim();
    const text = String(req.body.message || '').trim();
    if (!employeeId || !text) return res.status(400).json({ success: false, message: 'Employee and message are required' });

    const EmployeeModel = employeeModel === 'User' ? User : Employee;
    const employee = await EmployeeModel.findById(employeeId).select('name email division divisions designation role').lean();
    if (!employee) return res.status(404).json({ success: false, message: 'Recipient not found' });

    const senderId = userKey(req.user);
    const senderIsCoordinator = isCoordinator(req.user);
    const coordinatorId = senderIsCoordinator ? senderId : senderId;
    const coordinatorName = req.user.name || (senderIsCoordinator ? 'Service Coordinator' : 'Service Team');
    const message = {
      senderId,
      senderModel: userModel(req.user),
      senderName: req.user.name || 'Service Coordinator',
      senderRole: normalizeRole(req.user),
      text,
      readBy: [senderId],
    };
    const thread = await ServiceMessageThread.findOneAndUpdate(
      { coordinatorId, employeeId, employeeModel },
      {
        $setOnInsert: {
          coordinatorId,
          coordinatorName,
          employeeId,
          employeeModel,
          employeeName: employee.name || employee.email || 'Recipient',
          employeeEmail: employee.email || '',
          division: req.body.division || employee.division || (Array.isArray(employee.divisions) ? employee.divisions[0] : '') || '',
        },
        $set: { lastMessage: text, lastMessageAt: new Date() },
        $push: { messages: message },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();
    res.status(201).json({ success: true, data: threadSummary(thread, req.user) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to send message', error: err.message });
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
    res.status(500).json({ success: false, message: 'Failed to send reply', error: err.message });
  }
});

module.exports = router;
