/* TBR 2.0 — Export des ventes pour contrôle DCO
   Branche de test : feature/export-ventes-dco
   N'altère aucune donnée : lecture localStorage uniquement. */
(function(){
  const VERSION="1.0.0";

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
    if(looksLikeSale(value)){out.push({source:path,data:value});return;}
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
      seen.add(id);return true;
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
      // Copie brute incluse pour permettre un contrôle complet même si un champ TBR change de nom.
      localStorage:storage
    };
  }
  function download(){
    const data=snapshot();
    const stamp=new Date().toISOString().slice(0,10);
    const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;a.download="TBR-controle-DCO-"+stamp+".json";
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    return data;
  }
  window.TBR_DCO_EXPORT={version:VERSION,snapshot,download};

  function mount(){
    if(document.getElementById("tbr-dco-export-floating")) return;
    const btn=document.createElement("button");
    btn.id="tbr-dco-export-floating";
    btn.type="button";
    btn.textContent="Exporter mes ventes pour contrôle";
    btn.style.cssText="position:fixed;right:14px;bottom:92px;z-index:9999;border:1px solid rgba(56,189,248,.35);border-radius:16px;padding:12px 14px;background:linear-gradient(135deg,#0ea5e9,#4f46e5);color:white;font:800 12px system-ui;box-shadow:0 14px 35px rgba(2,6,23,.35);cursor:pointer";
    btn.onclick=()=>{
      const d=download();
      const old=btn.textContent;
      btn.textContent="Export prêt · "+d.saleCount+" vente(s) détectée(s)";
      setTimeout(()=>btn.textContent=old,3500);
    };
    document.body.appendChild(btn);
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",mount); else mount();
})();
