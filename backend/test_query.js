const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: './.env' });

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/shcl').then(async () => {
  const modelsPath = path.join(__dirname, 'models');
  const files = fs.readdirSync(modelsPath).filter(f => f.endsWith('.js'));
  for (const file of files) {
    try {
      const Model = require('./models/' + file);
      if (Model && Model.findOne) {
        const doc = await Model.findOne({ $or: [{scReNo: 'SH-0579'}, {scRefNo: 'SH-0579'}, {scRno: 'SH-0579'}] }).lean();
        if (doc) {
          console.log('Found in', file);
          console.log(Object.keys(doc).filter(k => k.toLowerCase().includes('comp') || k.toLowerCase().includes('part')));
          if (doc.components) console.log('components:', doc.components);
          if (doc.obComponents) console.log('obComponents:', doc.obComponents);
          if (doc.compUsedToRepair) console.log('compUsedToRepair:', doc.compUsedToRepair);
          if (doc.componentsUsed) console.log('componentsUsed:', doc.componentsUsed);
        }
      }
    } catch(e) {}
  }
  process.exit();
}).catch(console.error);
