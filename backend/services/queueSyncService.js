const Service = require('../models/Service');
const EmpFRNPending = require('../models/EmpFRN');
const UnderRepair = require('../models/UnderRepair');
const EstimationPending = require('../models/EstimationPending');
const EmpOBPending = require('../models/EmpOBPending');
const Division = require('../models/Division');

const FRN_UNIT_STATUSES = ['IW', 'EW', 'CAMC', 'STOCK', 'Demo', 'Repeat', 'Buy Back'];
const EST_UNIT_STATUSES = ['OW', 'LAMC'];

function normalizeUnitStatus(value) {
  const raw = String(value || '').trim();
  const upper = raw.toUpperCase();
  const map = {
    IW: 'IW',
    EW: 'EW',
    CAMC: 'CAMC',
    STOCK: 'STOCK',
    DEMO: 'Demo',
    REPEAT: 'Repeat',
    'BUY BACK': 'Buy Back',
    BUYBACK: 'Buy Back',
    OW: 'OW',
    LAMC: 'LAMC',
  };
  return map[upper] || raw;
}

function normalizeRepType(value) {
  return String(value || '').trim().toUpperCase();
}

function calcPendingDays(dateStr) {
  if (!dateStr) return 0;
  const diff = Math.floor((new Date() - new Date(dateStr)) / 86400000);
  return isNaN(diff) ? 0 : Math.max(0, diff);
}

async function resolveServiceDivision(svc) {
  const rawDivision = svc.division;
  const divisionId = rawDivision && rawDivision._id ? rawDivision._id : rawDivision;
  const divisionName = svc.divisionName
    || svc.divisionDisplayName
    || (rawDivision && (rawDivision.name || rawDivision.displayName))
    || '';

  if (divisionName || !divisionId) {
    return { division: divisionId || null, divisionName };
  }

  try {
    const div = await Division.findById(divisionId).select('name displayName').lean();
    return {
      division: divisionId,
      divisionName: div ? (div.name || div.displayName || '') : '',
    };
  } catch (_) {
    return { division: divisionId, divisionName: '' };
  }
}

async function tryCreateFRNPending(svc, user) {
  try {
    const unitStatus = normalizeUnitStatus(svc.unitSts || svc.unitStatus);
    const repType = normalizeRepType(svc.repType);
    const eligible = FRN_UNIT_STATUSES.includes(unitStatus) && repType === 'NA';
    if (!eligible) return;
    const serviceDivision = await resolveServiceDivision(svc);

    const exists = await EmpFRNPending.findOne({ serviceId: svc._id });
    if (exists) {
      await EmpFRNPending.findOneAndUpdate(
        { serviceId: svc._id },
        {
          scRno:      svc.scReNo || '',
          scEng:      svc.scEng  || '',
          frnNo:      svc.frnNo  || '',
          entryDate:   svc.entryDate || '',
          rcvdDate:    svc.rcvdDate || '',
          region:     svc.reg    || '',
          branch:     svc.branch || '',
          division:   serviceDivision.division,
          divisionName: serviceDivision.divisionName,
          eng:        svc.eng    || '',
          dealer:     svc.dealer || '',
          customer:   svc.custName || svc.customer || '',
          model:      svc.model  || '',
          unitSl:     svc.unitSl || '',
          unitStatus,
          defMod:     svc.defMod || '',
          defGir:     svc.defGir || '',
          defPartSno: svc.defPartSno || '',
          partNo:     svc.partNo || '',
          typeWork:   svc.typeWork || svc.type || '',
          bscon:      svc.bscon || '',
          updatedAt:  new Date().toISOString(),
        }
      );
      return;
    }

    await EmpFRNPending.create({
      serviceId:   svc._id,
      entryDate:   svc.entryDate  || '',
      rcvdDate:    svc.rcvdDate   || '',
      scRno:       svc.scReNo     || '',
      scEng:       svc.scEng      || '',
      frnNo:       svc.frnNo      || '',
      region:      svc.reg        || '',
      branch:      svc.branch     || '',
      division:    serviceDivision.division,
      divisionName: serviceDivision.divisionName,
      eng:         svc.eng        || '',
      dealer:      svc.dealer     || '',
      customer:    svc.custName || svc.customer || '',
      model:       svc.model      || '',
      unitSl:      svc.unitSl     || '',
      unitStatus,
      defMod:      svc.defMod     || '',
      defGir:      svc.defGir     || '',
      defPartSno:  svc.defPartSno || '',
      partNo:      svc.partNo     || '',
      typeWork:    svc.typeWork || svc.type || '',
      bscon:       svc.bscon || '',
      remarks:     svc.finalRemarks || '',
      status:      'pending',
      submittedBy: svc.submittedBy || (user ? user.name : ''),
      submittedAt: svc.submittedAt || new Date(),
      pdays:       calcPendingDays(svc.rcvdDate || svc.entryDate),
    });
  } catch (e) {
    if (e.code !== 11000) console.warn('⚠ FRN Pending auto-create failed:', e.message);
  }
}

