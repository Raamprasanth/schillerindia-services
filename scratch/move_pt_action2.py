import os

def process_file(filepath, header_replace, js_replace):
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        return

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content
    
    for old_str, new_str in header_replace:
        content = content.replace(old_str, new_str)
        
    for old_str, new_str in js_replace:
        content = content.replace(old_str, new_str)
        
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")
    else:
        print(f"No changes made to {filepath}")

# ptbir.html
ptbir_header_old = """            <tr>
              <th class="sortable" data-col="birRef">BIR Ref No.<span class="sort-icon"></span></th>
              <th class="sortable" data-col="unitInwardDate">Inward Date<span class="sort-icon"></span></th>
              <th class="sortable" data-col="division">Division<span class="sort-icon"></span></th>
              <th class="sortable" data-col="model">Model<span class="sort-icon"></span></th>
              <th>Configuration</th>
              <th class="sortable" data-col="receivedQty">Qty<span class="sort-icon"></span></th>
              <th>Prev SW</th>
              <th>HW Changes</th>
              <th>Accessory Details</th>
              <th>CNR/Technews</th>
              <th class="sortable" data-col="status">Status<span class="sort-icon"></span></th>
              <th>Actions</th>
            </tr>"""
ptbir_header_new = """            <tr>
              <th>Actions</th>
              <th class="sortable" data-col="birRef">BIR Ref No.<span class="sort-icon"></span></th>
              <th class="sortable" data-col="unitInwardDate">Inward Date<span class="sort-icon"></span></th>
              <th class="sortable" data-col="division">Division<span class="sort-icon"></span></th>
              <th class="sortable" data-col="model">Model<span class="sort-icon"></span></th>
              <th>Configuration</th>
              <th class="sortable" data-col="receivedQty">Qty<span class="sort-icon"></span></th>
              <th>Prev SW</th>
              <th>HW Changes</th>
              <th>Accessory Details</th>
              <th>CNR/Technews</th>
              <th class="sortable" data-col="status">Status<span class="sort-icon"></span></th>
            </tr>"""

ptbir_js_old = """    <tr>
      <td><span class="chip-sm">${esc(e.birRef||e._id)}</span></td>
      <td style="color:var(--muted);font-size:12px;">${fmtDate(e.unitInwardDate)}</td>
      <td><span class="badge-pill ${divClass(e.division)}">${esc(e.division)}</span></td>
      <td style="font-weight:600;">${esc(e.model)}</td>
      <td style="font-size:12px;color:var(--soft);max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${esc(e.configuration)}">${esc(e.configuration||'-')}</td>
      <td style="font-family:'JetBrains Mono',monospace;font-weight:600;">${esc(e.receivedQty||'-')}</td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--soft);">${esc(e.prevSwVersion||'-')}</td>
      <td>${e.hwChanges&&!['na','no','none','no change',''].includes(String(e.hwChanges).trim().toLowerCase())?`<span style="color:var(--amber);font-size:11px;font-weight:600;">${esc(e.hwChanges)}</span>`:`<span style="color:var(--muted);font-size:11px;">${esc(e.hwChanges||'NA')}</span>`}</td>
      <td style="font-size:12px;color:var(--soft);max-width:150px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${esc(e.accDetails)}">${esc(e.accDetails||'-')}</td>
      <td style="font-size:12px;">${String(e.cnrCirculation).trim().toLowerCase()==='yes'?`<span style="color:var(--purple);font-weight:600;">Yes</span>`:`<span style="color:var(--muted);">${esc(e.cnrCirculation||'-')}</span>`}</td>
      <td><span class="status-badge ${stClass(e.status)}">${esc(e.status)}</span></td>
      <td style="white-space:nowrap;">
        <button class="btn-xs" onclick="viewBIR('${e._id}')" title="View">&#128065;</button>
        <button class="btn-xs success" onclick="editBIR('${e._id}')" title="Update">&#9999;&#65039;</button>
      </td>
    </tr>"""

ptbir_js_new = """    <tr>
      <td style="white-space:nowrap;">
        <button class="btn-xs" onclick="viewBIR('${e._id}')" title="View">&#128065;</button>
        <button class="btn-xs success" onclick="editBIR('${e._id}')" title="Update">&#9999;&#65039;</button>
      </td>
      <td><span class="chip-sm">${esc(e.birRef||e._id)}</span></td>
      <td style="color:var(--muted);font-size:12px;">${fmtDate(e.unitInwardDate)}</td>
      <td><span class="badge-pill ${divClass(e.division)}">${esc(e.division)}</span></td>
      <td style="font-weight:600;">${esc(e.model)}</td>
      <td style="font-size:12px;color:var(--soft);max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${esc(e.configuration)}">${esc(e.configuration||'-')}</td>
      <td style="font-family:'JetBrains Mono',monospace;font-weight:600;">${esc(e.receivedQty||'-')}</td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--soft);">${esc(e.prevSwVersion||'-')}</td>
      <td>${e.hwChanges&&!['na','no','none','no change',''].includes(String(e.hwChanges).trim().toLowerCase())?`<span style="color:var(--amber);font-size:11px;font-weight:600;">${esc(e.hwChanges)}</span>`:`<span style="color:var(--muted);font-size:11px;">${esc(e.hwChanges||'NA')}</span>`}</td>
      <td style="font-size:12px;color:var(--soft);max-width:150px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${esc(e.accDetails)}">${esc(e.accDetails||'-')}</td>
      <td style="font-size:12px;">${String(e.cnrCirculation).trim().toLowerCase()==='yes'?`<span style="color:var(--purple);font-weight:600;">Yes</span>`:`<span style="color:var(--muted);">${esc(e.cnrCirculation||'-')}</span>`}</td>
      <td><span class="status-badge ${stClass(e.status)}">${esc(e.status)}</span></td>
    </tr>"""

