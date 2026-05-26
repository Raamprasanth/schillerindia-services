import re

def update_load_div(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    old_code = r'''ALL_MODELS_DATA = models;
    
    renderSupplierOptions\(selectedSupplier\);'''
    
    new_code = '''ALL_MODELS_DATA = models;
    
    if (selectedModel && !selectedSupplier) {
      const matched = models.find(m => String(m.model||m.name||'').trim().toLowerCase() === String(selectedModel).trim().toLowerCase());
      if (matched && matched.supplier) {
        selectedSupplier = matched.supplier;
      }
    }
    
    renderSupplierOptions(selectedSupplier);'''
    
    content = re.sub(old_code, new_code, content)
    
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(content)

def update_ptcall_edit(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # ptcall.html lacks await loadDivisionModels(d.division, d.model, d.supplier); in openEditModal
    # We will replace set('m-supplier'... set('m-model'... with await loadDivisionModels
    
    old_code = r"set\('m-supplier', d\.supplier\);\s*set\('m-model', d\.model\);"
    new_code = r"await loadDivisionModels(d.division, d.model);"
    
    content = re.sub(old_code, new_code, content)
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(content)

def update_acall_edit(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # acall.html openEditModal doesn't have loadDivisionModels either?
    # Wait, acall openEditModal does not exist? I didn't see it, it's called openEdit(id) or maybe there is no openEditModal?
    # Actually acall.html might not have edit capability at all! Or if it does, let's check if openEditModal exists.
    pass


update_load_div('c:/Users/Raamprasanth/OneDrive/Desktop/shcl/frontend/public/ptcall.html')
update_load_div('c:/Users/Raamprasanth/OneDrive/Desktop/shcl/frontend/public/ecall.html')
update_load_div('c:/Users/Raamprasanth/OneDrive/Desktop/shcl/frontend/public/acall.html')

update_ptcall_edit('c:/Users/Raamprasanth/OneDrive/Desktop/shcl/frontend/public/ptcall.html')
