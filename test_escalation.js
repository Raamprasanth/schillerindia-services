require('dotenv').config();
const path = require('path');
const { runEscalationMailer } = require('./backend/utils/escalationMailer');

async function test() {
  const payload = {
    subject: 'Test Escalation from Node.js',
    body: 'This is a test to verify the new Node.js pure escalation works without Python.',
    format: 'xlsx',
    sheets: [
      {
        name: 'Test Sheet',
        headers: ['ID', 'Name', 'Status'],
        rows: [
          { ID: '1', Name: 'Alice', Status: 'Pending' },
          { ID: '2', Name: 'Bob', Status: 'Completed' }
        ]
      }
    ]
  };

  const outputPath = path.join(__dirname, 'test_output.xlsx');
  
  console.log('Running test mailer...');
  try {
    await runEscalationMailer(payload, outputPath);
    console.log('Success!');
  } catch (err) {
    console.error('Failed:', err.message);
  }
}

test();
