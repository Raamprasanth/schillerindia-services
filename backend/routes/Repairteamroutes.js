// routes/repairTeamRoutes.js
// ══════════════════════════════════════════════════════════
//  Repair Team Routes
//  Base: /api/repair-team
//  All routes protected — admin can manage, repair members
//  can view/update their own data
// ══════════════════════════════════════════════════════════

const express    = require('express');
const RepairTeam = require('../models/RepairTeam');
const { protect, adminOnly } = require('../middleware/authMiddleware');

const router = express.Router();


// ════════════════════════════════════════════════════════
//  GET /api/repair-team
//  List all repair team members — admin only
// ════════════════════════════════════════════════════════
router.get('/', protect, adminOnly, async (req, res) => {
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
    console.error('Get repair team error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});


// ════════════════════════════════════════════════════════
//  GET /api/repair-team/:id
//  Get a single repair team member by ID — admin only
// ════════════════════════════════════════════════════════
router.get('/:id', protect, adminOnly, async (req, res) => {
  try {
    const member = await RepairTeam.findById(req.params.id).select('-password');

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Repair team member not found.',
      });
    }

    return res.status(200).json({ success: true, data: member });
  } catch (err) {
    console.error('Get repair member error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});


// ════════════════════════════════════════════════════════
//  POST /api/repair-team
//  Create a new repair team member — admin only
// ════════════════════════════════════════════════════════
router.post('/', protect, adminOnly, async (req, res) => {
  const { name, email, repairTeamId, password, department, designation, phone } = req.body;

  if (!name || !email || !repairTeamId || !password) {
    return res.status(400).json({
      success: false,
      message: 'Please provide name, email, repairTeamId, and password.',
    });
  }

  try {
    const exists = await RepairTeam.findOne({
      $or: [
        { email:        email.toLowerCase().trim() },
        { repairTeamId: repairTeamId.toUpperCase().trim() },
      ],
    });

    if (exists) {
      return res.status(409).json({
        success: false,
        message: 'A repair team member with this email or ID already exists.',
      });
    }

    const member = await RepairTeam.create({
      name,
      email:        email.toLowerCase().trim(),
      repairTeamId: repairTeamId.toUpperCase().trim(),
      password,
      department:   department  || 'Repair Centre',
      designation:  designation || 'Repair Technician',
      phone:        phone       || '',
    });

    const result = member.toObject();
    delete result.password;

    return res.status(201).json({
      success: true,
      message: `Repair team member "${member.name}" created successfully.`,
      data:    result,
    });

  } catch (err) {
    console.error('Create repair member error:', err.message);
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message).join(', ');
      return res.status(400).json({ success: false, message: messages });
    }
    return res.status(500).json({ success: false, message: err.message });
  }
});


// ════════════════════════════════════════════════════════
//  PUT /api/repair-team/:id
//  Update a repair team member — admin only
// ════════════════════════════════════════════════════════
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const { name, email, repairTeamId, password, department, designation, phone, isActive } = req.body;

    const member = await RepairTeam.findById(req.params.id);

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Repair team member not found.',
      });
    }

    // Apply updates only for provided fields
    if (name         !== undefined) member.name         = name;
    if (email        !== undefined) member.email        = email.toLowerCase().trim();
    if (department   !== undefined) member.department   = department;
    if (designation  !== undefined) member.designation  = designation;
    if (phone        !== undefined) member.phone        = phone;
    if (isActive     !== undefined) member.isActive     = isActive;
    if (repairTeamId !== undefined) member.repairTeamId = repairTeamId.toUpperCase().trim();

    // Only update password if a new one is provided
    if (password && password.trim().length >= 6)
      member.password = password.trim();

    await member.save({ validateBeforeSave: true });

    const result = member.toObject();
    delete result.password;

    return res.status(200).json({
      success: true,
      message: `Repair team member "${member.name}" updated successfully.`,
      data:    result,
    });

  } catch (err) {
    console.error('Update repair member error:', err.message);
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message).join(', ');
      return res.status(400).json({ success: false, message: messages });
    }
    return res.status(500).json({ success: false, message: err.message });
  }
});


// ════════════════════════════════════════════════════════
//  DELETE /api/repair-team/:id
//  Delete a repair team member — admin only
// ════════════════════════════════════════════════════════
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const member = await RepairTeam.findByIdAndDelete(req.params.id);

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Repair team member not found.',
      });
    }

    return res.status(200).json({
      success: true,
      message: `Repair team member "${member.name}" has been deleted and can no longer log in.`,
      deleted: req.params.id,
    });
  } catch (err) {
    console.error('Delete repair member error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});


// ════════════════════════════════════════════════════════
//  PUT /api/repair-team/:id/deactivate
//  Deactivate a repair team member — admin only
// ════════════════════════════════════════════════════════
router.put('/:id/deactivate', protect, adminOnly, async (req, res) => {
  try {
    const member = await RepairTeam.findById(req.params.id);

    if (!member) {
      return res.status(404).json({ success: false, message: 'Repair team member not found.' });
    }

    if (!member.isActive) {
      return res.status(400).json({
        success: false,
        message: `"${member.name}" is already deactivated.`,
      });
    }

    member.isActive = false;
    await member.save({ validateBeforeSave: false });

    return res.status(200).json({
      success: true,
      message: `Account for "${member.name}" has been deactivated. They can no longer log in.`,
    });
  } catch (err) {
    console.error('Deactivate repair member error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});


// ════════════════════════════════════════════════════════
//  PUT /api/repair-team/:id/reactivate
//  Reactivate a repair team member — admin only
// ════════════════════════════════════════════════════════
router.put('/:id/reactivate', protect, adminOnly, async (req, res) => {
  try {
    const member = await RepairTeam.findById(req.params.id);

    if (!member) {
      return res.status(404).json({ success: false, message: 'Repair team member not found.' });
    }

    if (member.isActive) {
      return res.status(400).json({
        success: false,
        message: `"${member.name}" is already active.`,
      });
    }

    member.isActive = true;
    await member.save({ validateBeforeSave: false });

    return res.status(200).json({
      success: true,
      message: `Account for "${member.name}" has been reactivated.`,
    });
  } catch (err) {
    console.error('Reactivate repair member error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});


module.exports = router;