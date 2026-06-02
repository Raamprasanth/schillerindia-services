require('dotenv').config({path: 'backend/.env'});
const mongoose = require('mongoose');

const schema = new mongoose.Schema({}, { strict: false });
const EClosedBir = mongoose.model('EClosedBirRecords', schema, 'eclosedbirrecords');

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    const docs = await EClosedBir.find().sort({createdAt:-1}).limit(2).lean();
    console.log("Found records:", docs.length);
    if(docs.length > 0) {
      console.log(JSON.stringify(docs[0], null, 2));
    }
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
