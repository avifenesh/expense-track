const fs = require('fs');
const issues = JSON.parse(fs.readFileSync('C:\Users\avife\AppData\Local\Temp\gh-issues.json', 'utf8'));
const claimedIds = new Set([214, 207]);
const available = issues.filter(i => !claimedIds.has(i.number));

const scored = available.map(task => {
  let score = 0;
  const labels = task.labels.map(l => l.name.toLowerCase());
  
  if (labels.some(l => l.includes('bug'))) score += 35;
  if (labels.some(l => l.includes('security'))) score += 40;
  if (labels.some(l => l.includes('mobile'))) score += 15;
  if (labels.some(l => l.includes('high'))) score += 50;
  if (labels.some(l => l.includes('critical'))) score += 100;
  
  return {
    number: task.number,
    title: task.title,
    labels: task.labels.map(l => l.name),
    url: task.url,
    score
  };
}).sort((a, b) => b.score - a.score).slice(0, 5);

console.log(JSON.stringify(scored, null, 2));
