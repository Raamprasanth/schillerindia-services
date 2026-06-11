const mongoose = require('mongoose');
const Division = require('../models/Division');
const Service = require('../models/Service');

function isPrivileged(user) {
  return !user || user.role === 'admin' || user.role === 'superadmin' || user.role === 'repair_team';
}

async function resolveDivision(user) {
  const divisions = await resolveDivisions(user);
  return divisions[0] || null;
}

async function resolveDivisions(user) {
  if (!user) return [];
  const resolved = [];

  // Only use primary division ID if activeDivision is not overriding it
  if (!user.activeDivision) {
    const rawDivisionId = user.divisionId || user.division_id || '';
    if (rawDivisionId && mongoose.Types.ObjectId.isValid(rawDivisionId)) {
      const byId = await Division.findById(rawDivisionId).lean();
      if (byId) resolved.push(byId);
    }
  }

  const names = user.activeDivision
    ? [user.activeDivision]
    : (Array.isArray(user.divisions) ? [...user.divisions] : []);
  if (!user.activeDivision && user.division) names.push(user.division);
  for (const raw of [...new Set(names.map(v => String(v || '').trim()).filter(Boolean))]) {
    const rawDivisionName = String(raw || '').trim();
    const escaped = rawDivisionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp('^' + escaped + '$', 'i');
    // Match by canonical name first, then by displayName alias
    const byName = await Division.findOne({ $or: [{ name: pattern }, { displayName: pattern }] }).lean();
    if (byName && !resolved.some(d => String(d._id) === String(byName._id))) resolved.push(byName);
  }

  return resolved;
}

async function getDivisionFilter(user, fallbackOr) {
  if (isPrivileged(user)) return {};

  const fallback = Array.isArray(fallbackOr) ? fallbackOr.filter(Boolean) : [];
  const divisions = await resolveDivisions(user);
  if (divisions.length) {
    const divisionFilter = { division: { $in: divisions.map(d => d._id) } };
    if (fallback.length) {
      return {
        $or: [
          divisionFilter,
          {
            $and: [
              { $or: [{ division: null }, { division: { $exists: false } }] },
              { $or: fallback }
            ]
          }
        ]
      };
    }
    return divisionFilter;
  }

  return fallback.length ? { $or: fallback } : { _id: null };
}

async function getServiceIdsFilter(user, fallbackOr) {
  if (isPrivileged(user)) return {};

  const fallback = Array.isArray(fallbackOr) ? fallbackOr.filter(Boolean) : [];
  const divisions = await resolveDivisions(user);
  if (divisions.length) {
    const services = await Service.find({ division: { $in: divisions.map(d => d._id) } }, '_id').lean();
    const serviceFilter = { serviceId: { $in: services.map(s => s._id) } };
    if (fallback.length) {
      const legacyServices = await Service.find({
        $or: [{ division: null }, { division: { $exists: false } }]
      }, '_id').lean();
      return {
        $or: [
          serviceFilter,
          {
            $and: [
              { $or: [{ serviceId: { $in: legacyServices.map(s => s._id) } }, { serviceId: null }, { serviceId: { $exists: false } }] },
              { $or: fallback }
            ]
          }
        ]
      };
    }
    return serviceFilter;
  }

  return fallback.length ? { $or: fallback } : { _id: null };
}

async function hasDivisionAccessToService(user, serviceId) {
  if (isPrivileged(user)) return true;
  if (!serviceId || !mongoose.Types.ObjectId.isValid(serviceId)) return false;

  const divisions = await resolveDivisions(user);
  if (!divisions.length) return false;

  const svc = await Service.findOne({ _id: serviceId, division: { $in: divisions.map(d => d._id) } }, '_id').lean();
  return Boolean(svc);
}

async function hasDivisionAccessToRecord(user, recordDivision) {
  if (isPrivileged(user)) return true;
  if (!recordDivision) return false;

  const divisions = await resolveDivisions(user);
  if (!divisions.length) return false;

  return divisions.some(division => String(division._id) === String(recordDivision._id || recordDivision));
}

module.exports = {
  resolveDivision,
  resolveDivisions,
  getDivisionFilter,
  getServiceIdsFilter,
  hasDivisionAccessToService,
  hasDivisionAccessToRecord,
};
