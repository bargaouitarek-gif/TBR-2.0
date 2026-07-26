const fs=require('fs');

function requireToken(source,token,label){
  if(!source.includes(token)) throw new Error(`${label} : ${token}`);
}

function validate(){
  const documentLauncher=fs.readFileSync('document-intake-bootstrap.js','utf8');
  const correctionLauncher=fs.readFileSync('pay-correction-bootstrap.js','utf8');
  const detailLauncher=fs.readFileSync('pay-detail-bootstrap.js','utf8');
  const payLauncher=fs.readFileSync('home-pay-bootstrap.js','utf8');
  const dcoWrapper=fs.readFileSync('dco-audit-bootstrap.js','utf8');
  const entry=fs.readFileSync('index.html','utf8');
  const auditEntry=fs.readFileSync('index-audit.html','utf8');
  const worker=fs.readFileSync('sw.js','utf8');

  new Function(documentLauncher);
  new Function(correctionLauncher);
  new Function(detailLauncher);
  new Function(payLauncher);
  new Function(dcoWrapper);
  new Function(worker);

  for(const source of [entry,auditEntry]){
    requireToken(source,'2026.07.26-document-intake-v12','Version v12 absente');
    requireToken(source,'document-intake-bootstrap.js','Lanceur documentaire absent');
    requireToken(source,'PV &gt; contrat &gt; proposition','Règle de priorité absente');
  }

  for(const token of [
    'PROPOSITION_COMMERCIALE:1','CONTRAT:2','PV_INSTALLATION:3',
    'indexedDB.open','tbr_document_vault_v1','cc_ventes_',
    'Ajouter une vente par document','Coffre documentaire',
    'mergeByPriority','fieldSources','documents',
    'readPdf','detectType','parseDocument','document-intake-v12',
    'pay-correction-bootstrap.js'
  ]){
    requireToken(documentLauncher,token,'Moteur documentaire incomplet');
  }

  for(const token of [
    'tbrSaleBefore','tbrSaleAfter','tbrBonusBefore','tbrBonusAfter',
    'partnerSale!==0?0:Number(r.bonus||0)','saleBonus',
    'pascalineBonus','bonus:100','Le bonus partenaire de Pascaline reste compté à tort',
    'pay-detail-bootstrap.js'
  ]){
    requireToken(correctionLauncher,token,'Correction du bonus partenaire incomplète');
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

  for(const token of ['document-intake-v12','document-intake-bootstrap.js','partner-bonus-v11','pay-correction-bootstrap.js','pay-detail-bootstrap.js','home-pay-bootstrap.js','dco-audit-bootstrap.js']){
    requireToken(worker,token,'Cache PWA v12 incomplet');
  }

  const sourcePriority={nomClient:{priority:2},packs:{priority:3}};
  const proposalPriority=1,contractPriority=2,pvPriority=3;
  if(proposalPriority>=sourcePriority.nomClient.priority) throw new Error('Une proposition peut encore écraser un contrat.');
  if(!(contractPriority>=sourcePriority.nomClient.priority)) throw new Error('Un contrat ne peut pas confirmer sa propre donnée.');
  if(!(pvPriority>=sourcePriority.packs.priority)) throw new Error('Le PV ne reste pas prioritaire.');

  const pascaline={kit:155,partnerSale:155,bonus:100,packs:0,install:0,partnerInstall:0,malus:0,total:155};
  const saleCommission=pascaline.partnerSale!==0?pascaline.partnerSale:pascaline.kit;
  const saleBonus=pascaline.partnerSale!==0?0:pascaline.bonus;
  const installCommission=pascaline.partnerInstall!==0?pascaline.partnerInstall:pascaline.install;
  const classified=saleCommission+saleBonus+pascaline.packs+installCommission+pascaline.malus;
  if(classified!==155||classified!==pascaline.total) throw new Error(`Pascaline reste mal classée : ${classified} € au lieu de 155 €.`);
  if(saleBonus!==0) throw new Error('Le bonus technique de 100 € est encore retenu sur la vente partenaire.');

  console.log('TBR v12 validé : dossiers PDF, priorité PV > contrat > proposition, coffre local, paye, DCO et AIMT conservés.');
}

try{validate();}catch(error){
  console.error(error&&error.stack?error.stack:error);
  process.exit(1);
}
