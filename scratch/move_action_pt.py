import os
import re

files_to_process = [
    'ptbir.html',
    'ptcbir.html',
    'ptpa.html',
    'ptca.html',
    'ptcall.html',
    'ptclose.html',
]

def move_action_column(filepath):
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        return

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content
    # 1. Move <th>Action(s)</th> to the first position
    def repl_th(m):
        tr_inner = m.group(1)
        action_th_match = re.search(r'(<th[^>]*>Actions?</th>)', tr_inner, flags=re.IGNORECASE)
        if not action_th_match:
            return m.group(0)
        action_th = action_th_match.group(1)
        tr_inner_no_action = tr_inner[:action_th_match.start()] + tr_inner[action_th_match.end():]
        return f"<tr>{action_th}{tr_inner_no_action}</tr>"
        
    content = re.sub(r'<tr>([\s\S]*?)</tr>', lambda m: repl_th(m) if '<th>Action' in m.group(1) or '<th>Action</th>' in m.group(1) or '<th>Actions</th>' in m.group(1) else m.group(0), content, flags=re.IGNORECASE)
    
    # 2. Move JS template literal row action td to first.
    # It generally looks like:
    # <tr>
    #   <td>...</td>
    #   ...
    #   <td>...button...</td>
    # </tr>
    def repl_js_tr(m):
        tr_inner = m.group(1)
        # Find the td with buttons (usually contains 'btn', 'edit', 'view', or similar)
        # Or simply it's the last td in the template literal.
        tds = re.split(r'(<td[^>]*>)', tr_inner)
        if len(tds) < 3: return m.group(0)
        
        # reconstruct tds
        td_elements = []
        current_td = ""
        in_td = False
        for chunk in tds:
            if chunk.startswith('<td'):
                in_td = True
                current_td = chunk
            elif in_td:
                # Find where td ends
                end_idx = chunk.find('</td>')
                if end_idx != -1:
                    current_td += chunk[:end_idx+5]
                    td_elements.append(current_td)
                    in_td = False
                else:
                    current_td += chunk
        
        if not td_elements: return m.group(0)
        
        # Assume the last TD is the actions one if it has a button
        if 'button' in td_elements[-1].lower() or 'btn' in td_elements[-1].lower() or 'display:flex' in td_elements[-1].lower():
            action_td = td_elements.pop(-1)
            td_elements.insert(0, action_td)
            # Reconstruct the tr_inner. It's tricky because there might be whitespace between tds.
            # Easiest way: find the exact strings of all tds in tr_inner, and reconstruct it.
            # Or just replace the whole inner content.
            # But what about the non-td content (newlines, spacing)?
            # Let's just create a new string.
            new_inner = "\n      ".join(td_elements) + "\n    "
            return f"<tr>\n      {new_inner}</tr>"
            
        return m.group(0)

    # We only want to apply this to the renderTable/JS block.
    # We can just apply it to `<tr>...</tr>` inside backticks.
    def repl_backtick(m):
        backtick_content = m.group(1)
        new_backtick_content = re.sub(r'<tr>([\s\S]*?)</tr>', repl_js_tr, backtick_content)
        return "`" + new_backtick_content + "`"
        
    content = re.sub(r'`([\s\S]*?)`', repl_backtick, content)

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")
    else:
        print(f"No changes made to {filepath}")

for filename in files_to_process:
    move_action_column(os.path.join('frontend', 'public', filename))
