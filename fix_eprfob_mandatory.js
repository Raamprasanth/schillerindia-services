const fs = require('fs');
const path = require('path');

const eprfobPath = path.join(__dirname, 'frontend/public/eprfob.html');
let eprfob = fs.readFileSync(eprfobPath, 'utf8');

const regex = /const payload = \{[\s\S]*?remarks: document\.getElementById\('ep-remarks'\)\?\.value\?\.trim\(\) \|\| ''\s*\};/;

const newLogic = `
      const requiredFields = ['ep-scEng', 'ep-crmRefNo', 'ep-partType', 'ep-partsDescription', 'ep-remarks'];
      let isValid = true;
      const values = {};
      
      requiredFields.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          const val = el.value.trim();
          if (!val) {
            el.classList.add('err');
            isValid = false;
          } else {
            el.classList.remove('err');
            values[id] = val;
          }
        }
      });

      if (!isValid) {
        if (msg) { msg.className = 'form-msg err-msg'; msg.textContent = 'Please fill in all mandatory fields.'; }
        return;
      }

      const payload = {
        ...row,
        status: 'Closed',
        executedDate: new Date().toISOString().slice(0, 10),
        scEng: values['ep-scEng'],
        crmRefNo: values['ep-crmRefNo'],
        partType: values['ep-partType'],
        partsDescription: values['ep-partsDescription'],
        remarks: values['ep-remarks']
      };`;

eprfob = eprfob.replace(regex, newLogic);

fs.writeFileSync(eprfobPath, eprfob, 'utf8');
console.log('Made eprfob update fields mandatory.');
