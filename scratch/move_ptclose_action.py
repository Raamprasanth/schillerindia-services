import os

filepath = r'frontend\public\ptclose.html'

if not os.path.exists(filepath):
    print("File not found")
else:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    old_header = """          <thead><tr>
            <th style="width:42px;" class="no-sort">#</th>
            <th onclick="sortBy('division')">Division <span class="si">-</span></th>
            <th onclick="sortBy('entryDate')">Entry Date <span class="si">-</span></th>
            <th onclick="sortBy('callDate')">Call Date <span class="si">-</span></th>
            <th onclick="sortBy('closeDate')" class="sorted">Close Date <span class="si">-</span></th>
            <th onclick="sortBy('scEngg')">SC Engg <span class="si">-</span></th>
            <th onclick="sortBy('engineer')">Engineer <span class="si">-</span></th>
            <th onclick="sortBy('customer')">Customer <span class="si">-</span></th>
            <th onclick="sortBy('model')">Model <span class="si">-</span></th>
            <th onclick="sortBy('typeCall')">Type of Call <span class="si">-</span></th>
            <th onclick="sortBy('status')">Status <span class="si">-</span></th>
            <th>Remarks</th>
            <th class="no-sort">Action</th>
          </tr></thead>"""
          
    new_header = """          <thead><tr>
            <th class="no-sort">Action</th>
            <th style="width:42px;" class="no-sort">#</th>
            <th onclick="sortBy('division')">Division <span class="si">-</span></th>
            <th onclick="sortBy('entryDate')">Entry Date <span class="si">-</span></th>
            <th onclick="sortBy('callDate')">Call Date <span class="si">-</span></th>
            <th onclick="sortBy('closeDate')" class="sorted">Close Date <span class="si">-</span></th>
            <th onclick="sortBy('scEngg')">SC Engg <span class="si">-</span></th>
            <th onclick="sortBy('engineer')">Engineer <span class="si">-</span></th>
            <th onclick="sortBy('customer')">Customer <span class="si">-</span></th>
            <th onclick="sortBy('model')">Model <span class="si">-</span></th>
            <th onclick="sortBy('typeCall')">Type of Call <span class="si">-</span></th>
            <th onclick="sortBy('status')">Status <span class="si">-</span></th>
            <th>Remarks</th>
          </tr></thead>"""

    old_js = """    <tr>
      <td class="mono" style="color:var(--muted);">${i+1}</td>
      <td><span class="badge-div ${divCls(d.division)}">${esc(d.division||'-')}</span></td>
      <td style="font-size:10.5px;color:var(--muted);">${fmtDate(d.entryDate)}</td>
      <td style="font-size:11px;font-weight:600;color:var(--soft);">${fmtDate(d.callDate)}</td>
      <td style="font-size:11.5px;font-weight:700;color:var(--green);">${fmtDate(d.closeDate)}</td>
      <td style="font-weight:600;">${esc(d.scEngg||'-')}</td>
      <td style="max-width:130px;overflow:hidden;text-overflow:ellipsis;">${esc(d.engineer||'-')}</td>
      <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;" title="${esc(d.customer||'')}">${esc(d.customer||'-')}</td>
      <td style="font-weight:600;">${esc(d.model||'-')}</td>
      <td><span class="call-type-pill ${callTypeCls(d.typeCall)}">${esc(d.typeCall||'-')}</span></td>
      <td><span class="status-pill sp-closed">Closed</span></td>
      <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;font-size:11px;color:var(--soft);" title="${esc(d.remarks||'')}">${esc(remark||'-')}</td>
      <td><button class="btn-xs view-btn" onclick="openViewModal('${d._id}')">&#128065;</button></td>
    </tr>"""
    
    new_js = """    <tr>
      <td><button class="btn-xs view-btn" onclick="openViewModal('${d._id}')">&#128065;</button></td>
      <td class="mono" style="color:var(--muted);">${i+1}</td>
      <td><span class="badge-div ${divCls(d.division)}">${esc(d.division||'-')}</span></td>
      <td style="font-size:10.5px;color:var(--muted);">${fmtDate(d.entryDate)}</td>
      <td style="font-size:11px;font-weight:600;color:var(--soft);">${fmtDate(d.callDate)}</td>
      <td style="font-size:11.5px;font-weight:700;color:var(--green);">${fmtDate(d.closeDate)}</td>
      <td style="font-weight:600;">${esc(d.scEngg||'-')}</td>
      <td style="max-width:130px;overflow:hidden;text-overflow:ellipsis;">${esc(d.engineer||'-')}</td>
      <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;" title="${esc(d.customer||'')}">${esc(d.customer||'-')}</td>
      <td style="font-weight:600;">${esc(d.model||'-')}</td>
      <td><span class="call-type-pill ${callTypeCls(d.typeCall)}">${esc(d.typeCall||'-')}</span></td>
      <td><span class="status-pill sp-closed">Closed</span></td>
      <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;font-size:11px;color:var(--soft);" title="${esc(d.remarks||'')}">${esc(remark||'-')}</td>
    </tr>"""

    content = content.replace(old_header, new_header)
    content = content.replace(old_js, new_js)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Updated ptclose.html")
