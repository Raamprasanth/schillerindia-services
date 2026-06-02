require('dotenv').config({path: 'backend/.env'});
const mongoose = require('mongoose');
const EClosedBir = require('./backend/models/EClosedBir');

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    const docs = await EClosedBir.find().limit(2).lean();
    console.log("Docs:", JSON.stringify(docs, null, 2));
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
