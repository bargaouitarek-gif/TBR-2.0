const fs=require('fs');

const VERSION='2026.07.26-home-pay-v8';

function validate(){
  const launcher=fs.readFileSync('home-pay-bootstrap.js','utf8');
  const dcoWrapper=fs.readFileSync('dco-audit-bootstrap.js','utf8');
  const entry=fs.readFileSync('index.html','utf8');
  const auditEntry=fs.readFileSync('index-audit.html','utf8');
  const worker=fs.readFileSync('sw.js','utf8');

  new Function(launcher);
  new Function(dcoWrapper);
  new Function(worker);

  const expectedEntry=[VERSION,'home-pay-bootstrap.js','Ta paye','Commissions packs','Installations'];
  const expectedLauncher=[
    'tbr-pay-home-v8','PAYE ESTIMÉE TBR','COMPOSITION DE TA PAYE','payRows.reduce',
    'Commissions ventes','Bonus VD / VF','Commissions packs','Installations',
    'Palier ventes','Palier VD','Déductions et malus','Total recomposé',
    'payVarsAnchor','payHomeAnchor','writeAnchor','dco-audit-bootstrap.js'
  ];
  const expectedDco=[
    '2026.07.26-home-month-v7','const finalWriteAnchor','tbrHomeHeaderCss',
    'externalAimtItems','setDcoData(refreshed)','DCO // CONTROL CENTER','tbr-month-header-v7'
  ];
  const expectedWorker=['home-pay-v8','home-pay-bootstrap.js','dco-audit-bootstrap.js'];
  const missing=[
    ...expectedEntry.filter(token=>!entry.includes(token)),
    ...expectedEntry.filter(token=>!auditEntry.includes(token)),
    ...expectedLauncher.filter(token=>!launcher.includes(token)),
    ...expectedDco.filter(token=>!dcoWrapper.includes(token)),
    ...expectedWorker.filter(token=>!worker.includes(token))
  ];
  if(missing.length) throw new Error(`Accueil paye incomplet : ${missing.join(', ')}`);

  const versionAnchor='const EMBEDDED_VERSION="2026.07.26-home-month-v7";';
  const definitionAnchor="  const finalWriteAnchor='  document.open();';";
  const writeAnchor='  html=html.replace("</head>",tbrHomeHeaderCss+"</head>");\n\n  document.open();`';
  if(!dcoWrapper.includes(versionAnchor)) throw new Error('Version embarquée v7 introuvable pour le passage en v8.');
  if(!dcoWrapper.includes(definitionAnchor)) throw new Error('Point d’injection des calculs de paye introuvable.');
  if(!dcoWrapper.includes(writeAnchor)) throw new Error('Point d’injection visuelle de la paye introuvable.');

  const simulated=dcoWrapper
    .replace(versionAnchor,'const EMBEDDED_VERSION="'+VERSION+'";')
    .replace(definitionAnchor,'  const payTestMarker="tbr-pay-home-v8";\n'+definitionAnchor)
    .replace(writeAnchor,'  html=html.replace("</head>",tbrHomeHeaderCss+"</head>");\n  html=html.replace("</head>","<style id=\\"tbr-home-pay-v8\\"></style></head>");\n\n  document.open();`');
  new Function(simulated);
  if(!simulated.includes(VERSION)||!simulated.includes('tbr-pay-home-v8')) throw new Error('La transformation v8 ne peut pas être appliquée.');

  console.log('Accueil paye v8 validé : syntaxe, points d’injection et moteur DCO compatibles.');
}

try{validate();}catch(error){
  console.error(error&&error.stack?error.stack:error);
  process.exit(1);
}
