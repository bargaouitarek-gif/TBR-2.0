const fs = require('fs');
const vm = require('vm');

const engineSource = fs.readFileSync('tbr-dco-engine.js','utf8');
const claim = fs.readFileSync('tbr-dco-claim-mail.js','utf8');
const bridge = fs.readFileSync('tbr-dco-dashboard-fix.js','utf8');
const index = fs.readFileSync('index.html','utf8');

const sandbox={module:{exports:{}},exports:{},globalThis:{}};
vm.createContext(sandbox);
vm.runInContext(engineSource,sandbox);
const engine=sandbox.module.exports;

const checks = [
  ['engine runtime 1.3.0', engine && engine.VERSION==='1.3.0'],
  ['claim runtime 2.3.0', claim.includes("const VERSION='2.3.0'")] ,
  ['claim requires engine 1.3.0', claim.includes("const ENGINE_VERSION='1.3.0'") && claim.includes('ENGINE_URL=`./tbr-dco-engine.js?v=${ENGINE_VERSION}`')],
  ['claim publishes canonical event', claim.includes("const CANONICAL_EVENT='tbr:dco-canonical'") && claim.includes('window.__tbrDcoCanonical=mail') && claim.includes('new CustomEvent(CANONICAL_EVENT')],
  ['dashboard runtime 1.4.0', bridge.includes("const VERSION='1.4.0'")],
  ['dashboard consumes published snapshot first', bridge.includes('if(window.__tbrDcoCanonical)return window.__tbrDcoCanonical;')],
  ['dashboard listens to canonical event', bridge.includes('window.addEventListener(CANONICAL_EVENT,sync)')],
  ['dashboard does not rebuild mail on every sync', !bridge.includes('TBR_DCO_INTEGRITY.buildMail')],
  ['history is diagnostic only', claim.includes('Diagnostic uniquement') && !claim.includes("source:'VERSION'")],
  ['stale canonical body is refreshed', claim.includes("if(textarea.dataset.tbrUserEdited!=='1')setTextareaValue(textarea,mail.body);")],
  ['manual textarea edits preserved', claim.includes("textarea.dataset.tbrUserEdited='1'") && claim.includes("textarea.dataset.tbrUserEdited!=='1'")],
  ['confirmed and missing totals separated', claim.includes('MONTANTS POTENTIELS NON AJOUTÉS AU TOTAL CHIFFRÉ')],
  ['relative claim loader still present', index.includes('tbr-dco-claim-mail-loader')],
  ['relative dashboard loader still present', index.includes('tbr-dco-dashboard-fix-loader')],
  ['index loads canonical engine directly', index.includes('id="tbr-dco-engine-runtime" src="./tbr-dco-engine.js?v=1.3.0"')],
  ['index buildAnalysis stores canonical result', index.includes('canonical:canonical') && index.includes('canonicalVersion:canonical?canonical.version:null')],
  ['index shortage total comes from canonical engine', index.includes('verseEnMoins:canonical?round2(canonical.totals.confirmed||0):0')],
  ['index overpaid total stays separate', index.includes('verseEnPlus:canonical?round2(canonical.totals.overpaid||0):0')],
  ['native mail uses canonical runtime only', index.includes('window.TBR_DCO_INTEGRITY.applyCanonicalMail') && !index.includes('const shortageRows=[]')],
  ['index alerts read canonical result only', index.includes('const result=data&&data.canonical;') && index.includes('(result.overpaidLedger||[])')],
  ['legacy alert calculator removed', !index.includes('const installGlobal=(data.globalRows||[])')],
  ['legacy aggregate totals removed', !index.includes('sousPayeCalculable:') && !index.includes('clientVerseEnMoinsAControler:') && !index.includes('const ecartsAControler=')],
  ['canonical loaders are cache-busted', index.includes('tbr-dco-claim-mail.js?v=2.3.0') && index.includes('tbr-dco-dashboard-fix.js?v=1.4.0')]
];

const src={
  cache:{raw:{rows:[
    {num:'2223533',nb:1,nom:'KHACHATRYAN',catpub:'DIS'},
    {num:'2223731',nb:1,nom:'Iacono',catpub:'DIS'}
  ]}},
  data:{
    analyses:[
      {type:'matched',num:'2223533',nom:'KHACHATRYAN',catpub:'DIS',lines:[
        {label:'Commission vente',dco:100,tbr:180,ecart:-80}
      ]},
      {type:'matched',num:'2223731',nom:'Iacono',catpub:'DIS',lines:[
        {label:'Commission vente',dco:60,tbr:100,ecart:-40},
        {label:'Installation',dco:0,tbr:55,ecart:-55}
      ]},
      {type:'missing_dco',num:'2215124',nom:'JONATHAN CHOURAQUI',catpub:'VF',lines:[
        {label:'Commission vente',dco:0,tbr:130,ecart:-130},
        {label:'Packs nets',dco:0,tbr:49.75,ecart:-49.75},
        {label:'Installation',dco:0,tbr:60,ecart:-60}
      ],tbrMeta:{commissionVente:130,commissionPacks:49.75,commissionInstall:60,total:239.75}}
    ],
    installationIssues:[
      {num:'2223731',nom:'Iacono',catpub:'DIS',dco:0,tbr:55,ecart:-55},
      {num:'2215124',nom:'JONATHAN CHOURAQUI',catpub:'VF',dco:0,tbr:60,ecart:-60}
    ],
    globalRows:[
      {money:true,label:'Palier ventes',dco:1300,tbr:1450,ecart:-150}
    ]
  }
};

