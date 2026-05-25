const express  = require('express');
const router   = express.Router();
const Engineer = require('../models/engineerModel');

// ── HELPERS ───────────────────────────────────────────────

const ok  = (res, data)          => res.json({ success: true, data });
const err = (res, msg, code=400) => res.status(code).json({ success: false, error: msg });

function normalizeDivisions(divisions, division) {
  const values = Array.isArray(divisions) ? divisions : [division];
  return [...new Set(values.map(v => String(v || '').trim()).filter(Boolean))];
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ═══════════════════════════════════════════════════════════
//  GET all engineers
//  Supports optional query filters:
//    ?division=SHIPL
//    ?location=Field
//    ?role=Engineer
//    ?active=Yes
// ═══════════════════════════════════════════════════════════

router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.division) {
      const division = String(req.query.division).trim();
      const divisionRegex = new RegExp(`^${escapeRegex(division)}$`, 'i');
      filter.$or = [{ division: divisionRegex }, { divisions: divisionRegex }];
    }
    if (req.query.location) filter.location = req.query.location;
    if (req.query.role)     filter.role     = req.query.role;
    if (req.query.active)   filter.active   = req.query.active;
    if (req.query.branch)   filter.branch   = req.query.branch;

    const engineers = await Engineer.find(filter)
      .select('-password')   // never send passwords to frontend
      .sort({ createdAt: 1 })
      .lean();

    ok(res, engineers);
  } catch (e) {
    err(res, e.message, 500);
  }
});

// ═══════════════════════════════════════════════════════════
//  GET single engineer by ID
// ═══════════════════════════════════════════════════════════

router.get('/:id', async (req, res) => {
  try {
    const engineer = await Engineer.findById(req.params.id)
      .select('-password')
      .lean();
    if (!engineer) return err(res, 'Engineer not found', 404);
    ok(res, engineer);
  } catch (e) {
    err(res, e.message, 500);
  }
});

// ═══════════════════════════════════════════════════════════
//  POST create engineer
// ═══════════════════════════════════════════════════════════

router.post('/', async (req, res) => {
  try {
    const { name, division, divisions, location, branch, role, active, empId } = req.body;
    const assignedDivisions = normalizeDivisions(divisions, division);

    if (!name || !location || !branch || !role)
      return err(res, 'name, location, branch, role are required');

    const engineer = await Engineer.create({
      empId:    empId    || '',
      name,
      division: assignedDivisions[0] || '',
      divisions: assignedDivisions,
      location,
      branch,
      role,
      active:   active   || 'Yes',
    });

    ok(res, engineer.toObject());
  } catch (e) {
    // Mongoose validation error — return readable message
    if (e.name === 'ValidationError') {
      const messages = Object.values(e.errors).map(v => v.message).join(', ');
      return err(res, messages);
    }
    err(res, e.message, 500);
  }
});

// ═══════════════════════════════════════════════════════════
//  PUT update engineer
// ═══════════════════════════════════════════════════════════

router.put('/:id', async (req, res) => {
  try {
    const { name, division, divisions, location, branch, role, active, empId } = req.body;
    const assignedDivisions = normalizeDivisions(divisions, division);

    const updateData = {
      name,
      division: assignedDivisions[0] || '',
      divisions: assignedDivisions,
      location,
      branch,
      role,
      active,
      empId,
    };

    const engineer = await Engineer.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).lean();

    if (!engineer) return err(res, 'Engineer not found', 404);
    ok(res, engineer);
  } catch (e) {
    if (e.name === 'ValidationError') {
      const messages = Object.values(e.errors).map(v => v.message).join(', ');
      return err(res, messages);
    }
    err(res, e.message, 500);
  }
});

// ═══════════════════════════════════════════════════════════
//  DELETE engineer
// ═══════════════════════════════════════════════════════════

router.delete('/:id', async (req, res) => {
  try {
    const engineer = await Engineer.findByIdAndDelete(req.params.id);
    if (!engineer) return err(res, 'Engineer not found', 404);
    ok(res, { deleted: req.params.id });
  } catch (e) {
    err(res, e.message, 500);
  }
});

module.exports = router;
