const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'backend', 'routes', 'estimationPending.js');
let content = fs.readFileSync(file, 'utf8');

const targetOld = `      let alreadyScrap = false;
      if (updated.frnNo) alreadyScrap = await Scrap.findOne({ frnNo: updated.frnNo, typeWork: 'Supplier Warranty' });
      if (!alreadyScrap && updated.serviceId) alreadyScrap = await Scrap.findOne({ serviceId: updated.serviceId, typeWork: 'Supplier Warranty' });`;

const targetNew = `      let alreadyScrap = false;
      const mongoose = require('mongoose');
      let validServiceId = null;

      if (updated.serviceId) {
        if (mongoose.Types.ObjectId.isValid(updated.serviceId) && String(updated.serviceId).length === 24) {
          validServiceId = updated.serviceId;
        } else if (typeof updated.serviceId === 'string' && updated.serviceId.startsWith('SVC-')) {
          const svcObj = await Service.findOne({ serviceNo: updated.serviceId }).lean();
          if (svcObj) validServiceId = svcObj._id;
        }
      }
      
      // Update the record in memory so subsequent uses (like Scrap.create) use the valid ObjectId
      updated.serviceId = validServiceId;

      if (updated.frnNo) alreadyScrap = await Scrap.findOne({ frnNo: updated.frnNo, typeWork: 'Supplier Warranty' });
      if (!alreadyScrap && validServiceId) alreadyScrap = await Scrap.findOne({ serviceId: validServiceId, typeWork: 'Supplier Warranty' });`;

if (content.includes(targetOld)) {
  content = content.replace(targetOld, targetNew);
  fs.writeFileSync(file, content, 'utf8');
  console.log('Successfully patched estimationPending Supplier Warranty logic.');
} else {
  console.log('Could not find target in estimationPending.js');
}
