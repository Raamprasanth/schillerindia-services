const fs = require('fs');
const path = require('path');
const https = require('https');

const TEMPLATE_PATH = path.join(__dirname, '..', 'templates', 'escalation_formats.xlsx');
const MAIL_ATTEMPTS = Math.max(1, parseInt(process.env.ESCALATION_MAIL_ATTEMPTS || '3', 10) || 3);
const MAIL_TIMEOUT_MS = Math.max(30000, parseInt(process.env.ESCALATION_MAIL_TIMEOUT_MS || '120000', 10) || 120000);
const MAIL_RETRY_BASE_MS = Math.max(1000, parseInt(process.env.ESCALATION_MAIL_RETRY_BASE_MS || '5000', 10) || 5000);

const HEADERS = [
  "SC_ENGINEER", "FRN_NO", "BRANCH", "ENGINEER_ID", "CUST_NAME",
  "PRODUCT_MODEL", "UNIT_STATUS", "DEF_MOD_BRD_NAME", "DEF_GIR_NO",
  "REP_GIR_NO", "DEF Part SNO", "FINAL_REMARKS", "DESTINATION",
  "SHIPMENT REF NUMBER", "REF DATE"
];

function getExcelJS() {
  try {
    return require('exceljs');
  } catch (error) {
    const installHint = 'Missing dependency "exceljs". Run npm install in the root/backend project or redeploy with package install enabled.';
    const wrapped = new Error(`${installHint} Original error: ${error.message}`);
    wrapped.code = error.code;
    throw wrapped;
  }
}

function getNodemailer() {
  try {
    return require('nodemailer');
  } catch (error) {
    const installHint = 'Missing dependency "nodemailer". Run npm install in the root/backend project or use an API mail provider.';
    const wrapped = new Error(`${installHint} Original error: ${error.message}`);
    wrapped.code = error.code;
    throw wrapped;
  }
}

function truncate(value, limit = 42) {
  const text = String(value || '');
  return text.length <= limit ? text : text.substring(0, limit - 3) + '...';
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanMailerError(error) {
  const code = error?.code ? ` (${error.code})` : '';
  const command = error?.command ? ` during ${error.command}` : '';
  const message = String(error?.message || error || 'Unknown mail error')
    .replace(/^NodeJS Escalation Mailer failed:\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (/timeout|timed out|etimedout|esocket|econnreset|econnrefused|enotfound|eai_again/i.test(`${message} ${code}`)) {
    return `Escalation mail server did not respond${command}${code}. The report was generated and the system retried automatically. Please check SMTP host/port/firewall or use an API mail provider.`;
  }
  if (/auth|login|credential|password|535|534|5\.7/i.test(`${message} ${code}`)) {
    return `Escalation mail authentication failed${code}. Please check sender email, SMTP user, and app password in Settings.`;
  }
  return `Escalation mail send failed${command}${code}: ${message}`;
}

function createTransporter(config) {
  const nodemailer = getNodemailer();
  const secure = config.useSsl || config.smtpPort === 465;
  return nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure,
    requireTLS: !secure && config.startTls !== false,
    auth: config.smtpUser ? {
      user: config.smtpUser,
      pass: config.smtpPass
    } : undefined,
    connectionTimeout: MAIL_TIMEOUT_MS,
    greetingTimeout: MAIL_TIMEOUT_MS,
    socketTimeout: MAIL_TIMEOUT_MS,
    tls: {
      servername: config.smtpHost,
      rejectUnauthorized: String(process.env.ESCALATION_SMTP_REJECT_UNAUTHORIZED || 'true').trim().toLowerCase() !== 'false'
    }
  });
}

function splitEmailList(value) {
  return String(value || '').split(',').map(x => x.trim()).filter(Boolean);
}

