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

router.post('/:id', async (req, res) => {
  try {
    const serviceId = req.params.id;
    const problemObserved = (req.body && req.body.problemObserved) ? String(req.body.problemObserved).trim() : '';

    let service = await Service.findById(serviceId);
    let isEstimation = false;

    if (!service) {
      service = await EstimationPending.findById(serviceId);
      isEstimation = true;
    }

    if (!service) {
      return res.status(404).json({ success: false, message: 'Service/Estimation record not found' });
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

    // 2. Clear the completion flags on the service record
    service.rturCompleted = false;
    service.rtfrnCompleted = false;
    service.rtobCompleted = false;
    service.repairStatus = 're repair product';

    let remarkParts = ['Re-repair requested'];
    if (problemObserved) remarkParts.push('Problem Observed: ' + problemObserved);
    service.finalRemarks = (service.finalRemarks ? service.finalRemarks + ' | ' : '') + remarkParts.join(' | ');
    await service.save({ validateBeforeSave: false });

    // 3. Re-create the RTUR/RTFRN/RTOB record with all fields restored from RTCRL
    const ModelToRecreate = 
      deletedSourceCollection === 'rtob' ? RTOB :
      deletedSourceCollection === 'rtfrn' ? RTFRN : RTUR;
      
    // Determine the category
    let category = crlCategory;
    if (service.frnNo && deletedSourceCollection === 'rtfrn') category = 'PFRN';
    else if (deletedSourceCollection === 'rtob') category = 'OB';

    // Normalize Division
    const rawDiv = String(service.division?.name || service.divisionName || service.division || service.branch || service.reg || '').trim().toUpperCase();
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
      sourceServiceId:  serviceId,
      sourceEmpFrnId:   sourceEmpFrnId,
      sourceId:         serviceId,
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

    // 2. Clear completion flags
    service.rturCompleted = false;
    service.rtfrnCompleted = false;
    service.rtobCompleted = false;
    service.repairStatus = 're repair product';
    let remarkParts = ['Re-repair requested'];
    if (problemObserved) remarkParts.push('Problem Observed: ' + problemObserved);
    service.finalRemarks = (service.finalRemarks ? service.finalRemarks + ' | ' : '') + remarkParts.join(' | ');
    await service.save({ validateBeforeSave: false });

    // 3. Re-create the RTUR/RTFRN/RTOB record with all fields restored from RTCRL
    const deletedSourceCollection = crlDoc.sourceCollection || '';
    const ModelToRecreate = 
      deletedSourceCollection === 'rtob' ? RTOB :
      deletedSourceCollection === 'rtfrn' ? RTFRN : RTUR;

    let category = crlDoc.category || 'UR';
    if (service.frnNo && deletedSourceCollection === 'rtfrn') category = 'PFRN';
    else if (deletedSourceCollection === 'rtob') category = 'OB';

    // Normalize Division
    const rawDiv = String(service.division?.name || service.divisionName || service.division || service.branch || service.reg || '').trim().toUpperCase();
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

    return res.json({ success: true, message: 'Repair reverted to RS successfully.' });
  } catch (error) {
    console.error('[Revert Repair CRL]', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});


module.exports = router;
