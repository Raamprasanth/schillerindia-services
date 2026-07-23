const mongoose = require('mongoose');
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/schillerindia').then(async () => {
  const EscalationQueue = require('./backend/models/EscalationQueue');
  const EscalationRunLog = require('./backend/models/EscalationRunLog');
  
  // Recent DR run logs
  const logs = await EscalationRunLog.find({ category: 'sr' }).sort({ createdAt: -1 }).limit(10).lean();
  console.log('\n=== Recent DR Escalation Run Logs ===');
  if (!logs.length) console.log('No run logs found for DR escalation.');
  logs.forEach(l => console.log(l.jobDate, l.slot, l.status, 'frn:', l.frnCount, 'est:', l.estCount, 'err:', l.error || '-'));

  // Current queue
  const count = await EscalationQueue.countDocuments({ module: { $in: ['sr_frn', 'sr_est'] } });
  console.log('\n=== Pending SR/DR Queue Entries:', count, '===');
  const sample = await EscalationQueue.find({ module: { $in: ['sr_frn', 'sr_est'] } }).limit(5).lean();
  sample.forEach(s => console.log(s.module, s.sourceId, s.queuedAt));
  
  process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });
