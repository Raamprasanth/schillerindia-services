const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const ServiceMessageThread = require('./models/ServiceMessageThread');
async function test() {
  await mongoose.connect(process.env.MONGO_URI);
  try {
    const threads = await ServiceMessageThread.find().sort({ createdAt: -1 }).limit(5);
    console.log(JSON.stringify(threads, null, 2));
  } catch (e) {
    console.log("ERROR:", e.message);
  }
  process.exit(0);
}
test();
