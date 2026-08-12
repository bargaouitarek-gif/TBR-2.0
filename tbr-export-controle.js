/* TBR 2.0 — chargeur Contrôle DCO Expert + export lecture seule. */
(function(){
  const VERSION='3.0.1';
  function parse(v){try{return JSON.parse(v)}catch{return null}}
  function sale(v){if(!v||typeof v!=='object'||Array.isArray(v))return false;const k=Object.keys(v).map(x=>x.toLowerCase());return k.some(x=>/numclient|client|nomclient/.test(x))&&k.some(x=>/date|statut|vd|vf|pack|commission|installation|abo/.test(x))}
  function collect(v,out,p){if(Array.isArray(v)){v.forEach((x,i)=>collect(x,out,p+'['+i+']'));return}if(!v||typeof v!=='object')return;if(sale(v)){out.push({source:p,data:v});return}Object.entries(v).forEach(([k,x])=>collect(x,out,p+'.'+k))}
  function snapshot(){const storage={},rows=[],seen=new Set(),ventes=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i),v=parse(localStorage.getItem(k));if(v!==null){storage[k]=v;collect(v,rows,'localStorage.'+k)}}rows.forEach(r=>{const v=r.data||{},id=[v.numClient||v.numeroClient||v.clientId||v.id||'',v.dateVente||v.dateInstallation||v.date||'',v.nomClient||v.client||v.nom||''].join('|');const key=id!=='||'?id:JSON.stringify(v);if(!seen.has(key)){seen.add(key);ventes.push(r)}});return{format:'TBR_DCO_AUDIT_EXPORT',formatVersion:VERSION,exportedAt:new Date().toISOString(),saleCount:ventes.length,ventes,localStorage:storage}}
  function download(){const d=snapshot(),b=new Blob([JSON.stringify(d,null,2)],{type:'application/json;charset=utf-8'}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download='TBR-controle-DCO-'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);return d}
  window.TBR_DCO_EXPORT={version:VERSION,snapshot,download};
  window.__TBR_BUILD=Object.assign({},window.__TBR_BUILD||{},{dco:VERSION,loadedAt:new Date().toISOString()});
  function boot(){
    const old=document.getElementById('tbr-dco-pro-layout');if(old)old.remove();
    ['tbr-dco-export-panel','tbr-dco-export-floating','tbr-release-confirmation','tbr-dco-inline-tools'].forEach(id=>{const n=document.getElementById(id);if(n)n.remove()});
    if(!document.querySelector('script[data-tbr-dco-expert]')){const s=document.createElement('script');s.src='/tbr-dco-expert.js?v='+VERSION;s.dataset.tbrDcoExpert='1';(document.head||document.documentElement).appendChild(s)}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
