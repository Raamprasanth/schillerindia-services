const mongoose = require('mongoose');
const FqcNonsaleable = require('./backend/models/FqcNonsaleable');
const FqcNonSaleableFs = require('./backend/models/FqcNonSaleableFs');
require('dotenv').config({ path: './backend/.env' });

async function test() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/shcl', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log("Connected to MongoDB");

    // 1. Create a test record in FNS
    const fnsDoc = new FqcNonsaleable({
      division: "TEST_DIV",
      unitDetails: "Demo",
      model: "TEST_MODEL",
      modelSn: "123",
      fqcInDate: "2023-01-01",
      reportedProblem: "Test Problem",
      status: "Pending"
    });
    
    await fnsDoc.save();
    console.log("FNS record created:", fnsDoc._id);

    // 2. Simulate the PUT request update to Closed
    const updateData = { status: "Closed" };
    
    const doc = await FqcNonsaleable.findByIdAndUpdate(
      fnsDoc._id,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (doc.status === 'Closed') {
      const newFsDoc = new FqcNonSaleableFs({
        division: doc.division,
        unitDetails: doc.unitDetails,
        model: doc.model,
        modelSn: doc.modelSn,
        unitConfig: doc.unitConfig || '',
        replacedSn: doc.replacedSn || '',
        
        entryDate: doc.entryDate || '',
        fqcInwardDate: doc.fqcInDate || '',
        scInwardDate: doc.scInDate || '',
        defRecvDate: doc.defRecvDate || '',
        tentativeDate: doc.tentDate || '',
        repShipDate: doc.repShipDate || '',
        shipDateFqc: doc.shipFqcDate || '',

        region: doc.region || '',
        branch: doc.branch || '',
        engineer: doc.engineer || '',
        scEngineer: doc.scEngineer || '',
        dealer: doc.dealer || '',
        supplier: doc.supplier || '',
        customer: doc.customer || '',

        reportedProblem: doc.reportedProblem || '',
        fqcRemarks: doc.fqcObservation || 'Moved from FNS',
        scObservation: doc.scObservation || '',
        rootCause: doc.rootCause || '',
        reqParts: doc.reqParts || '',
        actionPlan: doc.actionPlan || '',
        finalRemarks: doc.finalRemarks || '',

        finalStatus: 'pending',
        // createdBy: dummy
      });
      
      await newFsDoc.save();
      console.log("FS record created successfully:", newFsDoc._id);
      
      await FqcNonsaleable.findByIdAndDelete(doc._id);
      console.log("FNS record deleted successfully.");
    }
  } catch (err) {
    console.error("Error occurred:", err);
  } finally {
    mongoose.disconnect();
  }
}

test();
