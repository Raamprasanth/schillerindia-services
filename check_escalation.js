const mongoose = require('mongoose');

async function checkEscalation() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/schillerindia', { useNewUrlParser: true, useUnifiedTopology: true });
    
    // Check EscalationRunLog
    const db = mongoose.connection.db;
    const logs = await db.collection('escalationrunlogs').find().sort({ startedAt: -1 }).limit(1).toArray();
    
    if (logs.length > 0) {
      console.log('Latest Escalation Run Log:', logs[0]);
    } else {
      console.log('No escalation logs found.');
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Error connecting to DB:', err);
    process.exit(1);
  }
}

checkEscalation();
