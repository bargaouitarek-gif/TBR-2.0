/* TBR 2.0 — DCO structural parser 1.0.0 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  if(root) root.TBR_DCO_PARSER=api;
})(typeof window!=='undefined'?window:globalThis,function(){
'use strict';

const VERSION='1.0.0';
const CAT_RX=/^(REFVD|REFVF|PURVD|PURVF|PREVD|PREVF|RMK|PURGU|DIS)$/i;
const CLIENT_RX=/^\d{6,8}$/;
const NUM_RX=/^-?\d+(?:[,.]\d+)?$/;
const R=v=>Math.round((Number(v)||0)*100)/100;
const S=v=>String(v==null?'':v).trim();
const N=v=>{
  const n=parseFloat(S(v).replace(/[€\s]/g,'').replace(',','.'));
  return Number.isFinite(n)?n:0;
};
const textOf=lines=>Array.isArray(lines)?lines.join(' '):S(lines);

function clusterXs(xs,tolerance=25){
  const sorted=(xs||[]).filter(Number.isFinite).sort((a,b)=>a-b);
  const clusters=[];
  sorted.forEach(x=>{
    const last=clusters[clusters.length-1];
    if(!last||Math.abs(x-last.mean)>tolerance){
      clusters.push({values:[x],mean:x});
      return;
    }
    last.values.push(x);
    last.mean=last.values.reduce((s,v)=>s+v,0)/last.values.length;
  });
  return clusters.map(c=>c.mean);
}

function anchors(items){
  return (items||[])
    .filter(it=>CLIENT_RX.test(S(it?.str))&&Number.isFinite(Number(it?.x))&&Number.isFinite(Number(it?.y)))
    .map(it=>({x:Number(it.x),y:Number(it.y),str:S(it.str)}))
    .sort((a,b)=>a.y-b.y);
}

function bands(items){
  const a=anchors(items);
  return a.map((c,idx)=>{
    const prev=a[idx-1],next=a[idx+1];
    const low=prev?(prev.y+c.y)/2:c.y-18;
    const high=next?(c.y+next.y)/2:c.y+18;
    return {client:c,items:(items||[]).filter(it=>Number(it?.y)>=low&&Number(it?.y)<high)};
  });
}

function categoryFor(row,client){
  const cats=(row||[]).filter(it=>CAT_RX.test(S(it?.str))&&Number(it?.x)>client.x);
  return cats.sort((a,b)=>Number(a.x)-Number(b.x))[0]||null;
}

function nbFor(row,client,values){
  const left=(row||[])
    .filter(it=>Number(it?.x)<client.x&&/^-?[01]$/.test(S(it?.str)))
    .sort((a,b)=>Number(a.x)-Number(b.x));
  if(left.length)return Number(left[left.length-1].str);
  return (values||[]).some(v=>Math.abs(Number(v)||0)>.0001)?1:0;
}

function nameFor(row,client,cat){
  if(!cat)return'Client';
  const parts=(row||[])
    .filter(it=>Number(it?.x)>client.x+18&&Number(it?.x)<Number(cat.x)-2)
    .filter(it=>!CAT_RX.test(S(it?.str)))
    .sort((a,b)=>Number(b.y)-Number(a.y)||Number(a.x)-Number(b.x))
    .map(it=>S(it.str))
    .filter(Boolean);
  return parts.join(' ').replace(/\s+/g,' ').trim()||'Client';
}

function numericColumns(rowBands,columnCount){
  const xs=[];
  rowBands.forEach(({client,items})=>{
    const cat=categoryFor(items,client);
    if(!cat)return;
    items.forEach(it=>{
      if(Number(it?.x)>Number(cat.x)+15&&NUM_RX.test(S(it?.str)))xs.push(Number(it.x));
    });
  });
  const clusters=clusterXs(xs,25);
  return clusters.slice(-columnCount);
}

function readColumns(row,cat,centers,maxDistance=34){
  const values=new Array(centers.length).fill(null);
  const distances=new Array(centers.length).fill(Infinity);
  (row||[]).forEach(it=>{
    const x=Number(it?.x);
    if(!(x>Number(cat.x)+15)||!NUM_RX.test(S(it?.str)))return;
    let best=-1,bestD=Infinity;
    centers.forEach((c,idx)=>{const d=Math.abs(x-c);if(d<bestD){best=idx;bestD=d;}});
    if(best>=0&&bestD<=maxDistance&&bestD<distances[best]){
      values[best]=N(it.str);
      distances[best]=bestD;
    }
  });
  return values.map(v=>v==null?0:R(v));
}

function baseRow(client,cat,row,values){
  const nb=nbFor(row,client,values);
  return{
    nb,
    num:S(client.str).replace(/\D/g,''),
    nom:nameFor(row,client,cat),
    catpub:S(cat?.str).toUpperCase(),
    engagement:0,
    offre:'',
    isAnnulation:nb<=0
  };
}

function parseCompactSales(items){
  const rb=bands(items).filter(({client,items:row})=>!!categoryFor(row,client));
  const centers=numericColumns(rb,3);
  if(centers.length!==3)throw new Error('Colonnes DCO compact non reconnues');
  const rows=rb.map(({client,items:row})=>{
    const cat=categoryFor(row,client);
    const [caPacks,comVente,comPacks]=readColumns(row,cat,centers);
    return{
      ...baseRow(client,cat,row,[caPacks,comVente,comPacks]),
      caPacks,comVente,comPacks,comPacksRaw:comPacks,
      comBase:comVente,startVD:0,minoIntegrale:0,aboFixe:0,aboVariable:0,
      packDerived:false
    };
  });
  return{rows,centers};
}

function parseDetailedSales(items){
  const rb=bands(items).filter(({client,items:row})=>!!categoryFor(row,client));
  const centers=numericColumns(rb,6);
  if(centers.length!==6)throw new Error('Colonnes DCO détaillées non reconnues');
  const rows=rb.map(({client,items:row})=>{
    const cat=categoryFor(row,client);
    const [caPacks,comBase,startVD,minoIntegrale,aboFixe,aboVariable]=readColumns(row,cat,centers);
    const comVente=R(comBase+startVD+minoIntegrale+aboFixe+aboVariable);
    const comPacksRaw=caPacks*0.25;
    const comPacks=R(comPacksRaw);
    return{
      ...baseRow(client,cat,row,[caPacks,comBase,startVD,minoIntegrale,aboFixe,aboVariable]),
      caPacks,comVente,comPacks,comPacksRaw,comBase,startVD,minoIntegrale,aboFixe,aboVariable,
      packDerived:true
    };
  });
  return{rows,centers};
}

function parseRecapSales(items){
  const rb=bands(items).filter(({client,items:row})=>!!categoryFor(row,client));
  const centers=numericColumns(rb,3);
  if(centers.length!==3)throw new Error('Colonnes récapitulatives DCO non reconnues');
  const installs={};
  const rows=rb.map(({client,items:row})=>{
    const cat=categoryFor(row,client);
    const [comVente,comPacks,install]=readColumns(row,cat,centers);
    const base=baseRow(client,cat,row,[comVente,comPacks,install]);
    installs[base.num]=R(install);
    return{...base,caPacks:0,comVente,comPacks,comPacksRaw:comPacks,comBase:comVente,startVD:0,minoIntegrale:0,aboFixe:0,aboVariable:0,packDerived:false};
  });
  return{rows,installs,centers};
}

function parseInstallPage(items){
  const rb=bands(items);
  const xs=[];
  rb.forEach(({client,items:row})=>row.forEach(it=>{
    if(Number(it?.x)>client.x+80&&NUM_RX.test(S(it?.str)))xs.push(Number(it.x));
  }));
  const clusters=clusterXs(xs,25);
  const center=clusters[clusters.length-1];
  if(!Number.isFinite(center))return{};
  const out={};
  rb.forEach(({client,items:row})=>{
    const vals=(row||[])
      .filter(it=>NUM_RX.test(S(it?.str))&&Math.abs(Number(it.x)-center)<=36)
      .sort((a,b)=>Math.abs(Number(a.x)-center)-Math.abs(Number(b.x)-center));
    out[S(client.str).replace(/\D/g,'')]=vals.length?R(N(vals[0].str)):0;
  });
  return out;
}

function detect(pageLines){
  const texts=(pageLines||[]).map(textOf);
  const salesPages=texts.map((t,i)=>({t,i})).filter(x=>/DETAILS\s+SUR\s+LES\s+COMMISSIONS\s+DES\s+VENTES/i.test(x.t));
  const detailed=salesPages.find(x=>/Start\s*VD|Mino\s*Int[ée]grale|ABO\s*(?:fixe|variable)/i.test(x.t));
  const compact=salesPages.find(x=>/(?:CA\s*base|one\s*shot)/i.test(x.t)&&!/Start\s*VD|Mino\s*Int[ée]grale|ABO\s*(?:fixe|variable)/i.test(x.t));
  const recap=texts.findIndex(t=>/R[ée]capitulatif.*commissions.*ventes/i.test(t)&&/COM\s*installation/i.test(t));
  const installDetails=texts.findIndex(t=>/DETAILS\s+SUR\s+LES\s+COMMISSIONS\s+DES\s+INSTALLATIONS/i.test(t));
  const packsDetails=texts.findIndex(t=>/DETAILS\s+SUR\s+LES\s+COMMISSIONS\s+DES\s+PACKS/i.test(t));
  if(detailed)return{format:'detailed',salesPage:detailed.i,installPage:recap>=0?recap:installDetails,packsPage:packsDetails,recapPage:recap};
  if(compact)return{format:'compact',salesPage:compact.i,installPage:installDetails>=0?installDetails:recap,packsPage:packsDetails,recapPage:recap};
  if(recap>=0)return{format:'recap',salesPage:recap,installPage:recap,packsPage:packsDetails,recapPage:recap};
  return{format:'unknown',salesPage:-1,installPage:-1,packsPage:packsDetails,recapPage:recap};
}

function validate(summary,rows,installs,format){
  const sum=v=>R((v||[]).reduce((s,x)=>s+Number(x||0),0));
  const activeRows=(rows||[]).filter(r=>!r.isAnnulation&&Number(r.nb)>0);
  const grossRows=sum((rows||[]).map(r=>Math.max(0,Number(r.nb)||0)));
  const annulRows=sum((rows||[]).map(r=>Math.min(0,Number(r.nb)||0)));
  const netRows=sum((rows||[]).map(r=>Number(r.nb)||0));
  const saleDetail=sum((rows||[]).map(r=>r.comVente));
  const packsDetail=sum((rows||[]).map(r=>r.comPacksRaw!=null?r.comPacksRaw:r.comPacks));
  const installDetail=sum(Object.values(installs||{}));
  const check=(name,actual,expected,tolerance=.011,critical=true)=>({name,actual:R(actual),expected:R(expected),ok:Math.abs(R(actual)-R(expected))<=tolerance,critical});
  const checks=[];
  if(Number(summary?.vBrutes)||Number(summary?.vBrutes)===0)checks.push(check('ventesBrutes',grossRows,summary.vBrutes,.011,true));
  if(Number(summary?.annuls)||Number(summary?.annuls)===0)checks.push(check('annulations',annulRows,summary.annuls,.011,true));
  if(Number(summary?.vNettes)||Number(summary?.vNettes)===0)checks.push(check('ventesNettes',netRows,summary.vNettes,.011,true));
  if(Number(summary?.comVentes)||Number(summary?.comVentes)===0)checks.push(check('commissionVentes',saleDetail,summary.comVentes,.011,true));
  if(Number(summary?.comPacks)||Number(summary?.comPacks)===0)checks.push(check('commissionPacks',packsDetail,summary.comPacks,.02,true));
  if(Number(summary?.comInstall)||Number(summary?.comInstall)===0)checks.push(check('commissionInstallations',installDetail,summary.comInstall,.011,true));
  const failed=checks.filter(c=>!c.ok);
  return{
    format,
    rows:rows.length,
    activeRows:activeRows.length,
    totals:{grossRows,annulRows,netRows,saleDetail,packsDetail,installDetail},
    checks,
    failed,
    claimSafe:failed.filter(c=>c.critical).length===0
  };
}

function parseDocument(input={}){
  const pageLines=input.pageLines||[];
  const pageItemsByIndex=input.pageItemsByIndex||{};
  const summary=input.summary||{};
  const schema=detect(pageLines);
  if(schema.format==='unknown'||schema.salesPage<0)throw new Error('Format DCO non reconnu : colonnes de rémunération introuvables');
  const salesItems=pageItemsByIndex[schema.salesPage]||[];
  let parsed;
  if(schema.format==='compact')parsed=parseCompactSales(salesItems);
  else if(schema.format==='detailed')parsed=parseDetailedSales(salesItems);
  else parsed=parseRecapSales(salesItems);
  let installs=parsed.installs||{};
  if(schema.installPage>=0&&schema.installPage!==schema.salesPage){
    installs=parseInstallPage(pageItemsByIndex[schema.installPage]||[]);
  }else if(schema.format==='detailed'&&schema.recapPage>=0){
    installs=parseInstallPage(pageItemsByIndex[schema.recapPage]||[]);
  }
  const integrity=validate(summary,parsed.rows,installs,schema.format);
  return{version:VERSION,schema,rows:parsed.rows,installs,integrity};
}

return{VERSION,detect,parseDocument,parseCompactSales,parseDetailedSales,parseRecapSales,parseInstallPage,validate};
});