const mongoose = require('mongoose');

const appSettingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    value: { type: mongoose.Schema.Types.Mixed, default: null },
    updatedBy: { type: String, default: '' },
  },
  {
    timestamps: true,
    collection: 'app_settings',
  }
);

module.exports =
  mongoose.models.AppSetting ||
  mongoose.model('AppSetting', appSettingSchema);
