const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

// Load environment variables from the local .env file
require('dotenv').config({ path: path.join(__dirname, '.env') });

const mongoUri = process.env.MONGO_URI;

if (!mongoUri) {
  console.error("Error: MONGO_URI is not defined in the backend .env file");
  process.exit(1);
}

async function exportDatabase() {
  try {
    console.log("Connecting to MongoDB database...");
    console.log(`URI: ${mongoUri.replace(/:([^:@]+)@/, ':****@')}`); // Hide password in logs

    await mongoose.connect(mongoUri);
    console.log("Connected successfully!");

    const db = mongoose.connection.db;
    const collections = await db.collections();
    
    if (collections.length === 0) {
      console.log("No collections found in the database.");
      return;
    }

    // Create a folder for the exported database backup (saved inside backend/exports)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const exportFolder = path.join(__dirname, 'exports', `database_export_${timestamp}`);
    fs.mkdirSync(exportFolder, { recursive: true });
    console.log(`\nCreated backup directory: ${exportFolder}\n`);

    for (let col of collections) {
      const name = col.collectionName;
      process.stdout.write(`Exporting collection '${name}'... `);
      
      const documents = await col.find({}).toArray();
      const filePath = path.join(exportFolder, `${name}.json`);
      
      // Save collection data to JSON file
      fs.writeFileSync(filePath, JSON.stringify(documents, null, 2), 'utf-8');
      console.log(`Done! (${documents.length} records saved to ${name}.json)`);
    }

    console.log("\n==============================================");
    console.log("🎉 Database export completed successfully!");
    console.log(`Folder location: ${exportFolder}`);
    console.log("==============================================");
  } catch (error) {
    console.error("\n❌ Export failed with error:", error.message);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from database.");
  }
}

exportDatabase();
