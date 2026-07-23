const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/shcl')
  .then(async () => {
    const Service = require('./backend/models/Service');
    const Todr = require('./backend/models/Todr');
    const ScPrfOb = require('./backend/models/ScPrfOb');
    const ScSr = require('./backend/models/ScSr');

    const s = await Service.findOne().sort({createdAt:-1});
    console.log('Service:', s);

    const t = await Todr.findOne().sort({createdAt:-1});
    console.log('Todr:', t);

    const sr = await ScSr.findOne().sort({createdAt:-1});
    console.log('ScSr:', sr);

    const prf = await ScPrfOb.findOne().sort({createdAt:-1});
    console.log('ScPrfOb:', prf);

    mongoose.disconnect();
  })
  .catch(console.error);
