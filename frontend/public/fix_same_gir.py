import os

base_dir = r'c:\Users\Raamprasanth\OneDrive\Desktop\shcl\frontend\public'

for filename in os.listdir(base_dir):
    if not filename.endswith('.html'): continue
    filepath = os.path.join(base_dir, filename)
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    modified = False

    if 'Same GIR No?' in content:
        content = content.replace('Same GIR No?', 'Same GIR No')
        modified = True

    if 'const safeDefGir=/[A-Za-z0-9]/.test(defGir)?defGir:\'\';' in content:
        content = content.replace('const safeDefGir=/[A-Za-z0-9]/.test(defGir)?defGir:\'\';', 'const safeDefGir=defGir;')
        modified = True

    if filename == 'empestpend.html' and 'function handleEstimateSameGir(val){' in content:
        broken_func_start = content.find('function handleEstimateSameGir(val){')
        if broken_func_start != -1:
            broken_func_end = content.find('function closeToEscalationModal(){', broken_func_start)
            if broken_func_end != -1:
                correct_func = """function handleEstimateSameGir(val){
  const id=editingId;
  const current=allRecords.find(x=>(x._id||x.id)===id)||{};
  const defGir=String(current.defGir||'').trim();
  const input=document.getElementById('u-defunitgir');
  const revalue=document.getElementById('u-revalue');
  const safeDefGir=defGir;
  if(!input) return;
  if(val==='yes'){
    input.value=safeDefGir;
    input.readOnly=true;
    input.classList.add('gir-autofill');
    if(revalue){revalue.readOnly=false;revalue.classList.remove('gir-autofill');}
  }else if(val==='no'){
    input.value='';
    input.readOnly=false;
    input.classList.remove('gir-autofill');
    if(revalue){revalue.readOnly=false;revalue.classList.remove('gir-autofill');}
  }else{
    input.value='';
    input.readOnly=false;
    input.classList.remove('gir-autofill');
    if(revalue){revalue.readOnly=false;revalue.classList.remove('gir-autofill');}
  }
}
"""
                content = content[:broken_func_start] + correct_func + content[broken_func_end:]
                modified = True

    if modified:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'Fixed {filename}')
