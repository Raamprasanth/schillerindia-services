const express = require('express');
const mongoose = require('mongoose');
const { protect, adminOnly } = require('../middleware/authMiddleware');

const router = express.Router();

function safeFileDate() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

router.get('/download', protect, adminOnly, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
      return res.status(503).json({ success: false, message: 'Database is not connected.' });
    }

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    const backup = {
      app: 'schillerindia-services',
      type: 'mongodb-json-backup',
      createdAt: new Date().toISOString(),
      createdBy: {
        id: String(req.user?._id || ''),
        name: req.user?.name || '',
        role: req.user?.role || '',
      },
      database: db.databaseName,
      collections: {},
    };

    for (const info of collections) {
      if (!info.name || info.name.startsWith('system.')) continue;
      backup.collections[info.name] = await db.collection(info.name).find({}).toArray();
    }

    const fileName = `schiller-backup-${safeFileDate()}.json`;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.status(200).send(JSON.stringify(backup, null, 2));
  } catch (err) {
    console.error('[GET /api/admin/backup/download]', err);
    res.status(500).json({ success: false, message: err.message || 'Backup failed.' });
  }
});

module.exports = router;
