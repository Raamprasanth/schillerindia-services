const fs = require('fs');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const html = fs.readFileSync('frontend/public/Reports.html', 'utf8');

const dom = new JSDOM(`<!DOCTYPE html><div id='perf-div-result'></div><input id='perf-month-div' value='2026-04'>`, { runScripts: 'dangerously' });
global.window = dom.window;
global.document = dom.window.document;
global.localStorage = { getItem: () => null };
global.sessionStorage = { getItem: () => 'token' };

let combinedCode = '';
const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];
scripts.forEach((s, i) => {
  if (s[1].trim()) combinedCode += s[1] + '\n';
});

combinedCode = combinedCode.replace('loadStats();', '');
combinedCode = combinedCode.replace('loadDivisions();', '');
combinedCode = combinedCode.replace('loadPerfOptions().catch(() => {});', '');
combinedCode = combinedCode.replace("if (currentTab === 'kanban') loadKanbanBoard();", '');

try {
  dom.window.eval(combinedCode);
  
  const mockData = {
    month: '2026-04',
    workingDays: 20,
    compliance: {
      trackerSubmissions: {
        BuyBack: [ { date: '2026-04-15', emp: 'Test' } ]
      }
    },
    employees: [],
    divisions: []
  };

  const res = dom.window.generatePerfAnalysisHtml(mockData, { month: '2026-04' }, 'division');
  console.log('Success! Result length:', res.length);
} catch (e) {
  console.error('Runtime error:', e);
}
