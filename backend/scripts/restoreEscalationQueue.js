require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Service = require('../models/Service');
const { 
  enqueueEscalationSnapshot, 
  buildUrEscalationRow, 
  UR_DAILY_TYPES 
} = require('../services/escalationService');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/schiller';

async function restoreQueue() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // Restore ur_followup (Stock Escalation)
    const stockItems = await Service.find({ typeWork: { $in: UR_DAILY_TYPES } }).lean();
    console.log(`Found ${stockItems.length} items for Stock Escalation (ur_followup)`);
    
    let count = 0;
    for (const item of stockItems) {
      const row = buildUrEscalationRow(item);
      await enqueueEscalationSnapshot('ur_followup', item._id, 'System Restore', row);
      count++;
    }
    console.log(`Restored ${count} items into ur_followup queue`);

    // Restore ur_scrap (Scrap Escalation)
    const scrapItems = await Service.find({ typeWork: 'Scrap' }).lean();
    console.log(`Found ${scrapItems.length} items for Scrap Escalation (ur_scrap)`);
    
    count = 0;
    for (const item of scrapItems) {
      const row = buildUrEscalationRow(item);
      await enqueueEscalationSnapshot('ur_scrap', item._id, 'System Restore', row);
      count++;
    }
    console.log(`Restored ${count} items into ur_scrap queue`);

    console.log('Restore complete!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

restoreQueue();
