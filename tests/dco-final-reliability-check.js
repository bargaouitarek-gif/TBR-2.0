const fs = require('fs');

const claim = fs.readFileSync('tbr-dco-claim-mail.js','utf8');
const bridge = fs.readFileSync('tbr-dco-dashboard-fix.js','utf8');
const index = fs.readFileSync('index.html','utf8');

const checks = [
  ['claim runtime 1.6.0', claim.includes("const VERSION='1.6.0'" )],
  ['missing sale scan by client number', claim.includes('if(dcoSet.has(n))return;') && claim.includes('missing.push(enrichMissing')],
  ['missing sale mail section', claim.includes('VENTES ABSENTES DU DCO — IMPACT FINANCIER À VÉRIFIER')],
  ['confirmed total separated from missing sale', claim.includes('TOTAL DES ÉCARTS CHIFFRÉS EN MA DÉFAVEUR À VÉRIFIER') && claim.includes('MONTANTS POTENTIELS NON AJOUTÉS AU TOTAL CHIFFRÉ')],
  ['reliable claim action available', bridge.includes('Générer la réclamation DCO fiable')],
  ['dashboard uses canonical total', bridge.includes("amount.textContent=M(mail.total||0)")],
  ['relative claim loader', index.includes('src="./tbr-dco-claim-mail.js?v=1.6.0"')],
  ['relative dashboard loader', index.includes('src="./tbr-dco-dashboard-fix.js?v=1.0.0"') || index.includes('src="./tbr-dco-dashboard-fix.js?v=1.1.0"')]
];

let failed = false;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${name}`);
  if (!ok) failed = true;
}
if (failed) process.exit(1);
console.log('PASS - DCO final reliability static guard');
