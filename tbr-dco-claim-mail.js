/* TBR 2.0 — DCO 1.6.0 — moteur canonique + runtime de mail fiable */
(function(){
'use strict';

const VERSION='1.7.0';
const ALERT_ID='tbr-dco-integrity-native';
const STYLE_ID='tbr-dco-integrity-native-style';
const HISTORY_KEY='tbr_dco_integrity_history_v1';
const PATCH_WINDOW_MS=7000;

const J=v=>{try{return JSON.parse(v)}catch(_){return null}};
const N=v=>Number.isFinite(Number(v))?Number(v):0;
const R=v=>Math.round(N(v)*100)/100;
const S=v=>String(v==null?'':v).trim();
const P=v=>String(v).padStart(2,'0');
const normNum=v=>S(v).replace(/\D/g,'');
const esc=v=>S(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const M=v=>`${Math.abs(R(v)).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})} €`;
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
function monthText(m){const idx=Math.max(0,Math.min(11,N(m?.mois)-1));return `${MONTHS[idx]} ${N(m?.annee)}`;}
function getSales(month){const v=J(localStorage.getItem(`cc_ventes_${month.annee}_${P(month.mois)}`));return Array.isArray(v)?v:[];}
function getRows(src){if(Array.isArray(src?.cache?.raw?.rows))return src.cache.raw.rows;if(Array.isArray(src?.data?.rows))return src.data.rows;return [];}
function getSale(src,num){
  const n=normNum(num);
  if(!n)return null;
  return getSales(getMonth(src)).find(v=>v&&!v.annulation&&normNum(v.numClient)===n)||null;
}
function ownsInstallation(src,num){
  const sale=getSale(src,num);
  return !!(sale&&sale.installation===true);
}

function natureFor(label){
  const l=S(label);
  if(/pack/i.test(l))return'Rémunération Packs';
  if(/install/i.test(l))return'Installation';
  if(/commission|vente/i.test(l))return'Commission sur la vente';
  return l||'Rémunération';
}

function componentBreakdown(src,num){
  const n=normNum(num);
  const analysis=(src?.data?.analyses||[]).find(a=>a&&a.type==='missing_dco'&&normNum(a.num)===n)||null;
  if(!analysis)return{analysis:null,components:[],directTotal:0};
  const components=[];
  const seen=new Set();
  (analysis.lines||[]).forEach(l=>{
    const expected=R(l?.tbr);
    if(!(expected>0.99))return;
    const nature=natureFor(l?.label);
    if(nature==='Installation'&&!ownsInstallation(src,n))return;
    const key=nature.toLowerCase();
    if(seen.has(key))return;
    seen.add(key);
    components.push({nature,expected,sourceLabel:S(l?.label),detail:S(l?.niveau)});
  });
  const meta=analysis.tbrMeta||{};
  [['Commission sur la vente',meta.commissionVente],['Rémunération Packs',meta.commissionPacks],['Installation',meta.commissionInstall]].forEach(([nature,value])=>{
    if(nature==='Installation'&&!ownsInstallation(src,n))return;
    const expected=R(value);
    const key=nature.toLowerCase();
    if(!(expected>0.99)||seen.has(key))return;
    seen.add(key);
    components.push({nature,expected,sourceLabel:nature,detail:''});
  });
  const sum=R(components.reduce((s,x)=>s+x.expected,0));
  const fallback=R(analysis.tbr||analysis.tbrMeta?.total||analysis.verseEnMoins||0);
  return{analysis,components,directTotal:sum>0?sum:fallback};
}

function enrichMissing(src,base){
  const month=getMonth(src);
  const n=normNum(base?.num);
  const sale=getSales(month).find(v=>v&&!v.annulation&&normNum(v.numClient)===n)||null;
  const money=componentBreakdown(src,n);
  return{
    ...base,
    num:n,
    name:S(base?.name||sale?.nomClient)||'Client TBR',
    type:S(base?.type||sale?.catpub||sale?.typeDco||sale?.typeVente),
    date:S(base?.date||sale?.dateVente||sale?.dateInstallation),
    components:money.components,
    directTotal:money.directTotal,
    hasFinancialDetail:money.components.length>0||money.directTotal>0
  };
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
    missing.push(enrichMissing(src,{num:n,name:S(v?.nomClient)||'Client TBR',type:S(v?.catpub||v?.typeDco||v?.typeVente),date:S(v?.dateVente||v?.dateInstallation)}));
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
  const removed=previous?(previous.rows||[]).filter(r=>r?.num&&!currentSet.has(r.num)).map(r=>enrichMissing(src,r)):[];
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

function whyFor(nature,paid,expected,label){
  if(nature==='Rémunération Packs')return`La rémunération des packs est de ${M(paid)} au lieu des ${M(expected)} attendus. Merci de vérifier les packs pris en compte et la règle de calcul appliquée.`;
  if(nature==='Installation')return`L’installation a été rémunérée ${M(paid)} au lieu des ${M(expected)} attendus.`;
  if(nature==='Commission sur la vente')return`La commission versée est de ${M(paid)} au lieu des ${M(expected)} attendus. Merci de vérifier le barème appliqué à cette vente.`;
  return`${S(label)||nature} a été rémunéré(e) ${M(paid)} au lieu des ${M(expected)} attendus. Merci de vérifier la règle appliquée.`;
}

function isAggregateDuplicate(label){
  const l=S(label).toLowerCase();
  if(!l)return true;
  return /commission.*vente|commission.*pack|installations?\s*total|agr[ée]gat|ventes\s*\+\s*packs|^paliers?$|^total\b|total.*commission|commissions.*primes/.test(l);
}

function collectLedger(src){
  const d=src?.data||{};
  const items=[];
  const seen=new Set();
  const add=item=>{
    const amount=R(item.amount);
    if(!(amount>0.99))return;
    const key=item.key||`${item.scope}|${normNum(item.num)}|${S(item.nature).toLowerCase()}`;
    if(seen.has(key))return;
    seen.add(key);
    items.push({...item,amount,key});
  };

  (d.analyses||[]).forEach(a=>{
    if(!a||a.type==='missing_dco')return;
    (a.lines||[]).forEach(l=>{
      const e=R(l?.ecart);
      if(!(e<-.99))return;
      const nature=natureFor(l?.label);
      if(nature==='Installation'&&!ownsInstallation(src,a?.num))return;
      const paid=R(l?.dco);
      const expected=R(l?.tbr);
      add({scope:'client',num:normNum(a?.num),name:S(a?.nom)||'Client',type:S(a?.catpub),nature,paid,expected,amount:Math.abs(e),why:whyFor(nature,paid,expected,l?.label),sourceLabel:S(l?.label),key:`client|${normNum(a?.num)}|${nature.toLowerCase()}`});
    });
  });

  const installSource=(d.installationIssues&&d.installationIssues.length)?d.installationIssues:(d.installationCandidates||[]);
  (installSource||[]).forEach(x=>{
    const e=R(x?.ecart);
    if(!(e<-.99))return;
    const num=normNum(x?.num);
    if(!ownsInstallation(src,num))return;
    const paid=R(x?.dco);
    const expected=R(x?.tbr);
    add({scope:'client',num,name:S(x?.nom)||'Client',type:S(x?.catpub),nature:'Installation',paid,expected,amount:Math.abs(e),why:S(x?.cause)||whyFor('Installation',paid,expected,'Installation'),sourceLabel:'Installation',key:`client|${num}|installation`});
  });

  (d.globalRows||[]).forEach(r=>{
    const e=R(r?.ecart);
    if(!r?.money||!(e<-.99)||isAggregateDuplicate(r?.label))return;
    const label=S(r?.label)||'Écart global';
    add({scope:'global',num:'',name:'',type:'',nature:label,paid:R(r?.dco),expected:R(r?.tbr),amount:Math.abs(e),why:`Le montant global versé pour « ${label} » est inférieur au montant attendu. Merci de vérifier la règle ou le palier appliqué.`,sourceLabel:label,key:`global|${label.toLowerCase()}`});
  });
  return items;
}

function collectPalierImpact(src,missingCount,ledger){
  if(missingCount!==1)return[];
  const rows=[];
  (src?.data?.globalRows||[]).forEach(r=>{
    const e=R(r?.ecart);
    const label=S(r?.label);
    if(!r?.money||!(e<-.99)||!/(palier|volume.*vente|vente.*volume|prime.*vente|bonus.*vente)/i.test(label))return;
    const key=`global|${label.toLowerCase()}`;
    rows.push({label,paid:R(r?.dco),expected:R(r?.tbr),amount:Math.abs(e),includedInConfirmed:ledger.some(x=>x.key===key)});
  });
  return rows;
}

function buildCanonicalMail(src){
  const month=getMonth(src);
  const label=monthText(month);
  const integrity=collectIntegrity(src);
  const ledger=collectLedger(src);
  const clientRows=ledger.filter(x=>x.scope==='client');
  const globalRows=ledger.filter(x=>x.scope==='global');
  const total=R(ledger.reduce((s,x)=>s+x.amount,0));
  const missing=[...(integrity.missing||[]).map(x=>({...x,source:'TBR'})),...(integrity.removed||[]).map(x=>({...x,source:'VERSION'}))];
  const palierImpact=collectPalierImpact(src,missing.length,ledger);
  const lines=['Bonjour,','',`Après vérification de mon DCO de ${label}, j’ai identifié plusieurs rémunérations qui semblent avoir été versées pour un montant inférieur à celui attendu.`,``,`Je vous transmets ci-dessous uniquement les écarts en ma défaveur, dossier par dossier et par type de rémunération.`,` `];

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
    globalRows.forEach((r,i)=>{
      lines.push(`${i+1}. ${r.nature}`,`Montant versé : ${M(r.paid)}`,`Montant attendu : ${M(r.expected)}`,`Montant manquant : ${M(r.amount)}`,`Pourquoi : ${r.why}`,'');
    });
    lines.push('---','');
  }

  if(missing.length){
    lines.push('VENTES ABSENTES DU DCO — IMPACT FINANCIER À VÉRIFIER','');
    missing.forEach((x,i)=>{
      const origin=x.source==='VERSION'?'présente dans une version DCO précédente mais absente de la version actuelle':'enregistrée dans TBR mais absente du DCO importé';
      lines.push(`${i+1}. ${x.name||'Client'} — Client n° ${x.num}${x.type?` — ${x.type}`:''}`);
      lines.push(`Anomalie : cette vente est ${origin}${x.date?` (vente ${x.date})`:''}.`);
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
  }else{
    lines.push('Aucun écart chiffré en ma défaveur n’a été identifié dans les éléments actuellement analysables.');
  }

  if(missing.length){
    lines.push('','VENTES ABSENTES — MONTANTS POTENTIELS NON AJOUTÉS AU TOTAL CHIFFRÉ');
    missing.forEach(x=>lines.push(`${x.name||'Client'} — n° ${x.num} : ${x.hasFinancialDetail?`${M(x.directTotal)} de rémunération directe potentielle`:'montant direct non chiffrable automatiquement'}`));
    if(missing.length===1&&palierImpact.length){
      palierImpact.forEach(p=>lines.push(`${p.label} : impact possible ${M(p.amount)}${p.includedInConfirmed?' — déjà inclus dans le total chiffré':' — non ajouté automatiquement'}`));
    }
  }

  lines.push('','Je vous remercie de vérifier ces éléments dossier par dossier et rubrique par rubrique, et de me préciser pour chaque différence le barème ou la règle de rémunération appliqué(e).','','Lorsque ces écarts correspondent effectivement à des rémunérations qui auraient dû m’être versées, je vous remercie de procéder à leur régularisation.','','Cordialement,','Tarek');
  const check=R(ledger.reduce((s,x)=>s+x.amount,0));
  return{subject:`Demande de vérification et de régularisation — DCO ${label}`,body:lines.join('\n'),total,ledger,integrity,palierImpact,checkOk:Math.abs(check-total)<0.01};
}

function isCanonicalBody(text){
  const t=S(text);
  return t.includes('TOTAL DES ÉCARTS CHIFFRÉS EN MA DÉFAVEUR À VÉRIFIER')||t.includes('VENTES ABSENTES DU DCO — IMPACT FINANCIER À VÉRIFIER');
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
  }finally{
    internalWrite=false;
  }
  return true;
}

function wireTextarea(textarea){
  if(!textarea||textarea.dataset.tbrCanonicalWired==='1')return;
  textarea.dataset.tbrCanonicalWired='1';
  textarea.addEventListener?.('input',()=>{
    if(!internalWrite&&textarea.dataset.tbrCanonical==='1')textarea.dataset.tbrUserEdited='1';
  });
}

function applyCanonicalMail(options={}){
  const src=getSource();
  if(!src)return null;
  const mail=buildCanonicalMail(src);
  window.__tbrDcoCanonical=mail;
  const state=window.__tbrDcoMail;
  if(state&&typeof state==='object'){
    state.subject=mail.subject;
    state.body=mail.body;
    state.total=mail.total;
    state.shortageRows=mail.ledger;
    state.canonical=true;
    state.version=VERSION;
    state.totalCheck=mail.checkOk;
    state.missingSales=mail.integrity.missing||[];
  }

  const textarea=document.querySelector?.('#dco-native-mail-preview-v2 textarea')||null;
  if(textarea){
    wireTextarea(textarea);
    const reset=!!options.reset;
    if(reset){delete textarea.dataset.tbrUserEdited;delete textarea.dataset.tbrCanonical;}
    const userEdited=textarea.dataset.tbrUserEdited==='1';
    const alreadyCanonical=isCanonicalBody(textarea.value);
    if(!userEdited&&!alreadyCanonical)setTextareaValue(textarea,mail.body);
    else if(!userEdited&&alreadyCanonical){textarea.dataset.tbrCanonical='1';textarea.dataset.tbrCanonicalVersion=VERSION;}
  }
  return mail;
}

let patchUntil=0;
let patchTimer=null;
function stopPatchLoop(){if(patchTimer){clearInterval(patchTimer);patchTimer=null;}}
function startPatchWindow(reset=false){
  patchUntil=Date.now()+PATCH_WINDOW_MS;
  applyCanonicalMail({reset});
  if(patchTimer)return;
  patchTimer=setInterval(()=>{
    if(Date.now()>patchUntil){stopPatchLoop();return;}
    applyCanonicalMail();
  },120);
}

function addStyle(){
  if(document.getElementById?.(STYLE_ID))return;
  const s=document.createElement('style');
  s.id=STYLE_ID;
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
  if(!src){
    const html=`<div class="k">Contrôle récapitulatif DCO · runtime ${VERSION}</div><h3>En attente du DCO</h3><p>TBR vérifiera les écarts chiffrés et les ventes absentes après import.</p>`;
    if(card.dataset.html!==html){card.dataset.html=html;card.innerHTML=html;}
    card.classList.remove('ok');
    return;
  }
  const mail=buildCanonicalMail(src);
  const missing=[...(mail.integrity.missing||[]),...(mail.integrity.removed||[])];
  card.classList.toggle('ok',mail.checkOk&&missing.length===0);
  const rows=missing.slice(0,8).map(x=>`<div class="row">VENTE ABSENTE · N° ${esc(x.num)} — ${esc(x.name||'Client')}${x.directTotal>0?` · impact direct potentiel ${esc(M(x.directTotal))}`:''}</div>`).join('');
  const html=`<div class="k">Contrôle récapitulatif DCO · runtime ${VERSION}</div><h3>${missing.length?'⚠️':'✓'} ${mail.ledger.length} écart(s) chiffré(s) · ${M(mail.total)}</h3><p>Le mail est généré depuis le registre canonique et les ventes absentes sont contrôlées par numéro client.</p>${rows}${missing.length?`<div class="note">${missing.length} vente(s) absente(s) : impact financier potentiel détaillé dans le mail, séparé du total chiffré tant que le rattachement n’est pas confirmé.</div>`:''}`;
  if(card.dataset.html!==html){card.dataset.html=html;card.innerHTML=html;}
}

function onCaptureClick(e){
  const nativeButton=e.target?.closest?.('#dco-native-mail-v2 button');
  if(nativeButton){startPatchWindow(true);return;}
  const previewButton=e.target?.closest?.('#dco-native-mail-preview-v2 button');
  if(previewButton){
    const text=S(previewButton.textContent);
    if(/copier|messagerie|mail|envoyer/i.test(text))applyCanonicalMail();
  }
}

function boot(){
  document.addEventListener?.('click',onCaptureClick,true);
  renderAlert();
  setInterval(()=>{
    renderAlert();
    const textarea=document.querySelector?.('#dco-native-mail-preview-v2 textarea');
    if(textarea){wireTextarea(textarea);if(textarea.dataset.tbrUserEdited!=='1'&&!isCanonicalBody(textarea.value))applyCanonicalMail();}
  },1000);
}

window.TBR_DCO_INTEGRITY={
  version:VERSION,
  collect:()=>{const src=getSource();return src?collectIntegrity(src):null;},
  ledger:()=>{const src=getSource();return src?collectLedger(src):[];},
  buildMail:()=>{const src=getSource();return src?buildCanonicalMail(src):null;},
  applyCanonicalMail,
  runtimeStatus:()=>({version:VERSION,patching:!!patchTimer,patchUntil,hasState:!!window.__tbrDcoMail,hasPreview:!!document.querySelector?.('#dco-native-mail-preview-v2 textarea')})
};

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
else boot();
})();
