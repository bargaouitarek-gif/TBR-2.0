/* TBR 2.0 — DCO dashboard bridge 1.0.0 */
(function(){
'use strict';

const VERSION='1.0.0';
const STYLE_ID='tbr-dco-dashboard-bridge-style';
const POTENTIAL_ID='tbr-dco-missing-potential';
const R=v=>Math.round((Number(v)||0)*100)/100;
const M=v=>`${Math.abs(R(v)).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})} €`;

function addStyle(){
  if(document.getElementById(STYLE_ID)) return;
  const s=document.createElement('style');
  s.id=STYLE_ID;
  s.textContent=`#${POTENTIAL_ID}{margin-top:10px;padding:13px 14px;border:1px solid rgba(251,191,36,.34);border-radius:16px;background:rgba(120,53,15,.16);text-align:center}#${POTENTIAL_ID} b{display:block;color:#fbbf24;font-size:20px;font-weight:900}#${POTENTIAL_ID} span{display:block;margin-top:3px;color:#fde68a;font-size:11px;font-weight:800;line-height:1.35}#${POTENTIAL_ID} small{display:block;margin-top:5px;color:#cbd5e1;font-size:10px;font-weight:700;line-height:1.35}`;
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

function sync(){
  const mail=getCanonical();
  if(!mail) return;
  const verdict=document.querySelector('.dco-verdict-side');
  if(!verdict) return;

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
  addStyle();
  if(!box){
    box=document.createElement('div');
    box.id=POTENTIAL_ID;
    verdict.insertAdjacentElement('afterend',box);
  }
  const potential=R(missing.reduce((s,x)=>s+R(x&&x.directTotal),0));
  const names=missing.slice(0,3).map(x=>`${x.name||'Client'}${x.num?` n° ${x.num}`:''}`).join(' · ');
  box.innerHTML=`<b>${potential>0?M(potential):missing.length+' vente(s)'}</b><span>${missing.length} vente(s) TBR absente(s) du DCO — impact potentiel à vérifier séparément</span><small>${names}${missing.length>3?' · …':''}</small>`;
}

function boot(){
  sync();
  setInterval(sync,800);
}

window.TBR_DCO_DASHBOARD_BRIDGE={version:VERSION,sync};
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
else boot();
})();