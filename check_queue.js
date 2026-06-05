const mongoose = require('mongoose');

async function checkQueue() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/schillerindia', { useNewUrlParser: true, useUnifiedTopology: true });
    
    const db = mongoose.connection.db;
    const items = await db.collection('escalation_queue').find().toArray();
    
    console.log(`Queue items count: ${items.length}`);
    if (items.length > 0) {
      console.log('Sample item:', items[0]);
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Error connecting to DB:', err);
    process.exit(1);
  }
}

checkQueue();
