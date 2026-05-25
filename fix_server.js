const fs = require('fs');
let s = fs.readFileSync('backend/server.js', 'utf8');

// Require the route
if (!s.includes('const ctodrRoutes')) {
  s = s.replace(
    /const todrRoutes\s*=\s*require\('\.\/routes\/todrRoutes'\);/,
    "const todrRoutes               = require('./routes/todrRoutes');\nconst ctodrRoutes              = require('./routes/ctodrRoutes');"
  );
}

// Mount the route
if (!s.includes("app.use('/api/ctodr',")) {
  s = s.replace(
    "app.use('/api/todr',                  todrRoutes);",
    "app.use('/api/todr',                  todrRoutes);\napp.use('/api/ctodr',                 ctodrRoutes);"
  );
}

fs.writeFileSync('backend/server.js', s, 'utf8');
console.log('Successfully injected /api/ctodr route!');
