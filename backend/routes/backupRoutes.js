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

router.get('/excel', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
      return res.status(503).json({ success: false, message: 'Database is not connected.' });
    }

    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    workbook.creator = req.user?.name || 'System';
    workbook.created = new Date();

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();

    for (const info of collections) {
      if (!info.name || info.name.startsWith('system.')) continue;
      
      const docs = await db.collection(info.name).find({}).toArray();
      if (docs.length === 0) continue;

      const sheetName = info.name.substring(0, 31);
      const worksheet = workbook.addWorksheet(sheetName);

      // Fast key extraction: use only the first doc
      const keySet = Object.keys(docs[0]);
      worksheet.columns = keySet.map(key => ({
        header: key,
        key: key,
        width: 20
      }));

      const rows = docs.map(doc => {
        const row = {};
        for (const key of keySet) {
          let val = doc[key];
          if (val && typeof val === 'object' && !(val instanceof Date)) {
            try { val = JSON.stringify(val); } catch (e) { val = String(val); }
          }
          row[key] = val;
        }
        return row;
      });

      worksheet.addRows(rows);
    }

    const fileName = `schiller-backup-${safeFileDate()}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('[GET /api/backup/excel]', err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: err.message || 'Excel Backup failed.' });
    } else {
      res.end();
    }
  }
});

module.exports = router;

