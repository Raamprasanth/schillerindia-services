require('dotenv').config();
const mongoose = require('mongoose');
const EscalationQueue = require('./backend/models/EscalationQueue');

async function clearQueue() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('Error: MONGODB_URI is not set in your .env file.');
      process.exit(1);
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected.');

    console.log('Clearing all entries from EscalationQueue...');
    const result = await EscalationQueue.deleteMany({});
    
    console.log(`Successfully cleared ${result.deletedCount} entries from the queue.`);
  } catch (error) {
    console.error('Error clearing queue:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
    process.exit(0);
  }
}

clearQueue();
