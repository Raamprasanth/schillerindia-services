const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const RTUR = require('../models/rturModel');
const RTOB = require('../models/RTOB');
const RTFRN = require('../models/RTFRN.JS');
const EmpFRN = require('../models/EmpFRN');
const RTCRL = require('../models/rtcrlModel');
const Service = require('../models/Service');
const EstimationPending = require('../models/EstimationPending');
const { protect, repairTeamOrEmployeeOrAdmin } = require('../middleware/authMiddleware');

// Mount at /api/revert-repair
router.use(protect, repairTeamOrEmployeeOrAdmin);

async function resolveDivisionName(service) {
  if (!service) return 'OTHER';
  
  // 1. Try divisionName field
  let name = String(service.divisionName || '').trim();
  if (name) return name;
  
  // 2. Try division field
  let div = service.division;
  if (div) {
    if (typeof div === 'object' && div !== null) {
      if (div.name) return String(div.name).trim();
    } else if (typeof div === 'string' || div instanceof mongoose.Types.ObjectId) {
      try {
        const Division = require('../models/Division');
        const divDoc = await Division.findById(div).lean();
        if (divDoc && divDoc.name) return String(divDoc.name).trim();
      } catch (_) {}
    }
  }
  
  // 3. Fallback to branch or region
  return String(service.branch || service.reg || 'OTHER').trim();
}

