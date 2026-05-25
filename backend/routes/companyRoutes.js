const express = require('express');
const router  = express.Router();
const Company = require('../models/Company');

// ── HELPERS ───────────────────────────────────────────────
const ok  = (res, data)          => res.json({ success: true, data });
const err = (res, msg, code=400) => res.status(code).json({ success: false, error: msg });

// ═══════════════════════════════════════════════════════════
//  COMPANY ROUTES  →  /api/companies
// ═══════════════════════════════════════════════════════════

// GET all companies
router.get('/', async (req, res) => {
  try {
    const companies = await Company.find().sort({ createdAt: 1 }).lean();
    const result = companies.map(c => ({
      ...c,
      branchCount: c.branches ? c.branches.length : 0,
    }));
    ok(res, result);
  } catch (e) {
    err(res, e.message, 500);
  }
});

// GET single company
router.get('/:id', async (req, res) => {
  try {
    const company = await Company.findById(req.params.id).lean();
    if (!company) return err(res, 'Company not found', 404);
    ok(res, company);
  } catch (e) {
    err(res, e.message, 500);
  }
});

// POST create company (branches embedded)
router.post('/', async (req, res) => {
  try {
    const { name, address, email, mobile, website, gst, status, branches } = req.body;
    if (!name || !address || !email || !mobile)
      return err(res, 'Name, address, email and mobile are required');

    const company = await Company.create({
      name, address, email, mobile, website, gst, status,
      branches: Array.isArray(branches)
        ? branches.filter(b => b.name && b.location)
        : [],
    });
    ok(res, company);
  } catch (e) {
    err(res, e.message, 500);
  }
});

// PUT update company + replace branches
router.put('/:id', async (req, res) => {
  try {
    const { name, address, email, mobile, website, gst, status, branches } = req.body;

    const update = { name, address, email, mobile, website, gst, status };
    if (Array.isArray(branches)) {
      update.branches = branches.filter(b => b.name && b.location);
    }

    const company = await Company.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true, runValidators: true }
    );
    if (!company) return err(res, 'Company not found', 404);
    ok(res, company);
  } catch (e) {
    err(res, e.message, 500);
  }
});

// DELETE company
router.delete('/:id', async (req, res) => {
  try {
    const company = await Company.findByIdAndDelete(req.params.id);
    if (!company) return err(res, 'Company not found', 404);
    ok(res, { deleted: req.params.id });
  } catch (e) {
    err(res, e.message, 500);
  }
});

// ═══════════════════════════════════════════════════════════
//  BRANCH ROUTES  →  /api/branches
//  Branches are embedded in Company — these routes operate
//  on the branches array inside a company document
// ═══════════════════════════════════════════════════════════

const branchRouter = express.Router();

// GET all branches across all companies (optional ?companyId= filter)
branchRouter.get('/', async (req, res) => {
  try {
    const filter = req.query.companyId ? { _id: req.query.companyId } : {};
    const companies = await Company.find(filter).lean();
    const branches = companies.flatMap(c =>
      (c.branches || []).map(b => ({
        _id:         b._id,
        name:        b.name,
        location:    b.location,
        region:      b.region,
        companyId:   c._id,
        companyName: c.name,
      }))
    );
    ok(res, branches);
  } catch (e) {
    err(res, e.message, 500);
  }
});

// POST add a branch to a company
branchRouter.post('/', async (req, res) => {
  try {
    const { companyId, name, location, region } = req.body;
    if (!companyId || !name || !location)
      return err(res, 'companyId, name and location are required');

    const company = await Company.findByIdAndUpdate(
      companyId,
      { $push: { branches: { name, location, region: region || '' } } },
      { new: true, runValidators: true }
    );
    if (!company) return err(res, 'Company not found', 404);

    // Return only the newly added branch (last one pushed)
    const newBranch = company.branches[company.branches.length - 1];
    ok(res, {
      _id:         newBranch._id,
      name:        newBranch.name,
      location:    newBranch.location,
      region:      newBranch.region,
      companyId:   company._id,
      companyName: company.name,
    });
  } catch (e) {
    err(res, e.message, 500);
  }
});

// PUT update a branch — supports ObjectId or composite key (companyId__name)
branchRouter.put('/:branchId', async (req, res) => {
  try {
    const { name, location, region, companyId } = req.body;
    const mongoose = require('mongoose');
    const branchId = req.params.branchId;
    let company, branch;

    if (mongoose.Types.ObjectId.isValid(branchId)) {
      company = await Company.findOne({ 'branches._id': branchId });
      if (company) branch = company.branches.id(branchId);
    }

    if (!branch && branchId.includes('__') && companyId) {
      const bName = decodeURIComponent(branchId.slice(branchId.indexOf('__') + 2));
      company = await Company.findById(companyId);
      if (company) branch = company.branches.find(b => b.name === bName);
    }

    if (!company || !branch) return err(res, 'Branch not found', 404);

    if (name)                branch.name     = name;
    if (location)            branch.location = location;
    if (region !== undefined) branch.region  = region;

    await company.save();
    ok(res, { ...branch.toObject(), companyId: company._id, companyName: company.name });
  } catch (e) {
    err(res, e.message, 500);
  }
});

// DELETE a branch — supports ObjectId or composite key (companyId__name)
branchRouter.delete('/:branchId', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const branchId = req.params.branchId;
    let company;

    if (mongoose.Types.ObjectId.isValid(branchId)) {
      company = await Company.findOne({ 'branches._id': branchId });
      if (company) {
        company.branches.pull({ _id: branchId });
        await company.save();
        return ok(res, { deleted: branchId });
      }
    }

    if (branchId.includes('__')) {
      const sep = branchId.indexOf('__');
      const cid  = branchId.slice(0, sep);
      const bName = decodeURIComponent(branchId.slice(sep + 2));
      company = await Company.findById(cid);
      if (company) {
        const idx = company.branches.findIndex(b => b.name === bName);
        if (idx !== -1) {
          company.branches.splice(idx, 1);
          await company.save();
          return ok(res, { deleted: branchId });
        }
      }
    }

    return err(res, 'Branch not found', 404);
  } catch (e) {
    err(res, e.message, 500);
  }
});

// ── EXPORTS ───────────────────────────────────────────────
module.exports = { companyRouter: router, branchRouter };