function resolveApiProvider() {
  const requested = String(process.env.ESCALATION_MAIL_PROVIDER || '').trim().toLowerCase();
  const providers = {
    sendgrid: {
      name: 'sendgrid',
      key: process.env.SENDGRID_API_KEY || process.env.ESCALATION_SENDGRID_API_KEY,
      host: 'api.sendgrid.com',
      path: '/v3/mail/send',
      authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    },
    resend: {
      name: 'resend',
      key: process.env.RESEND_API_KEY || process.env.ESCALATION_RESEND_API_KEY,
      host: 'api.resend.com',
      path: '/emails',
      authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    },
    brevo: {
      name: 'brevo',
      key: process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY || process.env.ESCALATION_BREVO_API_KEY,
      host: 'api.brevo.com',
      path: '/v3/smtp/email',
      authHeader: (key) => ({ 'api-key': key }),
    },
  };
  if (requested && requested !== 'smtp' && providers[requested]?.key) return providers[requested];
  return Object.values(providers).find(provider => provider.key) || null;
}

function shouldPreferApiProvider() {
  const requested = String(process.env.ESCALATION_MAIL_PROVIDER || '').trim().toLowerCase();
  if (!requested || requested === 'auto') return Boolean(resolveApiProvider());
  return requested !== 'smtp';
}

function shouldUseApiOnly() {
  const requested = String(process.env.ESCALATION_MAIL_PROVIDER || '').trim().toLowerCase();
  return requested !== 'smtp' && Boolean(resolveApiProvider());
}

function postJson(provider, body) {
  const json = JSON.stringify(body);
  const headers = {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(json),
    ...provider.authHeader(provider.key),
  };
  return new Promise((resolve, reject) => {
    const req = https.request({
      method: 'POST',
      hostname: provider.host,
      path: provider.path,
      headers,
      timeout: MAIL_TIMEOUT_MS,
    }, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ statusCode: res.statusCode, body: text });
          return;
        }
        reject(new Error(`${provider.name} API failed with HTTP ${res.statusCode}: ${text.substring(0, 500)}`));
      });
    });
    req.on('timeout', () => req.destroy(new Error(`${provider.name} API request timed out`)));
    req.on('error', reject);
    req.write(json);
    req.end();
  });
}

function parseEmailAddress(addr) {
  const match = String(addr).match(/(.*)<(.*)>/);
  if (match) {
    const name = match[1].trim();
    const email = match[2].trim();
    if (name) return { name, email };
    return { email };
  }
  return { email: String(addr).trim() };
}

function buildApiBody(providerName, mailOptions, attachmentPath) {
  const attachmentName = path.basename(attachmentPath);
  const attachmentContent = fs.readFileSync(attachmentPath).toString('base64');
  const to = splitEmailList(mailOptions.to);
  const cc = splitEmailList(mailOptions.cc);
  const senderParsed = parseEmailAddress(mailOptions.from);

  if (providerName === 'sendgrid') {
    const personalization = { to: to.map(email => parseEmailAddress(email)) };
    if (cc.length) personalization.cc = cc.map(email => parseEmailAddress(email));
    return {
      personalizations: [personalization],
      from: senderParsed,
      subject: mailOptions.subject,
      content: [{ type: 'text/plain', value: mailOptions.text }],
      attachments: [{
        content: attachmentContent,
        filename: attachmentName,
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        disposition: 'attachment',
      }],
    };
  }

  if (providerName === 'resend') {
    const body = {
      from: mailOptions.from,
      to,
      subject: mailOptions.subject,
      text: mailOptions.text,
      attachments: [{ filename: attachmentName, content: attachmentContent }],
    };
    if (cc.length) body.cc = cc;
    return body;
  }

  const body = {
    sender: senderParsed,
    to: to.map(email => parseEmailAddress(email)),
    subject: mailOptions.subject,
    textContent: mailOptions.text,
    attachment: [{ name: attachmentName, content: attachmentContent }],
  };
  if (cc.length) body.cc = cc.map(email => parseEmailAddress(email));
  return body;
}

