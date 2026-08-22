/* TBR 2.0 — DCO 1.3.0 — augmentation du mail natif + contrôle des ventes absentes */
(function(){
'use strict';

const VERSION='1.3.0';
const ALERT_ID='tbr-dco-integrity-native';
const STYLE_ID='tbr-dco-integrity-native-style';
const HISTORY_KEY='tbr_dco_integrity_history_v1';
const SECTION_TITLE='VENTES SAISIES DANS TBR MAIS ABSENTES DU DCO';

const J=v=>{try{return JSON.parse(v)}catch(_){return null}};
const N=v=>Number.isFinite(Number(v))?Number(v):0;
const S=v=>String(v==null?'':v).trim();
const P=v=>String(v).padStart(2,'0');
const normNum=v=>S(v).replace(/\D/g,'');
const esc=v=>S(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const MONTHS=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];

function getSource(){
  for(const key of ['tbr_dco_cache_v4_source_first','tbr_dco_cache_v5_double_source','tbr_dco_cache_v2']){
    const cache=J(localStorage.getItem(key));
    if(cache&&cache.data)return{key,cache,data:cache.data};
  }
  return null;
}

function getMonth(src){
  const active=J(localStorage.getItem('dco_moisActif'))||{};
  const m=src?.data?.moisUsed||src?.data?.moisDoc||src?.cache?.month||active;
  return{
    annee:N(m?.annee)||N(active.annee)||new Date().getFullYear(),
    mois:N(m?.mois)||N(active.mois)||new Date().getMonth()+1
  };
}

function monthText(m){
  const idx=Math.max(0,Math.min(11,N(m?.mois)-1));
  return `${MONTHS[idx]} ${N(m?.annee)}`;
}

function getSales(month){
  const v=J(localStorage.getItem(`cc_ventes_${month.annee}_${P(month.mois)}`));
  return Array.isArray(v)?v:[];
}

function getRows(src){
  if(Array.isArray(src?.cache?.raw?.rows))return src.cache.raw.rows;
  if(Array.isArray(src?.data?.rows))return src.data.rows;
  return [];
}

function collectCurrentMissing(src){
  if(!src)return{month:null,missing:[],dcoNumbers:[]};
  const month=getMonth(src);
  const dcoSet=new Set();
  getRows(src).forEach(r=>{
    const n=normNum(r?.num||r?.numClient);
    const cancelled=!!r?.isAnnulation||N(r?.nb)<0;
    if(n&&!cancelled)dcoSet.add(n);
  });

  const missing=[];
  const seen=new Set();
  getSales(month).filter(v=>v&&!v.annulation).forEach(v=>{
    const n=normNum(v?.numClient);
    if(!n||seen.has(n))return;
    seen.add(n);
    if(dcoSet.has(n))return;
    missing.push({
      num:n,
      name:S(v?.nomClient)||'Client TBR',
      type:S(v?.catpub||v?.typeDco||v?.typeVente),
      date:S(v?.dateVente||v?.dateInstallation)
    });
  });

  return{month,missing,dcoNumbers:[...dcoSet]};
}

function rememberAndCompareVersion(src,integrity){
  if(!src||!integrity?.month)return{removed:[]};
  const rows=getRows(src)
    .filter(r=>r&&!r.isAnnulation&&N(r.nb)>=0)
    .map(r=>({num:normNum(r.num||r.numClient),name:S(r.nom),type:S(r.catpub)}))
    .filter(r=>r.num);
  const signature=[...new Set(rows.map(r=>r.num))].sort().join('|');
  if(!signature)return{removed:[]};

  let history=J(localStorage.getItem(HISTORY_KEY));
  if(!Array.isArray(history))history=[];
  const monthKey=`${integrity.month.annee}-${P(integrity.month.mois)}`;
  const previous=[...history].reverse().find(x=>x&&x.monthKey===monthKey&&x.signature&&x.signature!==signature)||null;
  const currentSet=new Set(rows.map(r=>r.num));
  const removed=previous?(previous.rows||[]).filter(r=>r?.num&&!currentSet.has(r.num)):[];

  if(!history.some(x=>x&&x.monthKey===monthKey&&x.signature===signature)){
    history.push({monthKey,signature,rows,at:new Date().toISOString(),file:S(src.cache?.name)});
    if(history.length>24)history=history.slice(-24);
    try{localStorage.setItem(HISTORY_KEY,JSON.stringify(history));}catch(_){/* non bloquant */}
  }
  return{removed};
}

function collectIntegrity(src){
  const current=collectCurrentMissing(src);
  const version=rememberAndCompareVersion(src,current);
  const missing=current.missing||[];
  const missingNums=new Set(missing.map(x=>x.num));
  const removed=(version.removed||[]).filter(x=>x?.num&&!missingNums.has(x.num));
  return{...current,removed};
}

function buildSection(info){
  const items=[];
  (info.missing||[]).forEach(x=>items.push({...x,source:'TBR'}));
  (info.removed||[]).forEach(x=>items.push({...x,source:'VERSION'}));
  if(!items.length)return'';

  const lines=['',SECTION_TITLE,''];
  items.forEach((x,i)=>{
    const source=x.source==='VERSION'?'présent dans une version DCO précédente mais absent de la version actuelle':'enregistré dans TBR mais absent du DCO importé';
    lines.push(`${i+1}. ${x.name||'Client'} — Client n° ${x.num}${x.type?` — ${x.type}`:''}`);
    lines.push(`Cette vente est ${source}${x.date?` (vente ${x.date})`:''}.`);
    lines.push('À vérifier en priorité : vente retirée, décalée de mois ou non comptabilisée.');
    lines.push('Aucun montant n’est ajouté automatiquement au total des écarts chiffrés tant que le traitement de cette vente n’est pas confirmé.','');
  });
  lines.push('---','');
  return lines.join('\n');
}

function augmentBody(body,src){
  const original=S(body);
  if(!original||original.includes(SECTION_TITLE))return original;
  const info=collectIntegrity(src);
  const section=buildSection(info);
  if(!section)return original;

  const recap='RÉCAPITULATIF DES MONTANTS EN MA DÉFAVEUR';
  if(original.includes(recap))return original.replace(recap,section+recap);

  const closing='Je vous remercie de vérifier ces éléments dossier par dossier et rubrique par rubrique';
  if(original.includes(closing))return original.replace(closing,section+closing);
  return original+'\n'+section;
}

function patchNativeMail(){
  const src=getSource();
  if(!src)return;
  const state=window.__tbrDcoMail;
  if(!state||!state.body)return;
  const body=augmentBody(state.body,src);
  if(!body||body===state.body)return;
  state.body=body;
  const ta=document.querySelector('#dco-native-mail-preview-v2 textarea');
  if(ta)ta.value=body;
}

function addStyle(){
  if(document.getElementById(STYLE_ID))return;
  const s=document.createElement('style');
  s.id=STYLE_ID;
  s.textContent=`#${ALERT_ID}{margin:12px 0 18px;padding:14px 15px;border-radius:18px;background:linear-gradient(145deg,rgba(55,9,16,.98),rgba(31,17,38,.98));border:1px solid rgba(248,113,113,.38);color:#fff;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}#${ALERT_ID}.ok{background:linear-gradient(145deg,rgba(5,46,36,.96),rgba(8,24,47,.98));border-color:rgba(16,185,129,.32)}#${ALERT_ID} .k{font-size:10px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:#fca5a5}#${ALERT_ID}.ok .k{color:#6ee7b7}#${ALERT_ID} h3{margin:6px 0 5px;font-size:17px;line-height:1.2}#${ALERT_ID} p{margin:0;color:#cbd5e1;font-size:12px;line-height:1.45;font-weight:700}#${ALERT_ID} .row{margin-top:8px;padding:9px 10px;border-radius:12px;background:rgba(2,6,23,.32);font-size:12px;font-weight:850}#${ALERT_ID} .note{margin-top:9px;color:#fde68a;font-size:11px;line-height:1.4;font-weight:800}`;
  document.head.appendChild(s);
}

function renderAlert(){
  const native=document.getElementById('dco-native-mail-v2');
  if(!native)return;
  addStyle();
  let card=document.getElementById(ALERT_ID);
  if(!card){
    card=document.createElement('section');
    card.id=ALERT_ID;
    native.insertAdjacentElement('afterend',card);
  }

  const src=getSource();
  if(!src){
    const html='<div class="k">Contrôle intégrité DCO</div><h3>En attente du DCO</h3><p>TBR vérifiera les numéros clients saisis dès qu’un DCO sera importé.</p>';
    if(card.dataset.html!==html){card.dataset.html=html;card.innerHTML=html;}
    card.classList.remove('ok');
    return;
  }

  const info=collectIntegrity(src);
  const items=[];
  (info.missing||[]).forEach(x=>items.push({...x,label:'VENTE TBR ABSENTE'}));
  (info.removed||[]).forEach(x=>items.push({...x,label:'DISPARU ENTRE VERSIONS'}));
  const ok=!items.length;
  card.classList.toggle('ok',ok);

  let html;
  if(ok){
    html=`<div class="k">Contrôle intégrité DCO · ${VERSION}</div><h3>✓ Toutes les ventes TBR sont retrouvées</h3><p>Aucune vente saisie avec un numéro client n’est absente du DCO de ${esc(monthText(info.month))}.</p>`;
  }else{
    const rows=items.map(x=>`<div class="row">${esc(x.label)} · N° ${esc(x.num)} — ${esc(x.name||'Client')}${x.type?` · ${esc(x.type)}`:''}</div>`).join('');
    html=`<div class="k">Alerte intégrité DCO · ${VERSION}</div><h3>⚠️ ${items.length} vente(s) à vérifier</h3><p>TBR a trouvé des numéros clients saisis qui ne figurent pas dans le DCO actuel.</p>${rows}<div class="note">Ces ventes seront aussi ajoutées au mail de réclamation, sans modifier automatiquement le total chiffré.</div>`;
  }
  if(card.dataset.html!==html){card.dataset.html=html;card.innerHTML=html;}
}

function onClick(e){
  const btn=e.target?.closest?.('#dco-native-mail-v2 button');
  if(!btn)return;
  setTimeout(patchNativeMail,0);
  setTimeout(patchNativeMail,80);
}

function boot(){
  document.addEventListener('click',onClick,false);
  renderAlert();
  setInterval(renderAlert,1500);
}

window.TBR_DCO_INTEGRITY={
  version:VERSION,
  collect:()=>{const src=getSource();return src?collectIntegrity(src):null;},
  patchNativeMail
};

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
else boot();
})();
