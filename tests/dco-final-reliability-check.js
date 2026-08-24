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
  ['engine runtime 1.0.0', engine && engine.VERSION==='1.0.0'],
  ['claim runtime 2.0.0', claim.includes("const VERSION='2.0.0'")],
  ['claim loads canonical engine', claim.includes("ENGINE_URL='./tbr-dco-engine.js?v=1.0.0'")],
  ['dashboard runtime 1.3.0', bridge.includes("const VERSION='1.3.0'")],
  ['history is diagnostic only', claim.includes('Diagnostic uniquement') && !claim.includes("source:'VERSION'")],
  ['stale canonical body is refreshed', claim.includes('if(!userEdited)setTextareaValue(textarea,mail.body);')],
  ['manual textarea edits preserved', claim.includes("textarea.dataset.tbrUserEdited==='1'")],
  ['dashboard missing uses current result only', bridge.includes("mail?.result?.missingSales||mail?.integrity?.missing||[]") && !bridge.includes('integrity.removed')],
  ['confirmed and missing totals separated', claim.includes('MONTANTS POTENTIELS NON AJOUTÉS AU TOTAL CHIFFRÉ')],
  ['existing relative claim loader still present', index.includes('src="./tbr-dco-claim-mail.js?v=1.7.1"')],
  ['existing relative dashboard loader still present', index.includes('src="./tbr-dco-dashboard-fix.js?v=1.0.0"')]
];

const src={
  cache:{raw:{rows:[
    {num:'2223533',nb:1},
    {num:'2223731',nb:1}
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
  {numClient:'2223731',nomClient:'Iacono',installation:true,annulation:false},
  {numClient:'2215124',nomClient:'JONATHAN CHOURAQUI',typeVente:'VF',dateVente:'2026-07-14',installation:true,annulation:false}
];

const result=engine.build({src,sales,month:{annee:2026,mois:7}});
checks.push(
  ['CHOURAQUI appears once as missing sale', result.missingSales.filter(x=>x.num==='2215124').length===1],
  ['CHOURAQUI excluded from ordinary ledger', !result.ordinaryLedger.some(x=>x.num==='2215124')],
  ['CHOURAQUI direct potential is 239.75', Math.abs(result.missingSales.find(x=>x.num==='2215124').directTotal-239.75)<0.001],
  ['Iacono partner install 55 is preserved', result.ordinaryLedger.some(x=>x.num==='2223731'&&x.nature==='Installation'&&x.expected===55&&x.amount===55)],
  ['confirmed total excludes missing potential', Math.abs(result.totals.confirmed-325)<0.001],
  ['missing potential separated', Math.abs(result.totals.missingPotential-239.75)<0.001],
  ['missing exclusion invariant', result.invariants.missingExcludedFromOrdinary===true],
  ['ledger total invariant', result.invariants.confirmedEqualsLedger===true]
);

const noInstallSales=sales.map(x=>x.numClient==='2215124'?{...x,installation:false}:x);
const noInstall=engine.build({src,sales:noInstallSales,month:{annee:2026,mois:7}});
checks.push(
  ['missing sale install false excludes installation', !noInstall.missingSales.find(x=>x.num==='2215124').components.some(x=>x.nature==='Installation')],
  ['filtered installation never returns through fallback', Math.abs(noInstall.missingSales.find(x=>x.num==='2215124').directTotal-179.75)<0.001]
);

const cancelledSales=sales.map(x=>x.numClient==='2215124'?{...x,annulation:true}:x);
const cancelled=engine.build({src,sales:cancelledSales,month:{annee:2026,mois:7}});
checks.push(['cancelled sale is not claimable', !cancelled.missingSales.some(x=>x.num==='2215124')]);

let failed=false;
for(const [name,ok] of checks){
  console.log(`${ok?'PASS':'FAIL'} - ${name}`);
  if(!ok)failed=true;
}
if(failed)process.exit(1);
console.log('PASS - DCO canonical engine reliability');
