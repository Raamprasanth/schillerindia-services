/**
 * SchillerIndia â€” Main Server
 *
 * Setup:
 *   npm install express mongoose cors dotenv
 *   Create .env:  MONGO_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/schillerindia
 *                 PORT=5000   (optional, defaults to 5000)
 *   node server.js
 */
require('dotenv').config();
const express    = require('express');
const mongoose   = require('mongoose');
const cors       = require('cors');
const path       = require('path');

// â”€â”€ ROUTE IMPORTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const authRoutes         = require('./routes/authRoutes');
const { companyRouter,
        branchRouter }   = require('./routes/companyRoutes');
const dashboardRoutes    = require('./routes/dashboardRoutes');
const dealerRoutes       = require('./routes/dealerRoutes');
const divisionRoutes     = require('./routes/divisions');
const engineerRoutes     = require('./routes/engineerRoutes');
const serviceRoutes      = require('./routes/serviceRoutes');
const userRoutes         = require('./routes/userRoutes');
const frnRoutes          = require('./routes/frnRoutes');
const underRepairRoutes  = require('./routes/underrepair');
const empServiceRoutes   = require('./routes/empServiceRoutes');
const obPendingRoutes    = require('./routes/empObPendingRoutes');
const empfrnRoutes = require('./routes/empfrnRoutes'); 
const scCompletedFrnRoutes  = require('./routes/scCompletedFrnRoutes');
const completedFrnRoutes    = require('./routes/completedFrnRoutes'); 
const scrapRoutes = require('./routes/scrapRoutes');
const EmpUnderrepairroutes = require('./routes/EmpUnderRepairroutes');
const repairTeamRoutes = require('./routes/Repairteamroutes');
const estimationPendingRoutes = require('./routes/estimationPending');
const rtfrnRoutes = require('./routes/rtfrn');
const atfrnRoutes = require('./routes/atfrnRoutes');
const rtobRoutes    = require('./routes/rtobRoutes');
const atobRoutes    = require('./routes/atobRoutes');
const rturRoutes = require('./routes/rturRoutes');
const aturRoutes = require('./routes/aturRoutes');  
const rtcrlRoutes = require('./routes/rtcrlRoutes');
const atcrlRoutes = require('./routes/atcrlRoutes');
const rtoaRoutes  = require('./routes/rtoaRoutes');
const rtcoaRoutes = require('./routes/rtcoaRoutes');
const rtcomrRoutes = require('./routes/rtcomrRoutes');
const rtccrRoutes = require('./routes/rtccrRoutes');
const escalationRoutes = require('./routes/escalationRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const scRoutes       = require('./routes/scRoutes');
const { initEscalationScheduler } = require('./services/escalationService');
const reportRoutes   = require('./routes/reports');
const scPrfObRoutes  = require('./routes/scPrfObRoutes');
const ePrfObRoutes   = require('./routes/ePrfObRoutes');
const fqcRoutes      = require('./routes/fqcRoutes');
const sccrRoutes     = require('./routes/sccrRoutes');
const loanItemRoutes = require('./routes/loanItemRoutes');
const eltItemRoutes  = require('./routes/eltItemRoutes');
const closedLoanRoutes = require('./routes/closedLoanRoutes');
const empClosedLoanRoutes = require('./routes/empClosedLoanRoutes');
const tourSummaryRoutes = require('./routes/tourSummaryRoutes');
const ptourSummaryRoutes = require('./routes/ptourSummaryRoutes');
const ptDailyWorkRoutes = require('./routes/ptDailyWorkRoutes');
const ecrRoutes      = require('./routes/ecrRoutes');
const ecallRoutes    = require('./routes/ecallRoutes');
const ecloseRoutes           = require('./routes/ecloseRoutes');
const fqcNonsaleableRoutes     = require('./routes/fqcNonsaleableRoutes');
const fqcNonSaleableFsRoutes   = require('./routes/fqcNonSaleableFsRoutes');
const birRoutes                = require('./routes/birRoutes');
const closedBirRoutes          = require('./routes/closedBirRoutes');
const empNonSaleableRoutes     = require('./routes/empNonSaleableRoutes');
const empSaleableRoutes        = require('./routes/empSaleableRoutes');
const eBirRoutes               = require('./routes/eBirRoutes');
const eClosedBirRoutes         = require('./routes/eClosedBirRoutes');
const ptCallRegisterRoutes     = require('./routes/ptCallRegisterRoutes');
const ptCallRoutes             = require('./routes/ptCallRoutes');
const ptCloseRoutes            = require('./routes/ptCloseRoutes');
const ptActivityRoutes         = require('./routes/ptActivityRoutes');
const ptBirRoutes              = require('./routes/ptBirRoutes');
const ptClosedBirRoutes        = require('./routes/ptClosedBirRoutes');

// â”€â”€ ADMIN ACTIVITY REGISTER ROUTES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const acallRoutes  = require('./routes/acallRoutes');
const acloseRoutes = require('./routes/acloseRoutes');
const aprofRoutes  = require('./routes/aprofRoutes');
const acrRoutes    = require('./routes/acrRoutes');
const ansRoutes    = require('./routes/ansRoutes');
const asRoutes     = require('./routes/asRoutes');
const abirRoutes   = require('./routes/abirRoutes');
const acbirRoutes  = require('./routes/acbirRoutes');
const aprfobRoutes = require('./routes/aprfobRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const userNotificationRoutes = require('./routes/userNotificationRoutes');
const serviceMessageRoutes = require('./routes/serviceMessageRoutes');
const serviceDocumentExtractRoutes = require('./routes/serviceDocumentExtractRoutes');
const defectAnalysisRoutes = require('./routes/defectAnalysisRoutes');
const backupRoutes = require('./routes/backupRoutes');


const app  = express();
const PORT = process.env.PORT || 5000;

// â”€â”€ MIDDLEWARE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use(cors({
  origin: [
    'http://localhost:3001',
    'http://127.0.0.1:3001',
    'http://localhost:5000',
    'http://127.0.0.1:5000',
    'http://localhost:8080',
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}));
app.use(express.json({ limit: '16mb' }));
app.use(express.urlencoded({ extended: true, limit: '16mb' }));

