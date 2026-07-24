const fs = require('fs');
const file = 'backend/routes/reports.js';
let code = fs.readFileSync(file, 'utf8');

const newRoute = `
router.get('/performance/productteam', verifyToken, async (req, res) => {
  try {
    const { month } = req.query;
    if (!month) return res.status(400).json({ success: false, message: 'Month is required' });

    const { getProductTeamPerformanceData } = require('../services/performanceReviewService');
    const data = await getProductTeamPerformanceData({ month });

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching Product Team performance data:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});
`;

if (!code.includes('/performance/productteam')) {
  // Inject before module.exports = router;
  code = code.replace(
    'module.exports = router;',
    newRoute + '\nmodule.exports = router;'
  );
  fs.writeFileSync(file, code);
  console.log('Added productteam route.');
} else {
  console.log('Product team route already exists.');
}
