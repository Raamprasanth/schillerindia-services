const http = require('http');

async function testApiScrap() {
  const loginPayload = JSON.stringify({ identifier: 'admin@schillerindia.com', password: 'admin123' });
  
  const req = http.request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/admin/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(loginPayload)
    }
  }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        const token = json.data?.token || json.token;
        console.log('Login Response:', token ? 'SUCCESS (Token received)' : json);
        if (token) {
          fetchScrap(token);
        }
      } catch(e) {
        console.error('JSON Error:', e.message, data);
      }
    });
  });

  req.on('error', err => console.error('Req error:', err.message));
  req.write(loginPayload);
  req.end();
}

function fetchScrap(token) {
  const req = http.request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/scrap',
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    }
  }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const list = JSON.parse(data);
        console.log(`\n✅ GET /api/scrap returned ${Array.isArray(list) ? list.length : 'error'} records!`);
        if (Array.isArray(list) && list.length > 0) {
          console.log('Record 1 Customer:', list[0].customer, '| Model:', list[0].model, '| FRN:', list[0].frnNo);
          console.log('Record 2 Customer:', list[1]?.customer, '| Model:', list[1]?.model, '| FRN:', list[1]?.frnNo);
        }
      } catch(e) {
        console.error('Scrap Parse Error:', e.message);
      }
    });
  });
  req.end();
}

testApiScrap();