async function tryCreateUnderRepair(svc, user) {
  try {
    const isUnderRepair = String(svc.typeWork || svc.type || '').toUpperCase() === 'UNDER REPAIR' || svc.repType === 'TO/ADV SO';
    if (!isUnderRepair) return;

    const exists = await UnderRepair.findOne({ serviceId: svc._id });
    if (exists) {
      await UnderRepair.findOneAndUpdate(
        { serviceId: svc._id },
        {
          scRno:         svc.scReNo || svc.scRno || '',
          scEng:         svc.scEng  || '',
          frnNo:         svc.frnNo  || '',
          entryDate:     svc.entryDate || new Date().toISOString().split('T')[0],
          rcvdDate:      svc.rcvdDate || '',
          region:        svc.reg    || '',
          eng:           svc.eng    || svc.engineer || svc.engineerName || svc.fieldEngineer || '',
          engineer:      svc.eng    || svc.engineer || svc.engineerName || svc.fieldEngineer || '',
          custName:      svc.custName || svc.customer || '',
          model:         svc.model  || '',
          unitStatus:    svc.unitSts || '',
          partNo:        svc.partNo || '',
          defMod:        svc.defMod || '',
          defModBrdName: svc.defMod || '',
          defGir:        svc.defGir || '',
          defGirNo:      svc.defGir || '',
          defPartSno:    svc.defPartSno || '',
          repGirNo:      svc.repGirNo || '',
          revalue:       svc.revalue || 0,
          typeWork:      svc.typeWork || svc.type || 'UNDER REPAIR',
          typeOfWork:    svc.typeWork || svc.type || 'UNDER REPAIR',
          status:        'UNDER REPAIR',
        }
      );
      return;
    }

    const scRno = svc.scReNo || svc.scRno || '';
    if (!scRno) return;

    await UnderRepair.create({
      serviceId:     svc._id,
      entryDate:     svc.entryDate || new Date().toISOString().split('T')[0],
      rcvdDate:      svc.rcvdDate  || '',
      scRno,
      scEng:         svc.scEng    || '',
      frnNo:         svc.frnNo    || '',
      region:        svc.reg      || '',
      eng:           svc.eng      || svc.engineer || svc.engineerName || svc.fieldEngineer || '',
      engineer:      svc.eng      || svc.engineer || svc.engineerName || svc.fieldEngineer || '',
      raEng:         '',
      custName:      svc.custName || svc.customer || '',
      customer:      svc.custName || svc.customer || '',
      model:         svc.model    || '',
      unitStatus:    svc.unitSts  || '',
      partNo:        svc.partNo   || '',
      defMod:        svc.defMod   || '',
      defModBrdName: svc.defMod   || '',
      defGir:        svc.defGir   || '',
      defGirNo:      svc.defGir   || '',
      defPartSno:    svc.defPartSno || '',
      defUnitGir:    '',
      finalRemarks:  svc.finalRemarks || '',
      techRemarks:   svc.techRemarks  || '',
      components:    '',
      typeWork:      svc.typeWork || svc.type || 'UNDER REPAIR',
      typeOfWork:    svc.typeWork || svc.type || 'UNDER REPAIR',
      status:        'UNDER REPAIR',
      repGirNo:      svc.repGirNo || '',
      revalue:       svc.revalue || 0,
      repBrd:        '',
      shipSc:        '',
      shipComm:      '',
      dcNo:          '',
      typeReport:    '',
      destination:   '',
      repairTeam:    '',
      pdays:         calcPendingDays(svc.rcvdDate || svc.entryDate),
    });
  } catch (e) {
    if (e.code !== 11000) console.warn('⚠ Under Repair auto-create failed:', e.message);
  }
}

function isFrnEligible(svc) {
  return FRN_UNIT_STATUSES.includes(normalizeUnitStatus(svc.unitSts || svc.unitStatus)) && normalizeRepType(svc.repType) === 'NA';
}

function isObEligible(svc) {
  return EST_UNIT_STATUSES.includes(normalizeUnitStatus(svc.unitSts || svc.unitStatus)) && normalizeRepType(svc.repType) === 'NA';
}

function isEstimationEligible(svc) {
  const repType = normalizeRepType(svc.repType);
  return EST_UNIT_STATUSES.includes(normalizeUnitStatus(svc.unitSts || svc.unitStatus)) && (repType === 'NA' || repType === 'BS/SO');
}

