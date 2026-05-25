import os

files_to_patch = [
    r'c:\Users\Raamprasanth\OneDrive\Desktop\shcl\frontend\public\employee-service-list.html',
    r'c:\Users\Raamprasanth\OneDrive\Desktop\shcl\frontend\public\service-list.html'
]

js_code = """
  // Setup enter to fetch today's date for all date inputs
  document.querySelectorAll('input[type="date"]').forEach(el => {
    el.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        const tzoffset = (new Date()).getTimezoneOffset() * 60000;
        this.value = (new Date(Date.now() - tzoffset)).toISOString().slice(0, 10);
      }
    });
  });
"""

for file in files_to_patch:
    if os.path.exists(file):
        with open(file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        if "el.addEventListener('keydown'" not in content:
            content = content.replace('loadData();', 'loadData();' + js_code)
            with open(file, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f'Patched {os.path.basename(file)}')
