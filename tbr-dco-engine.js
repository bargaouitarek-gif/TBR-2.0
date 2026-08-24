/* TBR 2.0 — DCO canonical engine 1.2.0 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  if(root) root.TBR_DCO_ENGINE=api;
})(typeof window!=='undefined'?window:globalThis,function(){
'use strict';

const VERSION='1.2.0';
const N=v=>Number.isFinite(Number(v))?Number(v):0;
const R=v=>Math.round(N(v)*100)/100;
const S=v=>String(v==null?'':v).trim();
const normNum=v=>S(v).replace(/\D/g,'');

function natureFor(label){
  const l=S(label);
  if(/pack/i.test(l))return'Rémunération Packs';
  if(/install/i.test(l))return'Installation';
  if(/commission|vente/i.test(l))return'Commission sur la vente';
  return l||'Rémunération';
}

function componentKey(label){
  const nature=natureFor(label);
  if(nature==='Rémunération Packs')return'packs';
  if(nature==='Installation')return'installation';
  if(nature==='Commission sur la vente')return'sale';
  return null;
}

function blankAmounts(){return{sale:0,packs:0,installation:0};}
function amountTotal(v){return R(N(v?.sale)+N(v?.packs)+N(v?.installation));}

function allSaleMap(sales){
  const map=new Map();
  (sales||[]).forEach(v=>{
    if(!v)return;
    const n=normNum(v.numClient);
    if(n&&!map.has(n))map.set(n,v);
  });
  return map;
}

function activeSaleMap(sales){
  const map=new Map();
  allSaleMap(sales).forEach((v,n)=>{if(!v.annulation)map.set(n,v);});
  return map;
}

function dcoRows(src){
  if(Array.isArray(src?.cache?.raw?.rows))return src.cache.raw.rows;
  if(Array.isArray(src?.data?.rows))return src.data.rows;
  return [];
}

function dcoNumberSet(src){
  const set=new Set();
  dcoRows(src).forEach(r=>{
    const n=normNum(r?.num||r?.numClient);
    const cancelled=!!r?.isAnnulation||N(r?.nb)<0;
    if(n&&!cancelled)set.add(n);
  });
  return set;
}

function dcoIdentityMap(src){
  const map=new Map();
  dcoRows(src).forEach(r=>{
    const n=normNum(r?.num||r?.numClient);
    const cancelled=!!r?.isAnnulation||N(r?.nb)<0;
    if(!n||cancelled||map.has(n))return;
    map.set(n,{num:n,name:S(r?.nom)||'Client DCO',type:S(r?.catpub||r?.typeVente)});
  });
  return map;
}

function ownsInstallation(salesByNum,num){
  const sale=salesByNum.get(normNum(num));
  return !!(sale&&sale.installation===true&&!sale.annulation);
}

function isAggregateDuplicate(label){
  const l=S(label).toLowerCase();
  if(!l)return true;
  return /commission.*vente|commission.*pack|installations?\s*total|agr[ée]gat|ventes\s*\+\s*packs|^paliers?$|^total\b|total.*commission|commissions.*primes/.test(l);
}

function whyFor(nature,paid,expected,label,formatMoney){
  const M=formatMoney||((v)=>`${Math.abs(R(v)).toFixed(2)} €`);
  if(nature==='Rémunération Packs')return`La rémunération des packs est de ${M(paid)} au lieu des ${M(expected)} attendus. Merci de vérifier les packs pris en compte et la règle de calcul appliquée.`;
  if(nature==='Installation')return`L’installation a été rémunérée ${M(paid)} au lieu des ${M(expected)} attendus.`;
  if(nature==='Commission sur la vente')return`La commission versée est de ${M(paid)} au lieu des ${M(expected)} attendus. Merci de vérifier le barème appliqué à cette vente.`;
  return`${S(label)||nature} a été rémunéré(e) ${M(paid)} au lieu des ${M(expected)} attendus. Merci de vérifier la règle appliquée.`;
}

function missingComponents(src,salesByNum,num){
  const n=normNum(num);
  const analysis=(src?.data?.analyses||[]).find(a=>a&&a.type==='missing_dco'&&normNum(a.num)===n)||null;
  if(!analysis)return{analysis:null,components:[],directTotal:0};
  const components=[];
  const seen=new Set();
  const add=(nature,value,sourceLabel,detail)=>{
    if(nature==='Installation'&&!ownsInstallation(salesByNum,n))return;
    const expected=R(value);
    if(!(expected>0.99))return;
    const key=nature.toLowerCase();
    if(seen.has(key))return;
    seen.add(key);
    components.push({nature,expected,sourceLabel:S(sourceLabel||nature),detail:S(detail)});
  };
  (analysis.lines||[]).forEach(l=>add(natureFor(l?.label),l?.tbr,l?.label,l?.niveau));
  const meta=analysis.tbrMeta||{};
  add('Commission sur la vente',meta.commissionVente,'Commission sur la vente','');
  add('Rémunération Packs',meta.commissionPacks,'Rémunération Packs','');
  add('Installation',meta.commissionInstall,'Installation','');

  // Aucun fallback vers le total agrégé : une composante filtrée ne doit jamais revenir indirectement.
  const directTotal=R(components.reduce((s,x)=>s+x.expected,0));
  return{analysis,components,directTotal};
}

function collectMissing(src,salesByNum){
  const dcoSet=dcoNumberSet(src);
  const missing=[];
  salesByNum.forEach((sale,n)=>{
    if(dcoSet.has(n))return;
    const money=missingComponents(src,salesByNum,n);
    missing.push({
      num:n,
      name:S(sale?.nomClient)||'Client TBR',
      type:S(sale?.catpub||sale?.typeDco||sale?.typeVente),
      date:S(sale?.dateVente||sale?.dateInstallation),
      components:money.components,
      directTotal:money.directTotal,
      hasFinancialDetail:money.components.length>0
    });
  });
  return missing;
}

function collectLedger(src,salesByNum,missing,formatMoney){
  const d=src?.data||{};
  const missingNums=new Set((missing||[]).map(x=>normNum(x?.num)).filter(Boolean));
  const items=[];
  const seen=new Set();
  const add=item=>{
    const num=normNum(item?.num);
    if(item?.scope==='client'&&missingNums.has(num))return;
    const amount=R(item?.amount);
    if(!(amount>0.99))return;
    const key=item.key||`${item.scope}|${num}|${S(item.nature).toLowerCase()}`;
    if(seen.has(key))return;
    seen.add(key);
    items.push({...item,num,amount,key});
  };

  (d.analyses||[]).forEach(a=>{
    if(!a||a.type==='missing_dco')return;
    (a.lines||[]).forEach(l=>{
      const e=R(l?.ecart);
      if(!(e<-.99))return;
      const nature=natureFor(l?.label);
      if(nature==='Installation'&&!ownsInstallation(salesByNum,a?.num))return;
      const paid=R(l?.dco), expected=R(l?.tbr);
      add({
        scope:'client',num:a?.num,name:S(a?.nom)||'Client',type:S(a?.catpub),
        nature,paid,expected,amount:Math.abs(e),
        why:whyFor(nature,paid,expected,l?.label,formatMoney),
        sourceLabel:S(l?.label),
        key:`client|${normNum(a?.num)}|${nature.toLowerCase()}`
      });
    });
  });

  const installSource=(d.installationIssues&&d.installationIssues.length)?d.installationIssues:(d.installationCandidates||[]);
  (installSource||[]).forEach(x=>{
    const e=R(x?.ecart);
    if(!(e<-.99))return;
    const num=normNum(x?.num);
    if(!ownsInstallation(salesByNum,num))return;
    const paid=R(x?.dco), expected=R(x?.tbr);
    add({
      scope:'client',num,name:S(x?.nom)||'Client',type:S(x?.catpub),
      nature:'Installation',paid,expected,amount:Math.abs(e),
      why:S(x?.cause)||whyFor('Installation',paid,expected,'Installation',formatMoney),
      sourceLabel:'Installation',key:`client|${num}|installation`
    });
  });

  (d.globalRows||[]).forEach(r=>{
    const e=R(r?.ecart);
    if(!r?.money||!(e<-.99)||isAggregateDuplicate(r?.label))return;
    const label=S(r?.label)||'Écart global';
    const paid=R(r?.dco), expected=R(r?.tbr);
    add({
      scope:'global',num:'',name:'',type:'',nature:label,paid,expected,amount:Math.abs(e),
      why:`Le montant global versé pour « ${label} » est inférieur au montant attendu. Merci de vérifier la règle ou le palier appliqué.`,
      sourceLabel:label,key:`global|${label.toLowerCase()}`
    });
  });

  return items;
}

function collectPalierImpact(src,missing,ledger){
  if((missing||[]).length!==1)return[];
  const rows=[];
  (src?.data?.globalRows||[]).forEach(r=>{
    const e=R(r?.ecart);
    const label=S(r?.label);
    if(!r?.money||!(e<-.99)||!/(palier|volume.*vente|vente.*volume|prime.*vente|bonus.*vente)/i.test(label))return;
    const key=`global|${label.toLowerCase()}`;
    rows.push({
      label,paid:R(r?.dco),expected:R(r?.tbr),amount:Math.abs(e),
      includedInConfirmed:(ledger||[]).some(x=>x.key===key)
    });
  });
  return rows;
}

function readMatchedAmounts(src,salesByNum,num,ordinaryLedger){
  const n=normNum(num);
  const expected=blankAmounts();
  const paid=blankAmounts();
  const analysis=(src?.data?.analyses||[]).find(a=>a&&a.type!=='missing_dco'&&normNum(a.num)===n)||null;

  const add=(label,dco,tbr)=>{
    const key=componentKey(label);
    if(!key)return;
    if(key==='installation'&&!ownsInstallation(salesByNum,n))return;
    paid[key]=Math.max(paid[key],R(dco));
    expected[key]=Math.max(expected[key],R(tbr));
  };
  (analysis?.lines||[]).forEach(l=>add(l?.label,l?.dco,l?.tbr));

  const installSource=(src?.data?.installationIssues&&src.data.installationIssues.length)?src.data.installationIssues:(src?.data?.installationCandidates||[]);
  (installSource||[]).filter(x=>normNum(x?.num)===n).forEach(x=>add('Installation',x?.dco,x?.tbr));

  (ordinaryLedger||[]).filter(x=>normNum(x?.num)===n).forEach(x=>add(x?.nature,x?.paid,x?.expected));

  const shortage={
    sale:R(Math.max(0,expected.sale-paid.sale)),
    packs:R(Math.max(0,expected.packs-paid.packs)),
    installation:R(Math.max(0,expected.installation-paid.installation))
  };
  const overpaid={
    sale:R(Math.max(0,paid.sale-expected.sale)),
    packs:R(Math.max(0,paid.packs-expected.packs)),
    installation:R(Math.max(0,paid.installation-expected.installation))
  };
  return{analysis,expected,paid,shortage,overpaid};
}

function collectClients(src,sales,activeSales,missingSales,ordinaryLedger){
  const allSales=allSaleMap(sales);
  const dcoSet=dcoNumberSet(src);
  const dcoIds=dcoIdentityMap(src);
  const missingByNum=new Map((missingSales||[]).map(x=>[normNum(x.num),x]));
  const clients=[];
  const seen=new Set();

  allSales.forEach((sale,n)=>{
    if(seen.has(n))return;
    seen.add(n);
    const base={
      num:n,
      name:S(sale?.nomClient)||dcoIds.get(n)?.name||'Client',
      type:S(sale?.catpub||sale?.typeDco||sale?.typeVente)||dcoIds.get(n)?.type||'',
      date:S(sale?.dateVente||sale?.dateInstallation),
      installationOwned:!!(sale?.installation===true&&!sale?.annulation),
      partner:!!sale?.partenaire
    };

    if(sale?.annulation){
      clients.push({...base,status:'cancelled',expected:blankAmounts(),paid:blankAmounts(),shortage:blankAmounts(),shortageTotal:0,overpaid:blankAmounts(),overpaidTotal:0});
      return;
    }

    const missing=missingByNum.get(n);
    if(missing){
      const expected=blankAmounts();
      (missing.components||[]).forEach(c=>{const key=componentKey(c?.nature);if(key)expected[key]=R(c?.expected);});
      const shortage={...expected};
      clients.push({...base,status:'missing_dco',expected,paid:blankAmounts(),shortage,shortageTotal:amountTotal(shortage),overpaid:blankAmounts(),overpaidTotal:0,directTotal:R(missing.directTotal)});
      return;
    }

    if(dcoSet.has(n)){
      const amounts=readMatchedAmounts(src,activeSales,n,ordinaryLedger);
      clients.push({...base,status:'matched',expected:amounts.expected,paid:amounts.paid,shortage:amounts.shortage,shortageTotal:amountTotal(amounts.shortage),overpaid:amounts.overpaid,overpaidTotal:amountTotal(amounts.overpaid)});
      return;
    }

    clients.push({...base,status:'missing_dco',expected:blankAmounts(),paid:blankAmounts(),shortage:blankAmounts(),shortageTotal:0,overpaid:blankAmounts(),overpaidTotal:0,directTotal:0});
  });

  dcoIds.forEach((identity,n)=>{
    if(seen.has(n))return;
    seen.add(n);
    const amounts=readMatchedAmounts(src,activeSales,n,ordinaryLedger);
    clients.push({
      num:n,name:identity.name,type:identity.type,date:'',status:'missing_tbr',
      installationOwned:false,partner:false,
      expected:amounts.expected,paid:amounts.paid,shortage:blankAmounts(),shortageTotal:0,overpaid:blankAmounts(),overpaidTotal:0
    });
  });

  return clients;
}

function build(input={}){
  const src=input.src||null;
  const sales=Array.isArray(input.sales)?input.sales:[];
  const activeSales=activeSaleMap(sales);
  const missingSales=collectMissing(src,activeSales);
  const ledger=collectLedger(src,activeSales,missingSales,input.formatMoney);
  const ordinaryLedger=ledger.filter(x=>x.scope==='client');
  const globalLedger=ledger.filter(x=>x.scope==='global');
  const palierImpact=collectPalierImpact(src,missingSales,ledger);
  const clients=collectClients(src,sales,activeSales,missingSales,ordinaryLedger);
  const confirmed=R(ledger.reduce((s,x)=>s+R(x.amount),0));
  const missingPotential=R(missingSales.reduce((s,x)=>s+R(x.directTotal),0));
  const clientOverpaid=R(clients.filter(c=>c.status==='matched').reduce((sum,c)=>sum+R(c.overpaidTotal),0));
  const globalOverpaid=R((src?.data?.globalRows||[])
    .filter(r=>r?.money&&R(r?.ecart)>.99&&!isAggregateDuplicate(r?.label))
    .reduce((sum,r)=>sum+R(r.ecart),0));
  const overpaid=R(clientOverpaid+globalOverpaid);

  const missingStatusExclusive=missingSales.every(m=>{
    const n=normNum(m.num);
    return clients.some(c=>c.num===n&&c.status==='missing_dco')&&!ordinaryLedger.some(x=>normNum(x.num)===n);
  });
  const uniqueClientStatus=new Set(clients.map(c=>c.num)).size===clients.length;

  return{
    version:VERSION,
    month:input.month||null,
    clients,
    ordinaryLedger,
    missingSales,
    globalLedger,
    ledger,
    palierImpact,
    totals:{confirmed,missingPotential,overpaid},
    invariants:{
      missingExcludedFromOrdinary:missingStatusExclusive,
      missingStatusExclusive,
      uniqueClientStatus,
      confirmedEqualsLedger:Math.abs(confirmed-R(ledger.reduce((s,x)=>s+R(x.amount),0)))<0.01,
      noComponentNetting:ordinaryLedger.every(x=>R(x.amount)===R(Math.max(0,R(x.expected)-R(x.paid)))),
      noCrossNetting:clients.filter(c=>c.status==='matched').every(c=>['sale','packs','installation'].every(k=>!(R(c.shortage?.[k])>.99&&R(c.overpaid?.[k])>.99)))
    }
  };
}

return{VERSION,build,normNum,natureFor,componentKey};
});
