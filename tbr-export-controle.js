/* TBR 2.0 — Contrôle DCO intégré + export lecture seule. */
(function(){
  const VERSION='2.0.1';
  const STYLE_ID='tbr-dco-pro-layout';
  const TOOLBAR_ID='tbr-dco-inline-tools';

  function safeParse(value){try{return JSON.parse(value)}catch(_){return null}}
  function looksLikeSale(v){
    if(!v||typeof v!=='object'||Array.isArray(v)) return false;
    const keys=Object.keys(v).map(k=>k.toLowerCase());
    return keys.some(k=>/numclient|client|nomclient/.test(k)) && keys.some(k=>/date|statut|vd|vf|pack|commission|installation|abo/.test(k));
  }
  function collectSales(value,out,path){
    if(Array.isArray(value)){value.forEach((v,i)=>collectSales(v,out,path+'['+i+']'));return;}
    if(!value||typeof value!=='object') return;
    if(looksLikeSale(value)){out.push({source:path,data:value});return;}
    Object.entries(value).forEach(([k,v])=>collectSales(v,out,path+'.'+k));
  }
  function snapshot(){
    const storage={}, rows=[], seen=new Set(), ventes=[];
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i), parsed=safeParse(localStorage.getItem(key));
      if(parsed!==null){storage[key]=parsed;collectSales(parsed,rows,'localStorage.'+key);}
    }
    rows.forEach(r=>{
      const v=r.data||{};
      const composite=[v.numClient||v.numeroClient||v.clientId||v.id||'',v.dateVente||v.dateInstallation||v.date||'',v.nomClient||v.client||v.nom||''].join('|');
      const id=composite!=='||'?composite:JSON.stringify(v);
      if(!seen.has(id)){seen.add(id);ventes.push(r);}
    });
    return {format:'TBR_DCO_AUDIT_EXPORT',formatVersion:VERSION,exportedAt:new Date().toISOString(),saleCount:ventes.length,ventes,localStorage:storage};
  }
  function download(){
    const data=snapshot();
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'});
    const url=URL.createObjectURL(blob), a=document.createElement('a');
    a.href=url;a.download='TBR-controle-DCO-'+new Date().toISOString().slice(0,10)+'.json';
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    return data;
  }
  window.TBR_DCO_EXPORT={version:VERSION,snapshot,download};

  function ensureStyles(){
    if(document.getElementById(STYLE_ID)) return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      .dco-v9{display:grid!important;grid-template-columns:1fr!important;gap:16px!important;max-width:1180px!important;margin:0 auto!important;padding-bottom:24px!important}
      .dco-v9>.dco-hero{order:0!important;padding:26px!important;border-radius:28px!important;background:radial-gradient(circle at 8% 0%,rgba(34,211,238,.18),transparent 34%),radial-gradient(circle at 96% 0%,rgba(99,102,241,.20),transparent 38%),linear-gradient(135deg,#07111f,#101a33)!important;border:1px solid rgba(148,163,184,.18)!important;box-shadow:0 24px 68px rgba(2,6,23,.24)!important}
      .dco-v9>.dco-hero h2{max-width:760px!important;font-size:clamp(24px,5vw,38px)!important;line-height:1.02!important;letter-spacing:-.055em!important;margin:6px 0 10px!important;color:#f8fafc!important}
      .dco-v9>.dco-hero p{max-width:760px!important;font-size:14px!important;line-height:1.5!important;color:#cbd5e1!important}
      #${TOOLBAR_ID}{order:1;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;align-items:center;padding:17px 18px;border-radius:22px;background:rgba(8,17,31,.96);border:1px solid rgba(56,189,248,.22);box-shadow:0 16px 42px rgba(2,6,23,.18)}
      #${TOOLBAR_ID} .tbr-dco-release{display:flex;align-items:center;flex-wrap:wrap;gap:7px;margin-bottom:9px}
      #${TOOLBAR_ID} .tbr-dco-release span{display:inline-flex;align-items:center;min-height:24px;padding:4px 9px;border-radius:999px;background:linear-gradient(135deg,#06b6d4,#4f46e5);color:#fff;font:950 10px/1 system-ui,-apple-system,sans-serif;letter-spacing:.08em;text-transform:uppercase;box-shadow:0 7px 18px rgba(37,99,235,.22)}
      #${TOOLBAR_ID} .tbr-dco-release b{color:#e0f2fe;font:950 12px/1.15 system-ui,-apple-system,sans-serif}
      #${TOOLBAR_ID} .tbr-dco-release small{color:#64748b;font:800 10px/1.15 system-ui,-apple-system,sans-serif}
      #${TOOLBAR_ID} .tbr-dco-tools-copy>strong{display:block;color:#f8fafc;font:900 16px/1.2 system-ui,-apple-system,sans-serif}
      #${TOOLBAR_ID} .tbr-dco-tools-copy>span{display:block;margin-top:5px;color:#94a3b8;font:750 12px/1.35 system-ui,-apple-system,sans-serif}
      #${TOOLBAR_ID} button{border:0;border-radius:15px;padding:13px 16px;background:linear-gradient(135deg,#0284c7,#4f46e5);color:#fff;font:900 13px/1.2 system-ui,-apple-system,sans-serif;box-shadow:0 10px 24px rgba(2,132,199,.28);cursor:pointer;white-space:nowrap}
      #${TOOLBAR_ID} button:active{transform:translateY(1px)}
      .dco-v9>.dco-verdict{order:2!important;display:grid!important;grid-template-columns:minmax(0,1.3fr) minmax(240px,.7fr)!important;gap:16px!important;padding:22px!important;border-radius:24px!important;background:linear-gradient(135deg,rgba(8,17,31,.97),rgba(15,23,42,.93))!important;border:1px solid rgba(148,163,184,.18)!important;box-shadow:0 18px 50px rgba(2,6,23,.18)!important}
      .dco-v9>.dco-card{border-radius:24px!important;padding:20px!important;background:linear-gradient(145deg,rgba(8,17,31,.96),rgba(15,23,42,.92))!important;border:1px solid rgba(148,163,184,.18)!important;box-shadow:0 16px 44px rgba(2,6,23,.14)!important;color:#e5eefb!important}
      .dco-v9 .dco-title{font-size:18px!important;font-weight:950!important;letter-spacing:-.025em!important;color:#f8fafc!important}
      .dco-v9 .dco-sub{margin-top:5px!important;color:#94a3b8!important;font-size:12px!important;line-height:1.45!important}
      .dco-v9 .dco-line{padding:13px 0!important;border-top-color:rgba(148,163,184,.12)!important}
      .dco-v9 .dco-line span,.dco-v9 .dco-client summary span,.dco-v9 .dco-client p{color:#94a3b8!important}
      .dco-v9 .dco-line b,.dco-v9 .dco-client summary strong,.dco-v9 .dco-client summary b{color:#e5eefb!important}
      .dco-v9 .dco-client{border-radius:18px!important;background:rgba(15,23,42,.74)!important;border-color:rgba(148,163,184,.14)!important}
      .dco-v9 .dco-client.ok{background:rgba(5,46,22,.34)!important;border-color:rgba(34,197,94,.22)!important}
      .dco-v9 .dco-client.warning{background:rgba(69,26,3,.34)!important;border-color:rgba(251,146,60,.24)!important}
      .dco-v9 .dco-client.danger{background:rgba(69,10,10,.34)!important;border-color:rgba(248,113,113,.24)!important}
      .dco-v9 .dco-detail-line{background:rgba(2,6,23,.54)!important;border-color:rgba(148,163,184,.12)!important}
      .dco-v9 .dco-detail-line span{color:#cbd5e1!important}.dco-v9 .dco-detail-line b{color:#f8fafc!important}
      @media(min-width:900px){.dco-v9{grid-template-columns:repeat(2,minmax(0,1fr))!important}.dco-v9>.dco-hero,.dco-v9>#${TOOLBAR_ID},.dco-v9>.dco-verdict{grid-column:1/-1!important}.dco-v9>.dco-card:last-child{grid-column:1/-1!important}}
      @media(max-width:700px){#${TOOLBAR_ID}{grid-template-columns:1fr!important}#${TOOLBAR_ID} button{width:100%!important}.dco-v9>.dco-verdict{grid-template-columns:1fr!important}.dco-v9>.dco-card{padding:16px!important}.dco-v9>.dco-hero{padding:20px!important}}
    `;
    (document.head||document.documentElement).appendChild(style);
  }

  function mountInlineTools(){
    ensureStyles();
    const root=document.querySelector('.dco-v9');
    if(!root) return false;
    const oldPanel=document.getElementById('tbr-dco-export-panel');if(oldPanel) oldPanel.remove();
    const oldFloating=document.getElementById('tbr-dco-export-floating');if(oldFloating) oldFloating.remove();
    let tools=document.getElementById(TOOLBAR_ID);
    if(!tools){
      tools=document.createElement('section');
      tools.id=TOOLBAR_ID;
      tools.innerHTML='<div class="tbr-dco-tools-copy"><div class="tbr-dco-release"><span>Nouveau</span><b>Contrôle DCO 2.0</b><small>v2.0.1 · 12 août 2026</small></div><strong>Contrôle DCO</strong><span>Audit des commissions et export des données TBR pour vérification détaillée.</span></div><button type="button" id="tbr-dco-export-action">⬇ Exporter les données TBR</button>';
      const hero=root.querySelector(':scope > .dco-hero');
      if(hero&&hero.nextSibling) root.insertBefore(tools,hero.nextSibling); else root.prepend(tools);
      const button=tools.querySelector('#tbr-dco-export-action');
      button.addEventListener('click',()=>{
        const data=download(), previous=button.textContent;
        button.textContent='✓ Export créé · '+data.saleCount+' vente(s) détectée(s)';
        setTimeout(()=>{if(button.isConnected) button.textContent=previous;},3500);
      });
    }else if(tools.parentElement!==root){root.insertBefore(tools,root.firstChild);}
    return true;
  }

  function boot(){
    ensureStyles();
    mountInlineTools();
    const observer=new MutationObserver(()=>mountInlineTools());
    observer.observe(document.documentElement,{childList:true,subtree:true});
    setInterval(mountInlineTools,1500);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();
