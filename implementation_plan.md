# Product Team Analysis Implementation Plan

This plan outlines the addition of the "Product Team Analysis" section to the Performance Analysis dashboard.

## User Review Required

Please review the proposed layout and metric logic below and confirm if it matches your expectations.

## Proposed Changes

### 1. Frontend (`Reports.html`)
- **New Sub-tab**: Add a "Product Team" button next to "Repair Team".
- **Product Team Report Pane**: Create a new UI section containing:
  - **Table 1: Employee Performance**: Lists Product Team members.
    - Columns: Employee Name, PT Call (Total/Completed/%), PT Daily Work (Total/Completed/%), Overall Completion Rate, Remark.
  - **Table 2: BIR List Tracker**: 
    - Columns: Division, Total BIRs Created, BIRs Moved to PTCBIR (< 7 days), % Completion, Remark. 
    - *(See Open Questions below regarding how you want this grouped).*
- **PDF Export**: Add a button to export this specific view to an 8K high-quality PDF.

### 2. Backend (`backend/services/performanceReviewService.js` & `backend/routes/reports.js`)
- **New Route**: `/api/reports/performance/productteam`
- **Data Fetching Logic (`getProductTeamPerformanceData`)**:
  - **Product Team Members**: Fetch users with `role: 'pt'` (or employees associated with the PT team).
  - **PT Call**: Fetch from `PtCall` collection. 
    - Total = Calls entered in the month.
    - Completed = Calls closed/completed in the month.
  - **PT Daily Work**: Fetch from `PtDailyWork` collection.
    - Total = Working days in the month (excluding Sundays).
    - Completed = Number of unique dates the employee logged daily work.
  - **BIR List**:
    - Fetch all `Bir` records (from FBIR page) created in the selected month.
    - Fetch corresponding `PtClosedBir` records.
    - Match using `birRef` or `model`/`serial`.
    - If `PtClosedBir.createdAt` - `Bir.createdAt` <= 7 days, mark as "Within Target".

## Open Questions

> [!WARNING]
> Please clarify the following before I begin execution:

1. **Table 1 (PT Call & PT Daily Work)**: Should this table have Product Team Employees as the rows, and the metrics as columns?
2. **Table 2 (BIR List)**: Should the BIR List table be grouped by **Division** (like Blood Gas, Monitors, etc.) or by **Employee**? 
3. **BIR Formula Matching**: When calculating the time between FBIR and PTCBIR, we will match them by `birRef`. Is that correct?
4. **PT Call Completion**: What statuses in the PT Call page count as "Completed"? (e.g. 'Closed', 'Completed'?)
5. **Product Team Members**: How do we identify Product Team members in the database? Are they Users with `role = 'pt'`?

## Verification Plan
- Verify that the Product Team tab loads successfully.
- Validate that the PT Call and PT Daily Work calculations match the records in their respective pages.
- Verify the BIR list calculation correctly checks the 7-day threshold.
- Test the 8K PDF export for correct layout and resolution.
