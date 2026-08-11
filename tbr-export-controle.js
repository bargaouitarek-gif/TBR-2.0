/* TBR 2.0 — Export des ventes pour contrôle DCO
   Lecture seule : aucune donnée TBR n'est modifiée. */
(function(){
  const VERSION="1.1.0";

  function safeParse(value){
    try{return JSON.parse(value);}catch(_){return null;}
  }

  function looksLikeSale(v){
    if(!v||typeof v!=="object"||Array.isArray(v)) return false;
    const keys=Object.keys(v).map(k=>k.toLowerCase());
    return keys.some(k=>/numclient|client|nomclient/.test(k)) &&
      keys.some(k=>/date|statut|vd|vf|pack|commission|installation|abo/.test(k));
  }

  function collectSales(value,out,path){
    if(Array.isArray(value)){
      value.forEach((v,i)=>collectSales(v,out,path+"["+i+"]"));
      return;
    }
    if(!value||typeof value!=="object") return;
    if(looksLikeSale(value)){
      out.push({source:path,data:value});
      return;
    }
    Object.entries(value).forEach(([k,v])=>collectSales(v,out,path+"."+k));
  }

  function dedupe(rows){
    const seen=new Set();
    return rows.filter(r=>{
      const v=r.data||{};
      const key=String(v.numClient||v.numeroClient||v.clientId||v.id||"")+"|"+
        String(v.dateVente||v.dateInstallation||v.date||"")+"|"+
        String(v.nomClient||v.client||v.nom||"");
      const fallback=JSON.stringify(v);
      const id=key!=="||"?key:fallback;
      if(seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  function snapshot(){
    const storage={};
    const sales=[];
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i);
      const raw=localStorage.getItem(key);
      const parsed=safeParse(raw);
      if(parsed!==null){
        storage[key]=parsed;
        collectSales(parsed,sales,"localStorage."+key);
      }
    }
    const unique=dedupe(sales);
    return {
      format:"TBR_DCO_AUDIT_EXPORT",
      formatVersion:VERSION,
      exportedAt:new Date().toISOString(),
      appVersion:(typeof APP_VERSION!=="undefined"?APP_VERSION:null),
      saleCount:unique.length,
      ventes:unique,
      localStorage:storage
    };
  }

  function download(){
    const data=snapshot();
    const stamp=new Date().toISOString().slice(0,10);
    const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;
    a.download="TBR-controle-DCO-"+stamp+".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    return data;
  }

  window.TBR_DCO_EXPORT={version:VERSION,snapshot,download};

  function mount(){
    if(!document.body) return;
    if(document.getElementById("tbr-dco-export-floating")) return;

    const btn=document.createElement("button");
    btn.id="tbr-dco-export-floating";
    btn.type="button";
    btn.setAttribute("aria-label","Exporter mes ventes pour contrôle DCO");
    btn.textContent="⬇ Exporter mes ventes pour contrôle DCO";
    btn.style.cssText=[
      "position:fixed",
      "left:50%",
      "bottom:126px",
      "transform:translateX(-50%)",
      "width:min(520px,calc(100vw - 36px))",
      "z-index:2147483647",
      "border:1px solid rgba(125,211,252,.65)",
      "border-radius:18px",
      "padding:15px 18px",
      "background:linear-gradient(135deg,#0284c7,#4f46e5)",
      "color:#fff",
      "font:800 14px/1.2 -apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif",
      "letter-spacing:.1px",
      "box-shadow:0 16px 42px rgba(2,132,199,.42),0 4px 14px rgba(0,0,0,.35)",
      "cursor:pointer",
      "visibility:visible",
      "opacity:1",
      "pointer-events:auto"
    ].join(";");

    btn.onclick=()=>{
      const data=download();
      const old=btn.textContent;
      btn.textContent="✓ Export créé · "+data.saleCount+" vente(s) détectée(s)";
      setTimeout(()=>{ if(btn.isConnected) btn.textContent=old; },4000);
    };

    document.body.appendChild(btn);
  }

  function keepMounted(){
    mount();
    if(document.documentElement && typeof MutationObserver!=="undefined"){
      const observer=new MutationObserver(()=>{
        if(!document.getElementById("tbr-dco-export-floating")) mount();
      });
      observer.observe(document.documentElement,{childList:true,subtree:true});
    }
    setInterval(mount,2000);
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",keepMounted,{once:true});
  }else{
    keepMounted();
  }
})();
