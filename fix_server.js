const fs = require('fs');
let s = fs.readFileSync('backend/server.js', 'utf8');

if (!s.includes("app.use('/api/todr',")) {
  s = s.replace(
    "app.use('/api/pt/bir',                ptBirRoutes);",
    "app.use('/api/pt/bir',                ptBirRoutes);\napp.use('/api/todr',                  todrRoutes);"
  );
  fs.writeFileSync('backend/server.js', s, 'utf8');
  console.log('Successfully injected /api/todr route!');
} else {
  console.log('Route already exists!');
}