function isUnderRepairEligible(svc) {
  return String(svc.typeWork || svc.type || '').toUpperCase() === 'UNDER REPAIR' || normalizeRepType(svc.repType) === 'TO/ADV SO';
}

function serviceToEstimationDoc(svc, user) {
  const repType = normalizeRepType(svc.repType);
  const estStatus = repType === 'BS/SO' ? 'SO Pending' : 'Estimation Pending';
  return {
    serviceId: svc._id,
    source: repType === 'BS/SO' ? 'service-bs-so' : 'service',
    sourceId: String(svc._id || ''),
    entryDate: svc.entryDate || '',
    rcvdDate: svc.rcvdDate || '',
    scReNo: svc.scReNo || '',
    scEng: svc.scEng || '',
    frnNo: svc.frnNo || '',
    frnDate: svc.frnDate || '',
    reg: svc.reg || '',
    branch: svc.branch || '',
    eng: svc.eng || '',
    dealer: svc.dealer || '',
    custName: svc.custName || svc.customer || '',
    customer: svc.customer || svc.custName || '',
    model: svc.model || '',
    unitSts: normalizeUnitStatus(svc.unitSts || svc.unitStatus),
    partNo: svc.partNo || '',
    defMod: svc.defMod || '',
    defPartSno: svc.defPartSno || '',
    defGir: svc.defGir || '',
    typeWork: svc.typeWork || svc.type || '',
    repType: svc.repType || 'NA',
    estStatus,
    submittedBy: svc.submittedBy || user?.name || '',
    submittedAt: svc.submittedAt || new Date(),
  };
}

function serviceToObDoc(svc, user) {
  return {
    serviceId: svc._id,
    employeeId: svc.engineer || user?._id,
    employeeName: svc.submittedBy || user?.name || svc.scEng || '',
    role: user?.role === 'admin' ? 'admin' : 'staff',
    entryDate: svc.entryDate || '',
    scReNo: svc.scReNo || '',
    scEng: svc.scEng || '',
    frnNo: svc.frnNo || '',
    reg: svc.reg || '',
    eng: svc.eng || '',
    custName: svc.custName || svc.customer || '',
    model: svc.model || '',
    unitSl: svc.unitSl || '',
    unitSts: normalizeUnitStatus(svc.unitSts || svc.unitStatus),
    partNo: svc.partNo || '',
    defMod: svc.defMod || '',
    defPartSno: svc.defPartSno || '',
    defGir: svc.defGir || '',
    typeWork: svc.typeWork || svc.type || '',
    repType: svc.repType || 'NA',
    finalRemarks: svc.finalRemarks || '',
    submittedBy: svc.submittedBy || user?.name || '',
    pdOb: calcPendingDays(svc.entryDate),
  };
}

async function syncEstimationPending(svc, user) {
  if (!isEstimationEligible(svc)) {
    await EstimationPending.deleteMany({ serviceId: svc._id, source: { $in: ['service', 'service-bs-so'] } });
    return;
  }

  const doc = serviceToEstimationDoc(svc, user);
  const existing = await EstimationPending.findOne({ serviceId: svc._id, source: { $in: ['service', 'service-bs-so'] } });
  if (existing) {
    await EstimationPending.findByIdAndUpdate(existing._id, doc, { new: true, runValidators: false });
  } else {
    await EstimationPending.create(doc);
  }
}

async function syncObPending(svc, user) {
  if (!isObEligible(svc)) {
    await EmpOBPending.deleteMany({ serviceId: svc._id });
    return;
  }

  const doc = serviceToObDoc(svc, user);
  if (!doc.employeeId) return;
  await EmpOBPending.findOneAndUpdate(
    { serviceId: svc._id },
    doc,
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: false }
  );
}

async function syncLinkedRecords(svc, user) {
  const serviceId = svc._id;
  await Promise.allSettled([
    isFrnEligible(svc) ? tryCreateFRNPending(svc, user) : EmpFRNPending.deleteMany({ serviceId }),
    isUnderRepairEligible(svc) ? tryCreateUnderRepair(svc, user) : UnderRepair.deleteMany({ serviceId }),
    syncObPending(svc, user),
    syncEstimationPending(svc, user),
  ]);
}

async function cleanupLinkedRecords(serviceId) {
  await Promise.allSettled([
    EmpFRNPending.deleteMany({ serviceId }),
    UnderRepair.deleteMany({ serviceId }),
    EstimationPending.deleteMany({ serviceId }),
  ]);
}

module.exports = {
  tryCreateFRNPending,
  tryCreateUnderRepair,
  syncLinkedRecords,
  cleanupLinkedRecords
};
