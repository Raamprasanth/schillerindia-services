const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: './backend/.env' });

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    const Engineer = require('../backend/models/engineerModel');
    const engs = await Engineer.find({}).lean();
    console.log("Total engineers:", engs.length);
    
    // Let's test the frontend logic on all engineers for the divisions user mentioned
    const normalizeDivisionName = (v) => String(v || '').trim().toUpperCase().replace(/\s+/g, ' ');
    const getEngineerDivisions = (engineer) => {
      const values = [];
      if (Array.isArray(engineer?.divisions)) values.push(...engineer.divisions);
      if (engineer?.division) values.push(engineer.division);
      if (engineer?.divisionName) values.push(engineer.divisionName);
      return values.map(normalizeDivisionName).filter(Boolean);
    };

    const targetDivs = [
      "SHIPL CHANDIGAR", "SALEM", "TRICHY", "NAGERCOIL", 
      "VILLUPURUM", "TRIVANDRUM", "BANGLORE", "HUBILI", "DELHI"
    ];

    for (let div of targetDivs) {
      const matched = engs.filter(e => {
        const d = normalizeDivisionName(div);
        return d && getEngineerDivisions(e).includes(d);
      });
      console.log(`Division '${div}' matched ${matched.length} engineers`);
    }
    
    mongoose.disconnect();
  })
  .catch(err => console.error(err));
