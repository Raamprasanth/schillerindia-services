const mongoose = require('mongoose');

function objectIdOrNull(value) {
  const text = String(value || '').trim();
  return mongoose.Types.ObjectId.isValid(text) ? new mongoose.Types.ObjectId(text) : null;
}

function normalizeText(value) {
  return String(value || '').trim();
}

function identityFilter(record = {}) {
  const parts = {
    scRefNo: normalizeText(record.scRefNo).toUpperCase(),
    defGirNo: normalizeText(record.defGirNo).toUpperCase(),
    category: normalizeText(record.category),
    model: normalizeText(record.model),
    defBrdModName: normalizeText(record.defBrdModName),
  };

  if (!parts.scRefNo || !parts.defGirNo || !parts.category) return null;

  const filter = {
    scRefNo: parts.scRefNo,
    defGirNo: parts.defGirNo,
    category: parts.category,
  };
  if (parts.model) filter.model = parts.model;
  if (parts.defBrdModName) filter.defBrdModName = parts.defBrdModName;
  return filter;
}

async function deleteMirroredRepairRows(Model, id, record = {}) {
  const filters = [];
  const oid = objectIdOrNull(id);
  if (oid) filters.push({ _id: oid });

  const sourceId = objectIdOrNull(record.sourceId || record.sourceEmpFrnId || record.sourceServiceId);
  if (sourceId) {
    filters.push({ sourceId });
    filters.push({ sourceEmpFrnId: sourceId });
    filters.push({ sourceServiceId: sourceId });
  }

  const identity = identityFilter(record);
  if (identity) filters.push(identity);

  if (!filters.length) return { deletedCount: 0 };
  return Model.deleteMany({ $or: filters });
}

module.exports = { deleteMirroredRepairRows };
