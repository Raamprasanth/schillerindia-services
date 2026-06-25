const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const ServiceMessageThread = require('./models/ServiceMessageThread');
async function test() {
  await mongoose.connect(process.env.MONGO_URI);
  try {
    const indexes = await ServiceMessageThread.collection.indexes();
    console.log(indexes);
  } catch (e) {
    console.log("ERROR:", e.message);
  }
  process.exit(0);
}
test();
