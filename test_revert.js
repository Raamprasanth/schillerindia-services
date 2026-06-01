const mongoose = require('mongoose');
const { app } = require('./backend/server'); // Just load the app to trigger DB connection
require('dotenv').config({path: './backend/.env'});

// Wait a bit for db connection
setTimeout(async () => {
  try {
    const Service = require('./backend/models/Service');
    const RTCRL = require('./backend/models/Rtcrl');
    
    // Check if there are any RTCRL records
    const crls = await RTCRL.find().limit(1).lean();
    if (crls.length > 0) {
      console.log("Found RTCRL:", crls[0]._id);
      
      const req = {
        params: { id: crls[0]._id },
        body: { problemObserved: 'Test NW POP Problem' },
        user: { _id: '646f11223344556677889900', _collection: 'Employee', name: 'Test Engineer' }
      };
      
      // Simulate calling the revert repair route
      // Wait, we can just call it via HTTP since server is running?
      // No, server might not be running in this script.
    } else {
      console.log("No RTCRL records found.");
    }
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}, 2000);