// â”€â”€ DATABASE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function connectMongo() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log('âœ…  MongoDB Atlas connected');
  } catch (err) {
    console.error('âŒ  MongoDB connection error:', err.message);
    console.error('âš ï¸  Starting server without database connection. API calls may fail until MongoDB is reachable.');
  }
}

connectMongo();
initEscalationScheduler();

mongoose.connection.on('connected', () => {
  console.log('âœ…  MongoDB connection established');
});

mongoose.connection.on('error', (err) => {
  console.error('âŒ  MongoDB runtime error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.warn('âš ï¸  MongoDB disconnected');
});

// â”€â”€ API ROUTES (must come BEFORE static files) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use('/api/auth',          authRoutes);
app.use('/api/companies',     companyRouter);
app.use('/api/branches',      branchRouter);
app.use('/api/dashboard',     dashboardRoutes);
app.use('/api/dealers',       dealerRoutes);
app.use('/api/divisions',     divisionRoutes);
app.use('/api/engineers',     engineerRoutes);
app.use('/api/services',      serviceRoutes);
app.use('/api/emp/services',  empServiceRoutes);
app.use('/api/users',         userRoutes);
app.use('/api/service-messages', serviceMessageRoutes);
app.use('/api/service-documents', serviceDocumentExtractRoutes);
app.use('/api/defect-analysis', defectAnalysisRoutes);
app.use('/api/frn',           frnRoutes);
app.use('/api/emp/frn',       empfrnRoutes);
app.use('/api/under-repair',  underRepairRoutes);
app.use('/api/ob-pending',    obPendingRoutes);
app.use('/api/emp/sc-completed-frn',   scCompletedFrnRoutes);
app.use('/api/emp/completed-frn',      completedFrnRoutes); 
app.use('/api/scrap', scrapRoutes);
app.use('/api/emp/underrepair', EmpUnderrepairroutes);
app.use('/api/repair-team', repairTeamRoutes);
app.use('/api/emp/estimation', estimationPendingRoutes);
app.use('/api/rtfrn', rtfrnRoutes);
app.use('/api/atfrn', atfrnRoutes);
app.use('/api/rtob', rtobRoutes);
app.use('/api/atob', atobRoutes);
app.use('/api/rtur', rturRoutes);
app.use('/api/atur', aturRoutes);
app.use('/api/rtcrl', rtcrlRoutes);
app.use('/api/atcrl', atcrlRoutes);  // Admin CRL â€” same rtcrls collection, read-only
app.use('/api/rtoa',  rtoaRoutes);
app.use('/api/rtcoa', rtcoaRoutes);
app.use('/api/rtcomr', rtcomrRoutes);
app.use('/api/rtccr', rtccrRoutes);
app.use('/api/escalation', escalationRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/sc',       scRoutes);
app.use('/api/reports',   reportRoutes);
app.use('/api/emp/prfob',  scPrfObRoutes);
app.use('/api/emp/eprfob', ePrfObRoutes);
app.use('/api/prfob',      ePrfObRoutes);
app.use('/api/fqc/non-saleable', fqcNonSaleableFsRoutes);  // fs.html â€” must be BEFORE /api/fqc
app.use('/api/fqc/nonsaleable',  fqcNonsaleableRoutes);    // fns.html â€” must be BEFORE /api/fqc
app.use('/api/fqc',             fqcRoutes);
app.use('/api/sccr',     sccrRoutes);
app.use('/api/loan-items', loanItemRoutes);
app.use('/api/elt-items',  eltItemRoutes);
app.use('/api/closed-loans', closedLoanRoutes);
app.use('/api/emp-closed-loans', empClosedLoanRoutes);
app.use('/api/tours',      tourSummaryRoutes);
app.use('/api/ptours',     ptourSummaryRoutes);
app.use('/api/ecr',      ecrRoutes);
app.use('/api/calls',              ecallRoutes);
app.use('/api/emp/calls/closed',   ecloseRoutes);
app.use('/api/emp/nonsaleable',    empNonSaleableRoutes);
app.use('/api/emp/saleables',      empSaleableRoutes);
app.use('/api/bir/closed',             closedBirRoutes);   // must be BEFORE /api/bir
app.use('/api/bir',                    birRoutes);
app.use('/api/emp/bir/closed',         eClosedBirRoutes);  // must be BEFORE /api/emp/bir
app.use('/api/emp/bir',                eBirRoutes);
app.use('/api/pt/call-register',      ptCallRegisterRoutes);
app.use('/api/pt/calls',              ptCallRoutes);
app.use('/api/pt/closed-calls',       ptCloseRoutes);
app.use('/api/pt/activity',           ptActivityRoutes);
app.use('/api/pt/bir/closed',         ptClosedBirRoutes);
app.use('/api/pt/bir',                ptBirRoutes);

// â”€â”€ ADMIN ACTIVITY REGISTER ROUTES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use('/api/admin/calls/closed',    acloseRoutes);   // must be BEFORE /api/admin/calls
app.use('/api/admin/calls',           acallRoutes);
app.use('/api/admin/prfob/closed',    acrRoutes);      // must be BEFORE /api/admin/prfob
app.use('/api/admin/prfob',           aprofRoutes);
app.use('/api/admin/nonsaleable',     ansRoutes);
app.use('/api/admin/saleables',       asRoutes);
app.use('/api/admin/bir/closed',      acbirRoutes);    // must be BEFORE /api/admin/bir
app.use('/api/admin/bir',             abirRoutes);
app.use('/api/admin/aprfob',          aprfobRoutes);
app.use('/api/admin/notifications',   notificationRoutes);
app.use('/api/admin/backup',          backupRoutes);
app.use('/api/notifications',         userNotificationRoutes);

// â”€â”€ HEALTH CHECK â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/api/health', (req, res) => {
  res.json({
    success:   true,
    message:   'SchillerIndia API is running',
    db:        mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

// â”€â”€ /api/me â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/api/me', require('./middleware/authMiddleware').protect, (req, res) => {
  res.json(req.user);
});

// â”€â”€ STATIC FILES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const frontendPath = path.join(__dirname, '../frontend/public');
app.use(express.static(frontendPath));

// Specific page routes
app.get('/',                            (req, res) => res.sendFile(path.join(frontendPath, 'index.html')));
app.get('/login',                       (req, res) => res.sendFile(path.join(frontendPath, 'login.html')));
app.get('/login.html',                  (req, res) => res.sendFile(path.join(frontendPath, 'login.html')));
app.get('/admin-dashboard.html',        (req, res) => res.sendFile(path.join(frontendPath, 'admin-dashboard.html')));
app.get('/acall.html',                  (req, res) => res.sendFile(path.join(frontendPath, 'acall.html')));
app.get('/acr.html',                    (req, res) => res.sendFile(path.join(frontendPath, 'acr.html')));
app.get('/abir.html',                   (req, res) => res.sendFile(path.join(frontendPath, 'abir.html')));
app.get('/acbir.html',                  (req, res) => res.sendFile(path.join(frontendPath, 'acbir.html')));
app.get('/employee-dashboard.html',     (req, res) => res.sendFile(path.join(frontendPath, 'employee-dashboard.html')));
app.get('/employee-service-list.html',  (req, res) => res.sendFile(path.join(frontendPath, 'employee-service-list.html')));
app.get('/ob-pending.html',             (req, res) => res.sendFile(path.join(frontendPath, 'ob-pending.html')));
app.get('/scprfob.html',               (req, res) => res.sendFile(path.join(frontendPath, 'scprfob.html')));
app.get('/fqc-dashboard.html',         (req, res) => res.sendFile(path.join(frontendPath, 'fqc-dashboard.html')));
app.get('/sccr.html',                  (req, res) => res.sendFile(path.join(frontendPath, 'sccr.html')));
app.get('/lt.html',                    (req, res) => res.sendFile(path.join(frontendPath, 'lt.html')));
app.get('/elt.html',                   (req, res) => res.sendFile(path.join(frontendPath, 'elt.html')));
app.get('/cli.html',                   (req, res) => res.sendFile(path.join(frontendPath, 'cli.html')));
app.get('/tours.html',                 (req, res) => res.sendFile(path.join(frontendPath, 'tours.html')));
app.get('/ecr.html',                   (req, res) => res.sendFile(path.join(frontendPath, 'ecr.html')));
app.get('/ecall.html',                 (req, res) => res.sendFile(path.join(frontendPath, 'ecall.html')));
app.get('/eclose.html',                (req, res) => res.sendFile(path.join(frontendPath, 'eclose.html')));
app.get('/emp-non-saleable.html',      (req, res) => res.sendFile(path.join(frontendPath, 'emp-non-saleable.html')));
app.get('/emp-saleables.html',         (req, res) => res.sendFile(path.join(frontendPath, 'emp-saleables.html')));
app.get('/fns.html',                   (req, res) => res.sendFile(path.join(frontendPath, 'fns.html')));
app.get('/fs.html',                    (req, res) => res.sendFile(path.join(frontendPath, 'fs.html')));
app.get('/fbir.html',                  (req, res) => res.sendFile(path.join(frontendPath, 'fbir.html')));
app.get('/fcbir.html',                 (req, res) => res.sendFile(path.join(frontendPath, 'fcbir.html')));
app.get('/ecbir.html',                 (req, res) => res.sendFile(path.join(frontendPath, 'ecbir.html')));
app.get('/ptbir.html',                 (req, res) => res.sendFile(path.join(frontendPath, 'ptbir.html')));
app.get('/ptcbir.html',                (req, res) => res.sendFile(path.join(frontendPath, 'ptcbir.html')));
app.get('/ptclose.html',               (req, res) => res.sendFile(path.join(frontendPath, 'ptclose.html')));
app.get('/notifications.html',         (req, res) => res.sendFile(path.join(frontendPath, 'notifications.html')));
app.get('/Atcrl.html',                 (req, res) => res.sendFile(path.join(frontendPath, 'Atcrl.html')));
app.get('/atcrl.html',                 (req, res) => res.sendFile(path.join(frontendPath, 'Atcrl.html')));

// â”€â”€ 404 FOR UNKNOWN API ROUTES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use('/api/*', (req, res) => {
  res.status(404).json({ success: false, message: `API route ${req.originalUrl} not found.` });
});

