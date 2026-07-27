const fs = require('fs');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const html = fs.readFileSync('frontend/public/Reports.html', 'utf8');

const start = html.indexOf('function generatePerfAnalysisHtml(data, params, scopeType)');
const end = html.indexOf('async function exportPriorityDivisionPDF()');
let funcCode = html.substring(start, end);

const dom = new JSDOM(`<!DOCTYPE html><p>Hello world</p>`);
global.document = dom.window.document;
global.window = dom.window;

global.escapeHtml = (str) => String(str);

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

try {
  eval(funcCode);
  const result = generatePerfAnalysisHtml(mockData, { month: '2026-04' }, 'division');
  if (result.includes('15-04-2026')) {
    console.log('Found 15-04-2026 in HTML!');
    const snippetIndex = result.indexOf('15-04-2026');
    console.log(result.substring(snippetIndex - 100, snippetIndex + 250));
  } else {
    console.log('Did NOT find 15-04-2026 in HTML');
  }
} catch(e) {
  console.log('Error running function:', e);
}