process_file(r'frontend\public\ptbir.html', [(ptbir_header_old, ptbir_header_new)], [(ptbir_js_old, ptbir_js_new)])


# ptcbir.html
ptcbir_header_old = """            <tr>
              <th data-col="birRef">BIR Ref No.<span class="si"></span></th>
              <th data-col="unitInwardDate">Inward Date<span class="si"></span></th>
              <th data-col="division">Division<span class="si"></span></th>
              <th data-col="model">Model<span class="si"></span></th>
              <th>Configuration</th>
              <th data-col="receivedQty">Qty<span class="si"></span></th>
              <th>Prev SW Version</th>
              <th>HW Changes</th>
              <th>Accessory Details</th>
              <th>CNR/Technews</th>
              <th>Status</th>
              <th>Action</th>
            </tr>"""
ptcbir_header_new = """            <tr>
              <th>Action</th>
              <th data-col="birRef">BIR Ref No.<span class="si"></span></th>
              <th data-col="unitInwardDate">Inward Date<span class="si"></span></th>
              <th data-col="division">Division<span class="si"></span></th>
              <th data-col="model">Model<span class="si"></span></th>
              <th>Configuration</th>
              <th data-col="receivedQty">Qty<span class="si"></span></th>
              <th>Prev SW Version</th>
              <th>HW Changes</th>
              <th>Accessory Details</th>
              <th>CNR/Technews</th>
              <th>Status</th>
            </tr>"""

ptcbir_js_old = """    <tr>
      <td><span class="chip-sm">${esc(e.birRef||e._id)}</span></td>
      <td style="color:var(--muted);font-size:12px;white-space:nowrap;">${fmtDate(e.unitInwardDate)}</td>
      <td><span class="badge-pill ${divPillClass(e.division)}">${esc(e.division)}</span></td>
      <td style="font-weight:600;">${esc(e.model)}</td>
      <td style="font-size:12px;color:var(--soft);max-width:140px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${esc(e.configuration)}">${esc(e.configuration||'-')}</td>
      <td style="font-family:'JetBrains Mono',monospace;font-weight:600;">${esc(e.receivedQty||'-')}</td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--soft);">${esc(e.prevSwVersion||'-')}</td>
      <td>${e.hwChanges&&!['na','no','none','no change',''].includes(String(e.hwChanges).trim().toLowerCase())?`<span style="color:var(--amber);font-size:11px;font-weight:600;">${esc(e.hwChanges)}</span>`:`<span style="color:var(--muted);font-size:11px;">${esc(e.hwChanges||'NA')}</span>`}</td>
      <td style="font-size:12px;color:var(--soft);max-width:140px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${esc(e.accDetails)}">${esc(e.accDetails||'-')}</td>
      <td style="font-size:12px;">${String(e.cnrCirculation).trim().toLowerCase()==='yes'?`<span style="color:var(--purple);font-weight:600;">Yes</span>`:`<span style="color:var(--muted);">${esc(e.cnrCirculation||'-')}</span>`}</td>
      <td><span class="st-approved">Approved</span></td>
      <td><button class="btn-xs" onclick="viewRecord('${e._id}')" title="View">View</button></td>
    </tr>"""
ptcbir_js_new = """    <tr>
      <td><button class="btn-xs" onclick="viewRecord('${e._id}')" title="View">View</button></td>
      <td><span class="chip-sm">${esc(e.birRef||e._id)}</span></td>
      <td style="color:var(--muted);font-size:12px;white-space:nowrap;">${fmtDate(e.unitInwardDate)}</td>
      <td><span class="badge-pill ${divPillClass(e.division)}">${esc(e.division)}</span></td>
      <td style="font-weight:600;">${esc(e.model)}</td>
      <td style="font-size:12px;color:var(--soft);max-width:140px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${esc(e.configuration)}">${esc(e.configuration||'-')}</td>
      <td style="font-family:'JetBrains Mono',monospace;font-weight:600;">${esc(e.receivedQty||'-')}</td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--soft);">${esc(e.prevSwVersion||'-')}</td>
      <td>${e.hwChanges&&!['na','no','none','no change',''].includes(String(e.hwChanges).trim().toLowerCase())?`<span style="color:var(--amber);font-size:11px;font-weight:600;">${esc(e.hwChanges)}</span>`:`<span style="color:var(--muted);font-size:11px;">${esc(e.hwChanges||'NA')}</span>`}</td>
      <td style="font-size:12px;color:var(--soft);max-width:140px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${esc(e.accDetails)}">${esc(e.accDetails||'-')}</td>
      <td style="font-size:12px;">${String(e.cnrCirculation).trim().toLowerCase()==='yes'?`<span style="color:var(--purple);font-weight:600;">Yes</span>`:`<span style="color:var(--muted);">${esc(e.cnrCirculation||'-')}</span>`}</td>
      <td><span class="st-approved">Approved</span></td>
    </tr>"""

process_file(r'frontend\public\ptcbir.html', [(ptcbir_header_old, ptcbir_header_new)], [(ptcbir_js_old, ptcbir_js_new)])