// â”€â”€ FALLBACK: serve index.html for any non-API route â”€â”€â”€â”€â”€
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// â”€â”€ GLOBAL ERROR HANDLER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use((err, req, res, next) => {
  console.error('Server Error:', err.stack);
  res.status(500).json({ success: false, message: 'Internal server error.' });
});

// â”€â”€ START â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.listen(PORT, () => {
  console.log(`\nðŸš€  Server running  â†’  http://localhost:${PORT}`);
  console.log(`ðŸ”  Login page      â†’  http://localhost:${PORT}/login.html`);
  console.log(`ðŸ“‚  API base        â†’  http://localhost:${PORT}/api\n`);
  console.log('ðŸ“‹  Registered API routes:');
  console.log(`    /api/auth             â†’ Auth`);
  console.log(`    /api/companies        â†’ Companies`);
  console.log(`    /api/branches         â†’ Branches`);
  console.log(`    /api/dashboard        â†’ Dashboard`);
  console.log(`    /api/dealers          â†’ Dealers`);
  console.log(`    /api/divisions        â†’ Divisions`);
  console.log(`    /api/engineers        â†’ Engineers`);
  console.log(`    /api/services         â†’ Service List (Admin)`);
  console.log(`    /api/emp/services     â†’ Service List (Employee)`);
  console.log(`    /api/users            â†’ Users`);
  console.log(`    /api/me               â†’ Current user`);
  console.log(`    /api/frn              â†’ Pending FRN (Admin)`);
  console.log(`    /api/emp/frn          â†’ Pending FRN (Employee)`);
  console.log(`    /api/under-repair     â†’ Under Repair`);
  console.log(`    /api/ob-pending       â†’ OB Pending`);
  console.log(`    /api/emp/prfob        â†’ PRF/OB Register`);
  console.log(`    /api/calls            â†’ Call Register (eCall)`);
  console.log(`    /api/emp/calls/closed  â†’ Closed Calls (eClose)`);
  console.log(`    /api/emp/nonsaleable   â†’ Employee Non Saleable (emp-non-saleable)`);
  console.log(`    /api/emp/saleables     â†’ Employee Saleables (emp-saleables)`);
  console.log(`    /api/fqc/nonsaleable   â†’ FQC Non Saleable (fns)`);
  console.log(`    /api/fqc/non-saleable  â†’ FQC Non Saleable (fs)`);
  console.log(`    /api/bir               â†’ Batch Inspection Report (fbir)`);
  console.log(`    /api/bir/closed        â†’ Closed BIR List (fcbir)`);
  console.log(`    /api/emp/bir           â†’ Employee BIR (ebir)`);
  console.log(`    /api/emp/bir/closed    â†’ Employee Closed BIR (ecbir)`);
  console.log(`    /api/pt/calls          â†’ PT Call Register (open/closed)`);
  console.log(`    /api/pt/closed-calls   â†’ PT Closed Calls (ptclose)`);
  console.log(`    /api/pt/activity       â†’ PT Activity (pending/closed)`);
  console.log(`    /api/pt/bir            â†’ PT BIR (ptbir)`);
  console.log(`    /api/pt/bir/closed     â†’ PT Closed BIR (ptcbir)`);
  console.log(`    /api/admin/notifications â†’ Admin Notifications`);
  console.log(`\nðŸŒ  Frontend pages served:`);
  console.log(`    /admin-dashboard.html`);
  console.log(`    /employee-dashboard.html`);
  console.log(`    /employee-service-list.html`);
  console.log(`    /ob-pending.html\n`);
});
