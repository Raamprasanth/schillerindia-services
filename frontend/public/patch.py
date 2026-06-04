import sys
import re

def patch_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        # 1. Table header
        content = re.sub(
            r'(<th[^>]*>Part No</th>)',
            r'\1\n                  <th style="width:150px;">Description</th>',
            content
        )
        
        # Also fix the colspan in the empty state
        content = re.sub(
            r'(<td colspan=")7("[^>]*>No TO rows added.</td>)',
            r'\g<1>8\g<2>',
            content
        )

        # 2. Add description input in renderToEscalationRows
        desc_td = r'    <td><input type="text" value="${esc(row.description||\'\')}" oninput="updateToEscalationRow(${index},\'description\',this.value)" placeholder="Description"/></td>'
        
        # Regex to find the partNo td in renderToEscalationRows
        # '<td><input type="text" value="${esc(row.partNo||'')}" oninput="updateToEscalationRow(${index},'partNo',this.value)" placeholder="Part no"/></td>'
        # The single quotes are tricky, use generic match
        content = re.sub(
            r'(<td><input type="text" value="\$\{esc\(row\.partNo\|\|[^\}]*\}\}" oninput="updateToEscalationRow\(\$\{index\},[^,]+,this\.value\)" placeholder="Part no"/></td>)',
            r'\1\n' + desc_td,
            content
        )

        # 3. Add to updateToEscalationRow
        content = re.sub(
            r'(if\(field===\'partNo\'\) currentToRows\[index\]\.partNo=String\(value\|\|\'\'\);)',
            r"\1\n  if(field==='description') currentToRows[index].description=String(value||'');",
            content
        )

        # 4. Add to submitToEscalationQueue
        content = re.sub(
            r'(partNo:String\(row\.partNo\|\|\'\'\)\.trim\(\),)',
            r"\1description:String(row.description||'').trim(),",
            content
        )

        # 5. Disable TO button if DR queued
        # Find TO buttons
        # <td><button class="btn-xs ${s.toEscalationQueuedAt?'to-queued':'to-action'}" onclick="openToEscalationModal('${rowId}')" title="${s.toEscalationQueuedAt?'Already queued for In House FRN Replacement':'Queue to In House FRN Replacement'}">TO</button></td>
        
        def to_button_replacer(m):
            button_str = m.group(0)
            if 'disabled' not in button_str:
                # Add disabled attribute
                # Depending on the page, the item is either `s` (empestpend), `d` (emppendingfrn), or `d` (empunderep)
                # But we can just use the literal text.
                if '${s.toEscalationQueuedAt' in button_str:
                    return button_str.replace('>TO</button>', ' ${s.srEscalationQueuedAt ? "disabled" : ""}>TO</button>')
                elif '${d.toEscalationQueuedAt' in button_str:
                    return button_str.replace('>TO</button>', ' ${d.srEscalationQueuedAt ? "disabled" : ""}>TO</button>')
            return button_str

        content = re.sub(
            r'<button class="btn-xs \$\{[^}]*to-queued.*?title="[^"]*In House FRN Replacement[^"]*".*?>TO</button>',
            to_button_replacer,
            content
        )

        # For empunderep.html renderToEscalationButton
        # function renderToEscalationButton(id,isQueued){
        #   return `<button class="btn-xs ${isQueued?'to-queued':'to-action'}" onclick="openToEscalationModal('${id}')" title="${isQueued?'Already queued for In House FRN Replacement':'Queue to In House FRN Replacement'}">TO</button>`;
        # }
        # And it's called as renderToEscalationButton(rid,isToQueued)
        # We need to change it to accept srQueued
        
        content = re.sub(
            r'function renderToEscalationButton\(id,isQueued\)\{.*?\}',
            r'''function renderToEscalationButton(id,isQueued,srQueued){
  return `<button class="btn-xs ${isQueued?'to-queued':'to-action'}" onclick="openToEscalationModal('${id}')" title="${isQueued?'Already queued for In House FRN Replacement':'Queue to In House FRN Replacement'}" ${srQueued?'disabled':''}>TO</button>`;
}''',
            content,
            flags=re.DOTALL
        )

        content = re.sub(
            r'renderToEscalationButton\(rid,isToQueued\)',
            r'renderToEscalationButton(rid,isToQueued, !!d.srEscalationQueuedAt)',
            content
        )
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'Patched {filepath}')
    except Exception as e:
        print(f'Failed to patch {filepath}: {e}')

patch_file('empestpend.html')
patch_file('emppendingfrn.html')
patch_file('empunderep.html')
