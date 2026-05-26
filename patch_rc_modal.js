const fs = require('fs');
const path = require('path');

const filesToPatch = [
  'under-repair.html',
  'empunderep.html',
  'emppendingfrn.html',
  'estimation-pending.html',
  'empestpend.html',
  'employee-ob-pending.html'
];

const modalHTML = `
<!-- RECHECK MODAL -->
<div class="update-panel" id="recheck-modal" style="z-index: 9999; display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); align-items: center; justify-content: center;">
  <div style="background: var(--surface); padding: 24px; border-radius: 12px; width: 340px; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">
    <h3 style="margin-top:0; font-size: 16px; color: var(--text);">Re-check Repair Status</h3>
    <p style="font-size: 13px; color: var(--soft); margin-bottom: 20px;">This item is marked as Repair Completed (RC). Please verify its status.</p>
    <div style="display: flex; gap: 10px; justify-content: flex-end;">
      <button class="btn btn-outline" style="flex:1;" onclick="closeRecheckModal()">WF (Working Fine)</button>
      <button class="btn btn-danger" style="flex:1;" id="nw-btn">NW (Not Working)</button>
    </div>
  </div>
</div>
<script>
let currentRecheckId = null;
function openRecheckModal(id) {
  currentRecheckId = id;
  const modal = document.getElementById('recheck-modal');
  if (modal) {
    modal.style.display = 'flex';
  }
}
function closeRecheckModal() {
  const modal = document.getElementById('recheck-modal');
  if (modal) {
    modal.style.display = 'none';
  }
  currentRecheckId = null;
}
document.getElementById('nw-btn')?.addEventListener('click', async () => {
  if (!currentRecheckId) return;
  const btn = document.getElementById('nw-btn');
  btn.disabled = true;
  btn.textContent = 'Processing...';
  try {
    const res = await fetch(\`\${API || ''}/api/revert-repair/\${currentRecheckId}\`, {
      method: 'POST',
      headers: typeof authHeaders === 'function' ? authHeaders() : { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (sessionStorage.getItem('schiller_token')||'') }
    });
    if (!res.ok) throw new Error('Failed to revert repair');
    if (typeof showToast === 'function') showToast('Reverted to Repair Started (RS).', 'ok');
    closeRecheckModal();
    if (typeof loadData === 'function') loadData();
  } catch (err) {
    console.error(err);
    if (typeof showToast === 'function') showToast('Error: ' + err.message, 'err');
    else alert('Error: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'NW (Not Working)';
  }
});
</script>
</body>`;

filesToPatch.forEach(file => {
  const filePath = path.join(__dirname, 'frontend/public', file);
  if (!fs.existsSync(filePath)) {
    console.warn('File not found:', filePath);
    return;
  }
  let content = fs.readFileSync(filePath, 'utf8');
  
  // 1. Inject openRecheckModal in place of the toast
  // Common pattern: if (current.rturCompleted||current.rtfrnCompleted||current.rtobCompleted) { showToast(...); return; }
  // We'll replace `showToast('Repair completed.','info'); return;` with `openRecheckModal(id); return;` inside openRepairModal.

  content = content.replace(/showToast\('Repair completed\.','info'\);(\s*)return;/g, "openRecheckModal(id);$1return;");

  // 2. Inject Modal HTML just before </body>
  if (!content.includes('id="recheck-modal"')) {
    content = content.replace(/<\/body>/, modalHTML);
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Patched:', file);
});
