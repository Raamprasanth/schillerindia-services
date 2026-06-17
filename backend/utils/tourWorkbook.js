const ExcelJS = require('exceljs');

const BASE_COLUMNS = [
  { header: 'S.No', key: 'sno', width: 8 },
  { header: 'Added By', key: 'createdBy', width: 18 },
  { header: 'Tour Name', key: 'tourName', width: 24 },
  { header: 'Day', key: 'dayNo', width: 8 },
  { header: 'Start Date', key: 'startDate', width: 14 },
  { header: 'Customer Name', key: 'customerName', width: 26 },
  { header: 'Region', key: 'region', width: 16 },
  { header: 'Branch', key: 'branch', width: 18 },
  { header: 'Model', key: 'model', width: 18 },
  { header: 'Unit Status', key: 'unitStatus', width: 14 },
  { header: 'Unit SL No', key: 'unitSlNo', width: 18 },
  { header: 'Problem Reported', key: 'problemReported', width: 34 },
  { header: 'Problem Observed', key: 'problemObserved', width: 34 },
  { header: 'Action Taken', key: 'actionTaken', width: 34 },
];

function imageExtension(dataUrl) {
  const match = String(dataUrl || '').match(/^data:image\/(png|jpe?g|gif);base64,/i);
  if (!match) return '';
  return match[1].toLowerCase().replace('jpg', 'jpeg');
}

function imageBase64(dataUrl) {
  return String(dataUrl || '').replace(/^data:image\/[a-z0-9.+-]+;base64,/i, '');
}

function safeSheetName(name) {
  return String(name || 'Tour Summary').replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Tour Summary';
}

async function buildTourWorkbookBuffer(records, options = {}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SchillerIndia Services';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(safeSheetName(options.sheetName));
  const includeSource = options.includeSource === true;
  const columns = includeSource
    ? [
        BASE_COLUMNS[0],
        BASE_COLUMNS[1],
        BASE_COLUMNS[2],
        BASE_COLUMNS[3],
        BASE_COLUMNS[4],
        { header: 'Source', key: 'sourceType', width: 16 },
        ...BASE_COLUMNS.slice(5),
      ]
    : BASE_COLUMNS.slice();

  for (let i = 1; i <= 5; i += 1) {
    columns.push({ header: `Photo ${i}`, key: `photo${i}`, width: 20 });
  }

  worksheet.columns = columns;
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  worksheet.getRow(1).height = 24;
  worksheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };
  });

  records.forEach((record, index) => {
    const rowValues = {
      sno: index + 1,
      tourName: record.tourName || record.customerName || 'Tour Summary',
      dayNo: record.dayNo || 1,
      startDate: record.startDate || '',
      sourceType: record.sourceType || '',
      customerName: record.customerName || '',
      region: record.region || '',
      branch: record.branch || '',
      model: record.model || '',
      unitStatus: record.unitStatus || '',
      unitSlNo: record.unitSlNo || '',
      problemReported: record.problemReported || '',
      problemObserved: record.problemObserved || '',
      actionTaken: record.actionTaken || '',
      createdBy: record.createdBy || '',
    };

    const row = worksheet.addRow(rowValues);
    row.height = 86;
    row.eachCell((cell) => {
      cell.alignment = { vertical: 'top', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    });

    const images = Array.isArray(record.images) ? record.images.filter(Boolean).slice(0, 5) : [];
    images.forEach((dataUrl, photoIndex) => {
      const extension = imageExtension(dataUrl);
      if (!extension) return;
      const imageId = workbook.addImage({ base64: imageBase64(dataUrl), extension });
      const col = columns.length - 5 + photoIndex;
      const rowNumber = row.number - 1;
      worksheet.addImage(imageId, {
        tl: { col, row: rowNumber + 0.12 },
        ext: { width: 128, height: 86 },
        editAs: 'oneCell',
      });
    });
  });

  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, records.length + 1), column: columns.length },
  };

  return workbook.xlsx.writeBuffer();
}

function sendWorkbook(res, buffer, fileName) {
  const safeName = String(fileName || 'tour-summary')
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100) || 'tour-summary';
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}.xlsx"`);
  res.send(Buffer.from(buffer));
}

module.exports = {
  buildTourWorkbookBuffer,
  sendWorkbook,
};
