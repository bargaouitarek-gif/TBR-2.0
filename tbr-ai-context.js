(()=>{
  if(window.TBR_AI_CONTEXT) return;

  const VERSION="2026.08.20-context-v1";
  const EXCLUDED=new Set(["tbr.ai.accessCode","tbr.ai.history.v2"]);
  const MATCH={
    ventes:/vente|sales|client|pv/i,
    dco:/dco|commission|remuner|rémunér|paie|paye/i,
    memoires:/memoire|mémoire|memory/i,
    documents:/document|pdf|contrat|proposition|pv/i,
    objectifs:/objectif|target|challenge|palier|performance/i,
    rendezVous:/rendez|rdv|appointment|agenda/i,
    mois:/mois|month|periode|période/i
  };

  function clone(v){try{return JSON.parse(JSON.stringify(v));}catch{return null;}}
  function parse(raw){if(typeof raw!=="string")return raw;try{return JSON.parse(raw);}catch{return raw;}}
  function arr(v,max){return Array.isArray(v)?clone(v.slice(-max))||[]:[];}
  function objectArrayScore(a,keys){if(!Array.isArray(a)||!a.length)return 0;return a.slice(-30).reduce((n,x)=>n+(x&&typeof x==="object"&&keys.some(k=>k in x)?1:0),0);}

  function readStorage(){
    const out={};
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i);
      if(!key||EXCLUDED.has(key))continue;
      const relevant=Object.values(MATCH).some(rx=>rx.test(key));
      if(!relevant)continue;
      const raw=localStorage.getItem(key);
      if(!raw||raw.length>300000)continue;
      out[key]=parse(raw);
    }
    return out;
  }

  function pickArrays(storage,rx){return Object.entries(storage).filter(([k,v])=>rx.test(k)&&Array.isArray(v)).map(([key,value])=>({key,value}));}
  function best(candidates,keys){let winner=null,score=-1;for(const c of candidates){const s=objectArrayScore(c.value,keys);if(s>score){winner=c;score=s;}}return winner;}

  function build(){
    const storage=readStorage();
    const allArrays=Object.entries(storage).filter(([,v])=>Array.isArray(v)).map(([key,value])=>({key,value}));
    const venteCandidates=[...pickArrays(storage,MATCH.ventes),...allArrays];
    const dcoCandidates=[...pickArrays(storage,MATCH.dco),...allArrays];
    const ventes=best(venteCandidates,["numClient","numeroClient","nomClient","client","statut","dateVente","dateInstallation"]);
    const dco=best(dcoCandidates,["attendu","verse","versé","ecart","écart","commission","montant"]);
    const mem=pickArrays(storage,MATCH.memoires)[0];
    const docs=pickArrays(storage,MATCH.documents)[0];
    const rdv=pickArrays(storage,MATCH.rendezVous)[0];
    const objectifs=Object.fromEntries(Object.entries(storage).filter(([k])=>MATCH.objectifs.test(k)));
    let mois=null;
    for(const [k,v] of Object.entries(storage)){if(MATCH.mois.test(k)&&typeof v==="string"&&v.length<80){mois=v;break;}}

    const context={
      schemaVersion:1,
      generatedAt:new Date().toISOString(),
      source:"TBR_AI_CONTEXT",
      page:location.pathname+location.search,
      mois,
      ventes:arr(ventes?.value,350),
      dcoRows:arr(dco?.value,500),
      documents:arr(docs?.value,80),
      memoiresConfirmees:arr(mem?.value,80),
      rendezVous:arr(rdv?.value,150),
      objectifs:clone(objectifs)||{},
      sources:{ventes:ventes?.key||null,dcoRows:dco?.key||null,documents:docs?.key||null,memoiresConfirmees:mem?.key||null,rendezVous:rdv?.key||null}
    };
    return context;
  }

  window.TBR_AI_CONTEXT={version:VERSION,build};
  window.dispatchEvent(new CustomEvent("tbr:ai-context-ready",{detail:{version:VERSION}}));
  console.info("TBR AI Context",VERSION);
})();
