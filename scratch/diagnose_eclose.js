const fetch = require('node-fetch');

// This script simulates what happens when updating a call to Closed
(async () => {
  // First, we need an admin login to get a token
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ empId: 'admin', password: 'admin' }) // assuming default
  });
  
  if (!loginRes.ok) {
    console.log("Login failed");
    return;
  }
  const loginData = await loginRes.json();
  const token = loginData.token || loginData.data?.token;

  // Create a dummy Ecall
  const callPayload = {
    callDate: "2026-05-27",
    division: "SAG",
    engineer: "Test Eng",
    model: "Test Model",
    callType: "Technical",
    status: "Pending",
    remarks: "Testing eclose issue"
  };

  const createRes = await fetch('http://localhost:5000/api/calls', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify(callPayload)
  });

  if (!createRes.ok) {
    console.log("Create call failed:", await createRes.text());
    return;
  }

  const newCall = await createRes.json();
  console.log("Created Call:", newCall._id);

  // Update status to Closed
  const updatePayload = {
    ...newCall,
    status: "Closed"
  };

  const updateRes = await fetch(`http://localhost:5000/api/calls/${newCall._id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify(updatePayload)
  });

  if (!updateRes.ok) {
    console.log("Update to Closed failed with status:", updateRes.status);
    console.log("Error body:", await updateRes.text());
  } else {
    const updatedData = await updateRes.json();
    console.log("Update successful. Closed property:", updatedData.closed);
  }

})();
