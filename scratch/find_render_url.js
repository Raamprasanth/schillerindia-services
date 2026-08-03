const fs = require('fs');
const transcriptPath = 'C:\\Users\\raamp\\.gemini\\antigravity\\brain\\f40c52b6-4e1e-4696-8692-4250f3a20e2c\\.system_generated\\logs\\transcript.jsonl';

const lines = fs.readFileSync(transcriptPath, 'utf-8').split('\n');
lines.forEach((line, idx) => {
  if (line.includes('onrender')) {
    console.log(`Line ${idx}:`, line.substring(0, 300));
  }
});
