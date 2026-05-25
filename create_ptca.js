const fs = require('fs');
const path = require('path');

const rootDir = 'c:/Users/Raamprasanth/OneDrive/Desktop/shcl';

// 1. Create Model
const modelPath = path.join(rootDir, 'backend/models/PtClosedActivity.js');
const modelContent = `const mongoose = require('mongoose');

const ptClosedActivitySchema = new mongoose.Schema({
  scEngineer: { type: String, required: true },
  initiatedDate: { type: String, required: true },
  activity: { type: String, required: true },
  description: { type: String, default: '' },
  responsible: { type: String, default: '' },
  pendingFrom: { type: String, default: '' },
  targetDate: { type: String, default: '' },
  remarks: { type: String, default: '' },
  scInchargeRemarks: { type: String, default: '' },
  status: { type: String, required: true, default: 'Closed' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('PtClosedActivity', ptClosedActivitySchema);
`;
fs.writeFileSync(modelPath, modelContent, 'utf8');

// 2. Create Route
const routePath = path.join(rootDir, 'backend/routes/ptClosedActivityRoutes.js');
const routeContent = `const express = require('express');
const PtClosedActivity = require('../models/PtClosedActivity');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();
router.use(protect);

function canUsePtCa(user) {
  const role = String(user?.role || '').toLowerCase();
  return ['pt', 'product team', 'product', 'product_team', 'admin', 'superadmin', 'administrator'].includes(role);
}

router.use((req, res, next) => {
  if (!canUsePtCa(req.user)) {
    return res.status(403).json({ message: 'Not allowed to access Product Team Closed Activity.' });
  }
  next();
});

function ownerFilter(user) {
  const role = String(user?.role || '').toLowerCase();
  if (['admin', 'superadmin', 'administrator'].includes(role)) return {};
  return { createdBy: user?._id };
}

router.get('/', async (req, res) => {
  try {
    const docs = await PtClosedActivity.find(ownerFilter(req.user)).sort({ createdAt: -1 }).lean();
    res.json(docs);
  } catch (err) {
    console.error('[GET /api/ptca]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.scEngineer || !body.initiatedDate || !body.activity || !body.status) {
      return res.status(400).json({ message: 'Required fields missing.' });
    }

    const doc = await PtClosedActivity.create({
      scEngineer: body.scEngineer,
      initiatedDate: body.initiatedDate,
      activity: body.activity,
      description: body.description || '',
      responsible: body.responsible || '',
      pendingFrom: body.pendingFrom || '',
      targetDate: body.targetDate || '',
      remarks: body.remarks || '',
      scInchargeRemarks: body.scInchargeRemarks || '',
      status: body.status || 'Closed',
      createdBy: req.user?._id,
    });
    res.status(201).json(doc);
  } catch (err) {
    console.error('[POST /api/ptca]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const filter = { _id: req.params.id, ...ownerFilter(req.user) };
    const doc = await PtClosedActivity.findOneAndDelete(filter);
    if (!doc) return res.status(404).json({ message: 'Record not found.' });
    res.json({ success: true, id: req.params.id });
  } catch (err) {
    console.error('[DELETE /api/ptca/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const filter = { _id: req.params.id, ...ownerFilter(req.user) };
    const doc = await PtClosedActivity.findOneAndUpdate(filter, req.body, { new: true });
    if (!doc) return res.status(404).json({ message: 'Record not found.' });
    res.json(doc);
  } catch (err) {
    console.error('[PUT /api/ptca/:id]', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
`;
fs.writeFileSync(routePath, routeContent, 'utf8');

// 3. Update server.js
const serverPath = path.join(rootDir, 'backend/server.js');
let serverContent = fs.readFileSync(serverPath, 'utf8');
if (!serverContent.includes('ptClosedActivityRoutes')) {
  serverContent = serverContent.replace(
    /app\.use\('\/api\/ptpa',\s*require\('\.\/routes\/ptPendingActivityRoutes'\)\);/,
    `app.use('/api/ptpa', require('./routes/ptPendingActivityRoutes'));\napp.use('/api/ptca', require('./routes/ptClosedActivityRoutes'));`
  );
  fs.writeFileSync(serverPath, serverContent, 'utf8');
}

// 4. Create frontend/public/ptca.html
const ptpaPath = path.join(rootDir, 'frontend/public/ptpa.html');
const ptcaPath = path.join(rootDir, 'frontend/public/ptca.html');
let ptpaContent = fs.readFileSync(ptpaPath, 'utf8');

// Replace identifiers and titles
let ptcaContent = ptpaContent
  .replace(/Pending Activity/g, 'Closed Activity')
  .replace(/PT Pending Activity/g, 'PT Closed Activity')
  .replace(/\/api\/ptpa/g, '/api/ptca')
  .replace(/ptpa\.html/g, 'ptca.html')
  .replace(/<a class="nav-item active" href="ptca\.html">/g, '<a class="nav-item" href="ptpa.html"><span class="ico">&#128221;</span> Pending Activity</a>\n      <a class="nav-item active" href="ptca.html">')
  .replace(/<a class="nav-item" href="ptca\.html"><span class="ico">&#128221;<\/span> Closed Activity<\/a>\n      <a class="nav-item active" href="ptca\.html">/g, '<a class="nav-item active" href="ptca.html">');

// Ensure the icon matches (maybe a checkmark for closed activity)
ptcaContent = ptcaContent.replace(/&#128221;<\/span> Closed Activity<\/a>/g, '&#9989;</span> Closed Activity</a>');

fs.writeFileSync(ptcaPath, ptcaContent, 'utf8');

// 5. Update other sidebars
const ptFiles = ['ptcall.html', 'ptclose.html', 'ptour.html', 'ptdw.html', 'ptbir.html', 'ptcbir.html', 'pt-dashboard.html', 'ptpa.html'];
for (const file of ptFiles) {
  const p = path.join(rootDir, 'frontend/public', file);
  if (!fs.existsSync(p)) continue;
  let html = fs.readFileSync(p, 'utf8');
  if (!html.includes('href="ptca.html"')) {
    html = html.replace(
      /<a class="nav-item([^>]*) href="ptpa\.html"><span class="ico">&#128221;<\/span> Pending Activity<\/a>/,
      `<a class="nav-item$1 href="ptpa.html"><span class="ico">&#128221;</span> Pending Activity</a>\n      <a class="nav-item" href="ptca.html"><span class="ico">&#9989;</span> Closed Activity</a>`
    );
    fs.writeFileSync(p, html, 'utf8');
  }
}

// 6. Update employee-theme.js exception
const empThemePath = path.join(rootDir, 'frontend/public/employee-theme.js');
if (fs.existsSync(empThemePath)) {
  let themeContent = fs.readFileSync(empThemePath, 'utf8');
  if (!themeContent.includes('ptca.html')) {
    themeContent = themeContent.replace(
      /href\.includes\('ptpa\.html'\)/,
      "href.includes('ptpa.html') || href.includes('ptca.html')"
    );
    fs.writeFileSync(empThemePath, themeContent, 'utf8');
  }
}

console.log('Successfully created PT Closed Activity');
