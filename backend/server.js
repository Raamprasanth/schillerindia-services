/**
 * SchillerIndia Ã¢â‚¬â€ Main Server
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

// Ã¢â€â‚¬Ã¢â€â‚¬ ROUTE IMPORTS Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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
const revertRepairRoutes = require('./routes/revertRepairRoutes');
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
const ptPendingActivityRoutes = require('./routes/ptPendingActivityRoutes');
const ptClosedActivityRoutes = require('./routes/ptClosedActivityRoutes');
const empPendingActivityRoutes = require('./routes/empPendingActivityRoutes');
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
const todrRoutes               = require('./routes/todrRoutes');
const ctodrRoutes              = require('./routes/ctodrRoutes');

// Ã¢â€â‚¬Ã¢â€â‚¬ ADMIN ACTIVITY REGISTER ROUTES Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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

// Ã¢â€â‚¬Ã¢â€â‚¬ MIDDLEWARE Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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

// Ã¢â€â‚¬Ã¢â€â‚¬ DATABASE Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
async function connectMongo() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log('Ã¢Å“â€¦  MongoDB Atlas connected');
  } catch (err) {
    console.error('Ã¢ÂÅ’  MongoDB connection error:', err.message);
    console.error('Ã¢Å¡Â Ã¯Â¸Â  Starting server without database connection. API calls may fail until MongoDB is reachable.');
  }
}

connectMongo();
initEscalationScheduler();

mongoose.connection.on('connected', () => {
  console.log('Ã¢Å“â€¦  MongoDB connection established');
});

mongoose.connection.on('error', (err) => {
  console.error('Ã¢ÂÅ’  MongoDB runtime error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.warn('Ã¢Å¡Â Ã¯Â¸Â  MongoDB disconnected');
});

// Ã¢â€â‚¬Ã¢â€â‚¬ API ROUTES (must come BEFORE static files) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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
app.use('/api/atcrl', atcrlRoutes);  // Admin CRL Ã¢â‚¬â€  same rtcrls collection, read-only
app.use('/api/revert-repair', revertRepairRoutes);
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
app.use('/api/fqc/non-saleable', fqcNonSaleableFsRoutes);  // fs.html Ã¢â‚¬â€ must be BEFORE /api/fqc
app.use('/api/fqc/nonsaleable',  fqcNonsaleableRoutes);    // fns.html Ã¢â‚¬â€ must be BEFORE /api/fqc
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
app.use('/api/ptdw',                  ptDailyWorkRoutes);
app.use('/api/ptpa',                  ptPendingActivityRoutes);
app.use('/api/ptca',                  ptClosedActivityRoutes);
app.use('/api/epa',                   empPendingActivityRoutes);
app.use('/api/pt/bir/closed',         ptClosedBirRoutes);
app.use('/api/pt/bir',                ptBirRoutes);
app.use('/api/todr',                  todrRoutes);
app.use('/api/ctodr',                 ctodrRoutes);

// Ã¢â€â‚¬Ã¢â€â‚¬ ADMIN ACTIVITY REGISTER ROUTES Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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

// Ã¢â€â‚¬Ã¢â€â‚¬ HEALTH CHECK Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
app.get('/api/health', (req, res) => {
  res.json({
    success:   true,
    message:   'SchillerIndia API is running',
    db:        mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

// Ã¢â€â‚¬Ã¢â€â‚¬ /api/me Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
app.get('/api/me', require('./middleware/authMiddleware').protect, (req, res) => {
  res.json(req.user);
});

// Ã¢â€â‚¬Ã¢â€â‚¬ STATIC FILES Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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
app.get('/todr.html',                  (req, res) => res.sendFile(path.join(frontendPath, 'todr.html')));
app.get('/ctodr.html',                 (req, res) => res.sendFile(path.join(frontendPath, 'ctodr.html')));
app.get('/Sc-dashboard.html',         (req, res) => res.sendFile(path.join(frontendPath, 'Sc-dashboard.html')));
app.get('/sc-dashboard.html',         (req, res) => res.sendFile(path.join(frontendPath, 'Sc-dashboard.html')));
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
app.get('/epa.html',                   (req, res) => res.sendFile(path.join(frontendPath, 'epa.html')));
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

// Ã¢â€â‚¬Ã¢â€â‚¬ 404 FOR UNKNOWN API ROUTES Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
app.use('/api/*', (req, res) => {
  res.status(404).json({ success: false, message: `API route ${req.originalUrl} not found.` });
});

// Ã¢â€â‚¬Ã¢â€â‚¬ FALLBACK: serve index.html for any non-API route Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Ã¢â€â‚¬Ã¢â€â‚¬ GLOBAL ERROR HANDLER Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
app.use((err, req, res, next) => {
  console.error('Server Error:', err.stack);
  res.status(500).json({ success: false, message: 'Internal server error.' });
});

// Ã¢â€â‚¬Ã¢â€â‚¬ START Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
app.listen(PORT, () => {
  console.log(`\nÃ°Å¸Å¡â‚¬  Server running  Ã¢â€ â€™  http://localhost:${PORT}`);
  console.log(`Ã°Å¸â€Â  Login page      Ã¢â€ â€™  http://localhost:${PORT}/login.html`);
  console.log(`Ã°Å¸â€œâ€š  API base        Ã¢â€ â€™  http://localhost:${PORT}/api\n`);
  console.log('Ã°Å¸â€œâ€¹  Registered API routes:');
  console.log(`    /api/auth             Ã¢â€ â€™ Auth`);
  console.log(`    /api/companies        Ã¢â€ â€™ Companies`);
  console.log(`    /api/branches         Ã¢â€ â€™ Branches`);
  console.log(`    /api/dashboard        Ã¢â€ â€™ Dashboard`);
  console.log(`    /api/dealers          Ã¢â€ â€™ Dealers`);
  console.log(`    /api/divisions        Ã¢â€ â€™ Divisions`);
  console.log(`    /api/engineers        Ã¢â€ â€™ Engineers`);
  console.log(`    /api/services         Ã¢â€ â€™ Service List (Admin)`);
  console.log(`    /api/emp/services     Ã¢â€ â€™ Service List (Employee)`);
  console.log(`    /api/users            Ã¢â€ â€™ Users`);
  console.log(`    /api/me               Ã¢â€ â€™ Current user`);
  console.log(`    /api/frn              Ã¢â€ â€™ Pending FRN (Admin)`);
  console.log(`    /api/emp/frn          Ã¢â€ â€™ Pending FRN (Employee)`);
  console.log(`    /api/under-repair     Ã¢â€ â€™ Under Repair`);
  console.log(`    /api/ob-pending       Ã¢â€ â€™ OB Pending`);
  console.log(`    /api/emp/prfob        Ã¢â€ â€™ PRF/OB Register`);
  console.log(`    /api/calls            Ã¢â€ â€™ Call Register (eCall)`);
  console.log(`    /api/emp/calls/closed  Ã¢â€ â€™ Closed Calls (eClose)`);
  console.log(`    /api/emp/nonsaleable   Ã¢â€ â€™ Employee Non Saleable (emp-non-saleable)`);
  console.log(`    /api/emp/saleables     Ã¢â€ â€™ Employee Saleables (emp-saleables)`);
  console.log(`    /api/fqc/nonsaleable   Ã¢â€ â€™ FQC Non Saleable (fns)`);
  console.log(`    /api/fqc/non-saleable  Ã¢â€ â€™ FQC Non Saleable (fs)`);
  console.log(`    /api/bir               Ã¢â€ â€™ Batch Inspection Report (fbir)`);
  console.log(`    /api/bir/closed        Ã¢â€ â€™ Closed BIR List (fcbir)`);
  console.log(`    /api/emp/bir           Ã¢â€ â€™ Employee BIR (ebir)`);
  console.log(`    /api/emp/bir/closed    Ã¢â€ â€™ Employee Closed BIR (ecbir)`);
  console.log(`    /api/pt/calls          Ã¢â€ â€™ PT Call Register (open/closed)`);
  console.log(`    /api/pt/closed-calls   Ã¢â€ â€™ PT Closed Calls (ptclose)`);
  console.log(`    /api/pt/activity       Ã¢â€ â€™ PT Activity (pending/closed)`);
  console.log(`    /api/pt/bir            Ã¢â€ â€™ PT BIR (ptbir)`);
  console.log(`    /api/pt/bir/closed     Ã¢â€ â€™ PT Closed BIR (ptcbir)`);
  console.log(`    /api/admin/notifications Ã¢â€ â€™ Admin Notifications`);
  console.log(`\nÃ°Å¸Å’Â  Frontend pages served:`);
  console.log(`    /admin-dashboard.html`);
  console.log(`    /employee-dashboard.html`);
  console.log(`    /employee-service-list.html`);
  console.log(`    /ob-pending.html\n`);
});
