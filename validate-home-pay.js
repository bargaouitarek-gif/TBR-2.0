const fs=require('fs');

const VERSION='2026.07.26-pay-details-v9';

function validate(){
  const detailLauncher=fs.readFileSync('pay-detail-bootstrap.js','utf8');
  const payLauncher=fs.readFileSync('home-pay-bootstrap.js','utf8');
  const dcoWrapper=fs.readFileSync('dco-audit-bootstrap.js','utf8');
  const entry=fs.readFileSync('index.html','utf8');
  const auditEntry=fs.readFileSync('index-audit.html','utf8');
  const worker=fs.readFileSync('sw.js','utf8');

  new Function(detailLauncher);
  new Function(payLauncher);
  new Function(dcoWrapper);
  new Function(worker);

  const expectedEntry=[VERSION,'pay-detail-bootstrap.js','montants rouges','Détail client par client'];
  const expectedDetail=[
    VERSION,'home-pay-bootstrap.js','deductionDetails','adjustmentDetails','explainPayMalus',
    'Déductions et malus','Autres ajustements','Voir le détail','DÉTAIL COMPLET',
    'Total calculé pour le dossier','Éléments déjà classés','Écart non encore rattaché',
    'tbr-pay-modal','setPayDetail'
  ];
  const expectedPay=[
    '2026.07.26-home-pay-v8','tbr-pay-home-v8','PAYE ESTIMÉE TBR','COMPOSITION DE TA PAYE',
    'Commissions ventes','Commissions packs','Installations','Palier ventes','Palier VD',
    'Déductions et malus','Total recomposé','dco-audit-bootstrap.js'
  ];
  const expectedDco=['externalAimtItems','setDcoData(refreshed)','DCO // CONTROL CENTER','tbr-month-header-v7'];
  const expectedWorker=['pay-details-v9','pay-detail-bootstrap.js','home-pay-bootstrap.js','dco-audit-bootstrap.js'];

  const missing=[
    ...expectedEntry.filter(token=>!entry.includes(token)),
    ...expectedEntry.filter(token=>!auditEntry.includes(token)),
    ...expectedDetail.filter(token=>!detailLauncher.includes(token)),
    ...expectedPay.filter(token=>!payLauncher.includes(token)),
    ...expectedDco.filter(token=>!dcoWrapper.includes(token)),
    ...expectedWorker.filter(token=>!worker.includes(token))
  ];
  if(missing.length) throw new Error(`Détail de paye incomplet : ${missing.join(', ')}`);

  const requiredAnchors=[
    'const payVfCount=safeDetails.filter(v=>v.typeVente==="VF").length;',
    '<div className="tbr-pay-lines">{payRows.map',
    '<section className="flight-hero">',
    '.tbr-pay-line.is-zero{opacity:.58}'
  ];
  const absentAnchors=requiredAnchors.filter(token=>!payLauncher.includes(token));
  if(absentAnchors.length) throw new Error(`Points d’injection v9 absents : ${absentAnchors.join(', ')}`);

  console.log('Détail de paye v9 validé : montants rouges cliquables, dossiers détaillés et moteur DCO conservé.');
}

try{validate();}catch(error){
  console.error(error&&error.stack?error.stack:error);
  process.exit(1);
}