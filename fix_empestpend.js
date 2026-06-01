const fs = require('fs');
const path = require('path');
const p = path.join('frontend', 'public', 'empestpend.html');
let content = fs.readFileSync(p, 'utf8');

const regex = /function configureEstimationStatCards\(\)\{[\s\S]*?(?=function renderTable\(\)\{)/m;

const replacement = `function configureEstimationStatCards(){
  const cards=document.querySelectorAll('.stats-row .stat-card');
  if(cards.length<4) return;
  cards[0].setAttribute('onclick',"filterByCard('all')");
  cards[1].setAttribute('onclick',"filterByCard('normal')");
  cards[2].setAttribute('onclick',"filterByCard('warning')");
  cards[3].setAttribute('onclick',"filterByCard('critical')");
}
`;

if (regex.test(content)) {
  content = content.replace(regex, replacement);
  fs.writeFileSync(p, content, 'utf8');
  console.log('Regex match and replaced!');
} else {
  console.log('Regex did not match');
}
