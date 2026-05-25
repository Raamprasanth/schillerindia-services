import os
path = r'c:\Users\Raamprasanth\OneDrive\Desktop\shcl\frontend\public\Rtcrl.html'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

target1 = """        <div class="detail-sec">
          <div class="detail-sec-title">&#128295; Repair Details</div>
          <div class="dg-4">
            <div class="df"><label>Repaired By</label><div class="dval hl" id="d-repairedby">-</div></div>
            <div class="df"><label>DC No</label><div class="dval" id="d-dcno">-</div></div>
            <div class="df"><label>Repaired BRD Stk Date</label><div class="dval" id="d-repbrddate">-</div></div>
            <div class="df"><label>Return Date to Field</label><div class="dval" id="d-returndate">-</div></div>
            <div class="df" style="grid-column:span 4"><label>Component Used to Repair</label><div class="dval" id="d-compused">-</div></div>
          </div>
        </div>
        <div class="detail-sec">
          <div class="detail-sec-title">&#128172; Remarks &amp; Findings</div>
          <div class="dg-3">
            <div class="df"><label>Tech Remarks</label><div class="dval long" id="d-techremarks">-</div></div>
            <div class="df"><label>Final Remarks</label><div class="dval long" id="d-finalremarks">-</div></div>
            <div class="df"><label>Additional Notes</label><div class="dval long" id="d-addnotes">-</div></div>
          </div>
        </div>
        <div class="detail-sec">
          <div class="detail-sec-title">&#128666; Dispatch &amp; Return</div>
          <div class="dg-4">
            <div class="df"><label>Return DC No</label><div class="dval" id="d-returndcno">-</div></div>
            <div class="df"><label>Destination</label><div class="dval" id="d-destination">-</div></div>
            <div class="df"><label>Submitted By</label><div class="dval" id="d-submittedby">-</div></div>
            <div class="df"><label>Submitted At</label><div class="dval" id="d-submittedat">-</div></div>
          </div>
        </div>"""

replace1 = """        <div class="detail-sec">
          <div class="detail-sec-title">&#128172; Remarks &amp; Findings</div>
          <div class="dg-3">
            <div class="df"><label>Technical Remarks</label><div class="dval long" id="d-techremarks">-</div></div>
            <div class="df"><label>Repair Team Remarks</label><div class="dval long" id="d-repairremarks">-</div></div>
            <div class="df"><label>Components Used to Repaired</label><div class="dval long" id="d-compused">-</div></div>
            <div class="df"><label>Cost in INR</label><div class="dval" id="d-cost">-</div></div>
            <div class="df"><label>Time Taken to Repair</label><div class="dval" id="d-timetaken">-</div></div>
            <div class="df"><label>Repair Status</label><div class="dval" id="d-repairstatus">-</div></div>
          </div>
        </div>
        <div class="detail-sec">
          <div class="detail-sec-title">&#128196; Details</div>
          <div class="dg-4">
            <div class="df"><label>DOI (Date of Installation)</label><div class="dval" id="d-doi">-</div></div>
            <div class="df"><label>Repaired By</label><div class="dval hl" id="d-repairedby">-</div></div>
            <div class="df"><label>Repaired Date</label><div class="dval" id="d-repaireddate">-</div></div>
            <div class="df"><label>Status</label><div class="dval" id="d-status">-</div></div>
          </div>
        </div>"""

target2 = """  set('d-repairedby',  d.repairedBy);
  set('d-dcno',        d.dcNo);
  set('d-repbrddate',  d.repBrdDate  ? fmtDate(d.repBrdDate)  : '');
  set('d-returndate',  d.returnDate  ? fmtDate(d.returnDate)  : '');
  set('d-compused',    d.compUsedToRepair);
  set('d-techremarks', d.techRemarks);
  set('d-finalremarks',d.finalRemarks);
  set('d-addnotes',    d.addNotes);
  set('d-returndcno',  d.returnDcNo);
  set('d-destination', d.destination);
  set('d-submittedby', d.submittedBy);
  set('d-submittedat', d.submittedAt ? fmtDate(d.submittedAt) : '');"""

replace2 = """  set('d-techremarks',   d.techRemarks);
  set('d-repairremarks', d.repairRemarks);
  set('d-compused',      d.components || d.compUsedToRepair);
  set('d-cost',          d.cost);
  set('d-timetaken',     d.timeTaken);
  set('d-repairstatus',  d.repairStatus);
  
  set('d-doi',           d.doi);
  set('d-repairedby',    d.repairedBy);
  set('d-repaireddate',  d.repairedDate ? fmtDate(d.repairedDate) : '');
  set('d-status',        d.status);"""

if target1 in content:
    content = content.replace(target1, replace1)
    print('Replaced HTML target')
else:
    print('HTML target not found. Checking if it is due to line endings...')
    content = content.replace(target1.replace(chr(10), chr(13)+chr(10)), replace1)

if target2 in content:
    content = content.replace(target2, replace2)
    print('Replaced JS target')
else:
    print('JS target not found.')
    content = content.replace(target2.replace(chr(10), chr(13)+chr(10)), replace2)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
