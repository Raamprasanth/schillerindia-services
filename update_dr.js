const fs = require('fs');
let htmlFile = 'frontend/public/dr.html';
let html = fs.readFileSync(htmlFile, 'utf8');

// 1. Add Search input
const searchInputStr = `<button class="btn btn-outline btn-sm" onclick="clearFilters()" style="margin-left:auto;">&#10005; Clear</button>`;
const searchInputReplace = `<div class="f-divider"></div>
        <input type="text" class="f-inp" id="fl-search" placeholder="Search..." onkeyup="applyFilters()" style="width: 200px; margin-left:auto;">
        <button class="btn btn-outline btn-sm" onclick="clearFilters()">&#10005; Clear</button>`;

html = html.replace(searchInputStr, searchInputReplace);

// 2. Update applyFilters
const filterLogicStr = `  function applyFilters() {
    const from = document.getElementById('fl-from')?.value || '';
    const to = document.getElementById('fl-to')?.value || '';
    const division = document.getElementById('fl-division')?.value || '';
    
    filtered = records.filter(d => {
      const entryDateStr = d.entryDate ? new Date(d.entryDate).toISOString().split('T')[0] : '';
      if (from && entryDateStr < from) return false;
      if (to && entryDateStr > to) return false;
      if (division && (d.division || '').toLowerCase() !== division.toLowerCase()) return false;
      return true;
    });`;

const filterLogicReplace = `  function applyFilters() {
    const from = document.getElementById('fl-from')?.value || '';
    const to = document.getElementById('fl-to')?.value || '';
    const division = document.getElementById('fl-division')?.value || '';
    const search = document.getElementById('fl-search')?.value.toLowerCase() || '';
    
    filtered = records.filter(d => {
      const entryDateStr = d.entryDate ? new Date(d.entryDate).toISOString().split('T')[0] : '';
      if (from && entryDateStr < from) return false;
      if (to && entryDateStr > to) return false;
      if (division && (d.division || '').toLowerCase() !== division.toLowerCase()) return false;
      
      if (search) {
        const searchableText = [
          d.frnNo,
          d.partNo,
          d.model,
          d.description,
          d.defGirNo,
          d.unitStatus,
          d.division
        ].join(' ').toLowerCase();
        
        if (!searchableText.includes(search)) return false;
      }
      
      return true;
    });`;

html = html.replace(filterLogicStr, filterLogicReplace);

// 3. Update clearFilters to clear the search box
const clearFiltersStr = `  function clearFilters() {
    document.getElementById('fl-from').value = '';
    document.getElementById('fl-to').value = '';
    document.getElementById('fl-division').value = '';
    applyFilters();
  }`;

const clearFiltersReplace = `  function clearFilters() {
    document.getElementById('fl-from').value = '';
    document.getElementById('fl-to').value = '';
    document.getElementById('fl-division').value = '';
    if (document.getElementById('fl-search')) {
      document.getElementById('fl-search').value = '';
    }
    applyFilters();
  }`;

html = html.replace(clearFiltersStr, clearFiltersReplace);

fs.writeFileSync(htmlFile, html);
console.log('dr.html updated');
