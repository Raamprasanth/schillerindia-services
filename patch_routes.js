const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'backend', 'routes', 'reports.js');
let content = fs.readFileSync(filePath, 'utf8');

const newRoute = `
router.get('/performance/commercial', verifyToken, async (req, res) => {
  try {
    const { month } = req.query;
    if (!month) return res.status(400).json({ success: false, message: 'Month is required' });

    const { getCommercialPerformanceData } = require('../services/performanceReviewService');
    const data = await getCommercialPerformanceData({ month });

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error generating commercial performance summary:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});
`;

if (!content.includes('/performance/commercial')) {
  // Insert before the `/performance/summary` route
  content = content.replace("router.get('/performance/summary', verifyToken, async (req, res) => {", newRoute + "\nrouter.get('/performance/summary', verifyToken, async (req, res) => {");
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('patched reports.js');
} else {
  console.log('already patched');
}
