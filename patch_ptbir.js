const fs = require('fs');

// Patch ptbir.html
let ptbir = fs.readFileSync('frontend/public/ptbir.html', 'utf8');

const selectOld = `<select id="f-cnr-circ" disabled>`;
const selectNew = `<select id="f-cnr-circ" onchange="handleCnrCircChange(this.value)" disabled>`;
ptbir = ptbir.replace(selectOld, selectNew);

const jsOld = `function handleAttachment(e) {`;
const jsNew = `function handleCnrCircChange(val) {
  const fileInp = document.getElementById('f-pt-attachment');
  const preview = document.getElementById('f-pt-attachment-preview');
  if(fileInp) {
    if(val === 'Yes') {
      fileInp.disabled = false;
    } else {
      fileInp.disabled = true;
      fileInp.value = '';
      currentPtAttachment = '';
      if(preview) preview.innerHTML = '';
    }
  }
}
function handleAttachment(e) {`;
ptbir = ptbir.replace(jsOld, jsNew);

const enableOld = `['f-ts-date','f-ps-engineer','f-cnr-circ','f-cnr-ref','f-cnr-date','f-ps-date','f-pt-remarks','f-pt-attachment','f-approved-date'].forEach(fid=>{
      const el=document.getElementById(fid); if(el) el.disabled = false;
    });`;
const enableNew = `['f-ts-date','f-ps-engineer','f-cnr-circ','f-cnr-ref','f-cnr-date','f-ps-date','f-pt-remarks','f-approved-date'].forEach(fid=>{
      const el=document.getElementById(fid); if(el) el.disabled = false;
    });
    const cnrCirc = document.getElementById('f-cnr-circ');
    const fileInp2 = document.getElementById('f-pt-attachment');
    if (fileInp2 && cnrCirc) { fileInp2.disabled = (cnrCirc.value !== 'Yes'); }`;
ptbir = ptbir.replace(enableOld, enableNew);

fs.writeFileSync('frontend/public/ptbir.html', ptbir);

// Patch ptcbir.html
let ptcbir = fs.readFileSync('frontend/public/ptcbir.html', 'utf8');

const tdOld = `<td><button class="btn-xs" onclick="viewRecord('\${e._id}')" title="View">View</button></td>`;
const tdNew = `<td style="white-space:nowrap;">
          <button class="btn-xs" onclick="viewRecord('\${e._id}')" title="View">View</button>
          \${e.attachment ? \`<button class="btn-xs" style="margin-left:4px;" onclick="downloadAttachment('\${e._id}')" title="Download">&#128229;</button>\` : ''}
        </td>`;
ptcbir = ptcbir.replace(tdOld, tdNew);

const dlFuncOld = `function closeView(){document.getElementById('view-modal').classList.remove('show');}`;
const dlFuncNew = `function downloadAttachment(id) {
  const e=allData.find(x=>x._id===id);
  if(!e || !e.attachment) return;
  const a = document.createElement('a');
  a.href = e.attachment;
  a.download = 'attachment';
  a.click();
}
function closeView(){document.getElementById('view-modal').classList.remove('show');}`;
ptcbir = ptcbir.replace(dlFuncOld, dlFuncNew);

fs.writeFileSync('frontend/public/ptcbir.html', ptcbir);
console.log('Patched ptbir.html and ptcbir.html');
