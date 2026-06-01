const mongoose = require('mongoose');
const Ctodr = require('./backend/models/Ctodr');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/shcl').then(async () => {
  const c = await Ctodr.find().limit(5).lean();
  console.log(c);
  process.exit();
});
