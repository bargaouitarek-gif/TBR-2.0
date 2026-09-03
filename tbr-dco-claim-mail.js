/* TBR 2.0 — DCO canonical mail runtime 2.4.0 */
(function(){
'use strict';

const VERSION='2.4.0';
const ENGINE_VERSION='1.4.0';
const ENGINE_URL=`./tbr-dco-engine.js?v=${ENGINE_VERSION}`;
const ALERT_ID='tbr-dco-integrity-native';
const STYLE_ID='tbr-dco-integrity-native-style';
const HISTORY_KEY='tbr_dco_integrity_history_v1';
const PATCH_WINDOW_MS=7000;
const CANONICAL_EVENT='tbr:dco-canonical';

const J=v=>{try{return JSON.parse(v)}catch(_){return null}};
const N=v=>Number.isFinite(Number(v))?Number(v):0;
const R=v=>Math.round(N(v)*100)/100;
const S=v=>String(v==null?'':v).trim();
const P=v=>String(v).padStart(2,'0');
const normNum=v=>S(v).replace(/\D/g,'');
const esc=v=>S(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const M=v=>`${R(v).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})} €`;
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
  return{annee:N(m?.annee)||N(active.annee)||new Date().getFullYear(),mois:N(m?.mois)||N(active.mois)||new Date().getMonth()+1};
}
function monthText(m){const idx=Math.max(0,Math.min(11,N(m?.mois)-1));return`${MONTHS[idx]} ${N(m?.annee)}`;}
function getSales(month){const v=J(localStorage.getItem(`cc_ventes_${month.annee}_${P(month.mois)}`));return Array.isArray(v)?v:[];}
function getRows(src){if(Array.isArray(src?.cache?.raw?.rows))return src.cache.raw.rows;if(Array.isArray(src?.data?.rows))return src.data.rows;return[];}

function diagnosticsForPreviousVersions(src,month){
  const rows=getRows(src)
    .filter(r=>r&&!r.isAnnulation&&N(r.nb)>=0)
    .map(r=>({num:normNum(r.num||r.numClient),name:S(r.nom),type:S(r.catpub)}))
    .filter(r=>r.num);
  const signature=[...new Set(rows.map(r=>r.num))].sort().join('|');
  if(!signature)return{removedFromPreviousVersion:[]};
  let history=J(localStorage.getItem(HISTORY_KEY));
  if(!Array.isArray(history))history=[];
  const monthKey=`${month.annee}-${P(month.mois)}`;
  const previous=[...history].reverse().find(x=>x&&x.monthKey===monthKey&&x.signature&&x.signature!==signature)||null;
  const currentSet=new Set(rows.map(r=>r.num));
  const removedFromPreviousVersion=previous?(previous.rows||[]).filter(r=>r?.num&&!currentSet.has(r.num)):[];
  if(!history.some(x=>x&&x.monthKey===monthKey&&x.signature===signature)){
    history.push({monthKey,signature,rows,at:new Date().toISOString(),file:S(src.cache?.name)});
    if(history.length>24)history=history.slice(-24);
    try{localStorage.setItem(HISTORY_KEY,JSON.stringify(history));}catch(_){}
  }
  // Diagnostic uniquement : V1/V2 ne peut jamais alimenter une réclamation.
  return{removedFromPreviousVersion};
}

function buildResult(src){
  if(!src||!window.TBR_DCO_ENGINE)return null;
  const month=getMonth(src);
  const result=window.TBR_DCO_ENGINE.build({src,sales:getSales(month),month,formatMoney:M});
  result.diagnostics=diagnosticsForPreviousVersions(src,month);
  return result;
}

function buildCanonicalMail(src){
  const result=buildResult(src);
  if(!result)return null;
  const month=result.month||getMonth(src);
  const label=monthText(month);
  if(!result.claimSafe){
    const failed=result.sourceIntegrity?.failed||[];
    const body=['Bonjour,','',`Le contrôle automatique du DCO de ${label} a détecté une incohérence dans le document ou dans sa lecture.`,`Par sécurité, TBR ne génère aucune réclamation chiffrée tant que ce contrôle n’est pas conforme.`,''];
    failed.forEach(c=>body.push(`- ${c.name} : détail ${M(c.actual)} · synthèse ${M(c.expected)}`));
    if(!result.sourceIntegrity)body.push('- Ancien DCO en cache : réimporte le PDF pour appliquer le nouveau contrôle multi-format.');
    body.push('','Aucun montant de réclamation n’a été calculé automatiquement.');
    return{subject:`Contrôle DCO ${label} — incohérence détectée`,body:body.join('\n'),total:0,ledger:[],result,integrity:{month,missing:[],removed:[]},palierImpact:[],checkOk:false,blocked:true};
  }
  const ledger=result.ledger||[];
  const clientRows=result.ordinaryLedger||[];
  const globalRows=result.globalLedger||[];
  const missing=result.missingSales||[];
  const palierImpact=result.palierImpact||[];
  const total=R(result.totals?.confirmed||0);
  const lines=[
    'Bonjour,','',
    `Après vérification de mon DCO de ${label}, j’ai identifié plusieurs rémunérations qui semblent avoir été versées pour un montant inférieur à celui attendu.`,
    '',
    'Je vous transmets ci-dessous uniquement les écarts en ma défaveur, dossier par dossier et par type de rémunération.',' '
  ];

  if(clientRows.length){
    const groups=[];
    clientRows.forEach(r=>{
      let g=groups.find(x=>x.num===r.num&&x.name===r.name);
      if(!g){g={num:r.num,name:r.name,type:r.type,rows:[]};groups.push(g);}
      g.rows.push(r);
    });
    groups.forEach((g,i)=>{
      lines.push(`${i+1}. ${g.name||'Client'}${g.num?` — Client n° ${g.num}`:''}${g.type?` — ${g.type}`:''}`,'');
      let gt=0;
      g.rows.forEach(r=>{
        gt=R(gt+r.amount);
        lines.push(r.nature,`Montant versé : ${M(r.paid)}`,`Montant attendu : ${M(r.expected)}`,`Montant manquant : ${M(r.amount)}`,`Pourquoi : ${r.why}`,'');
      });
      lines.push(`Total manquant à vérifier sur ce dossier : ${M(gt)}`,'','---','');
    });
  }

  if(globalRows.length){
    lines.push('ÉCARTS GLOBAUX / PALIERS / BONUS À VÉRIFIER','');
    globalRows.forEach((r,i)=>lines.push(`${i+1}. ${r.nature}`,`Montant versé : ${M(r.paid)}`,`Montant attendu : ${M(r.expected)}`,`Montant manquant : ${M(r.amount)}`,`Pourquoi : ${r.why}`,''));
    lines.push('---','');
  }
  const unverifiedGlobal=result.unverifiedGlobal||[];
  if(unverifiedGlobal.length){
    lines.push('ÉCARTS GLOBAUX NON AJOUTÉS AU TOTAL','');
    unverifiedGlobal.forEach(r=>lines.push(`- ${r.label} : DCO ${M(r.paid)} · TBR ${M(r.expected)} — volumes DCO/TBR à réconcilier.`));
    lines.push('Ces montants ne sont pas réclamés automatiquement tant que les volumes ne concordent pas.','','---','');
  }

  if(missing.length){
    lines.push('VENTES ABSENTES DU DCO — IMPACT FINANCIER À VÉRIFIER','');
    missing.forEach((x,i)=>{
      lines.push(`${i+1}. ${x.name||'Client'} — Client n° ${x.num}${x.type?` — ${x.type}`:''}`);
      lines.push(`Anomalie : cette vente est enregistrée dans TBR mais absente du DCO importé${x.date?` (vente ${x.date})`:''}.`);
      lines.push('Pourquoi l’argent manque : le numéro client n’apparaît pas dans le DCO actuel ; aucune ligne de rémunération liée à cette vente n’y est donc retrouvée.');
      if(x.hasFinancialDetail){
        lines.push('Impact financier attendu selon les données saisies dans TBR :');
        (x.components||[]).forEach(c=>lines.push(`- ${c.nature} : DCO 0,00 € · attendu TBR ${M(c.expected)} · manque potentiel ${M(c.expected)}`));
        lines.push(`Total potentiel directement lié à cette vente : ${M(x.directTotal)}.`);
      }else{
        lines.push('Impact financier direct : TBR ne dispose pas d’un détail suffisamment fiable pour chiffrer automatiquement cette vente.');
      }
      if(missing.length===1&&palierImpact.length){
        lines.push('Conséquence indirecte possible sur les paliers / bonus :');
        palierImpact.forEach(p=>lines.push(`- ${p.label} : DCO ${M(p.paid)} · attendu TBR ${M(p.expected)} · écart ${M(p.amount)}${p.includedInConfirmed?' (déjà compris dans le total chiffré ci-dessous)':' (à vérifier séparément)'}`));
      }
      lines.push('À vérifier en priorité : vente retirée, décalée de mois, annulée ou non comptabilisée.');
      lines.push('Le montant potentiel direct de cette vente absente n’est pas ajouté automatiquement au total des écarts confirmés tant que son rattachement à ce DCO n’est pas confirmé.','');
    });
    lines.push('---','');
  }

  lines.push('RÉCAPITULATIF DES MONTANTS EN MA DÉFAVEUR','');
  if(ledger.length){
    ledger.forEach(r=>{
      if(r.scope==='client')lines.push(`${r.name||'Client'}${r.num?` — n° ${r.num}`:''} — ${r.nature} : ${M(r.amount)}`);
      else lines.push(`${r.nature} : ${M(r.amount)}`);
    });
    lines.push('',`TOTAL DES ÉCARTS CHIFFRÉS EN MA DÉFAVEUR À VÉRIFIER : ${M(total)}`);
  }else lines.push('Aucun écart chiffré en ma défaveur n’a été identifié dans les éléments actuellement analysables.');

  if(missing.length){
    lines.push('','VENTES ABSENTES — MONTANTS POTENTIELS NON AJOUTÉS AU TOTAL CHIFFRÉ');
    missing.forEach(x=>lines.push(`${x.name||'Client'} — n° ${x.num} : ${x.hasFinancialDetail?`${M(x.directTotal)} de rémunération directe potentielle`:'montant direct non chiffrable automatiquement'}`));
    if(missing.length===1&&palierImpact.length){
      palierImpact.forEach(p=>lines.push(`${p.label} : impact possible ${M(p.amount)}${p.includedInConfirmed?' — déjà inclus dans le total chiffré':' — non ajouté automatiquement'}`));
    }
  }

  lines.push('','Je vous remercie de vérifier ces éléments dossier par dossier et rubrique par rubrique, et de me préciser pour chaque différence le barème ou la règle de rémunération appliqué(e).','','Lorsque ces écarts correspondent effectivement à des rémunérations qui auraient dû m’être versées, je vous remercie de procéder à leur régularisation.','','Cordialement,','Tarek');

  return{
    subject:`Demande de vérification et de régularisation — DCO ${label}`,
    body:lines.join('\n'),total,ledger,result,
    integrity:{month,missing,removed:[]},
    palierImpact,
    checkOk:!!(result.claimSafe&&result.invariants?.confirmedEqualsLedger&&result.invariants?.missingStatusExclusive&&result.invariants?.uniqueClientStatus&&result.invariants?.noComponentNetting&&result.invariants?.noCrossNetting&&result.invariants?.overpaidEqualsLedger&&result.invariants?.sourceIntegritySafe)
  };
}

let internalWrite=false;
function setTextareaValue(textarea,value){
  if(!textarea||textarea.value===value)return false;
  internalWrite=true;
  try{
    const setter=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement?.prototype||{},'value')?.set;
    if(setter)setter.call(textarea,value);else textarea.value=value;
    textarea.dispatchEvent?.(new Event('input',{bubbles:true}));
    textarea.dispatchEvent?.(new Event('change',{bubbles:true}));
    textarea.dataset.tbrCanonical='1';
    textarea.dataset.tbrCanonicalVersion=VERSION;
  }finally{internalWrite=false;}
  return true;
}

function wireTextarea(textarea){
  if(!textarea||textarea.dataset.tbrCanonicalWired==='1')return;
  textarea.dataset.tbrCanonicalWired='1';
  textarea.addEventListener?.('input',()=>{
    if(!internalWrite&&textarea.dataset.tbrCanonical==='1')textarea.dataset.tbrUserEdited='1';
  });
}

function publish(mail){
  window.__tbrDcoCanonical=mail;
  try{window.dispatchEvent(new CustomEvent(CANONICAL_EVENT,{detail:{version:VERSION,engineVersion:ENGINE_VERSION,total:mail.total,overpaid:mail.result?.totals?.overpaid||0}}));}catch(_){}
}

function applyCanonicalMail(options={}){
  const src=getSource();
  if(!src||!window.TBR_DCO_ENGINE)return null;
  const mail=buildCanonicalMail(src);
  if(!mail)return null;
  publish(mail);

  const state=window.__tbrDcoMail;
  if(state&&typeof state==='object'){
    state.subject=mail.subject;state.body=mail.body;state.total=mail.total;state.shortageRows=mail.ledger;
    state.canonical=true;state.version=VERSION;state.totalCheck=mail.checkOk;state.missingSales=mail.result?.missingSales||[];
  }

  const textarea=document.querySelector?.('#dco-native-mail-preview-v2 textarea')||null;
  if(textarea){
    wireTextarea(textarea);
    if(options.reset){delete textarea.dataset.tbrUserEdited;delete textarea.dataset.tbrCanonical;delete textarea.dataset.tbrCanonicalVersion;}
    if(textarea.dataset.tbrUserEdited!=='1')setTextareaValue(textarea,mail.body);
  }
  return mail;
}

let patchUntil=0,patchTimer=null;
function stopPatchLoop(){if(patchTimer){clearInterval(patchTimer);patchTimer=null;}}
function startPatchWindow(reset=false){
  patchUntil=Date.now()+PATCH_WINDOW_MS;
  applyCanonicalMail({reset});
  if(patchTimer)return;
  patchTimer=setInterval(()=>{if(Date.now()>patchUntil){stopPatchLoop();return;}applyCanonicalMail();},120);
}

function addStyle(){
  if(document.getElementById?.(STYLE_ID))return;
  const s=document.createElement('style');s.id=STYLE_ID;
  s.textContent=`#${ALERT_ID}{margin:12px 0 18px;padding:14px 15px;border-radius:18px;background:linear-gradient(145deg,rgba(55,9,16,.98),rgba(31,17,38,.98));border:1px solid rgba(248,113,113,.38);color:#fff;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}#${ALERT_ID}.ok{background:linear-gradient(145deg,rgba(5,46,36,.96),rgba(8,24,47,.98));border-color:rgba(16,185,129,.32)}#${ALERT_ID} .k{font-size:10px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:#fca5a5}#${ALERT_ID}.ok .k{color:#6ee7b7}#${ALERT_ID} h3{margin:6px 0 5px;font-size:17px;line-height:1.2}#${ALERT_ID} p{margin:0;color:#cbd5e1;font-size:12px;line-height:1.45;font-weight:700}#${ALERT_ID} .row{margin-top:8px;padding:9px 10px;border-radius:12px;background:rgba(2,6,23,.32);font-size:12px;font-weight:850}#${ALERT_ID} .note{margin-top:9px;color:#fde68a;font-size:11px;line-height:1.4;font-weight:800}`;
  document.head?.appendChild(s);
}

function renderAlert(){
  const native=document.getElementById?.('dco-native-mail-v2');
  if(!native)return;
  addStyle();
  let card=document.getElementById(ALERT_ID);
  if(!card){card=document.createElement('section');card.id=ALERT_ID;native.insertAdjacentElement('afterend',card);}
  const src=getSource();
  if(!src||!window.TBR_DCO_ENGINE){
    const html=`<div class="k">Contrôle récapitulatif DCO · runtime ${VERSION}</div><h3>En attente du DCO</h3><p>TBR vérifiera les écarts chiffrés et les ventes absentes après import.</p>`;
    if(card.dataset.html!==html){card.dataset.html=html;card.innerHTML=html;}card.classList.remove('ok');return;
  }
  const mail=applyCanonicalMail();
  if(!mail)return;
  const missing=mail.result?.missingSales||[];
  card.classList.toggle('ok',mail.checkOk&&missing.length===0);
  const rows=missing.slice(0,8).map(x=>`<div class="row">VENTE ABSENTE · N° ${esc(x.num)} — ${esc(x.name||'Client')}${x.directTotal>0?` · impact direct potentiel ${esc(M(x.directTotal))}`:''}</div>`).join('');
  const html=`<div class="k">Contrôle récapitulatif DCO · runtime ${VERSION} · moteur ${ENGINE_VERSION}</div><h3>${missing.length?'⚠️':'✓'} ${mail.ledger.length} écart(s) chiffré(s) · ${M(mail.total)}</h3><p>Le mail et le dashboard utilisent le même résultat canonique par client.</p>${rows}${missing.length?`<div class="note">${missing.length} vente(s) absente(s) : impact potentiel séparé du total chiffré.</div>`:''}`;
  if(card.dataset.html!==html){card.dataset.html=html;card.innerHTML=html;}
}

function onCaptureClick(e){
  const nativeButton=e.target?.closest?.('#dco-native-mail-v2 button');
  if(nativeButton){startPatchWindow(true);return;}
  const previewButton=e.target?.closest?.('#dco-native-mail-preview-v2 button');
  if(previewButton&&/copier|messagerie|mail|envoyer/i.test(S(previewButton.textContent)))applyCanonicalMail();
}

let booted=false,heartbeat=null;
function bootRuntime(){
  if(booted)return;booted=true;
  document.addEventListener?.('click',onCaptureClick,true);
  renderAlert();
  heartbeat=setInterval(()=>{
    renderAlert();
    const textarea=document.querySelector?.('#dco-native-mail-preview-v2 textarea');
    if(textarea){wireTextarea(textarea);if(textarea.dataset.tbrUserEdited!=='1')applyCanonicalMail();}
  },1000);
}

function ensureEngine(){
  if(window.TBR_DCO_ENGINE?.VERSION===ENGINE_VERSION){bootRuntime();return;}
  const current=[...document.querySelectorAll('script[data-tbr-dco-engine="1"]')].find(s=>String(s.src||'').includes(`v=${ENGINE_VERSION}`));
  if(current){current.addEventListener('load',bootRuntime,{once:true});if(window.TBR_DCO_ENGINE?.VERSION===ENGINE_VERSION)bootRuntime();return;}
  const s=document.createElement('script');s.src=ENGINE_URL;s.async=false;s.dataset.tbrDcoEngine='1';
  s.addEventListener('load',()=>{if(window.TBR_DCO_ENGINE?.VERSION===ENGINE_VERSION)bootRuntime();else console.error('TBR DCO engine version mismatch');},{once:true});
  s.addEventListener('error',()=>console.error('TBR DCO engine unavailable'),{once:true});
  document.head.appendChild(s);
}

window.TBR_DCO_INTEGRITY={
  version:VERSION,
  engineVersion:()=>window.TBR_DCO_ENGINE?.VERSION||null,
  buildResult:()=>{const src=getSource();return src?buildResult(src):null;},
  collect:()=>{const src=getSource();const r=src?buildResult(src):null;return r?{month:r.month,missing:r.missingSales||[],removed:[],clients:r.clients||[],diagnostics:r.diagnostics}:null;},
  ledger:()=>{const src=getSource();const r=src?buildResult(src):null;return r?.ledger||[];},
  buildMail:()=>{const src=getSource();return src&&window.TBR_DCO_ENGINE?buildCanonicalMail(src):null;},
  applyCanonicalMail,
  runtimeStatus:()=>({version:VERSION,engineVersion:window.TBR_DCO_ENGINE?.VERSION||null,patching:!!patchTimer,patchUntil,booted,hasState:!!window.__tbrDcoMail,hasPreview:!!document.querySelector?.('#dco-native-mail-preview-v2 textarea')})
};

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensureEngine,{once:true});else ensureEngine();
})();
