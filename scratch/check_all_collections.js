require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') });
const mongoose = require('mongoose');

async function checkAllCollections() {
  try {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
    await mongoose.connect(uri);
    console.log('Connected to MongoDB Atlas.');

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();

    for (const c of collections) {
      const count = await db.collection(c.name).countDocuments();
      if (count > 0) {
        console.log(`Collection '${c.name}': ${count} documents`);
      }
    }
  } catch(e) {
    console.error(e);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

checkAllCollections();