async function sendEmailViaApiProvider(mailOptions, attachmentPath) {
  const provider = resolveApiProvider();
  if (!provider) return false;
  const body = buildApiBody(provider.name, mailOptions, attachmentPath);
  const response = await postJson(provider, body);
  let parsed = {};
  try { parsed = response.body ? JSON.parse(response.body) : {}; } catch (_) {}
  const messageId = parsed.messageId || parsed.id || parsed.message_id || '';
  console.log(`[EscalationMailer] Mail accepted via ${provider.name} API${messageId ? ` (${messageId})` : ''}. To: ${mailOptions.to}`);
  return {
    provider: provider.name,
    statusCode: response.statusCode,
    messageId,
    responseBody: response.body || '',
    to: mailOptions.to,
    from: mailOptions.from,
    subject: mailOptions.subject,
  };
}

function getHeaders(rows, preferred = null) {
  if (preferred && preferred.length > 0) return preferred;
  const discovered = [];
  rows.forEach(row => {
    Object.keys(row).forEach(key => {
      if (!discovered.includes(key)) discovered.push(key);
    });
  });
  return discovered;
}

function copyCellStyle(source, target) {
  if (source.font) target.font = JSON.parse(JSON.stringify(source.font));
  if (source.fill) target.fill = JSON.parse(JSON.stringify(source.fill));
  if (source.border) target.border = JSON.parse(JSON.stringify(source.border));
  if (source.alignment) target.alignment = JSON.parse(JSON.stringify(source.alignment));
  if (source.numFmt) target.numFmt = source.numFmt;
}

async function buildXlsx(payload, outputPath) {
  const ExcelJS = getExcelJS();
  const workbook = new ExcelJS.Workbook();
  const sheets = payload.sheets || [];

  sheets.forEach((sheet, index) => {
    const ws = workbook.addWorksheet((sheet.name || `Sheet ${index + 1}`).substring(0, 31));
    let rows = sheet.rows || [];
    let headers = getHeaders(rows, sheet.headers);

    if (headers.length === 0) {
      return;
    }

    // Add headers
    const headerRow = ws.addRow(headers);
    headerRow.eachCell(cell => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD9EAF7' } // Note: exceljs expects ARGB
      };
      cell.font = { bold: true, color: { argb: 'FF12344D' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });

    // Add rows
    rows.forEach(row => {
      const rowData = headers.map(h => row[h] || "");
      const addedRow = ws.addRow(rowData);
      addedRow.eachCell(cell => {
        cell.alignment = { vertical: 'top', wrapText: true };
      });
    });

    // Auto fit columns
    ws.columns.forEach(column => {
      let maxLength = 12;
      column.eachCell({ includeEmpty: true }, cell => {
        const val = cell.value ? String(cell.value) : '';
        maxLength = Math.max(maxLength, Math.min(val.length + 2, 40));
      });
      column.width = maxLength;
    });

    ws.views = [{ state: 'frozen', ySplit: 1 }];
  });

  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
  await workbook.xlsx.writeFile(outputPath);
}

function templateHeaders(templateWs, headerRowIdx) {
  const headers = [];
  const row = templateWs.getRow(headerRowIdx);
  row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    const val = cell.value ? String(cell.value).trim() : '';
    headers.push(val);
  });
  // trim trailing empty headers
  while (headers.length > 0 && !headers[headers.length - 1]) {
    headers.pop();
  }
  return headers;
}

