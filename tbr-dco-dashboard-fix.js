/* TBR 2.0 — DCO dashboard bridge 1.1.0 */
(function(){
'use strict';

const VERSION='1.1.0';
const STYLE_ID='tbr-dco-dashboard-bridge-style';
const POTENTIAL_ID='tbr-dco-missing-potential';
const ACTION_ID='tbr-dco-reliable-claim-action';
const MODAL_ID='tbr-dco-reliable-claim-modal';
const R=v=>Math.round((Number(v)||0)*100)/100;
const M=v=>`${Math.abs(R(v)).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})} €`;
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function addStyle(){
  if(document.getElementById(STYLE_ID)) return;
  const s=document.createElement('style');
  s.id=STYLE_ID;
  s.textContent=`
#${POTENTIAL_ID}{margin-top:10px;padding:13px 14px;border:1px solid rgba(251,191,36,.34);border-radius:16px;background:rgba(120,53,15,.16);text-align:center}
#${POTENTIAL_ID} b{display:block;color:#fbbf24;font-size:20px;font-weight:900}
#${POTENTIAL_ID} span{display:block;margin-top:3px;color:#fde68a;font-size:11px;font-weight:800;line-height:1.35}
#${POTENTIAL_ID} small{display:block;margin-top:5px;color:#cbd5e1;font-size:10px;font-weight:700;line-height:1.35}
#${ACTION_ID}{margin-top:10px;width:100%;border:0;border-radius:14px;padding:13px 14px;background:#e8001d;color:#fff;font:900 13px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;box-shadow:0 8px 24px rgba(232,0,29,.22)}
#${MODAL_ID}{position:fixed;inset:0;z-index:999999;background:rgba(2,6,23,.78);display:flex;align-items:flex-end;justify-content:center;padding:14px}
#${MODAL_ID} .panel{width:min(760px,100%);max-height:92vh;overflow:auto;background:#fff;color:#111827;border-radius:22px;padding:16px;box-shadow:0 30px 80px rgba(0,0,0,.35)}
#${MODAL_ID} .head{display:flex;gap:10px;align-items:center;justify-content:space-between;margin-bottom:10px}
#${MODAL_ID} h3{margin:0;font:900 18px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif}
#${MODAL_ID} .meta{font:800 11px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;color:#475569;margin-bottom:10px}
#${MODAL_ID} textarea{width:100%;min-height:56vh;resize:vertical;border:1px solid #cbd5e1;border-radius:14px;padding:12px;font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;background:#f8fafc;color:#111827}
#${MODAL_ID} .actions{display:flex;gap:8px;margin-top:10px}
#${MODAL_ID} button{flex:1;border:0;border-radius:12px;padding:12px;font:900 12px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif}
#${MODAL_ID} .copy{background:#e8001d;color:#fff}
#${MODAL_ID} .close{background:#e2e8f0;color:#0f172a}
`;
  document.head.appendChild(s);
}

function getCanonical(){
  try{
    if(window.TBR_DCO_INTEGRITY && typeof window.TBR_DCO_INTEGRITY.buildMail==='function') return window.TBR_DCO_INTEGRITY.buildMail();
  }catch(_){ }
  return window.__tbrDcoCanonical||null;
}

function allMissing(mail){
  if(!mail||!mail.integrity) return [];
  const map=new Map();
  [...(mail.integrity.missing||[]),...(mail.integrity.removed||[])].forEach(x=>{
    const n=String(x&&x.num||'').replace(/\D/g,'');
    if(n&&!map.has(n)) map.set(n,x);
  });
  return [...map.values()];
}

function openReliableClaim(){
  const mail=getCanonical();
  if(!mail){
    alert('Le moteur DCO fiable n’est pas chargé. Ferme puis rouvre TBR et réessaie.');
    return;
  }
  document.getElementById(MODAL_ID)?.remove();
  addStyle();
  const missing=allMissing(mail);
  const modal=document.createElement('div');
  modal.id=MODAL_ID;
  modal.innerHTML=`<div class="panel"><div class="head"><h3>Réclamation DCO fiable</h3></div><div class="meta">Écarts chiffrés : ${esc(M(mail.total||0))} · Ventes absentes : ${missing.length} · moteur ${esc(window.TBR_DCO_INTEGRITY?.version||'?')} · bridge ${VERSION}</div><textarea spellcheck="false"></textarea><div class="actions"><button class="copy" type="button">Copier le mail</button><button class="close" type="button">Fermer</button></div></div>`;
  document.body.appendChild(modal);
  const ta=modal.querySelector('textarea');
  ta.value=mail.body||'';
  modal.querySelector('.close').onclick=()=>modal.remove();
  modal.querySelector('.copy').onclick=async()=>{
    const text=ta.value;
    try{await navigator.clipboard.writeText(text);modal.querySelector('.copy').textContent='Copié ✓';}
    catch(_){ta.focus();ta.select();document.execCommand?.('copy');modal.querySelector('.copy').textContent='Copié ✓';}
  };
  modal.addEventListener('click',e=>{if(e.target===modal)modal.remove();});
}

function ensureAction(verdict){
  if(document.getElementById(ACTION_ID)) return;
  const btn=document.createElement('button');
  btn.id=ACTION_ID;
  btn.type='button';
  btn.textContent='Générer la réclamation DCO fiable';
  btn.onclick=openReliableClaim;
  verdict.insertAdjacentElement('afterend',btn);
}

function sync(){
  const mail=getCanonical();
  if(!mail) return;
  const verdict=document.querySelector('.dco-verdict-side');
  if(!verdict) return;
  addStyle();
  ensureAction(verdict);

  const cells=[...verdict.children];
  if(cells[1]){
    const amount=cells[1].querySelector('b');
    const label=cells[1].querySelector('span');
    if(amount){
      amount.textContent=M(mail.total||0);
      amount.dataset.tbrCanonical='1';
      amount.dataset.tbrRuntime=VERSION;
    }
    if(label) label.textContent='écarts chiffrés détectés';
  }

  const missing=allMissing(mail);
  let box=document.getElementById(POTENTIAL_ID);
  if(!missing.length){ if(box) box.remove(); return; }
  if(!box){
    box=document.createElement('div');
    box.id=POTENTIAL_ID;
    const action=document.getElementById(ACTION_ID);
    (action||verdict).insertAdjacentElement('afterend',box);
  }
  const potential=R(missing.reduce((s,x)=>s+R(x&&x.directTotal),0));
  const names=missing.slice(0,3).map(x=>`${x.name||'Client'}${x.num?` n° ${x.num}`:''}`).join(' · ');
  box.innerHTML=`<b>${potential>0?M(potential):missing.length+' vente(s)'}</b><span>${missing.length} vente(s) TBR absente(s) du DCO — impact potentiel à vérifier séparément</span><small>${esc(names)}${missing.length>3?' · …':''}</small>`;
}

function boot(){
  sync();
  setInterval(sync,800);
}

window.TBR_DCO_DASHBOARD_BRIDGE={version:VERSION,sync,openReliableClaim};
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
else boot();
})();