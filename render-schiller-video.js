const path = require('path');
const fs = require('fs');
const Module = require('module');

process.env.NODE_PATH = [
  path.join(process.env.USERPROFILE || 'C:\\Users\\Admin', '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules'),
  path.join(process.env.USERPROFILE || 'C:\\Users\\Admin', '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules', '.pnpm', 'playwright@1.61.0', 'node_modules'),
  path.join(process.env.USERPROFILE || 'C:\\Users\\Admin', '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules', '.pnpm', 'playwright-core@1.61.0', 'node_modules'),
  process.env.NODE_PATH || ''
].filter(Boolean).join(path.delimiter);
Module._initPaths();

const { chromium } = require('playwright');

const cwd = process.cwd();
const logoPath = path.join(cwd, 'schiller-logo-source.png');
const outputPath = path.join(cwd, 'schiller-flashy-10s.webm');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required']
  });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html>
<html>
<body style="margin:0;background:#050505;overflow:hidden">
<canvas id="c" width="1920" height="1080"></canvas>
<script>
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const logo = new Image();
logo.src = ${JSON.stringify('file:///' + logoPath.replace(/\\/g, '/'))};
const W = canvas.width, H = canvas.height;
const duration = 10;
const fps = 30;
const particles = Array.from({length: 130}, (_, i) => ({
  a: Math.random() * Math.PI * 2,
  r: 90 + Math.random() * 830,
  s: 0.35 + Math.random() * 1.8,
  z: 1 + Math.random() * 2.8,
  hue: [48, 344, 190, 25][i % 4],
}));
function ease(x){ return x < .5 ? 4*x*x*x : 1 - Math.pow(-2*x+2,3)/2; }
function drawStar(x,y,r,rot){
  ctx.save(); ctx.translate(x,y); ctx.rotate(rot); ctx.beginPath();
  for(let i=0;i<10;i++){ const rr = i%2 ? r*.42 : r; const aa = -Math.PI/2 + i*Math.PI/5; ctx.lineTo(Math.cos(aa)*rr, Math.sin(aa)*rr); }
  ctx.closePath(); ctx.fill(); ctx.restore();
}
function frame(ms){
  const t = ms / 1000;
  const p = Math.min(t / duration, 1);
  const flash = Math.max(0, Math.sin(t * Math.PI * 4)) ** 9;
  const sweep = (t * .42) % 1;
  const g = ctx.createLinearGradient(0,0,W,H);
  g.addColorStop(0, '#090909');
  g.addColorStop(.34 + .10*Math.sin(t), '#3a0714');
  g.addColorStop(.65, '#191002');
  g.addColorStop(1, '#060606');
  ctx.fillStyle = g; ctx.fillRect(0,0,W,H);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  particles.forEach((pt, i) => {
    const spin = t * pt.s + i*.15;
    const pulse = .5 + .5*Math.sin(t*3 + i);
    const x = W/2 + Math.cos(pt.a + spin*.25) * (pt.r + Math.sin(t*1.7+i)*28);
    const y = H/2 + Math.sin(pt.a + spin*.18) * (pt.r*.48 + Math.cos(t*1.4+i)*18);
    ctx.fillStyle = 'hsla(' + pt.hue + ',100%,' + (48 + pulse*24) + '%,.42)';
    ctx.beginPath(); ctx.arc(x,y, pt.z + pulse*3, 0, Math.PI*2); ctx.fill();
  });
  ctx.restore();

  for(let i=0;i<5;i++){
    const y = H*(.15 + i*.18) + Math.sin(t*2+i)*22;
    const x = (sweep*W*1.45 - W*.25 + i*140) % (W*1.35) - W*.15;
    const grad = ctx.createLinearGradient(x-280,y,x+280,y);
    grad.addColorStop(0,'rgba(255,255,255,0)');
    grad.addColorStop(.5, i%2 ? 'rgba(255,219,42,.38)' : 'rgba(196,18,55,.40)');
    grad.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x-280, y-5, 560, 10);
  }

  const intro = ease(Math.min(t/1.35,1));
  const outro = p > .88 ? 1 - ease((p-.88)/.12)*.18 : 1;
  const scale = (.72 + intro*.28 + Math.sin(t*4.2)*.018 + flash*.028) * outro;
  const logoW = 1530 * scale;
  const logoH = logoW * (logo.height / logo.width);
  const x = W/2 - logoW/2;
  const y = H/2 - logoH/2;

  ctx.save();
  ctx.translate(W/2, H/2);
  ctx.rotate(Math.sin(t*1.55) * 0.018);
  ctx.translate(-W/2, -H/2);
  ctx.shadowColor = flash > .08 ? '#ffe335' : '#c41237';
  ctx.shadowBlur = 28 + flash*80;
  ctx.drawImage(logo, x, y, logoW, logoH);
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const shineX = x - logoW*.25 + ((t*.72)%1.45) * logoW;
  const shine = ctx.createLinearGradient(shineX-110,y,shineX+130,y+logoH);
  shine.addColorStop(0,'rgba(255,255,255,0)');
  shine.addColorStop(.48,'rgba(255,255,255,.58)');
  shine.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle = shine;
  ctx.fillRect(shineX-160, y-80, 320, logoH+160);
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for(let i=0;i<16;i++){
    const tt = (t*1.3 + i/16) % 1;
    const sx = W/2 + Math.cos(tt*Math.PI*2 + i)*760;
    const sy = H/2 + Math.sin(tt*Math.PI*2 + i*.7)*380;
    ctx.fillStyle = i%3 ? 'rgba(255,229,48,.72)' : 'rgba(255,34,87,.75)';
    drawStar(sx, sy, 8 + 12*Math.sin(t*5+i)**2, t+i);
  }
  ctx.restore();

  ctx.fillStyle = 'rgba(255,255,255,' + (.05 + flash*.22) + ')';
  ctx.fillRect(0,0,W,H);
  ctx.strokeStyle = 'rgba(255,226,40,.78)';
  ctx.lineWidth = 8 + flash*8;
  ctx.strokeRect(30,30,W-60,H-60);

  if (p < 1) requestAnimationFrame(frame);
}
logo.onload = () => requestAnimationFrame(frame);
</script>
</body>
</html>`);

  await page.waitForFunction(() => window.logo && window.logo.complete);
  const videoBuffer = await page.evaluate(async ({ duration }) => {
    const canvas = document.getElementById('c');
    const stream = canvas.captureStream(30);
    const chunks = [];
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 9000000 });
    recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    recorder.start();
    await new Promise(resolve => setTimeout(resolve, duration * 1000));
    recorder.stop();
    await new Promise(resolve => recorder.onstop = resolve);
    const blob = new Blob(chunks, { type: 'video/webm' });
    const buf = await blob.arrayBuffer();
    return Array.from(new Uint8Array(buf));
  }, { duration: 10 });

  fs.writeFileSync(outputPath, Buffer.from(videoBuffer));
  await browser.close();
  console.log(outputPath);
})();