async function buildTemplateXlsx(payload, outputPath) {
  const ExcelJS = getExcelJS();
  const templatePath = payload.templatePath || process.env.ESCALATION_TEMPLATE_PATH || TEMPLATE_PATH;
  
  if (!fs.existsSync(templatePath)) {
    return await buildXlsx(payload, outputPath);
  }

  const templateWb = new ExcelJS.Workbook();
  await templateWb.xlsx.readFile(templatePath);
  
  const workbook = new ExcelJS.Workbook();

  const sheets = payload.sheets || [];
  for (let i = 0; i < sheets.length; i++) {
    const sheet = sheets[i];
    let templateName = sheet.template || sheet.name;
    let templateWs = templateWb.getWorksheet(templateName);
    
    if (!templateWs) {
      templateWs = templateWb.worksheets[0];
    }

    const title = (sheet.name || templateName || `Sheet ${i + 1}`).substring(0, 31);
    const ws = workbook.addWorksheet(title);
    
    const headerRowIdx = parseInt(sheet.headerRow || 1, 10);
    const headers = sheet.headers || templateHeaders(templateWs, headerRowIdx);
    const rows = sheet.rows || [];

    // Copy header formatting
    const sourceHeaderRow = templateWs.getRow(headerRowIdx);
    const targetHeaderRow = ws.getRow(1);
    
    headers.forEach((header, idx) => {
      const col = idx + 1;
      const sourceCell = sourceHeaderRow.getCell(col);
      const targetCell = targetHeaderRow.getCell(col);
      targetCell.value = header;
      copyCellStyle(sourceCell, targetCell);
      if (!targetCell.alignment) targetCell.alignment = {};
      targetCell.alignment.horizontal = targetCell.alignment.horizontal || 'center';
      targetCell.alignment.vertical = targetCell.alignment.vertical || 'middle';
      targetCell.alignment.wrapText = true;

      const sourceCol = templateWs.getColumn(col);
      if (sourceCol && sourceCol.width) {
        ws.getColumn(col).width = sourceCol.width;
      }
    });

    if (sourceHeaderRow.height) {
      targetHeaderRow.height = sourceHeaderRow.height;
    }

    // Add rows
    const sourceDataRow = templateWs.getRow(headerRowIdx + 1);
    if (rows.length > 0) {
      rows.forEach((row, rowIdx) => {
        const addedRow = ws.getRow(rowIdx + 2);
        headers.forEach((header, idx) => {
          const col = idx + 1;
          const cell = addedRow.getCell(col);
          cell.value = row[header] || "";
          
          const templateDataCell = sourceDataRow.getCell(col);
          copyCellStyle(templateDataCell, cell);
          
          if (!cell.alignment) cell.alignment = {};
          cell.alignment.vertical = 'top';
          cell.alignment.wrapText = true;
        });
        addedRow.commit();
      });
    }

    ws.views = [{ state: 'frozen', ySplit: 1 }];
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: headers.length }
    };
  }

  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
  await workbook.xlsx.writeFile(outputPath);
}

