/* TBR 2.0 — Mail DCO 1.2.1 — intégrité client stable, sans boucle DOM */
(function(){
'use strict';

const VERSION='1.2.1';
const MAIL_ID='tbr-dco-claim-mail';
const INTEGRITY_ID='tbr-dco-integrity';
const STYLE_ID='tbr-dco-integrity-style';
const HISTORY_KEY='tbr_dco_integrity_history_v1';

const J=v=>{try{return JSON.parse(v)}catch(_){return null}};
const N=v=>Number.isFinite(Number(v))?Number(v):0;
const R=v=>Math.round(N(v)*100)/100;
const S=v=>String(v==null?'':v).trim();
const P=v=>String(v).padStart(2,'0');
const normNum=v=>S(v).replace(/\D/g,'');
const M=v=>new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(N(v));
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

function monthText(m){return `${MONTHS[Math.max(0,Math.min(11,N(m?.mois)-1))]} ${N(m?.annee)}`;}
function getSales(m){const v=J(localStorage.getItem(`cc_ventes_${m.annee}_${P(m.mois)}`));return Array.isArray(v)?v:[];}
function getRows(src){
  if(Array.isArray(src?.cache?.raw?.rows))return src.cache.raw.rows;
  if(Array.isArray(src?.data?.rows))return src.data.rows;
  return [];
}

function collectIntegrity(src){
  if(!src)return{month:null,missing:[],withoutNumber:[],dcoNumbers:[],tbrNumbers:[]};
  const month=getMonth(src);
  const activeSales=getSales(month).filter(v=>v&&!v.annulation);
  const dcoSet=new Set();
  getRows(src).forEach(r=>{
    const n=normNum(r?.num||r?.numClient);
    const cancelled=!!r?.isAnnulation||N(r?.nb)<0;
    if(n&&!cancelled)dcoSet.add(n);
  });

  const seen=new Set();
  const missing=[];
  const withoutNumber=[];
  const analyses=Array.isArray(src?.data?.analyses)?src.data.analyses:[];

  activeSales.forEach(v=>{
    const n=normNum(v?.numClient);
    if(!n){
      withoutNumber.push({name:S(v?.nomClient)||'Client TBR',type:S(v?.typeVente),date:S(v?.dateVente||v?.dateInstallation)});
      return;
    }
    if(seen.has(n))return;
    seen.add(n);
    if(dcoSet.has(n))return;
    const existing=analyses.find(a=>a&&a.type==='missing_dco'&&normNum(a.num)===n);
    missing.push({
      num:n,
      name:S(v?.nomClient)||S(existing?.nom)||'Client TBR',
      type:S(v?.typeVente)||S(existing?.catpub),
      date:S(v?.dateVente||v?.dateInstallation),
      estimate:existing?R(existing.tbr||existing.verseEnMoins||0):0
    });
  });

  return{month,missing,withoutNumber,dcoNumbers:[...dcoSet],tbrNumbers:[...seen]};
}

function rememberVersion(src,integrity){
  if(!src||!integrity?.month)return{removed:[]};
  const currentRows=getRows(src)
    .filter(r=>r&&!r.isAnnulation&&N(r.nb)>=0)
    .map(r=>({num:normNum(r.num||r.numClient),name:S(r.nom),type:S(r.catpub)}))
    .filter(r=>r.num);
  const signature=[...new Set(currentRows.map(r=>r.num))].sort().join('|');
  if(!signature)return{removed:[]};

  let history=J(localStorage.getItem(HISTORY_KEY));
  if(!Array.isArray(history))history=[];
  const monthKey=`${integrity.month.annee}-${P(integrity.month.mois)}`;
  const previous=[...history].reverse().find(x=>x&&x.monthKey===monthKey&&x.signature&&x.signature!==signature)||null;
  const currentSet=new Set(currentRows.map(r=>r.num));
  const removed=previous?(previous.rows||[]).filter(r=>r?.num&&!currentSet.has(r.num)):[];

  if(!history.some(x=>x&&x.monthKey===monthKey&&x.signature===signature)){
    history.push({monthKey,signature,rows:currentRows,at:new Date().toISOString(),file:S(src.cache?.name)});
    if(history.length>24)history=history.slice(-24);
    try{localStorage.setItem(HISTORY_KEY,JSON.stringify(history));}catch(_){/* non bloquant */}
  }
  return{removed};
}

function safeClaim(src){
  const d=src?.data||{};
  const missingCore=(d.analyses||[]).filter(a=>a&&a.type==='missing_dco');
  const missingAmount=R(missingCore.reduce((s,a)=>s+N(a.verseEnMoins||a.tbr||0),0));
  return R(Math.max(0,N(d.verseEnMoins)-missingAmount));
}

function collectMail(src){
  const d=src.data||{};
  const m=getMonth(src);
  const integrity=collectIntegrity(src);
  const version=rememberVersion(src,integrity);
  const confirmed=[];
  const verify=[];
  const installs=[];

  (d.globalRows||[]).forEach(r=>{
    const e=R(r?.ecart);
    if(r?.money&&e<-0.99&&S(r.label)!=='Installations total')confirmed.push({title:S(r.label)||'Rubrique DCO',dco:R(r.dco),tbr:R(r.tbr),missing:Math.abs(e),why:S(r.detail||r.niveau||r.cause)});
  });

  (d.analyses||[]).forEach(a=>{
    if(a?.type==='missing_dco')return;
    (a?.lines||[]).forEach(l=>{
      const e=R(l?.ecart);
      if(e<-0.99)verify.push({client:S(a.nom)||'Client',num:S(a.num)||'—',title:S(l.label)||'Écart client',dco:R(l.dco),tbr:R(l.tbr),missing:Math.abs(e),why:S(l.niveau||a.detail||a.title)});
    });
  });

  const source=(d.installationIssues&&d.installationIssues.length)?d.installationIssues:(d.installationCandidates||[]);
  source.forEach(x=>{
    const e=R(x?.ecart);
    if(e<-0.99)installs.push({client:S(x.nom)||'Client',num:S(x.num)||'—',dco:R(x.dco),tbr:R(x.tbr),missing:Math.abs(e),why:S(x.cause)});
  });

  return{m,label:monthText(m),integrity,version,confirmed,verify,installs,safeClaim:safeClaim(src),over:R(d.verseEnPlus),total:R(d.totalDCO)};
}

function detail(prefix,x){
  let out=`${prefix} ${x.title} : DCO ${M(x.dco)} · attendu TBR ${M(x.tbr)} · écart à contrôler ${M(x.missing)}.`;
  if(x.why)out+=` Motif : ${x.why}.`;
  return out;
}

function buildMail(src){
  const a=collectMail(src);
  const out=['Bonjour,','',`Je demande une vérification détaillée de mon DCO de ${a.label}.`];
  if(a.total)out.push(`Montant DCO officiel détecté : ${M(a.total)}.`);
  out.push(`Montant chiffré à vérifier hors ventes totalement absentes du DCO : ${M(a.safeClaim)}.`);
  if(a.over>0)out.push(`Montant versé en plus identifié séparément : ${M(a.over)}. Il n'est pas utilisé pour compenser un manque.`);

  out.push('','1) VENTES SAISIES DANS TBR MAIS ABSENTES DU DCO');
  if(a.integrity.missing.length){
    a.integrity.missing.forEach((x,i)=>{
      out.push(`${i+1}. N° ${x.num} — ${x.name}${x.type?` — ${x.type}`:''}${x.date?` — vente ${x.date}`:''}`);
      out.push('   Vente présente dans TBR mais numéro client absent du DCO importé. À vérifier en priorité.');
      out.push('   Son montant n’est pas ajouté automatiquement au total à réclamer tant que son traitement DCO n’est pas confirmé.');
    });
  }else out.push('- Toutes les ventes TBR avec numéro client sont retrouvées dans le DCO importé.');

  if(a.version.removed.length){
    out.push('','2) CLIENTS DISPARUS ENTRE DEUX VERSIONS DCO');
    a.version.removed.forEach((x,i)=>out.push(`${i+1}. N° ${x.num} — ${x.name||'Client'}${x.type?` — ${x.type}`:''}`));
  }

  const shift=a.version.removed.length?1:0;
  out.push('',`${2+shift}) MONTANTS CONFIRMÉS À RÉCLAMER / CONTRÔLER`);
  if(a.confirmed.length)a.confirmed.forEach((x,i)=>out.push(detail(`${i+1}.`,x)));
  else out.push(a.safeClaim>0?`- Le contrôle chiffre ${M(a.safeClaim)} hors ventes absentes.`:'- Aucun manque global suffisamment prouvé pour être présenté comme une créance certaine.');

  out.push('',`${3+shift}) COMMISSIONS ET PACKS CLIENT PAR CLIENT À VÉRIFIER`);
  if(a.verify.length)a.verify.slice(0,40).forEach((x,i)=>out.push(detail(`${i+1}. N° ${x.num} — ${x.client} —`,x)));
  else out.push('- Aucun écart négatif client détaillé n’est présent dans l’analyse actuelle.');

  out.push('',`${4+shift}) INSTALLATIONS À VÉRIFIER`);
  if(a.installs.length)a.installs.slice(0,30).forEach((x,i)=>out.push(`${i+1}. N° ${x.num} — ${x.client} : DCO ${M(x.dco)} · attendu TBR ${M(x.tbr)} · écart ${M(x.missing)}${x.why?` · ${x.why}`:''}.`));
  else out.push('- Aucun manque d’installation structuré n’est détecté dans les données actuelles.');

  out.push('',`${5+shift}) DEMANDE`,'Merci de vérifier les ventes absentes, commissions, packs, installations, paliers, bonus et challenges, et de régulariser tout montant effectivement dû.','Merci de m’indiquer la règle appliquée pour chaque écart.','','Cordialement,','Tarek');

  return{
    subject:`Vérification DCO — ${a.label}${a.integrity.missing.length?` — ${a.integrity.missing.length} vente(s) absente(s)`:a.safeClaim>0?` — écart ${M(a.safeClaim)}`:''}`,
    body:out.join('\n'),
    audit:a
  };
}

function addStyle(){
  if(document.getElementById(STYLE_ID))return;
  const s=document.createElement('style');
  s.id=STYLE_ID;
  s.textContent=`#${MAIL_ID},#${INTEGRITY_ID}{margin:18px 0;padding:18px;border-radius:24px;color:#f8fafc;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-shadow:0 18px 46px rgba(2,6,23,.3)}#${MAIL_ID}{border:1px solid rgba(56,189,248,.34);background:linear-gradient(145deg,rgba(8,24,47,.99),rgba(31,38,78,.99))}#${INTEGRITY_ID}{border:1px solid rgba(239,68,68,.38);background:linear-gradient(145deg,rgba(55,9,16,.98),rgba(31,17,38,.98))}#${INTEGRITY_ID}.ok{border-color:rgba(16,185,129,.32);background:linear-gradient(145deg,rgba(5,46,36,.96),rgba(8,24,47,.98))}#${MAIL_ID} .k,#${INTEGRITY_ID} .k{font:900 11px/1.2 system-ui;letter-spacing:.13em;color:#7dd3fc;text-transform:uppercase}#${INTEGRITY_ID} .k{color:#fca5a5}#${INTEGRITY_ID}.ok .k{color:#6ee7b7}#${MAIL_ID} h3,#${INTEGRITY_ID} h3{margin:8px 0 6px;font:950 21px/1.15 system-ui;color:#fff}#${MAIL_ID} p,#${INTEGRITY_ID} p{margin:0;color:#cbd5e1;font:750 13px/1.45 system-ui}#${INTEGRITY_ID} .missing-list{display:grid;gap:8px;margin-top:13px}#${INTEGRITY_ID} .missing-row{padding:11px 12px;border-radius:15px;background:rgba(2,6,23,.36);border:1px solid rgba(248,113,113,.18)}#${INTEGRITY_ID} .missing-row b{display:block;font-size:13px;color:#fff}#${INTEGRITY_ID} .missing-row span{display:block;margin-top:3px;font-size:11px;color:#fecaca;font-weight:750}#${INTEGRITY_ID} .safe-note{margin-top:12px;padding:10px 12px;border-radius:14px;background:rgba(251,191,36,.09);color:#fde68a;font-size:11px;font-weight:800;line-height:1.45}#${MAIL_ID} .prep{width:100%;margin-top:14px;border:0;border-radius:17px;padding:15px;background:linear-gradient(135deg,#0ea5e9,#4f46e5);color:#fff;font:900 15px system-ui}#${MAIL_ID} .preview{display:none;margin-top:14px;padding-top:14px;border-top:1px solid rgba(148,163,184,.2)}#${MAIL_ID} textarea{box-sizing:border-box;width:100%;min-height:330px;border:1px solid rgba(148,163,184,.24);border-radius:14px;background:#020817;color:#e5eefb;padding:12px;font:12px/1.45 ui-monospace,monospace}#${MAIL_ID} .actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:9px}#${MAIL_ID} .actions button{border:1px solid rgba(148,163,184,.24);border-radius:14px;padding:12px;background:rgba(15,23,42,.72);color:#fff;font:850 12px system-ui}`;
  document.head.appendChild(s);
}

function findPdfCard(){
  const nodes=[...document.querySelectorAll('h1,h2,h3,h4,div,span')];
  const title=nodes.find(el=>S(el.textContent)==='PDF DCO');
  if(!title)return null;
  return title.closest('.dco-card,.card,section')||title.parentElement?.parentElement||title.parentElement;
}

function setHtmlIfChanged(el,html){
  if(el.dataset.tbrHtml===html)return false;
  el.dataset.tbrHtml=html;
  el.innerHTML=html;
  return true;
}

function renderIntegrity(pdfCard,src){
  let card=document.getElementById(INTEGRITY_ID);
  if(!card){
    card=document.createElement('section');
    card.id=INTEGRITY_ID;
    pdfCard.insertAdjacentElement('afterend',card);
  }

  if(!src){
    card.classList.remove('ok');
    setHtmlIfChanged(card,'<div class="k">Contrôle intégrité DCO</div><h3>En attente du PDF DCO</h3><p>Après import, TBR vérifiera automatiquement que chaque vente saisie avec un numéro client existe bien dans le DCO.</p>');
    return;
  }

  const integrity=collectIntegrity(src);
  const version=rememberVersion(src,integrity);
  const missing=integrity.missing||[];
  const removed=(version.removed||[]).filter(x=>!missing.some(m=>m.num===x.num));
  const hasAlert=missing.length||removed.length;
  card.classList.toggle('ok',!hasAlert);

  if(!hasAlert){
    setHtmlIfChanged(card,`<div class="k">Contrôle intégrité DCO · ${VERSION}</div><h3>✓ Toutes les ventes TBR sont retrouvées</h3><p>Aucune vente TBR avec numéro client n’est absente du DCO de ${monthText(integrity.month)}.</p>`);
    return;
  }

  const rows=[];
  missing.forEach(x=>rows.push(`<div class="missing-row"><b>VENTE TBR ABSENTE · N° ${x.num} — ${x.name}</b><span>${x.type||'Type non renseigné'}${x.date?` · vente ${x.date}`:''} · numéro absent du DCO</span></div>`));
  removed.forEach(x=>rows.push(`<div class="missing-row"><b>DISPARU ENTRE VERSIONS · N° ${x.num} — ${x.name||'Client'}</b><span>${x.type||'Type non renseigné'} · présent dans une version précédente, absent de la version actuelle</span></div>`));
  setHtmlIfChanged(card,`<div class="k">Alerte intégrité DCO · ${VERSION}</div><h3>⚠️ ${missing.length} vente(s) TBR absente(s)</h3><p>TBR compare les numéros clients saisis avec ceux réellement présents dans le PDF.</p><div class="missing-list">${rows.join('')}</div><div class="safe-note">Ces ventes sont signalées en priorité, mais leur montant n’est pas ajouté automatiquement au total à réclamer tant que leur traitement DCO n’est pas confirmé.</div>`);
}

function mountMail(pdfCard){
  if(document.getElementById(MAIL_ID))return;
  const card=document.createElement('section');
  card.id=MAIL_ID;
  card.innerHTML=`<div class="k">Réclamation DCO assistée · ${VERSION}</div><h3>✉️ Préparer mon mail de réclamation</h3><p>Les ventes totalement absentes du DCO sont séparées des montants chiffrés pour éviter toute fausse créance.</p><button class="prep" type="button">Préparer le mail détaillé</button><div class="preview"><textarea aria-label="Mail DCO"></textarea><div class="actions"><button class="copy" type="button">Copier le mail</button><button class="open" type="button">Ouvrir ma messagerie</button></div></div>`;
  const integrity=document.getElementById(INTEGRITY_ID);
  (integrity||pdfCard).insertAdjacentElement('afterend',card);

  const prep=card.querySelector('.prep');
  const preview=card.querySelector('.preview');
  const textarea=card.querySelector('textarea');
  const copy=card.querySelector('.copy');
  const open=card.querySelector('.open');
  let current=null;

  prep.onclick=()=>{
    const src=getSource();
    if(!src){prep.textContent='Importe d’abord ton DCO';setTimeout(()=>prep.textContent='Préparer le mail détaillé',1800);return;}
    current=buildMail(src);
    textarea.value=current.body;
    preview.style.display='block';
    prep.textContent=current.audit.integrity.missing.length?`Mail prêt · ${current.audit.integrity.missing.length} vente(s) absente(s)`:`Mail prêt · ${M(current.audit.safeClaim)} à vérifier`;
    renderIntegrity(pdfCard,src);
  };
  copy.onclick=async()=>{
    if(!textarea.value)return;
    try{await navigator.clipboard.writeText(textarea.value)}catch(_){textarea.focus();textarea.select();document.execCommand('copy')}
    copy.textContent='✓ Copié';setTimeout(()=>copy.textContent='Copier le mail',1400);
  };
  open.onclick=()=>{
    const src=getSource();if(!src)return;
    if(!current)current=buildMail(src);
    location.href='mailto:?subject='+encodeURIComponent(current.subject)+'&body='+encodeURIComponent(textarea.value||current.body);
  };
}

let scheduled=false;
function mount(){
  scheduled=false;
  const pdfCard=findPdfCard();
  if(!pdfCard)return;
  addStyle();
  renderIntegrity(pdfCard,getSource());
  mountMail(pdfCard);
}
function scheduleMount(){
  if(scheduled)return;
  scheduled=true;
  setTimeout(mount,60);
}
function boot(){
  mount();
  const observer=new MutationObserver(scheduleMount);
  observer.observe(document.body||document.documentElement,{childList:true,subtree:true});
  window.addEventListener('storage',scheduleMount);
  setInterval(scheduleMount,1500);
}

window.TBR_DCO_INTEGRITY={
  version:VERSION,
  collect:()=>{const src=getSource();return src?collectIntegrity(src):null;},
  buildMail:()=>{const src=getSource();return src?buildMail(src):null;}
};

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
else boot();
})();
