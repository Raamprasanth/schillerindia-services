/**
 * SchillerIndia ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Main Server
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

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ ROUTE IMPORTS ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
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
const cswRoutes = require('./routes/cswRoutes');
const cerRoutes = require('./routes/cerRoutes');
const EmpUnderrepairroutes = require('./routes/EmpUnderRepairroutes');
const repairTeamRoutes = require('./routes/Repairteamroutes');
const estimationPendingRoutes = require('./routes/estimationPending');
const rtfrnRoutes = require('./routes/rtfrn');
const atfrnRoutes = require('./routes/atfrnRoutes');
const rtobRoutes    = require('./routes/rtobRoutes');
const atobRoutes    = require('./routes/atobRoutes');
const rturRoutes = require('./routes/rturRoutes');
const aturRoutes = require('./routes/aturRoutes');
const rtrrRoutes    = require('./routes/rtrrRoutes');
const atrrRoutes    = require('./routes/atrrRoutes');
const rtcrlRoutes   = require('./routes/rtcrlRoutes');
const rtcrrRoutes   = require('./routes/rtcrrRoutes');
const atcrrRoutes   = require('./routes/atcrrRoutes');
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
const trackerRoutes  = require('./routes/trackerRoutes');
const scPrfObRoutes  = require('./routes/scPrfObRoutes');
const ePrfObRoutes   = require('./routes/ePrfObRoutes');
const fqcRoutes      = require('./routes/fqcRoutes');
const sccrRoutes     = require('./routes/sccrRoutes');
const loanItemRoutes = require('./routes/loanItemRoutes');
const eltItemRoutes  = require('./routes/eltItemRoutes');
const srRoutes       = require('./routes/srRoutes');
const csrRoutes      = require('./routes/csrRoutes');
const closedLoanRoutes = require('./routes/closedLoanRoutes');
const empClosedLoanRoutes = require('./routes/empClosedLoanRoutes');
const tourSummaryRoutes = require('./routes/tourSummaryRoutes');
const ptourSummaryRoutes = require('./routes/ptourSummaryRoutes');
const atourRoutes = require('./routes/atourRoutes');
const adailyRoutes = require('./routes/adailyRoutes');
const empDailyWorkRoutes = require('./routes/empDailyWorkRoutes');
const ptDailyWorkRoutes = require('./routes/ptDailyWorkRoutes');
const ptPendingActivityRoutes = require('./routes/ptPendingActivityRoutes');
const ptClosedActivityRoutes = require('./routes/ptClosedActivityRoutes');
const empPendingActivityRoutes = require('./routes/empPendingActivityRoutes');
const empCompletedActivityRoutes = require('./routes/empCompletedActivityRoutes');
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
const drRoutes                 = require('./routes/drRoutes');
const todrRoutes               = require('./routes/todrRoutes');
const cdrRoutes                = require('./routes/cdrRoutes');
const ctodrRoutes              = require('./routes/ctodrRoutes');

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ ADMIN ACTIVITY REGISTER ROUTES ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
const acallRoutes  = require('./routes/acallRoutes');
const acloseRoutes = require('./routes/acloseRoutes');
const aprofRoutes  = require('./routes/aprofRoutes');
const acrRoutes    = require('./routes/acrRoutes');
const ansRoutes    = require('./routes/ansRoutes');
const asRoutes     = require('./routes/asRoutes');
const abirRoutes   = require('./routes/abirRoutes');
const acbirRoutes  = require('./routes/acbirRoutes');
const apaRoutes    = require('./routes/apaRoutes');
const acpaRoutes   = require('./routes/acpaRoutes');
const aprfobRoutes = require('./routes/aprfobRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const userNotificationRoutes = require('./routes/userNotificationRoutes');
const serviceMessageRoutes = require('./routes/serviceMessageRoutes');
const serviceDocumentExtractRoutes = require('./routes/serviceDocumentExtractRoutes');
const defectAnalysisRoutes = require('./routes/defectAnalysisRoutes');
const backupRoutes = require('./routes/backupRoutes');


const app  = express();
const PORT = process.env.PORT || 5000;

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ MIDDLEWARE ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
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

// Disable Cache/bfcache for HTML files (prevents back-button access after logout)
app.use((req, res, next) => {
  if (req.path.endsWith('.html') || req.path === '/' || req.path === '/login') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  }
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ DATABASE ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
async function connectMongo() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log('ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦  MongoDB Atlas connected');
  } catch (err) {
    console.error('ÃƒÂ¢Ã‚ÂÃ…â€™  MongoDB connection error:', err.message);
    console.error('ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â  Starting server without database connection. API calls may fail until MongoDB is reachable.');
  }
}

connectMongo();
initEscalationScheduler();

mongoose.connection.on('connected', () => {
  console.log('ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦  MongoDB connection established');
});

mongoose.connection.on('error', (err) => {
  console.error('ÃƒÂ¢Ã‚ÂÃ…â€™  MongoDB runtime error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.warn('ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â  MongoDB disconnected');
});

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ API ROUTES (must come BEFORE static files) ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
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
app.use('/api/csw', cswRoutes);
app.use('/api/cer', cerRoutes);
app.use('/api/emp/underrepair', EmpUnderrepairroutes);
app.use('/api/repair-team', repairTeamRoutes);
app.use('/api/emp/estimation', estimationPendingRoutes);
app.use('/api/rtfrn', rtfrnRoutes);
app.use('/api/atfrn', atfrnRoutes);
app.use('/api/rtob', rtobRoutes);
app.use('/api/atob', atobRoutes);
app.use('/api/rtur', rturRoutes);
app.use('/api/atur', aturRoutes);
app.use('/api/rtrr', rtrrRoutes);
app.use('/api/atrr', atrrRoutes);
app.use('/api/atcrr', atcrrRoutes);
app.use('/api/rtcrl', rtcrlRoutes);
app.use('/api/rtcrr', rtcrrRoutes);
app.use('/api/atcrl', atcrlRoutes);  // Admin CRL ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬  same rtcrls collection, read-only
app.use('/api/revert-repair', revertRepairRoutes);
app.use('/api/rtoa',  rtoaRoutes);
app.use('/api/rtcoa', rtcoaRoutes);
app.use('/api/rtcomr', rtcomrRoutes);
app.use('/api/rtccr', rtccrRoutes);
app.use('/api/escalation', escalationRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/sc',       scRoutes);
app.use('/api/reports',   reportRoutes);
app.use('/api/tracker',   trackerRoutes);
app.use('/api/emp/prfob',  scPrfObRoutes);
app.use('/api/emp/eprfob', ePrfObRoutes);
app.use('/api/prfob',      ePrfObRoutes);
app.use('/api/fqc/non-saleable', fqcNonSaleableFsRoutes);  // fs.html ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â must be BEFORE /api/fqc
app.use('/api/fqc/nonsaleable',  fqcNonsaleableRoutes);    // fns.html ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â must be BEFORE /api/fqc
app.use('/api/fqc',             fqcRoutes);
app.use('/api/sccr',     sccrRoutes);
app.use('/api/loan-items', loanItemRoutes);
app.use('/api/elt-items',  eltItemRoutes);
app.use('/api/sr',         srRoutes);
app.use('/api/csr',        csrRoutes);
app.use('/api/closed-loans', closedLoanRoutes);
app.use('/api/emp-closed-loans', empClosedLoanRoutes);
app.use('/api/tours',      tourSummaryRoutes);
app.use('/api/ptours',     ptourSummaryRoutes);
app.use('/api/atours',     atourRoutes);
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
app.use('/api/empdw',                 empDailyWorkRoutes);
app.use('/api/adaily',                adailyRoutes);
app.use('/api/ptpa',                  ptPendingActivityRoutes);
app.use('/api/ptca',                  ptClosedActivityRoutes);
app.use('/api/epa',                   empPendingActivityRoutes);
app.use('/api/ecpa',                  empCompletedActivityRoutes);
app.use('/api/pt/bir/closed',         ptClosedBirRoutes);
app.use('/api/pt/bir',                ptBirRoutes);
app.use('/api/dr',                    drRoutes);
app.use('/api/todr',                  todrRoutes);
app.use('/api/cdr',                   cdrRoutes);
app.use('/api/ctodr',                 ctodrRoutes);

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ ADMIN ACTIVITY REGISTER ROUTES ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
app.use('/api/admin/calls/closed',    acloseRoutes);   // must be BEFORE /api/admin/calls
app.use('/api/admin/calls',           acallRoutes);
app.use('/api/admin/prfob/closed',    acrRoutes);      // must be BEFORE /api/admin/prfob
app.use('/api/admin/prfob',           aprofRoutes);
app.use('/api/admin/nonsaleable',     ansRoutes);
app.use('/api/admin/saleables',       asRoutes);
app.use('/api/admin/bir/closed',      acbirRoutes);    // must be BEFORE /api/admin/bir
app.use('/api/admin/apa',             apaRoutes);
app.use('/api/admin/acpa',            acpaRoutes);
app.use('/api/admin/bir',             abirRoutes);
app.use('/api/admin/aprfob',          aprfobRoutes);
app.use('/api/admin/notifications',   notificationRoutes);
app.use('/api/admin/backup',          backupRoutes);
app.use('/api/notifications',         userNotificationRoutes);

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ HEALTH CHECK ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
app.get('/api/health', (req, res) => {
  res.json({
    success:   true,
    message:   'SchillerIndia API is running',
    db:        mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ /api/me ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
app.get('/api/me', require('./middleware/authMiddleware').protect, (req, res) => {
  res.json(req.user);
});

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ STATIC FILES ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
const frontendPath = path.join(__dirname, '../frontend/public');
app.use(express.static(frontendPath));

// Specific page routes
app.get('/',                            (req, res) => res.sendFile(path.join(frontendPath, 'index.html')));
app.get('/login',                       (req, res) => res.sendFile(path.join(frontendPath, 'login.html')));
app.get('/login.html',                  (req, res) => res.sendFile(path.join(frontendPath, 'login.html')));
app.get('/admin-dashboard.html',        (req, res) => res.sendFile(path.join(frontendPath, 'admin-dashboard.html')));
app.get('/acall.html',                  (req, res) => res.sendFile(path.join(frontendPath, 'acall.html')));
app.get('/adaily.html',                 (req, res) => res.sendFile(path.join(frontendPath, 'adaily.html')));
app.get('/acr.html',                    (req, res) => res.sendFile(path.join(frontendPath, 'acr.html')));
app.get('/abir.html',                   (req, res) => res.sendFile(path.join(frontendPath, 'abir.html')));
app.get('/acbir.html',                  (req, res) => res.sendFile(path.join(frontendPath, 'acbir.html')));
app.get('/apa.html',                    (req, res) => res.sendFile(path.join(frontendPath, 'apa.html')));
app.get('/acpa.html',                   (req, res) => res.sendFile(path.join(frontendPath, 'acpa.html')));
app.get('/employee-dashboard.html',     (req, res) => res.sendFile(path.join(frontendPath, 'employee-dashboard.html')));
app.get('/employee-service-list.html',  (req, res) => res.sendFile(path.join(frontendPath, 'employee-service-list.html')));
app.get('/ob-pending.html',             (req, res) => res.sendFile(path.join(frontendPath, 'ob-pending.html')));
app.get('/scprfob.html',               (req, res) => res.sendFile(path.join(frontendPath, 'scprfob.html')));
app.get('/dr.html',                    (req, res) => res.sendFile(path.join(frontendPath, 'dr.html')));
app.get('/todr.html',                  (req, res) => res.sendFile(path.join(frontendPath, 'todr.html')));
app.get('/cdr.html',                  (req, res) => res.sendFile(path.join(frontendPath, 'cdr.html')));
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
app.get('/admin-re-repair-atrr.html',  (req, res) => res.sendFile(path.join(frontendPath, 'admin-re-repair-atrr.html')));
app.get('/admin-closed-re-repair-atcrr.html',  (req, res) => res.sendFile(path.join(frontendPath, 'admin-closed-re-repair-atcrr.html')));

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ 404 FOR UNKNOWN API ROUTES ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
app.use('/api/*', (req, res) => {
  res.status(404).json({ success: false, message: `API route ${req.originalUrl} not found.` });
});

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ FALLBACK: serve index.html for any non-API route ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ GLOBAL ERROR HANDLER ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
app.use((err, req, res, next) => {
  console.error('Server Error:', err.stack);
  res.status(500).json({ success: false, message: 'Internal server error.' });
});

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ START ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\nÃƒÂ°Ã…Â¸Ã…Â¡Ã¢â€šÂ¬  Server running  ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢  http://localhost:${PORT}`);
  console.log(`ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â  Login page      ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢  http://localhost:${PORT}/login.html`);
  console.log(`ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Å¡  API base        ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢  http://localhost:${PORT}/api\n`);
  console.log('ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Â¹  Registered API routes:');
  console.log(`    /api/auth             ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Auth`);
  console.log(`    /api/companies        ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Companies`);
  console.log(`    /api/branches         ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Branches`);
  console.log(`    /api/dashboard        ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Dashboard`);
  console.log(`    /api/dealers          ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Dealers`);
  console.log(`    /api/divisions        ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Divisions`);
  console.log(`    /api/engineers        ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Engineers`);
  console.log(`    /api/services         ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Service List (Admin)`);
  console.log(`    /api/emp/services     ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Service List (Employee)`);
  console.log(`    /api/users            ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Users`);
  console.log(`    /api/me               ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Current user`);
  console.log(`    /api/frn              ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Pending FRN (Admin)`);
  console.log(`    /api/emp/frn          ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Pending FRN (Employee)`);
  console.log(`    /api/under-repair     ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Under Repair`);
  console.log(`    /api/ob-pending       ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ OB Pending`);
  console.log(`    /api/emp/prfob        ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ PRF/OB Register`);
  console.log(`    /api/calls            ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Call Register (eCall)`);
  console.log(`    /api/emp/calls/closed  ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Closed Calls (eClose)`);
  console.log(`    /api/emp/nonsaleable   ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Employee Non Saleable (emp-non-saleable)`);
  console.log(`    /api/emp/saleables     ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Employee Saleables (emp-saleables)`);
  console.log(`    /api/fqc/nonsaleable   ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ FQC Non Saleable (fns)`);
  console.log(`    /api/fqc/non-saleable  ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ FQC Non Saleable (fs)`);
  console.log(`    /api/bir               ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Batch Inspection Report (fbir)`);
  console.log(`    /api/bir/closed        ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Closed BIR List (fcbir)`);
  console.log(`    /api/emp/bir           ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Employee BIR (ebir)`);
  console.log(`    /api/emp/bir/closed    ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Employee Closed BIR (ecbir)`);
  console.log(`    /api/pt/calls          ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ PT Call Register (open/closed)`);
  console.log(`    /api/pt/closed-calls   ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ PT Closed Calls (ptclose)`);
  console.log(`    /api/pt/activity       ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ PT Activity (pending/closed)`);
  console.log(`    /api/pt/bir            ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ PT BIR (ptbir)`);
  console.log(`    /api/pt/bir/closed     ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ PT Closed BIR (ptcbir)`);
  console.log(`    /api/admin/notifications ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Admin Notifications`);
  console.log(`\nÃƒÂ°Ã…Â¸Ã…â€™Ã‚Â  Frontend pages served:`);
  console.log(`    /admin-dashboard.html`);
  console.log(`    /employee-dashboard.html`);
  console.log(`    /employee-service-list.html`);
  console.log(`    /ob-pending.html\n`);
});