async function sendEmail(payload, attachmentPath, senderConfig) {
  const smtpHost = (senderConfig?.smtpHost || process.env.ESCALATION_SMTP_HOST || "").trim();
  const smtpPort = parseInt(senderConfig?.smtpPort || process.env.ESCALATION_SMTP_PORT || "587", 10);
  const smtpUser = (senderConfig?.smtpUser || process.env.ESCALATION_SMTP_USER || "").trim();
  let smtpPass = (senderConfig?.smtpPass || process.env.ESCALATION_SMTP_PASS || "").trim();
  const fromAddr = (senderConfig?.fromEmail || process.env.ESCALATION_EMAIL_FROM || smtpUser).trim();
  
  if (smtpHost.toLowerCase().includes("gmail.com")) {
    smtpPass = smtpPass.replace(/\s+/g, "");
  }

  let toAddrs = [];
  if (payload.to && Array.isArray(payload.to)) {
    toAddrs = payload.to.map(x => String(x).trim()).filter(Boolean);
  }
  if (toAddrs.length === 0) {
    toAddrs = splitEmailList(process.env.ESCALATION_EMAIL_TO || "");
  }
  
  const ccAddrs = splitEmailList(process.env.ESCALATION_EMAIL_CC || "");
  const useSsl = senderConfig && typeof senderConfig.ssl !== 'undefined' ? Boolean(senderConfig.ssl) : (process.env.ESCALATION_SMTP_SSL || "false").trim().toLowerCase() === "true";
  const startTls = senderConfig && typeof senderConfig.startTls !== 'undefined'
    ? Boolean(senderConfig.startTls)
    : (process.env.ESCALATION_SMTP_STARTTLS || "true").trim().toLowerCase() !== "false";

  const apiOnly = shouldUseApiOnly();
  if (!fromAddr || toAddrs.length === 0) {
    throw new Error("Email settings are incomplete. Set ESCALATION_EMAIL_FROM and escalation receiver email.");
  }
  if (!apiOnly && !smtpHost) {
    throw new Error("SMTP settings are incomplete. Set ESCALATION_SMTP_HOST or configure an API mail provider.");
  }

  const attachmentName = path.basename(attachmentPath);
  
  const mailOptions = {
    from: fromAddr,
    to: toAddrs.join(', '),
    cc: ccAddrs.join(', '),
    subject: payload.subject || "Escalation Report",
    text: payload.body || "Please find the attached escalation report.",
    attachments: [
      {
        filename: attachmentName,
        path: attachmentPath,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }
    ]
  };

  if (shouldPreferApiProvider()) {
    try {
      const sentViaApi = await sendEmailViaApiProvider(mailOptions, attachmentPath);
      if (sentViaApi) return sentViaApi;
    } catch (error) {
      console.warn(`[EscalationMailer] API provider failed before SMTP fallback: ${error.message}`);
      if (apiOnly) {
        throw new Error(`Escalation API mail send failed: ${error.message}`);
      }
    }
  }

  let lastError = null;
  for (let attempt = 1; attempt <= MAIL_ATTEMPTS; attempt++) {
    const transporter = createTransporter({
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPass,
      useSsl,
      startTls
    });
    try {
      await transporter.verify();
      await transporter.sendMail(mailOptions);
      return {
        provider: 'smtp',
        to: mailOptions.to,
        from: mailOptions.from,
        subject: mailOptions.subject,
      };
    } catch (error) {
      lastError = error;
      const cleanError = cleanMailerError(error);
      console.warn(`[EscalationMailer] Attempt ${attempt}/${MAIL_ATTEMPTS} failed: ${cleanError}`);
      if (attempt >= MAIL_ATTEMPTS) break;
      await wait(MAIL_RETRY_BASE_MS * attempt);
    } finally {
      try { transporter.close(); } catch (_) {}
    }
  }

  if (!apiOnly) {
    try {
      const sentViaApi = await sendEmailViaApiProvider(mailOptions, attachmentPath);
      if (sentViaApi) return sentViaApi;
    } catch (error) {
      console.warn(`[EscalationMailer] API fallback failed after SMTP retries: ${error.message}`);
    }
  }

  throw new Error(`${cleanMailerError(lastError)} Attempts: ${MAIL_ATTEMPTS}. Attachment kept at ${attachmentPath}`);
}

async function runEscalationMailer(payload, outputPath, senderConfig) {
  try {
    const isXlsx = (payload.format || "").toLowerCase() === "xlsx" || outputPath.toLowerCase().endsWith('.xlsx');
    
    if (isXlsx) {
      const hasTemplate = payload.sheets && payload.sheets.some(s => s.template);
      if (hasTemplate) {
        await buildTemplateXlsx(payload, outputPath);
      } else {
        await buildXlsx(payload, outputPath);
      }
    } else {
      // If someone wants a PDF but python is removed, fallback to basic excel
      // Or they can add PDF generation logic here if required.
      await buildXlsx(payload, outputPath);
    }
    
    const mailResult = await sendEmail(payload, outputPath, senderConfig);
    return { success: true, outputPath, mailResult };
  } catch (error) {
    console.error("Error running escalation mailer:", error);
    throw error;
  }
}

module.exports = {
  runEscalationMailer
};
