const mongoose = require('mongoose');
const RepairTeam = require('./backend/models/Repairteam');
const ServiceMessageThread = require('./backend/models/ServiceMessageThread');
require('dotenv').config({path: './backend/.env'});

async function test() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB.");
  
  const recipients = await RepairTeam.find({ isActive: { $ne: false } }).select('name email division divisions role').lean();
  console.log("Recipients found:", recipients.length);
  
  if (recipients.length > 0) {
    const recipient = recipients[0];
    const employeeId = String(recipient._id || recipient.id);
    const employeeModel = 'RepairTeam';
    const employeeName = recipient.name || 'Recipient';
    const employeeEmail = recipient.email || '';

    const coordinatorId = new mongoose.Types.ObjectId().toString(); // Fake engineer ID
    const coordinatorName = 'Fake Engineer';
    const safeDivision = recipient.division || 'General';

    const msgText = "Test NW pop problem broadcast";

    try {
      const result = await ServiceMessageThread.findOneAndUpdate(
        { coordinatorId, employeeId, employeeModel },
        {
          $setOnInsert: {
            coordinatorId,
            coordinatorName,
            employeeId,
            employeeModel,
            employeeName,
            employeeEmail,
            division: safeDivision,
          },
          $set: { lastMessage: msgText, lastMessageAt: new Date() },
          $push: {
            messages: {
              senderId: coordinatorId,
              senderModel: 'Employee',
              senderName: coordinatorName,
              senderRole: 'employee',
              text: msgText,
              readBy: [coordinatorId],
            },
          },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
      console.log("Broadcast success. Thread ID:", result._id);
    } catch (err) {
      console.error("Broadcast problem failed:", err);
    }
  }
  
  mongoose.connection.close();
}
test();
