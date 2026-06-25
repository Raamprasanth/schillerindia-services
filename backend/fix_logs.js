const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const EscalationRunLog = require('./models/EscalationRunLog');

async function fixLogs() {
  await mongoose.connect(process.env.MONGO_URI);
  const logs = await EscalationRunLog.find({ message: /To:/ });
  console.log('Found', logs.length, 'logs to fix.');
  for (const log of logs) {
    if (log.message && log.message.includes('To:')) {
      const parts = log.message.split(' | ');
      const newParts = parts.filter(p => !p.trim().startsWith('To:'));
      log.message = newParts.join(' | ');
      await log.save();
    }
  }
  console.log('Done fixing logs!');
  process.exit(0);
}
fixLogs();