const sales=[
  {numClient:'2223533',nomClient:'KHACHATRYAN',installation:false,annulation:false},
  {numClient:'2223731',nomClient:'Iacono',installation:true,annulation:false,partenaire:true},
  {numClient:'2215124',nomClient:'JONATHAN CHOURAQUI',typeVente:'VF',dateVente:'2026-07-14',installation:true,annulation:false}
];

const result=engine.build({src,sales,month:{annee:2026,mois:7}});
checks.push(
  ['CHOURAQUI appears once as missing sale', result.missingSales.filter(x=>x.num==='2215124').length===1],
  ['CHOURAQUI excluded from ordinary ledger', !result.ordinaryLedger.some(x=>x.num==='2215124')],
  ['CHOURAQUI direct potential is 239.75', Math.abs(result.missingSales.find(x=>x.num==='2215124').directTotal-239.75)<0.001],
  ['CHOURAQUI canonical status is missing_dco', result.clients.filter(x=>x.num==='2215124').length===1 && result.clients.find(x=>x.num==='2215124').status==='missing_dco'],
  ['CHOURAQUI shortage components equal 239.75', Math.abs(result.clients.find(x=>x.num==='2215124').shortageTotal-239.75)<0.001],
  ['KHACHATRYAN canonical status is matched', result.clients.find(x=>x.num==='2223533').status==='matched'],
  ['Iacono canonical status is matched', result.clients.find(x=>x.num==='2223731').status==='matched'],
  ['Iacono partner install 55 is preserved', result.clients.find(x=>x.num==='2223731').expected.installation===55 && result.clients.find(x=>x.num==='2223731').shortage.installation===55],
  ['confirmed total excludes missing potential', Math.abs(result.totals.confirmed-325)<0.001],
  ['missing potential separated', Math.abs(result.totals.missingPotential-239.75)<0.001],
  ['missing exclusion invariant', result.invariants.missingExcludedFromOrdinary===true],
  ['missing status invariant', result.invariants.missingStatusExclusive===true],
  ['unique client status invariant', result.invariants.uniqueClientStatus===true],
  ['ledger total invariant', result.invariants.confirmedEqualsLedger===true],
  ['no component netting invariant', result.invariants.noComponentNetting===true],
  ['no cross netting invariant', result.invariants.noCrossNetting===true],
  ['normal fixture has no overpayment', Math.abs(result.totals.overpaid||0)<0.001]
);

const noInstallSales=sales.map(x=>x.numClient==='2215124'?{...x,installation:false}:x);
const noInstall=engine.build({src,sales:noInstallSales,month:{annee:2026,mois:7}});
checks.push(
  ['missing sale install false excludes installation', !noInstall.missingSales.find(x=>x.num==='2215124').components.some(x=>x.nature==='Installation')],
  ['filtered installation never returns through fallback', Math.abs(noInstall.missingSales.find(x=>x.num==='2215124').directTotal-179.75)<0.001],
  ['client model also excludes install when false', noInstall.clients.find(x=>x.num==='2215124').expected.installation===0]
);

const cancelledSales=sales.map(x=>x.numClient==='2215124'?{...x,annulation:true}:x);
const cancelled=engine.build({src,sales:cancelledSales,month:{annee:2026,mois:7}});
checks.push(
  ['cancelled sale is not claimable', !cancelled.missingSales.some(x=>x.num==='2215124')],
  ['cancelled sale remains diagnostic only', cancelled.clients.find(x=>x.num==='2215124').status==='cancelled' && cancelled.clients.find(x=>x.num==='2215124').shortageTotal===0]
);

const overpaySrc={
  cache:{raw:{rows:[{num:'9999999',nb:1,nom:'TEST',catpub:'VD'}]}},
  data:{
    analyses:[{type:'matched',num:'9999999',nom:'TEST',catpub:'VD',lines:[
      {label:'Commission vente',dco:200,tbr:100,ecart:100},
      {label:'Installation',dco:0,tbr:40,ecart:-40}
    ]}],
    installationIssues:[{num:'9999999',nom:'TEST',catpub:'VD',dco:0,tbr:40,ecart:-40}],
    globalRows:[]
  }
};
const overpay=engine.build({src:overpaySrc,sales:[{numClient:'9999999',nomClient:'TEST',installation:true,annulation:false}]});
checks.push(
  ['overpayment never offsets shortage', Math.abs(overpay.totals.confirmed-40)<0.001],
  ['overpaid component shortage stays zero', overpay.clients.find(x=>x.num==='9999999').shortage.sale===0],
  ['installation shortage survives overpayment', overpay.clients.find(x=>x.num==='9999999').shortage.installation===40],
  ['overpayment is reported separately', Math.abs(overpay.totals.overpaid-100)<0.001],
  ['overpaid component is preserved', overpay.clients.find(x=>x.num==='9999999').overpaid.sale===100],
  ['overpay fixture still forbids cross netting', overpay.invariants.noCrossNetting===true],
  ['overpaid ledger exposes the component once', overpay.overpaidLedger.filter(x=>x.num==='9999999'&&x.nature==='Commission sur la vente'&&x.amount===100).length===1],
  ['overpaid ledger invariant', overpay.invariants.overpaidEqualsLedger===true]
);

let failed=false;
for(const [name,ok] of checks){
  console.log(`${ok?'PASS':'FAIL'} - ${name}`);
  if(!ok)failed=true;
}
if(failed)process.exit(1);
console.log('PASS - DCO canonical engine reliability');
