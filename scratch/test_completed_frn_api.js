const http = require('http');

async function testCompletedFrnApi() {
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
        if (token) fetchCompletedFRNs(token);
        else console.error('Login failed:', json);
      } catch(e) {
        console.error(e);
      }
    });
  });
  req.write(loginPayload);
  req.end();
}

function fetchCompletedFRNs(token) {
  const req = http.request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/emp/completed-frn',
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
        console.log(`\n✅ GET /api/emp/completed-frn returned ${Array.isArray(list) ? list.length : 0} records!`);
        if (Array.isArray(list)) {
          list.forEach((item, i) => {
            console.log(`[${i+1}] SC RNo: ${item.scRno} | Engineer: "${item.eng}" | Part No: "${item.partNo}" | Customer: "${item.customer}"`);
          });
        }
      } catch(e) {
        console.error(e);
      }
    });
  });
  req.end();
}

testCompletedFrnApi();
