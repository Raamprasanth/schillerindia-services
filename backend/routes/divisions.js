// routes/divisions.js
const express = require('express');
const router  = express.Router();
const Division = require('../models/Division');

// ── GET all divisions ──────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const divisions = await Division.find().sort({ createdAt: 1 });
    res.json(divisions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET single division ────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const division = await Division.findById(req.params.id);
    if (!division) return res.status(404).json({ error: 'Division not found' });
    res.json(division);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── CREATE division ────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { name, displayName, models } = req.body;
    if (!name)
      return res.status(400).json({ error: 'name is required' });

    const division = new Division({ name, displayName: displayName || '', models: models || [] });
    await division.save();
    res.status(201).json(division);
  } catch (err) {
    if (err.code === 11000)
      return res.status(409).json({ error: 'Division name already exists' });
    res.status(500).json({ error: err.message });
  }
});

// ── UPDATE division ────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const { name, displayName, models } = req.body;
    const division = await Division.findByIdAndUpdate(
      req.params.id,
      { name, displayName: displayName || '', models: models || [] },
      { new: true, runValidators: true }
    );
    if (!division) return res.status(404).json({ error: 'Division not found' });
    res.json(division);
  } catch (err) {
    if (err.code === 11000)
      return res.status(409).json({ error: 'Division name already exists' });
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE division ────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const division = await Division.findByIdAndDelete(req.params.id);
    if (!division) return res.status(404).json({ error: 'Division not found' });
    res.json({ message: 'Deleted successfully', id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── ADD a model to a division ──────────────────────────────────
router.post('/:id/models', async (req, res) => {
  try {
    const { supplier, model, desc } = req.body;
    if (!model) return res.status(400).json({ error: 'model name is required' });

    const division = await Division.findByIdAndUpdate(
      req.params.id,
      { $push: { models: { supplier, model, desc } } },
      { new: true }
    );
    if (!division) return res.status(404).json({ error: 'Division not found' });
    res.json(division);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── REMOVE a model from a division ────────────────────────────
router.delete('/:id/models/:modelIndex', async (req, res) => {
  try {
    const division = await Division.findById(req.params.id);
    if (!division) return res.status(404).json({ error: 'Division not found' });

    const idx = parseInt(req.params.modelIndex);
    if (idx < 0 || idx >= division.models.length)
      return res.status(400).json({ error: 'Invalid model index' });

    division.models.splice(idx, 1);
    await division.save();
    res.json(division);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;