const fs=require('fs');

function requireToken(source,token,label){
  if(!source.includes(token)) throw new Error(`${label} : ${token}`);
}

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

  for(const source of [entry,auditEntry]){
    requireToken(source,'2026.07.26-pay-details-v9','Version v9 absente');
    requireToken(source,'pay-detail-bootstrap.js','Lanceur v9 absent');
  }

  for(const token of ['deductionDetails','adjustmentDetails','explainPayMalus','Voir le détail','DÉTAIL COMPLET','tbr-pay-modal','setPayDetail']){
    requireToken(detailLauncher,token,'Détail cliquable incomplet');
  }

  for(const token of ['2026.07.26-home-pay-v8','tbr-pay-home-v8','PAYE ESTIMÉE TBR','Déductions et malus','Total recomposé']){
    requireToken(payLauncher,token,'Accueil paye v8 indisponible');
  }

  for(const token of ['externalAimtItems','setDcoData(refreshed)','tbr-month-header-v7']){
    requireToken(dcoWrapper,token,'Moteur DCO indisponible');
  }

  for(const token of ['pay-details-v9','pay-detail-bootstrap.js','home-pay-bootstrap.js','dco-audit-bootstrap.js']){
    requireToken(worker,token,'Cache PWA v9 incomplet');
  }

  console.log('Détail de paye v9 validé : ouverture, dossiers clients, ajustements et moteurs conservés.');
}

try{validate();}catch(error){
  console.error(error&&error.stack?error.stack:error);
  process.exit(1);
}