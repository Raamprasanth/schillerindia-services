const Service = require('../models/Service');
const EmpFRNPending = require('../models/EmpFRN');
const UnderRepair = require('../models/UnderRepair');
const EstimationPending = require('../models/EstimationPending');

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

async function tryCreateFRNPending(svc, user) {
  try {
    const unitStatus = normalizeUnitStatus(svc.unitSts || svc.unitStatus);
    const repType = normalizeRepType(svc.repType);
    const eligible = FRN_UNIT_STATUSES.includes(unitStatus) && repType === 'NA';
    if (!eligible) return;

    const exists = await EmpFRNPending.findOne({ serviceId: svc._id });
    if (exists) {
      await EmpFRNPending.findOneAndUpdate(
        { serviceId: svc._id },
        {
          scRno:      svc.scReNo || '',
          scEng:      svc.scEng  || '',
          frnNo:      svc.frnNo  || '',
          region:     svc.reg    || '',
          branch:     svc.branch || '',
          eng:        svc.eng    || '',
          dealer:     svc.dealer || '',
          customer:   svc.custName || svc.customer || '',
          model:      svc.model  || '',
          unitSl:     svc.unitSl || '',
          unitStatus,
          defMod:     svc.defMod || '',
          defGir:     svc.defGir || '',
          partNo:     svc.partNo || '',
          typeWork:   svc.typeWork || svc.type || '',
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
      eng:         svc.eng        || '',
      dealer:      svc.dealer     || '',
      customer:    svc.custName || svc.customer || '',
      model:       svc.model      || '',
      unitSl:      svc.unitSl     || '',
      unitStatus,
      defMod:      svc.defMod     || '',
      defGir:      svc.defGir     || '',
      partNo:      svc.partNo     || '',
      typeWork:    svc.typeWork || svc.type || '',
      remarks:     svc.finalRemarks || '',
      status:      'pending',
      submittedBy: svc.submittedBy || (user ? user.name : ''),
      pdays:       calcPendingDays(svc.rcvdDate || svc.entryDate),
    });
  } catch (e) {
    if (e.code !== 11000) console.warn('⚠ FRN Pending auto-create failed:', e.message);
  }
}

async function tryCreateUnderRepair(svc, user) {
  try {
    const eligible = svc.repType === 'TO/ADV SO';
    if (!eligible) return;

    const exists = await UnderRepair.findOne({ serviceId: svc._id });
    if (exists) {
      await UnderRepair.findOneAndUpdate(
        { serviceId: svc._id },
        {
          scRno:         svc.scReNo || svc.scRno || '',
          scEng:         svc.scEng  || '',
          frnNo:         svc.frnNo  || '',
          region:        svc.reg    || '',
          engineer:      svc.eng    || '',
          custName:      svc.custName || svc.customer || '',
          model:         svc.model  || '',
          unitStatus:    svc.unitSts || '',
          defMod:        svc.defMod || '',
          defModBrdName: svc.defMod || '',
          defGir:        svc.defGir || '',
          defGirNo:      svc.defGir || '',
          repGirNo:      svc.repGirNo || '',
          revalue:       svc.revalue || 0,
          typeWork:      svc.typeWork || svc.type || 'UNDER REPAIR',
          typeOfWork:    svc.typeWork || svc.type || 'UNDER REPAIR',
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
      engineer:      svc.eng      || '',
      raEng:         '',
      custName:      svc.custName || svc.customer || '',
      customer:      svc.custName || svc.customer || '',
      model:         svc.model    || '',
      unitStatus:    svc.unitSts  || '',
      defMod:        svc.defMod   || '',
      defModBrdName: svc.defMod   || '',
      defGir:        svc.defGir   || '',
      defGirNo:      svc.defGir   || '',
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
  cleanupLinkedRecords
};
