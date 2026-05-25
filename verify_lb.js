const fs = require('fs');
const dir = 'frontend/public';
const files = ['Repair-dashboard.html','Rtfrn.html','Rtob.html','Rtur.html','Rtcrl.html','Rtoa.html','Rtcoa.html','Rtcomr.html','Rtccr.html'];
files.forEach(f => {
  const c = fs.readFileSync(dir + '/' + f, 'utf8');
  const hasEl  = c.includes('id="loading-bar"');
  const hasCSS = c.includes('.loading-bar{');
  const hasJS  = c.includes('setLoading(');
  const clean  = !hasEl && !hasCSS && !hasJS;
  console.log(f + ': el=' + hasEl + ' css=' + hasCSS + ' js=' + hasJS + (clean ? ' [CLEAN]' : ' [ISSUES]'));
});
