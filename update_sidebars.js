const fs = require('fs');
const files = ['ptcall.html', 'ptclose.html', 'ptbir.html', 'ptcbir.html', 'ptour.html', 'ptdw.html'];
for (const file of files) {
  const path = 'frontend/public/' + file;
  if (!fs.existsSync(path)) continue;
  let content = fs.readFileSync(path, 'utf8');

  const correctLinks = `<a class="nav-item" href="ptcall.html"><span class="ico">&#128222;</span> Call Register</a>
      <a class="nav-item" href="ptclose.html"><span class="ico">&#9989;</span> Closed Calls</a>
      <a class="nav-item" href="ptour.html"><span class="ico">&#128663;</span> Tour Summary</a>
      <a class="nav-item" href="ptdw.html"><span class="ico">&#128197;</span> Daily Work</a>
      <a class="nav-item" href="ptpa.html"><span class="ico">&#128221;</span> Pending Activity</a>`;

  // First, normalize all versions of these links to the correct block
  // We will replace everything from ptcall to ptcbir (not including ptcbir, we just stop before the Inventory sec)
  
  // A regex that matches the whole block of links under "Service Records" down to just before "<div class="nav-sec">Inventory</div>"
  const regex = /<div class="nav-sec">Service Records<\/div>[\s\S]*?<div class="nav-sec">Inventory<\/div>/;
  
  // We recreate the block properly
  let newBlock = `<div class="nav-sec">Service Records</div>
      <a class="nav-item" href="ptcall.html"><span class="ico">&#128222;</span> Call Register</a>
      <a class="nav-item" href="ptclose.html"><span class="ico">&#9989;</span> Closed Calls</a>
      <a class="nav-item" href="ptour.html"><span class="ico">&#128663;</span> Tour Summary</a>
      <a class="nav-item" href="ptdw.html"><span class="ico">&#128197;</span> Daily Work</a>
      <a class="nav-item" href="ptpa.html"><span class="ico">&#128221;</span> Pending Activity</a>
  
      <div class="nav-sec">Inventory</div>`;

  // Apply the active class properly based on the filename
  if (file === 'ptcall.html') {
    newBlock = newBlock.replace('href="ptcall.html"', 'class="nav-item active" href="ptcall.html"').replace('class="nav-item" class="nav-item active"', 'class="nav-item active"');
  } else if (file === 'ptclose.html') {
    newBlock = newBlock.replace('href="ptclose.html"', 'class="nav-item active" href="ptclose.html"').replace('class="nav-item" class="nav-item active"', 'class="nav-item active"');
  } else if (file === 'ptour.html') {
    newBlock = newBlock.replace('href="ptour.html"', 'class="nav-item active" href="ptour.html"').replace('class="nav-item" class="nav-item active"', 'class="nav-item active"');
  } else if (file === 'ptdw.html') {
    newBlock = newBlock.replace('href="ptdw.html"', 'class="nav-item active" href="ptdw.html"').replace('class="nav-item" class="nav-item active"', 'class="nav-item active"');
  } else if (file === 'ptpa.html') {
    newBlock = newBlock.replace('href="ptpa.html"', 'class="nav-item active" href="ptpa.html"').replace('class="nav-item" class="nav-item active"', 'class="nav-item active"');
  }

  content = content.replace(regex, newBlock);
  fs.writeFileSync(path, content, 'utf8');
}
console.log("Done updating sidebars.");
