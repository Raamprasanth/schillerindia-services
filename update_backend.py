import re

path = 'backend/services/performanceReviewService.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Original getRealTrackerMetrics block
orig_block = """  if (empCount > 0) {
    const submissions = await TrackerSubmission.aggregate([
      { $match: matchQuery },
      { $group: { _id: "$type", count: { $sum: 1 } } }
    ]);
    for (const sub of submissions) {
      if (actuals[sub._id] !== undefined) {
        actuals[sub._id] = sub.count;
      }
    }
  }

  const result = {};
  for (const def of reportDefs) {
    const expected = def.expectedPerEmployee * empCount;
    const actual = actuals[def.type];
    const pct = expected > 0 ? percent((actual / expected) * 100) : percent(0);
    result[def.type] = pct;
  }
  
  return result;"""

# New block that also fetches dates
new_block = """  const submissionsObj = {};
  if (empCount > 0) {
    const submissions = await TrackerSubmission.aggregate([
      { $match: matchQuery },
      { $group: { _id: { type: "$type", date: "$reportDate" }, count: { $sum: 1 } } }
    ]);
    
    // actuals just count total unique type+date per employee?? No, TrackerSubmission is per employee.
    // the previous aggregate grouped by just type. We can group by type and push dates!
    const allSubs = await TrackerSubmission.find(matchQuery).lean();
    for (const sub of allSubs) {
      if (actuals[sub.type] !== undefined) {
        actuals[sub.type]++;
      }
      if (!submissionsObj[sub.type]) submissionsObj[sub.type] = [];
      submissionsObj[sub.type].push({ date: sub.reportDate, emp: sub.employee.toString() });
    }
  }

  const result = { submissionsObj };
  for (const def of reportDefs) {
    const expected = def.expectedPerEmployee * empCount;
    const actual = actuals[def.type];
    const pct = expected > 0 ? percent((actual / expected) * 100) : percent(0);
    result[def.type] = pct;
  }
  
  return result;"""

content = content.replace(orig_block, new_block)

# Second block to attach to compliance
orig_compliance = """  // Override fake compliance with real tracker percentages
  compliance.weeklyCrm = realTrackers.CRM;
  compliance.pendingActivity = realTrackers.PendingActivity;
  compliance.nonSaleable = realTrackers.NonSaleable;
  compliance.supplierWarranty = realTrackers.SupplierWarranty;
  compliance.criticalPending = realTrackers.CriticalPendingReport;
  compliance.purchaseIndent = realTrackers.PIRequest;"""

new_compliance = """  // Override fake compliance with real tracker percentages
  compliance.weeklyCrm = realTrackers.CRM;
  compliance.pendingActivity = realTrackers.PendingActivity;
  compliance.nonSaleable = realTrackers.NonSaleable;
  compliance.supplierWarranty = realTrackers.SupplierWarranty;
  compliance.criticalPending = realTrackers.CriticalPendingReport;
  compliance.purchaseIndent = realTrackers.PIRequest;
  compliance.trackerSubmissions = realTrackers.submissionsObj;"""

content = content.replace(orig_compliance, new_compliance)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Backend performanceReviewService updated.")
