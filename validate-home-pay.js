const fs=require('fs');

const SNAPSHOT='5fd7ade1955a6024ca972d77beaf35c8c23f339c';
const VERSION='2026.07.26-home-pay-v8';
const RAW_ROOT=`https://raw.githubusercontent.com/bargaouitarek-gif/TBR-2.0/${SNAPSHOT}/`;

async function readRemote(path){
  const response=await fetch(`${RAW_ROOT}${path}`,{cache:'no-store'});
  if(!response.ok) throw new Error(`${path} indisponible (${response.status})`);
  return response.text();
}

async function validate(){
  const launcher=fs.readFileSync('home-pay-bootstrap.js','utf8');
  const dcoWrapper=fs.readFileSync('dco-audit-bootstrap.js','utf8');
  const entry=fs.readFileSync('index.html','utf8');
  const auditEntry=fs.readFileSync('index-audit.html','utf8');
  const worker=fs.readFileSync('sw.js','utf8');

  new Function(launcher);
  new Function(worker);

  const expectedEntry=[VERSION,'home-pay-bootstrap.js','Ta paye','Commissions packs','Installations'];
  const expectedLauncher=['tbr-pay-home-v8','PAYE ESTIMÉE TBR','Commissions ventes','Bonus VD / VF','Commissions packs','Installations','Palier ventes','Palier VD','Déductions et malus','Total recomposé'];
  const expectedWorker=['home-pay-v8','home-pay-bootstrap.js','dco-audit-bootstrap.js'];
  const missing=[
    ...expectedEntry.filter(token=>!entry.includes(token)),
    ...expectedEntry.filter(token=>!auditEntry.includes(token)),
    ...expectedLauncher.filter(token=>!launcher.includes(token)),
    ...expectedWorker.filter(token=>!worker.includes(token))
  ];
  if(missing.length) throw new Error(`Accueil paye incomplet : ${missing.join(', ')}`);

  const [base,originalBootstrap]=await Promise.all([readRemote('index.html'),readRemote('dco-audit-bootstrap.js')]);
  let rendered='';
  let bootError='';
  const storage=new Map();
  const previous={document:global.document,localStorage:global.localStorage,fetch:global.fetch};

  global.localStorage={
    getItem:key=>storage.has(key)?storage.get(key):null,
    setItem:(key,value)=>storage.set(key,String(value)),
    removeItem:key=>storage.delete(key),
    key:index=>[...storage.keys()][index]||null,
    get length(){return storage.size;}
  };
  global.document={
    open(){},
    write(value){rendered=String(value||'');},
    close(){},
    getElementById(){return{set className(_){},set textContent(value){bootError=String(value||'');}};}
  };
  global.fetch=async url=>{
    const value=String(url||'');
    if(value.startsWith('dco-audit-bootstrap.js?')) return{ok:true,status:200,text:async()=>dcoWrapper};
    if(value===`${RAW_ROOT}dco-audit-bootstrap.js`) return{ok:true,status:200,text:async()=>originalBootstrap};
    if(value===`${RAW_ROOT}index.html`) return{ok:true,status:200,text:async()=>base};
    throw new Error(`URL inattendue : ${value}`);
  };

  try{
    (0,eval)(launcher);
    await new Promise(resolve=>setTimeout(resolve,900));
  }finally{
    global.document=previous.document;
    global.localStorage=previous.localStorage;
    global.fetch=previous.fetch;
  }

  if(bootError) throw new Error(bootError);
  if(!rendered) throw new Error('Le nouvel accueil n’a produit aucune page.');
  const required=[
    'tbr-pay-home-v8','PAYE ESTIMÉE TBR','COMPOSITION DE TA PAYE','payRows.reduce',
    'Commissions ventes','Commissions packs','Installations','Palier ventes','Palier VD',
    'Bonus "+status','Challenges','Déductions et malus','Total recomposé',
    'DCO // CONTROL CENTER','externalAimtItems','setDcoData(refreshed)','tbr-month-header-v7'
  ];
  const renderedMissing=required.filter(token=>!rendered.includes(token));
  if(renderedMissing.length) throw new Error(`Page générée incomplète : ${renderedMissing.join(', ')}`);
  if(storage.get('cc_version')!==VERSION) throw new Error('La version v8 n’est pas mémorisée.');

  console.log(`Accueil paye v8 validé (${rendered.length} caractères), moteur DCO conservé.`);
}

validate().catch(error=>{
  console.error(error&&error.stack?error.stack:error);
  process.exit(1);
});
