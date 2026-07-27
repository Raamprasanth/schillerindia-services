const fs = require('fs');
const FILE_PATH = 'frontend/public/Reports.html';

let content = fs.readFileSync(FILE_PATH, 'utf8');

// We need to do the following replacements globally:
// 1. type="month" -> type="date"
// 2. From Month -> From Date
// 3. To Month -> To Date
// 4. <div style="display:flex; gap:10px; margin-bottom:15px;"> -> <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:15px;"> (for the From/To container)
// 5. Add box-sizing:border-box; to the inputs.

content = content.replace(/<div style="display:flex; gap:10px; margin-bottom:15px;">/g, '<div style="display:flex; flex-direction:column; gap:10px; margin-bottom:15px;">');
content = content.replace(/From Month/g, 'From Date');
content = content.replace(/To Month/g, 'To Date');

// We can replace type="month" with type="date" and add box-sizing
content = content.replace(/<input type="month" id="perf-range-from-([a-z]+)" style="([^"]*)"/g, '<input type="date" id="perf-range-from-$1" style="box-sizing:border-box; $2"');
content = content.replace(/<input type="month" id="perf-range-to-([a-z]+)" style="([^"]*)"/g, '<input type="date" id="perf-range-to-$1" style="box-sizing:border-box; $2"');

// And replace type="month" with type="date" in the class="field-input" version
content = content.replace(/<input type="month" id="perf-range-from-([a-z]+)" class="field-input" \/>/g, '<input type="date" id="perf-range-from-$1" class="field-input" style="box-sizing:border-box;" />');
content = content.replace(/<input type="month" id="perf-range-to-([a-z]+)" class="field-input" \/>/g, '<input type="date" id="perf-range-to-$1" class="field-input" style="box-sizing:border-box;" />');

// Let's also update the toast message in getPeriodValue
content = content.replace(/Please select both From and To months/g, 'Please select both From and To dates');

fs.writeFileSync(FILE_PATH, content);
console.log('Fixed UI layout and changed to date pickers.');
