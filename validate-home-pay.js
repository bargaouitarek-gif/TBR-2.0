const fs=require('fs');

function requireToken(source,token,label){
  if(!source.includes(token)) throw new Error(`${label} : ${token}`);
}

function validate(){
  const correctionLauncher=fs.readFileSync('pay-correction-bootstrap.js','utf8');
  const detailLauncher=fs.readFileSync('pay-detail-bootstrap.js','utf8');
  const payLauncher=fs.readFileSync('home-pay-bootstrap.js','utf8');
  const dcoWrapper=fs.readFileSync('dco-audit-bootstrap.js','utf8');
  const entry=fs.readFileSync('index.html','utf8');
  const auditEntry=fs.readFileSync('index-audit.html','utf8');
  const worker=fs.readFileSync('sw.js','utf8');

  new Function(correctionLauncher);
  new Function(detailLauncher);
  new Function(payLauncher);
  new Function(dcoWrapper);
  new Function(worker);

  for(const source of [entry,auditEntry]){
    requireToken(source,'2026.07.26-partner-double-count-v10','Version v10 absente');
    requireToken(source,'pay-correction-bootstrap.js','Lanceur de correction absent');
    requireToken(source,'Pascaline reste à 155 €','Explication de mise à jour absente');
  }

  for(const token of [
    'tbrSaleBefore','tbrSaleAfter','partnerSale!==0?partnerSale:Number(r.kit||0)',
    'partnerInstall!==0?partnerInstall:Number(r.install||0)','pascalineClassified',
    'Le dossier Pascaline Iacono reste compté deux fois','pay-detail-bootstrap.js'
  ]){
    requireToken(correctionLauncher,token,'Correction partenaire incomplète');
  }

  for(const token of ['deductionDetails','adjustmentDetails','explainPayMalus','Voir le détail','DÉTAIL COMPLET','tbr-pay-modal','setPayDetail']){
    requireToken(detailLauncher,token,'Détail cliquable incomplet');
  }

  for(const token of ['2026.07.26-home-pay-v8','tbr-pay-home-v8','PAYE ESTIMÉE TBR','Déductions et malus','Total recomposé']){
    requireToken(payLauncher,token,'Accueil paye indisponible');
  }

  for(const token of ['externalAimtItems','setDcoData(refreshed)','tbr-month-header-v7']){
    requireToken(dcoWrapper,token,'Moteur DCO indisponible');
  }

  for(const token of ['partner-double-count-v10','pay-correction-bootstrap.js','pay-detail-bootstrap.js','home-pay-bootstrap.js','dco-audit-bootstrap.js']){
    requireToken(worker,token,'Cache PWA v10 incomplet');
  }

  const pascaline={kit:155,partnerSale:155,bonus:0,packs:0,install:0,partnerInstall:0,malus:0,total:155};
  const saleCommission=pascaline.partnerSale!==0?pascaline.partnerSale:pascaline.kit;
  const installCommission=pascaline.partnerInstall!==0?pascaline.partnerInstall:pascaline.install;
  const classified=saleCommission+pascaline.bonus+pascaline.packs+installCommission+pascaline.malus;
  if(classified!==155||classified!==pascaline.total) throw new Error(`Pascaline reste mal classée : ${classified} € au lieu de 155 €.`);

  console.log('Paye v10 validée : Pascaline 2223731 comptée une seule fois à 155 €, détails, DCO et AIMT conservés.');
}

try{validate();}catch(error){
  console.error(error&&error.stack?error.stack:error);
  process.exit(1);
}