async function backendBroadcastProblem(req, record, problemText, safeDivision) {
  try {
    const ServiceMessageThread = require('../models/ServiceMessageThread');
    const RepairTeam = require('../models/Repairteam');

    const repairFilter = { isActive: { $ne: false } };
    if (safeDivision && safeDivision !== 'OTHER') {
      repairFilter.$or = [
        { division: safeDivision },
        { divisions: safeDivision }
      ];
    }
    
    let recipients = await RepairTeam.find(repairFilter).select('name email division divisions role').lean();
    if (recipients.length === 0) {
      recipients = await RepairTeam.find({ isActive: { $ne: false } }).select('name email division divisions role').lean();
    }

    if (recipients.length === 0) return;

    const senderId = String(req.user._id || req.user.id || '');
    let senderModel = 'User';
    if (req.user._collection === 'Employee') senderModel = 'Employee';
    else if (req.user._collection === 'RepairTeam') senderModel = 'RepairTeam';
    
    const senderName = req.user.name || 'Service Engineer';
    const senderRole = String(req.user.role || '').toLowerCase();

    const scRefNo = record.scReNo || record.scRno || record.scRefNo || '-';
    const defGirNo = record.defGir || record.defGirNo || '-';
    const model = record.model || '-';

    const msgText =
      `🔴 NW Re-Repair Alert\n` +
      `SC Ref: ${scRefNo}  |  DEF GIR: ${defGirNo}\n` +
      `Model: ${model}  |  Division: ${safeDivision}\n` +
      `\nProblem Observed:\n${problemText}\n` +
      `\nReported by: ${senderName}`;

    const message = {
      senderId,
      senderModel,
      senderName,
      senderRole,
      text: msgText,
      readBy: [senderId],
    };

    for (const recipient of recipients) {
      const employeeId = String(recipient._id || recipient.id);
      const employeeModel = 'RepairTeam';
      const employeeName = recipient.name || 'Recipient';
      const employeeEmail = recipient.email || '';

      const coordinatorId = senderId;
      const coordinatorName = senderName;

      await ServiceMessageThread.findOneAndUpdate(
        { coordinatorId, employeeId, employeeModel },
        {
          $setOnInsert: {
            coordinatorId,
            coordinatorName,
            employeeId,
            employeeModel,
            employeeName,
            employeeEmail,
            division: safeDivision || 'General',
          },
          $set: { lastMessage: msgText, lastMessageAt: new Date() },
          $push: { messages: message },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
    }
  } catch (err) {
    console.error('[backendBroadcastProblem] Error:', err.message);
  }
}

router.post('/:id', async (req, res) => {
  try {
    const serviceId = req.params.id;
    const problemObserved = (req.body && req.body.problemObserved) ? String(req.body.problemObserved).trim() : '';

    let service = await Service.findById(serviceId);
    let isEstimation = false;
    let empfrnDoc = null;

    if (!service) {
      service = await EstimationPending.findById(serviceId);
      if (service) {
        isEstimation = true;
      }
    }

    if (!service) {
      // Check if it's an EmpFRN ID
      empfrnDoc = await EmpFRN.findById(serviceId);
      if (empfrnDoc) {
        if (empfrnDoc.serviceId) {
          service = await Service.findById(empfrnDoc.serviceId);
        } else {
          // Fallback search by scRefNo/defGirNo
          const scRefNo = empfrnDoc.scRno || empfrnDoc.frnNo;
          const defGirNo = empfrnDoc.defGir;
          const escapeRegex = (string) => string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
          let serviceFilter = { $or: [] };
          const cleanScRef = scRefNo && typeof scRefNo === 'string' ? scRefNo.trim() : '';
          if (cleanScRef && cleanScRef !== '-') {
            const scRegex = { $regex: new RegExp('^' + escapeRegex(cleanScRef) + '$', 'i') };
            serviceFilter.$or.push({ scReNo: scRegex });
            serviceFilter.$or.push({ scRno: scRegex });
            serviceFilter.$or.push({ scRefNo: scRegex });
          }
          const cleanGir = defGirNo && typeof defGirNo === 'string' ? defGirNo.trim() : '';
          if (cleanGir && cleanGir !== '-') {
            const girRegex = { $regex: new RegExp('^' + escapeRegex(cleanGir) + '$', 'i') };
            serviceFilter.$or.push({ defGir: girRegex });
            serviceFilter.$or.push({ defGirNo: girRegex });
          }
          if (serviceFilter.$or.length > 0) {
            service = await Service.findOne(serviceFilter);
          }
        }
      }
    }

    if (!service) {
      return res.status(404).json({ success: false, message: 'Service/Estimation record not found' });
    }

    // Find the associated EmpFRN record if we haven't already and this is a Service
    if (!empfrnDoc && !isEstimation) {
      empfrnDoc = await EmpFRN.findOne({ serviceId: service._id });
    }

    // 1. Delete corresponding RTCRL record
    const scRefNo = service.scReNo || service.scRno || service.scRefNo;
    const defGirNo = service.defGir || service.defGirNo;
    
    const escapeRegex = (string) => string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    let crlFilter = { $or: [] };
    
    const cleanSc = scRefNo && typeof scRefNo === 'string' ? scRefNo.trim() : '';
    if (cleanSc && cleanSc !== '-') {
      crlFilter.$or.push({ scRefNo: { $regex: new RegExp('^' + escapeRegex(cleanSc) + '$', 'i') } });
    }
    const cleanGir = defGirNo && typeof defGirNo === 'string' ? defGirNo.trim() : '';
    if (cleanGir && cleanGir !== '-') {
      crlFilter.$or.push({ defGirNo: { $regex: new RegExp('^' + escapeRegex(cleanGir) + '$', 'i') } });
    }
    
    // Find the RTCRL record to carry over all its fields
    let deletedSourceId = null;
    let deletedSourceCollection = null;
    let crlCategory = 'UR';
    let crlDoc = null;
    
    if (crlFilter.$or.length > 0) {
      const crlDocs = await RTCRL.find(crlFilter).sort({ closedDate: -1 }).limit(1);
      if (crlDocs.length > 0) {
        crlDoc = crlDocs[0];
        deletedSourceId = crlDoc.sourceId;
        deletedSourceCollection = crlDoc.sourceCollection;
        crlCategory = crlDoc.category || 'UR';
        await RTCRL.findByIdAndDelete(crlDoc._id);
      }
    }

    // 2. Clear the completion flags and ensure sent flags are true on the service/estimation record
    service.rturCompleted = false;
    service.rtfrnCompleted = false;
    service.rtobCompleted = false;
    service.rturSent = true;
    service.rtfrnSent = true;
    service.rtobSent = true;
    service.repairStatus = 're repair product';

    let remarkParts = ['Re-repair requested'];
    if (problemObserved) remarkParts.push('Problem Observed: ' + problemObserved);
    service.finalRemarks = (service.finalRemarks ? service.finalRemarks + ' | ' : '') + remarkParts.join(' | ');
    await service.save({ validateBeforeSave: false });

    if (empfrnDoc) {
      empfrnDoc.rtfrnCompleted = false;
      empfrnDoc.rtfrnSent = true;
      await empfrnDoc.save({ validateBeforeSave: false });
    }

    // 3. Re-create the RTUR/RTFRN/RTOB record with all fields restored from RTCRL
    let finalSourceCollection = deletedSourceCollection;
    if (!finalSourceCollection) {
      if (isEstimation) finalSourceCollection = 'rtob';
      else if (empfrnDoc) finalSourceCollection = 'rtfrn';
      else finalSourceCollection = 'rtur';
    }

    const ModelToRecreate = 
      finalSourceCollection === 'rtob' ? RTOB :
      finalSourceCollection === 'rtfrn' ? RTFRN : RTUR;
      
    // Determine the category
    let category = crlCategory;
    if (service.frnNo && finalSourceCollection === 'rtfrn') category = 'PFRN';
    else if (finalSourceCollection === 'rtob') category = 'OB';

    // Normalize Division
    const rawDivName = await resolveDivisionName(service);
    const rawDiv = rawDivName.toUpperCase();
    const mapDiv = { 'PATIENT MONITOR':'PATIENT MONITORS','PATIENT MONITORS':'PATIENT MONITORS','SAG':'SAG','VENTILATOR':'VENTILATOR','DEFIBRILLATOR':'DEFIBRILLATOR','ECG':'ECG','SYRINGE PUMP':'SYRINGE PUMP','INFUSION PUMP':'INFUSION PUMP','ULTRASOUND':'ULTRASOUND','ANAESTHESIA':'ANAESTHESIA' };
    const safeDivision = mapDiv[rawDiv] || 'OTHER';

    // Build final remarks for the new doc
    let newDocRemarks = 'Re-repair requested';
    if (problemObserved) newDocRemarks += ' | Problem Observed: ' + problemObserved;

    // Find matching EmpFRN if category is PFRN/rtfrn
    let sourceEmpFrnId = empfrnDoc ? empfrnDoc._id : null;
    if (!sourceEmpFrnId && deletedSourceCollection === 'rtfrn') {
      const matchedEmpFrn = await EmpFRN.findOne({ serviceId: service._id }).lean();
      if (matchedEmpFrn) {
        sourceEmpFrnId = matchedEmpFrn._id;
      }
    }

    // Carry over all view-tab fields from RTCRL so no data is lost
    const newDocPayload = {
      entryDate:        service.rturSentAt || service.rtfrnSentAt || service.rtobSentAt || new Date(),
      division:         safeDivision,
      scRefNo:          scRefNo || '',
      defGirNo:         defGirNo || '',
      category:         category,
      model:            (crlDoc && crlDoc.model)            || service.model       || '',
      defBrdModName:    (crlDoc && crlDoc.defBrdModName)     || service.defMod      || '',
      techRemarks:      (crlDoc && crlDoc.techRemarks)       || '',
      repairRemarks:    (crlDoc && crlDoc.repairRemarks)     || '',
      compUsedToRepair: (crlDoc && (crlDoc.compUsedToRepair || crlDoc.components)) || '',
      cost:             (crlDoc && crlDoc.cost)              || '',
      timeTaken:        (crlDoc && crlDoc.timeTaken)         || '',
      doi:              (crlDoc && crlDoc.doi)               || service.doi         || '',
      repairedBy:       (crlDoc && crlDoc.repairedBy)        || '',
      repairedDate:     (crlDoc && crlDoc.closedDate)        || null,
      problemObserved:  problemObserved,
      status:           'pending',
      repairStatus:     're repair product',
      finalRemarks:     newDocRemarks,
      fieldRemarks:     (crlDoc && crlDoc.fieldRemarks)      || service.fieldRemarks || '',
      submittedBy:      req.user?.name || '',
      submittedAt:      new Date(),
      sourceServiceId:  service._id,
      sourceEmpFrnId:   sourceEmpFrnId,
      sourceId:         service._id,
      sourceCollection: isEstimation ? 'estimation' : 'service',
    };

    if (deletedSourceId && mongoose.Types.ObjectId.isValid(deletedSourceId)) {
      newDocPayload._id = deletedSourceId;
    }

    try {
      await ModelToRecreate.create(newDocPayload);
    } catch(err) {
      // If duplicate key error, it means the record already exists, which is fine
      if (err.code !== 11000) {
        console.error('Failed to recreate repair record:', err.message);
      }
    }

    if (problemObserved) {
      await backendBroadcastProblem(req, service, problemObserved, safeDivision);
    }

    return res.json({ success: true, message: 'Repair reverted to RS successfully.' });
  } catch (error) {
    console.error('[Revert Repair]', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

router.post('/crl/:id', async (req, res) => {
  try {
    const crlId = req.params.id;
    const problemObserved = (req.body && req.body.problemObserved) ? String(req.body.problemObserved).trim() : '';

    const crlDoc = await RTCRL.findById(crlId);
    if (!crlDoc) {
      return res.status(404).json({ success: false, message: 'Closed repair record not found' });
    }

    const scRefNo = crlDoc.scRefNo;
    const defGirNo = crlDoc.defGirNo;

    const escapeRegex = (string) => string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    let serviceFilter = { $or: [] };
    
    const cleanScRef = scRefNo && typeof scRefNo === 'string' ? scRefNo.trim() : '';
    if (cleanScRef && cleanScRef !== '-') {
      const scRegex = { $regex: new RegExp('^' + escapeRegex(cleanScRef) + '$', 'i') };
      serviceFilter.$or.push({ scReNo: scRegex });
      serviceFilter.$or.push({ scRno: scRegex });
      serviceFilter.$or.push({ scRefNo: scRegex });
    }
    
    const cleanGir = defGirNo && typeof defGirNo === 'string' ? defGirNo.trim() : '';
    if (cleanGir && cleanGir !== '-') {
      const girRegex = { $regex: new RegExp('^' + escapeRegex(cleanGir) + '$', 'i') };
      serviceFilter.$or.push({ defGir: girRegex });
      serviceFilter.$or.push({ defGirNo: girRegex });
    }

    let service = null;
    let isEstimation = false;

    if (serviceFilter.$or.length > 0) {
      service = await Service.findOne(serviceFilter);
      if (!service) {
        service = await EstimationPending.findOne(serviceFilter);
        isEstimation = true;
      }
    }

    if (!service) {
      return res.status(404).json({ success: false, message: 'Matching active Service/Estimation record not found' });
    }

    // 1. Delete corresponding RTCRL record
    await RTCRL.findByIdAndDelete(crlId);

    // 2. Clear completion flags and ensure sent flags are true
    service.rturCompleted = false;
    service.rtfrnCompleted = false;
    service.rtobCompleted = false;
    service.rturSent = true;
    service.rtfrnSent = true;
    service.rtobSent = true;
    service.repairStatus = 're repair product';
    let remarkParts = ['Re-repair requested'];
    if (problemObserved) remarkParts.push('Problem Observed: ' + problemObserved);
    service.finalRemarks = (service.finalRemarks ? service.finalRemarks + ' | ' : '') + remarkParts.join(' | ');
    await service.save({ validateBeforeSave: false });

    // Also clear rtfrnCompleted and ensure rtfrnSent is true on the associated EmpFRN if category is rtfrn/PFRN
    const deletedSourceCollection = crlDoc.sourceCollection || '';
    if (deletedSourceCollection === 'rtfrn') {
      const empfrnDoc = await EmpFRN.findOne({ serviceId: service._id });
      if (empfrnDoc) {
        empfrnDoc.rtfrnCompleted = false;
        empfrnDoc.rtfrnSent = true;
        await empfrnDoc.save({ validateBeforeSave: false });
      }
    }

    // 3. Re-create the RTUR/RTFRN/RTOB record with all fields restored from RTCRL
    let finalSourceCollection = deletedSourceCollection;
    if (!finalSourceCollection) {
      if (isEstimation) finalSourceCollection = 'rtob';
      else if (service.frnNo) finalSourceCollection = 'rtfrn';
      else finalSourceCollection = 'rtur';
    }

    const ModelToRecreate = 
      finalSourceCollection === 'rtob' ? RTOB :
      finalSourceCollection === 'rtfrn' ? RTFRN : RTUR;

    let category = crlDoc.category || 'UR';
    if (service.frnNo && finalSourceCollection === 'rtfrn') category = 'PFRN';
    else if (finalSourceCollection === 'rtob') category = 'OB';

    // Normalize Division
    const rawDivName = await resolveDivisionName(service);
    const rawDiv = rawDivName.toUpperCase();
    const mapDiv = { 'PATIENT MONITOR':'PATIENT MONITORS','PATIENT MONITORS':'PATIENT MONITORS','SAG':'SAG','VENTILATOR':'VENTILATOR','DEFIBRILLATOR':'DEFIBRILLATOR','ECG':'ECG','SYRINGE PUMP':'SYRINGE PUMP','INFUSION PUMP':'INFUSION PUMP','ULTRASOUND':'ULTRASOUND','ANAESTHESIA':'ANAESTHESIA' };
    const safeDivision = mapDiv[rawDiv] || 'OTHER';

    // Build final remarks for the new doc
    let newDocRemarks = 'Re-repair requested';
    if (problemObserved) newDocRemarks += ' | Problem Observed: ' + problemObserved;

    // Find matching EmpFRN if category is PFRN/rtfrn
    let sourceEmpFrnId = null;
    if (deletedSourceCollection === 'rtfrn') {
      const empfrnDoc = await EmpFRN.findOne({ serviceId: service._id }).lean();
      if (empfrnDoc) {
        sourceEmpFrnId = empfrnDoc._id;
      }
    }

    // Carry over all view-tab fields from RTCRL so no data is lost
    const newDocPayload = {
      entryDate:        service.rturSentAt || service.rtfrnSentAt || service.rtobSentAt || new Date(),
      division:         safeDivision,
      scRefNo:          scRefNo || '',
      defGirNo:         defGirNo || '',
      category:         category,
      // Restored from RTCRL view tab
      model:            crlDoc.model            || service.model       || '',
      defBrdModName:    crlDoc.defBrdModName     || service.defMod      || '',
      techRemarks:      crlDoc.techRemarks       || '',
      repairRemarks:    crlDoc.repairRemarks     || '',
      compUsedToRepair: crlDoc.compUsedToRepair  || crlDoc.components   || '',
      cost:             crlDoc.cost              || '',
      timeTaken:        crlDoc.timeTaken         || '',
      doi:              crlDoc.doi               || service.doi         || '',
      repairedBy:       crlDoc.repairedBy        || '',
      repairedDate:     crlDoc.closedDate        || null,
      // Problem + status info
      problemObserved:  problemObserved,
      status:           'pending',
      repairStatus:     're repair product',
      finalRemarks:     newDocRemarks,
      fieldRemarks:     crlDoc.fieldRemarks      || service.fieldRemarks || '',
      submittedBy:      req.user?.name           || '',
      submittedAt:      new Date(),
      sourceServiceId:  service._id,
      sourceEmpFrnId:   sourceEmpFrnId,
      sourceId:         service._id,
      sourceCollection: isEstimation ? 'estimation' : 'service',
    };

    if (crlDoc.sourceId) {
      newDocPayload._id = crlDoc.sourceId;
    }

    try {
      await ModelToRecreate.create(newDocPayload);
    } catch(err) {
      if (err.code !== 11000) {
        console.error('Failed to recreate repair record:', err.message);
      }
    }

    if (problemObserved) {
      await backendBroadcastProblem(req, service, problemObserved, safeDivision);
    }

    return res.json({ success: true, message: 'Repair reverted to RS successfully.' });
  } catch (error) {
    console.error('[Revert Repair CRL]', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});


module.exports = router;
