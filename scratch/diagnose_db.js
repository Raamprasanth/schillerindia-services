const mongoose = require('mongoose');
const Ecall = require('./backend/models/Ecall');
const Eclose = require('./backend/models/Eclose');

(async () => {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/schiller');

    // Make a fake user id
    const fakeUserId = new mongoose.Types.ObjectId();

    // Create a dummy Ecall
    const doc = new Ecall({
      callDate: "2026-05-27",
      division: "SAG",
      engineer: "Test Eng",
      model: "Test Model",
      callType: "Technical",
      status: "Closed",
      remarks: "Testing eclose issue",
      createdBy: fakeUserId
    });

    const today = new Date().toISOString().split('T')[0];

    await Eclose.create({
      entryDate: doc.callDate || today,
      callDate:  doc.callDate  || today,
      closeDate: today,
      division:  doc.division  || '',
      typeCall:  '',
      branch:    doc.branch    || '',
      region:    doc.region    || '',
      scEngg:    doc.scEng     || '',
      engineer:  doc.engineer  || '',
      customer:  doc.customer  || '',
      model:     doc.model     || '',
      girSno:    doc.girSno    || '',
      status:    'Closed',
      remarks:   doc.remarks   || '',
      createdBy: fakeUserId,
    });
    
    console.log("Successfully created Eclose document!");
  } catch(e) {
    console.error("Error:", e.message);
    if(e.errors) {
      Object.keys(e.errors).forEach(key => console.error(key, ':', e.errors[key].message));
    }
  } finally {
    mongoose.disconnect();
  }
})();
