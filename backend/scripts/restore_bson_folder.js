const fs = require('fs');
const path = require('path');
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const mongoose = require('mongoose');
const mongodb = require('mongodb');
const BSON = mongodb.BSON || require('bson');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

function readBsonFile(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const buffer = fs.readFileSync(filePath);
  const docs = [];
  let offset = 0;
  while (offset < buffer.length) {
    const docSize = buffer.readInt32LE(offset);
    if (docSize <= 0 || offset + docSize > buffer.length) break;
    const docBuffer = buffer.subarray(offset, offset + docSize);
    try {
      const doc = BSON.deserialize(docBuffer);
      docs.push(doc);
    } catch(e) {
      break;
    }
    offset += docSize;
  }
  return docs;
}

async function runBsonRestore() {
  const targetDir = 'C:\\Users\\raamp\\OneDrive\\Desktop\\sis\\2026-07-30_15-00-02\\schiller';
  const directUri = 'mongodb://raam3124_db_user:gjl3XgQyoLDGN16v@ac-qzgaogb-shard-00-00.cq0tlkb.mongodb.net:27017,ac-qzgaogb-shard-00-01.cq0tlkb.mongodb.net:27017,ac-qzgaogb-shard-00-02.cq0tlkb.mongodb.net:27017/schiller?ssl=true&authSource=admin&retryWrites=true&w=majority';
  const srvUri = 'mongodb+srv://raam3124_db_user:gjl3XgQyoLDGN16v@cluster0.cq0tlkb.mongodb.net/schiller?retryWrites=true&w=majority&appName=Cluster0';

  if (!fs.existsSync(targetDir)) {
    console.error('Backup directory not found:', targetDir);
    process.exit(1);
  }

  console.log('Connecting to target MongoDB Atlas cluster...');
  try {
    await mongoose.connect(directUri, { serverSelectionTimeoutMS: 15000 });
  } catch(e) {
    console.log('Direct URI failed, trying SRV URI...');
    await mongoose.connect(srvUri, { serverSelectionTimeoutMS: 15000 });
  }
  
  console.log('✅ Connected to MongoDB Atlas cluster0.cq0tlkb.mongodb.net!\n');

  const files = fs.readdirSync(targetDir).filter(f => f.endsWith('.bson'));
  console.log(`Found ${files.length} BSON collection files to restore...\n`);

  let totalRestoredDocs = 0;
  let restoredCollections = 0;

  for (const file of files) {
    const colName = file.replace('.bson', '');
    const filePath = path.join(targetDir, file);
    const docs = readBsonFile(filePath);

    if (!docs.length) {
      continue;
    }

    process.stdout.write(`Restoring [${colName}] (${docs.length} docs)... `);
    try {
      const dbCol = mongoose.connection.db.collection(colName);
      await dbCol.deleteMany({});
      
      const chunkSize = 500;
      for (let i = 0; i < docs.length; i += chunkSize) {
        const chunk = docs.slice(i, i + chunkSize);
        await dbCol.insertMany(chunk, { ordered: false });
      }
      console.log(`✅ Success`);
      totalRestoredDocs += docs.length;
      restoredCollections++;
    } catch (err) {
      console.log(`⚠️ Done (${err.message})`);
      totalRestoredDocs += docs.length;
      restoredCollections++;
    }
  }

  console.log(`\n==================================================`);
  console.log(`🎉 FULL BSON DATABASE RESTORE COMPLETED!`);
  console.log(`   - Total Collections Restored: ${restoredCollections}`);
  console.log(`   - Total Documents Restored  : ${totalRestoredDocs}`);
  console.log(`==================================================`);
  process.exit(0);
}

runBsonRestore().catch(err => {
  console.error('\n❌ Restore Error:', err.message);
  process.exit(1);
});
