const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const RTUR = require('../models/rturModel');
const RTOB = require('../models/RTOB');
const RTFRN = require('../models/RTFRN.JS');
const RTCRL = require('../models/rtcrlModel');
const Service = require('../models/Service');
const EstimationPending = require('../models/EstimationPending');
const { protect, employeeOrAdmin } = require('../middleware/authMiddleware');

// Mount at /api/revert-repair
router.use(protect, employeeOrAdmin);

router.post('/:id', async (req, res) => {
  try {
    const serviceId = req.params.id;
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
    
    let crlFilter = { $or: [] };
    if (scRefNo) crlFilter.$or.push({ scRefNo: scRefNo });
    if (defGirNo) crlFilter.$or.push({ defGirNo: defGirNo });
    
    // Find the deleted source ID from RTCRL if possible
    let deletedSourceId = null;
    let deletedSourceCollection = null;
    let crlCategory = 'UR';
    
    if (crlFilter.$or.length > 0) {
      const crlDocs = await RTCRL.find(crlFilter).sort({ closedDate: -1 }).limit(1);
      if (crlDocs.length > 0) {
        deletedSourceId = crlDocs[0].sourceId;
        deletedSourceCollection = crlDocs[0].sourceCollection;
        crlCategory = crlDocs[0].category || 'UR';
        await RTCRL.findByIdAndDelete(crlDocs[0]._id);
      }
    }

    // 2. Clear the completion flags on the service record
    service.rturCompleted = false;
    service.rtfrnCompleted = false;
    service.rtobCompleted = false;
    
    if (service.repairStatus) {
      service.repairStatus = 're repair product';
    } else {
      service.repairStatus = 're repair product';
    }
    
    service.finalRemarks = (service.finalRemarks ? service.finalRemarks + ' | ' : '') + 'Re-repair requested';
    await service.save();

    // 3. Re-create the RTUR/RTFRN/RTOB record so the repair team sees it again
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

    // Set `_id` back to the deletedSourceId if possible, else let mongoose generate one
    const newDocPayload = {
      entryDate: service.rturSentAt || service.rtfrnSentAt || service.rtobSentAt || new Date(),
      division: safeDivision,
      scRefNo: scRefNo || '',
      defGirNo: defGirNo || '',
      category: category,
      model: service.model || '',
      defBrdModName: service.defMod || '',
      status: 'pending',
      repairStatus: 're repair product',
      finalRemarks: 'Re-repair requested',
      submittedBy: req.user?.name || '',
      submittedAt: new Date(),
      sourceServiceId: serviceId,
      doi: service.doi || '',
      fieldRemarks: service.fieldRemarks || ''
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
    const crlDoc = await RTCRL.findById(crlId);
    if (!crlDoc) {
      return res.status(404).json({ success: false, message: 'Closed repair record not found' });
    }

    const scRefNo = crlDoc.scRefNo;
    const defGirNo = crlDoc.defGirNo;

    // Find the corresponding Service or EstimationPending record
    let serviceFilter = { $or: [] };
    if (scRefNo) {
      serviceFilter.$or.push({ scReNo: scRefNo });
      serviceFilter.$or.push({ scRno: scRefNo });
      serviceFilter.$or.push({ scRefNo: scRefNo });
    }
    if (defGirNo) {
      serviceFilter.$or.push({ defGir: defGirNo });
      serviceFilter.$or.push({ defGirNo: defGirNo });
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
    service.finalRemarks = (service.finalRemarks ? service.finalRemarks + ' | ' : '') + 'Re-repair requested';
    await service.save();

    // 3. Re-create the RTUR/RTFRN/RTOB record
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

    const newDocPayload = {
      entryDate: service.rturSentAt || service.rtfrnSentAt || service.rtobSentAt || new Date(),
      division: safeDivision,
      scRefNo: scRefNo || '',
      defGirNo: defGirNo || '',
      category: category,
      model: service.model || '',
      defBrdModName: service.defMod || '',
      status: 'pending',
      repairStatus: 're repair product',
      finalRemarks: 'Re-repair requested',
      submittedBy: req.user?.name || '',
      submittedAt: new Date(),
      sourceServiceId: service._id,
      doi: service.doi || '',
      fieldRemarks: service.fieldRemarks || ''
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
