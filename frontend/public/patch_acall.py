import re

filename = 'c:/Users/Raamprasanth/OneDrive/Desktop/shcl/frontend/public/acall.html'
with open(filename, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update HTML
content = content.replace('<div class="ff"><label>Division</label><input type="text" id="m-division"/></div>', 
                          '<div class="ff"><label>Division</label><input type="text" id="m-division" onchange="loadDivisionModels(this.value)"/></div>')

content = content.replace('<div class="ff"><label>Model</label><input type="text" id="m-model"/></div>',
                          '<div class="ff"><label>Supplier</label><select id="m-supplier" onchange="onSupplierChange()"><option value="">Select Supplier-</option></select></div>\n      <div class="ff"><label>Model</label><select id="m-model"><option value="">Select Model-</option></select></div>')

# 2. Add JS
js_injection = '''let ALL_MODELS_DATA = [];
let MODEL_OPTIONS = [];

function normalizeDivisionName(value){
  return String(value||'').trim().toLowerCase();
}
function getModelName(item){
  return typeof item === 'string' ? item : (item && (item.model || item.name || item.value)) || '';
}

async function loadDivisionModels(divisionName = '', selectedModel = '', selectedSupplier = ''){
  const targetDivision = divisionName || document.getElementById('m-division').value || '';
  MODEL_OPTIONS = [];
  ALL_MODELS_DATA = [];
  renderSupplierOptions(selectedSupplier);
  renderModelOptions(selectedModel);
  if(!targetDivision) return;
  try{
    const res = await fetch(`${API}/api/divisions`, { headers: authHeaders() });
    if(!res.ok) throw new Error('HTTP ' + res.status);
    const divisions = await res.json();
    const div = (Array.isArray(divisions) ? divisions : []).find(d => {
      const names = [d.name, d.displayName].map(normalizeDivisionName);
      return names.includes(normalizeDivisionName(targetDivision));
    });
    const models = Array.isArray(div?.models) ? div.models : [];
    ALL_MODELS_DATA = models;
    renderSupplierOptions(selectedSupplier);
    onSupplierChange(selectedModel);
  }catch(e){
    MODEL_OPTIONS = [];
    renderSupplierOptions(selectedSupplier);
    renderModelOptions(selectedModel);
  }
}

function renderSupplierOptions(selected = ''){
  const sel = document.getElementById('m-supplier');
  if(!sel) return;
  const suppliers = Array.from(new Set(ALL_MODELS_DATA.map(m => String(m.supplier||'').trim()).filter(Boolean))).sort((a,b)=>a.localeCompare(b));
  let options = suppliers.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
  if(selected && !suppliers.includes(selected)){
    options = `<option value="${esc(selected)}">${esc(selected)}</option>` + options;
  }
  sel.innerHTML = `<option value="">Select Supplier-</option>` + options;
  if(selected) sel.value = selected;
}

function onSupplierChange(selectedModel = '') {
  const supplier = (document.getElementById('m-supplier')||{}).value || '';
  let filteredModels = ALL_MODELS_DATA;
  if (supplier) {
    filteredModels = ALL_MODELS_DATA.filter(m => String(m.supplier||'').trim() === supplier);
  }
  MODEL_OPTIONS = Array.from(new Set(filteredModels.map(getModelName).map(v => String(v||'').trim()).filter(Boolean))).sort((a,b)=>a.localeCompare(b));
  renderModelOptions(typeof selectedModel === 'string' ? selectedModel : '');
}

function renderModelOptions(selected = ''){
  const sel = document.getElementById('m-model');
  if(!sel) return;
  const selectedValue = String(selected||'').trim();
  let options = MODEL_OPTIONS.map(name => `<option value="${esc(name)}">${esc(name)}</option>`).join('');
  if(selectedValue && !MODEL_OPTIONS.includes(selectedValue)){
    options = `<option value="${esc(selectedValue)}">${esc(selectedValue)}</option>` + options;
  }
  sel.innerHTML = `<option value="">${MODEL_OPTIONS.length ? 'Select Model-' : 'No models configured'}</option>` + options;
  if(selectedValue) sel.value = selectedValue;
}

'''
content = content.replace("function optionHtml(value){", js_injection + "function optionHtml(value){")

# 3. Open add modal
# function openAddModal(){document.getElementById('m-callDate').value=new Date().toISOString().slice(0,10);renderRegionOptions();renderBranchOptions();document.getElementById('add-modal').classList.add('open');}
content = content.replace("function openAddModal(){", "function openAddModal(){['m-division','m-scEng','m-engineer','m-customer','m-callType','m-commType','m-duration','m-remarks'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';}); document.getElementById('m-supplier').innerHTML='<option value=\"\">Select Supplier-</option>'; document.getElementById('m-model').innerHTML='<option value=\"\">Select Model-</option>'; ")

with open(filename, 'w', encoding='utf-8') as f:
    f.write(content)
print(f"Updated {filename}")
