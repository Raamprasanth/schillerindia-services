const fs = require('fs');
const file = 'frontend/public/employee-dashboard.html';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/<script>[\s\S]*<\/script>/, `<script>
  // ── AUTH GUARD: redirect to login if not employee ──
  (async function() {
    const token = localStorage.getItem('schiller_token');
    const role  = localStorage.getItem('schiller_role');
    const localUser = JSON.parse(localStorage.getItem('schiller_user') || '{}');

    const normalizedRole = (role || '').toLowerCase();
    if (!token || normalizedRole !== 'employee') {
      window.location.href = 'login.html';
      return;
    }

    let user = localUser;
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: 'Bearer ' + token }
      });
      if (res.status === 401) {
        window.location.href = 'login.html';
        return;
      }
      const payload = await res.json().catch(() => ({}));
      if (res.ok && payload && payload.data) {
        user = payload.data;
        localStorage.setItem('schiller_user', JSON.stringify(user));
      }
    } catch (err) {
      console.warn('Dashboard user fetch failed:', err);
    }

    // Show dashboard
    document.getElementById('auth-guard').style.display   = 'none';
    document.getElementById('sidebar').style.display      = 'flex';
    document.getElementById('main-content').style.display = 'flex';

    // Fill user info
    const name  = user.name        || 'Employee';
    const desig = user.designation || 'Field Engineer';
    const division = user.division || 'General';
    const initl = name.charAt(0).toUpperCase();

    document.getElementById('emp-name').textContent       = name;
    document.getElementById('emp-avatar').textContent     = initl;
    document.getElementById('emp-desig').textContent      = desig;
    document.getElementById('profile-name').textContent   = name;
    document.getElementById('profile-avatar').textContent = initl;
    document.getElementById('profile-dept').textContent   = \`\${desig} · \${division} Division\`;
    document.getElementById('emp-date').textContent       = new Date().toLocaleDateString('en-IN',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
  })();

  function logout() {
    localStorage.removeItem('schiller_token');
    localStorage.removeItem('schiller_user');
    localStorage.removeItem('schiller_role');
    window.location.href = 'login.html';
  }
</script>`);

fs.writeFileSync(file, content);
console.log('Restored correctly');
