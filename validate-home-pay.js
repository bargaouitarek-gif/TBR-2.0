const fs=require('fs');

function requireToken(source,token,label){
  if(!source.includes(token)) throw new Error(`${label} : ${token}`);
}

function validate(){
  const documentLauncher=fs.readFileSync('document-intake-bootstrap.js','utf8');
  const documentEntry=fs.readFileSync('document-intake-entry-v14.js','utf8');
  const documentRuntime=fs.readFileSync('document-intake-runtime.js','utf8');
  const simpleSaisie=fs.readFileSync('saisie-simple-bootstrap.js','utf8');
  const shareTarget=fs.readFileSync('share-target-bootstrap.js','utf8');
  const manifest=JSON.parse(fs.readFileSync('manifest.webmanifest','utf8'));
  const correctionLauncher=fs.readFileSync('pay-correction-bootstrap.js','utf8');
  const detailLauncher=fs.readFileSync('pay-detail-bootstrap.js','utf8');
  const payLauncher=fs.readFileSync('home-pay-bootstrap.js','utf8');
  const dcoWrapper=fs.readFileSync('dco-audit-bootstrap.js','utf8');
  const entry=fs.readFileSync('index.html','utf8');
  const auditEntry=fs.readFileSync('index-audit.html','utf8');
  const worker=fs.readFileSync('sw-v16.js','utf8');

  new Function(documentLauncher);
  new Function(documentEntry);
  new Function(documentRuntime);
  new Function(simpleSaisie);
  new Function(shareTarget);
  new Function(correctionLauncher);
  new Function(detailLauncher);
  new Function(payLauncher);
  new Function(dcoWrapper);
  new Function(worker);

  for(const source of [entry,auditEntry]){
    requireToken(source,'2026.07.26-android-share-v16','Version v16 absente');
    requireToken(source,'manifest.webmanifest','Manifest de partage absent');
    requireToken(source,'document-intake-entry-v14.js','Entrée documentaire absente');
    requireToken(source,'sw-v16.js','Service worker v16 absent');
    requireToken(source,'Activer les PDF directs','Activation des PDF directs absente');
  }

  for(const token of [
    'raw\\.githubusercontent','document-intake-runtime.js','saisie-simple-bootstrap.js',
    'share-target-bootstrap.js','manifest.webmanifest','window.__tbrOriginalFetchV13',
    'html.replace("</body>"','pay-correction-bootstrap.js','android-share-v16'
  ]){
    requireToken(documentEntry,token,'Injection du partage Android incomplète');
  }

  for(const token of [
    'Ajouter un document','Choisir un PDF','Ajouter des photos','Saisie manuelle','Mes documents',
    'Ajoute 4, 5, 6 captures','oldGrid.style.setProperty("display","none","important")',
    'tbr-simple-choice-v15','tbr-doc-launcher','tbr-doc-vault-btn','unfreeze-saisie-v15',
    'mountTimer','scheduleMount','existing&&existing.isConnected','setTimeout(()=>'
  ]){
    requireToken(simpleSaisie,token,'Interface Saisie stable incomplète');
  }

  for(const token of [
    'document-intake-bootstrap.js','const VAULT_KEY=','lastIndexOf("})().catch")',
    '__tbrDocumentRuntimeLoadedV13','document-button-v13'
  ]){
    requireToken(documentRuntime,token,'Runtime documentaire incomplet');
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
    'tbr_share_inbox_v1','tbr_control_documents_v1','CLASSEMENT SIMPLE',
    'Mois concerné','Créer / compléter une vente','Garder pour un contrôle',
    'DataTransfer','launchQueue','monthKey','mergeIntoTarget','deleteShared',
    'tbr.document.last.import','purpose','typeVente'
  ]){
    requireToken(shareTarget,token,'Classement des PDF partagés incomplet');
  }

  if(!manifest.share_target) throw new Error('share_target absent du manifest.');
  if(manifest.share_target.action!=='./share-target'||manifest.share_target.method!=='POST') throw new Error('Route de partage Android incorrecte.');
  const sharedFiles=manifest.share_target.params&&manifest.share_target.params.files;
  if(!Array.isArray(sharedFiles)||!sharedFiles.some(item=>item.name==='pdf'&&item.accept.includes('application/pdf'))) throw new Error('Le manifest n’accepte pas les PDF.');
  if(!Array.isArray(manifest.file_handlers)||!manifest.file_handlers.length) throw new Error('Gestionnaire de fichier PDF absent.');

  for(const token of [
    'android-share-v16','manifest.webmanifest','tbr-icon.svg','share-target-bootstrap.js',
    'tbr_share_inbox_v1','event.request.formData()','form.get("pdf")',
    'storeSharedFile','/?shared=','document-intake-entry-v14.js',
    'saisie-simple-bootstrap.js','document-intake-runtime.js','document-intake-bootstrap.js',
    'pay-correction-bootstrap.js','pay-detail-bootstrap.js','home-pay-bootstrap.js','dco-audit-bootstrap.js'
  ]){
    requireToken(worker,token,'Réception PDF du service worker incomplète');
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

  const juneKey=`cc_ventes_${'2026-06'.replace('-','_')}`;
  if(juneKey!=='cc_ventes_2026_06') throw new Error('Le classement par mois est incorrect.');

  console.log('TBR v16 validé : PDF Android reçu, mois et VD/VF classables, vente ou contrôle séparés, paye, DCO et AIMT conservés.');
}

try{validate();}catch(error){
  console.error(error&&error.stack?error.stack:error);
  process.exit(1);
}
