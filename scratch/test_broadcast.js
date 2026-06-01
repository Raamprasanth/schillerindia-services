const mongoose = require('mongoose');
const RepairTeam = require('../backend/models/Repairteam');
const ServiceMessageThread = require('../backend/models/ServiceMessageThread');
require('dotenv').config({path: '../backend/.env'});

async function test() {
  await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  
  const recipients = await RepairTeam.find({ isActive: { $ne: false } }).select('name email division divisions role').lean();
  console.log("Recipients found:", recipients.length);
  for (const r of recipients) {
      console.log("-", r.name, " / ", r.email, " / div:", r.division);
  }
  
  const threads = await ServiceMessageThread.find({}).lean();
  console.log("\nThreads found:", threads.length);
  if (threads.length > 0) {
      console.log(JSON.stringify(threads[threads.length - 1], null, 2));
  }
  
  mongoose.connection.close();
}
test();
