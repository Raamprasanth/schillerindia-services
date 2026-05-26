import re
import os

def update_file(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Add Supplier dropdown before Model dropdown in HTML
    # We find:
    #         <div class="ff">
    #           <label>Model / Device <span class="req">*</span></label>
    #           <select id="m-model" required>
    #             <option value="">Select Model-</option>
    #           </select>
    #         </div>
    
    # Or in ptcall.html:
    #         <div class="ff">
    #           <label>Model / Reason <span class="req">*</span></label>
    #           <input type="text" id="m-model" placeholder="Type model or reason" required/>
    #         </div>

    # To handle both consistently, we will find id="m-model" wrapper
    if 'id="m-supplier"' not in content:
        model_div_regex = re.compile(r'(<div class="ff">\s*<label>(?:Model / Reason|Model / Device) <span class="req">\*</span></label>\s*(?:<input[^>]+id="m-model"[^>]*/>|<select[^>]+id="m-model"[^>]*>[\s\S]*?</select>)\s*</div>)')
        
        replacement_html = '''<div class="ff">
          <label>Supplier <span class="req">*</span></label>
          <select id="m-supplier" required onchange="onSupplierChange()">
            <option value="">Select Supplier-</option>
          </select>
        </div>
        <div class="ff">
          <label>Model / Device <span class="req">*</span></label>
          <select id="m-model" required>
            <option value="">Select Model-</option>
          </select>
        </div>'''
        
        content = model_div_regex.sub(replacement_html, content)

    # 2. Update clearModalForm to also clear m-supplier
    content = content.replace("['m-model','m-duration','m-remarks'].forEach(id => document.getElementById(id).value = '');", 
                              "['m-supplier','m-model','m-duration','m-remarks'].forEach(id => {const el=document.getElementById(id);if(el)el.value = '';});")
                              
    content = content.replace("['m-division','m-region','m-branch','m-calldate','m-engineer','m-model','m-calltype','m-status','m-remarks']",
                              "['m-division','m-region','m-branch','m-calldate','m-engineer','m-supplier','m-model','m-calltype','m-status','m-remarks']")

    # 3. Add ALL_MODELS_DATA and onSupplierChange logic
    if 'ALL_MODELS_DATA =' not in content:
        js_injection = '''let ALL_MODELS_DATA = [];

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
'''
        content = content.replace("function normalizeDivisionName(value){", js_injection + "\nfunction normalizeDivisionName(value){")

    # 4. Replace loadDivisionModels
    old_load_div = re.compile(r'async function loadDivisionModels.*?}\s*}', re.DOTALL)
    
    new_load_div = '''async function loadDivisionModels(divisionName = '', selectedModel = '', selectedSupplier = ''){
  const targetDivision = divisionName || CURRENT_USER.division || document.getElementById('m-division').value || '';
  MODEL_OPTIONS = [];
  ALL_MODELS_DATA = [];
  renderSupplierOptions(selectedSupplier);
  renderModelOptions(selectedModel);
  if(!targetDivision) return;
  try{
    const res = await fetch(`${API}/api/divisions`, { headers: authHeaders() });
    handleUnauth(res);
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
    if(e.message === 'Unauthorized') return;
    MODEL_OPTIONS = [];
    renderSupplierOptions(selectedSupplier);
    renderModelOptions(selectedModel);
    showToast('Could not load models for this division: ' + e.message, 'err');
  }
}'''
    
    content = old_load_div.sub(new_load_div, content, count=1)

    # 5. Fix edit modal open
    content = content.replace("await loadDivisionModels(d.division, d.model);", "await loadDivisionModels(d.division, d.model, d.supplier);")
    content = content.replace("set('m-model', d.model);", "set('m-supplier', d.supplier);\n  set('m-model', d.model);")

    # Write back
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Updated {filename}")

for f in ['c:/Users/Raamprasanth/OneDrive/Desktop/shcl/frontend/public/ptcall.html', 'c:/Users/Raamprasanth/OneDrive/Desktop/shcl/frontend/public/ecall.html']:
    update_file(f)
