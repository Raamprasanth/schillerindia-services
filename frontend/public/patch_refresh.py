import glob, re

for f in glob.glob('c:/Users/Raamprasanth/OneDrive/Desktop/shcl/frontend/public/pt*.html'):
    with open(f, 'r', encoding='utf-8') as file:
        content = file.read()
    
    def repl(m):
        btn = m.group(0)
        onclick_match = re.search(r'onclick="([^"]+)"', btn)
        if not onclick_match: return btn
        fn = onclick_match.group(1).strip()
        if fn.startswith('const b=this'): return btn
        
        new_onclick = f"const b=this; const o=b.innerHTML; b.innerHTML='&#8635; Refreshing...'; Promise.resolve({fn}).then(()=>{{b.innerHTML='&#10004; Refreshed!'; setTimeout(()=>b.innerHTML=o,2000);}}).catch(()=>{{b.innerHTML='&#10008; Error'; setTimeout(()=>b.innerHTML=o,2000);}})"
        
        new_btn = btn.replace(onclick_match.group(0), f'onclick="{new_onclick}"')
        return new_btn
        
    new_content = re.sub(r'<button[^>]*>[^<]*Refresh[^<]*</button>', repl, content, flags=re.IGNORECASE)
    
    if new_content != content:
        with open(f, 'w', encoding='utf-8') as file:
            file.write(new_content)
        print(f'Updated {f}')
