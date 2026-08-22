/* TBR 2.0 — Mail DCO 1.2.0 — contrôle d'intégrité client + mail sécurisé */
(function(){
'use strict';

const VERSION='1.2.0';
const ID='tbr-dco-claim-mail';
const INTEGRITY_ID='tbr-dco-integrity';
const STYLE=ID+'-style';
const HISTORY_KEY='tbr_dco_integrity_history_v1';

const J=v=>{try{return JSON.parse(v)}catch(_){return null}};
const N=v=>Number.isFinite(Number(v))?Number(v):0;
const R=v=>Math.round(N(v)*100)/100;
const M=v=>new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(N(v));
const S=v=>String(v==null?'':v).trim();
const P=v=>String(v).padStart(2,'0');
const normNum=v=>S(v).replace(/\D/g,'');
const MONTHS=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];

function getSource(){
  for(const key of ['tbr_dco_cache_v4_source_first','tbr_dco_cache_v5_double_source','tbr_dco_cache_v2']){
    const c=J(localStorage.getItem(key));
    if(c&&c.data)return{cache:c,data:c.data,key};
  }
  return null;
}

function getMonth(src){
  const active=J(localStorage.getItem('dco_moisActif'))||{};
  const d=src?.data||{};
  const c=src?.cache||{};
  const m=d.moisUsed||d.moisDoc||c.month||active;
  return{
    annee:N(m.annee)||N(active.annee)||new Date().getFullYear(),
    mois:N(m.mois)||N(active.mois)||new Date().getMonth()+1
  };
}

function monthText(m){
  return `${MONTHS[Math.max(0,Math.min(11,m.mois-1))]} ${m.annee}`;
}

function getMonthlySales(m){
  const v=J(localStorage.getItem(`cc_ventes_${m.annee}_${P(m.mois)}`));
  return Array.isArray(v)?v:[];
}

function getDcoRows(src){
  const rawRows=src?.cache?.raw?.rows;
  if(Array.isArray(rawRows))return rawRows;
  const dataRows=src?.data?.rows;
  if(Array.isArray(dataRows))return dataRows;
  return [];
}

function collectIntegrity(src){
  if(!src)return{month:null,missing:[],withoutNumber:[],dcoNumbers:[],tbrNumbers:[]};
  const month=getMonth(src);
  const sales=getMonthlySales(month).filter(v=>v&&!v.annulation);
  const rows=getDcoRows(src);
  const dcoSet=new Set();

  rows.forEach(r=>{
    if(!r)return;
    const n=normNum(r.num||r.numClient);
    const cancelled=!!r.isAnnulation||N(r.nb)<0;
    if(n&&!cancelled)dcoSet.add(n);
  });

  const seen=new Set();
  const missing=[];
  const withoutNumber=[];
  const analyses=Array.isArray(src.data?.analyses)?src.data.analyses:[];

  sales.forEach(v=>{
    const n=normNum(v.numClient);
    if(!n){
      withoutNumber.push({name:S(v.nomClient)||'Client TBR',type:S(v.typeVente),date:S(v.dateVente||v.dateInstallation)});
      return;
    }
    if(seen.has(n))return;
    seen.add(n);
    if(dcoSet.has(n))return;
    const existing=analyses.find(a=>a&&a.type==='missing_dco'&&normNum(a.num)===n);
    missing.push({
      num:n,
      name:S(v.nomClient)||S(existing?.nom)||'Client TBR',
      type:S(v.typeVente)||S(existing?.catpub),
      date:S(v.dateVente||v.dateInstallation),
      installation:!!v.installation,
      estimate:existing?R(existing.tbr||existing.verseEnMoins||0):0,
      source:'TBR'
    });
  });

  return{
    month,
    missing,
    withoutNumber,
    dcoNumbers:[...dcoSet],
    tbrNumbers:[...seen]
  };
}

function snapshotSignature(numbers){
  return [...new Set((numbers||[]).map(normNum).filter(Boolean))].sort().join('|');
}

function rememberAndCompare(src,integrity){
  if(!src||!integrity?.month)return{removed:[],added:[],previous:null};
  const month=integrity.month;
  const rows=getDcoRows(src).filter(r=>r&&!r.isAnnulation&&N(r.nb)>=0);
  const currentRows=rows.map(r=>({num:normNum(r.num||r.numClient),name:S(r.nom),type:S(r.catpub)})).filter(r=>r.num);
  const signature=snapshotSignature(currentRows.map(r=>r.num));
  if(!signature)return{removed:[],added:[],previous:null};

  let history=J(localStorage.getItem(HISTORY_KEY));
  if(!Array.isArray(history))history=[];
  const monthKey=`${month.annee}-${P(month.mois)}`;
  const sameMonth=history.filter(x=>x&&x.monthKey===monthKey);
  const previous=[...sameMonth].reverse().find(x=>x.signature&&x.signature!==signature)||null;

  let removed=[];
  let added=[];
  if(previous){
    const cur=new Set(currentRows.map(r=>r.num));
    const prev=new Set((previous.rows||[]).map(r=>r.num));
    removed=(previous.rows||[]).filter(r=>r.num&&!cur.has(r.num));
    added=currentRows.filter(r=>r.num&&!prev.has(r.num));
  }

  const already=history.some(x=>x&&x.monthKey===monthKey&&x.signature===signature);
  if(!already){
    history.push({
      monthKey,
      signature,
      rows:currentRows,
      at:new Date().toISOString(),
      file:S(src.cache?.name)
    });
    if(history.length>24)history=history.slice(-24);
    try{localStorage.setItem(HISTORY_KEY,JSON.stringify(history));}catch(_){/* non bloquant */}
  }

  return{removed,added,previous};
}

function ch75(v){
  if(!v||v.annulation||v.typeVente!=='VD'||!/^2026-07-/.test(S(v.dateVente))||!/^2026-07-/.test(S(v.dateInstallation)))return null;
  const d=S(v.dateVente),i=S(v.dateInstallation),day=new Date(d+'T12:00:00').getDay();
  if(day===0)return null;
  if(d>='2026-07-11'&&d<='2026-07-14'&&i<'2026-07-16')return'11–14 juillet';
  if(d>='2026-07-25'&&d<='2026-07-28'&&i<'2026-07-30')return'25–28 juillet';
  return null;
}

function collect(src){
  const d=src.data||{};
  const m=getMonth(src);
  const confirmed=[];
  const verify=[];
  const installs=[];
  const boosts=[];
  const integrity=collectIntegrity(src);
  const versionDiff=rememberAndCompare(src,integrity);

  (d.globalRows||[]).forEach(r=>{
    const e=R(r?.ecart);
    if(r?.money&&e<-0.99&&S(r.label)!=='Installations total'){
      confirmed.push({title:S(r.label)||'Rubrique DCO',dco:R(r.dco),tbr:R(r.tbr),missing:Math.abs(e),why:S(r.detail||r.niveau||r.cause)});
    }
  });

  (d.analyses||[]).forEach(a=>{
    if(a?.type==='missing_dco')return;
    (a.lines||[]).forEach(l=>{
      const e=R(l?.ecart);
      if(e<-0.99)verify.push({client:S(a.nom)||'Client',num:S(a.num)||'—',title:S(l.label)||'Écart client',dco:R(l.dco),tbr:R(l.tbr),missing:Math.abs(e),why:S(l.niveau||a.detail||a.title)});
    });
  });

  const is=(d.installationIssues&&d.installationIssues.length)?d.installationIssues:(d.installationCandidates||[]);
  is.forEach(x=>{
    const e=R(x?.ecart);
    if(e<-0.99)installs.push({client:S(x.nom)||'Client',num:S(x.num)||'—',dco:R(x.dco),tbr:R(x.tbr),missing:Math.abs(e),why:S(x.cause)});
  });

  const challenges=J(localStorage.getItem(`dco_challenges_${m.annee}_${m.mois}`))||[];
  const ventes=getMonthlySales(m);
  ventes.forEach(v=>{
    const w=ch75(v);
    if(w)boosts.push({client:S(v.nomClient)||'Client',num:S(v.numClient)||'—',sale:S(v.dateVente),install:S(v.dateInstallation),window:w,amount:75});
  });

  const missingCore=(d.analyses||[]).filter(a=>a&&a.type==='missing_dco');
  const missingCoreAmount=R(missingCore.reduce((s,a)=>s+N(a.verseEnMoins||a.tbr||0),0));
  const rawClaim=R(d.verseEnMoins);
  const safeClaim=R(Math.max(0,rawClaim-missingCoreAmount));

  return{
    m,
    label:monthText(m),
    confirmed,
    verify,
    installs,
    challenges:Array.isArray(challenges)?challenges:[],
    boosts,
    integrity,
    versionDiff,
    total:R(d.totalDCO),
    rawClaim,
    safeClaim,
    missingCoreAmount,
    over:R(d.verseEnPlus)
  };
}

function detail(prefix,x){
  let s=`${prefix} ${x.title} : DCO ${M(x.dco)} · attendu TBR ${M(x.tbr)} · écart à contrôler ${M(x.missing)}.`;
  if(x.why)s+=` Motif : ${x.why}.`;
  return s;
}

function build(src){
  const a=collect(src);
  const out=['Bonjour,','',`Je demande une vérification détaillée de mon DCO de ${a.label}.`];
  if(a.total)out.push(`Montant DCO officiel détecté : ${M(a.total)}.`);
  out.push(`Montant chiffré à vérifier hors ventes totalement absentes du DCO : ${M(a.safeClaim)}.`);
  if(a.over>0)out.push(`Montant versé en plus identifié séparément : ${M(a.over)}. Il n'est pas utilisé pour compenser un manque.`);

  out.push('','1) VENTES SAISIES DANS TBR MAIS ABSENTES DU DCO');
  if(a.integrity.missing.length){
    a.integrity.missing.forEach((x,i)=>{
      out.push(`${i+1}. N° ${x.num} — ${x.name}${x.type?` — ${x.type}`:''}${x.date?` — vente ${x.date}`:''}`);
      out.push('   Cette vente est enregistrée dans TBR pour le mois du DCO, mais son numéro client est absent des lignes de vente du PDF importé.');
      out.push('   À vérifier en priorité : vente retirée, décalée de mois ou non comptabilisée. Son montant n’est pas ajouté automatiquement au total à réclamer tant que son traitement n’est pas confirmé.');
    });
  }else{
    out.push('- Toutes les ventes TBR disposant d’un numéro client sont retrouvées dans les lignes de vente du DCO importé.');
  }

  if(a.versionDiff.removed.length){
    out.push('','2) CLIENTS DISPARUS ENTRE DEUX VERSIONS DCO MÉMORISÉES');
    a.versionDiff.removed.forEach((x,i)=>out.push(`${i+1}. N° ${x.num} — ${x.name||'Client'}${x.type?` — ${x.type}`:''}`));
    out.push('- Ces disparitions sont détectées par comparaison des numéros clients entre deux versions différentes du même mois.');
  }

  out.push('',a.versionDiff.removed.length?'3) MONTANTS CONFIRMÉS À RÉCLAMER / CONTRÔLER':'2) MONTANTS CONFIRMÉS À RÉCLAMER / CONTRÔLER');
  if(a.confirmed.length)a.confirmed.forEach((x,i)=>out.push(detail(`${i+1}.`,x)));
  else out.push(a.safeClaim>0?`- Le contrôle chiffre ${M(a.safeClaim)} hors ventes absentes ; merci de communiquer le détail de calcul correspondant.`:'- Aucun manque global n’est actuellement suffisamment prouvé pour être présenté comme une créance certaine.');

  out.push('',a.versionDiff.removed.length?'4) COMMISSIONS ET PACKS CLIENT PAR CLIENT À VÉRIFIER':'3) COMMISSIONS ET PACKS CLIENT PAR CLIENT À VÉRIFIER');
  if(a.verify.length)a.verify.slice(0,40).forEach((x,i)=>out.push(detail(`${i+1}. N° ${x.num} — ${x.client} —`,x)));
  else out.push('- Aucun écart négatif client détaillé n’est présent dans l’analyse actuelle.');
  out.push('- Ces écarts restent des demandes de vérification tant que la règle applicable n’est pas suffisamment établie.');

  out.push('',a.versionDiff.removed.length?'5) INSTALLATIONS À VÉRIFIER':'4) INSTALLATIONS À VÉRIFIER');
  if(a.installs.length)a.installs.slice(0,30).forEach((x,i)=>out.push(`${i+1}. N° ${x.num} — ${x.client} : DCO ${M(x.dco)} · attendu TBR ${M(x.tbr)} · écart ${M(x.missing)}${x.why?` · ${x.why}`:''}.`));
  else out.push('- Aucun manque d’installation structuré n’est détecté dans les données actuelles.');

  out.push('',a.versionDiff.removed.length?'6) CHALLENGES / BOOSTERS À CONTRÔLER':'5) CHALLENGES / BOOSTERS À CONTRÔLER');
  if(a.challenges.length)a.challenges.forEach((c,i)=>{const q=Math.max(1,N(c.qte)||1),u=N(c.montant);out.push(`${i+1}. ${S(c.nom)||'Challenge'} : ${q} × ${M(u)} = ${M(q*u)} saisi dans TBR — à rapprocher des règles et du DCO.`);});
  else out.push('- Aucun challenge manuel n’est saisi pour ce mois dans TBR.');
  if(a.boosts.length){
    out.push('','Boosters +75 € potentiels détectés par les dates TBR :');
    a.boosts.forEach((x,i)=>out.push(`${i+1}. N° ${x.num} — ${x.client} — vente ${x.sale}, installation ${x.install}, fenêtre ${x.window} : +${M(75)} à vérifier.`));
  }

  out.push('',a.versionDiff.removed.length?'7) DEMANDE':'6) DEMANDE',
    'Merci de vérifier rubrique par rubrique et client par client les ventes absentes, commissions de vente, packs, installations, paliers, bonus et challenges, et de régulariser tout montant effectivement dû.',
    'Merci de m’indiquer également la règle appliquée pour chaque écart afin que je puisse rapprocher votre calcul de mon suivi.',
    '',
    'Cordialement,',
    'Tarek'
  );

  return{
    subject:`Vérification DCO — ${a.label}${a.integrity.missing.length?` — ${a.integrity.missing.length} vente(s) absente(s)`:a.safeClaim>0?` — écart ${M(a.safeClaim)}`:''}`,
    body:out.join('\n'),
    audit:a
  };
}

function addStyle(){
  if(document.getElementById(STYLE))return;
  const s=document.createElement('style');
  s.id=STYLE;
  s.textContent=`
#${ID},#${INTEGRITY_ID}{margin:18px 0;padding:18px;border-radius:26px;color:#f8fafc;box-shadow:0 18px 46px rgba(2,6,23,.3);font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
#${ID}{border:1px solid rgba(56,189,248,.34);background:linear-gradient(145deg,rgba(8,24,47,.99),rgba(31,38,78,.99))}
#${INTEGRITY_ID}{border:1px solid rgba(239,68,68,.38);background:linear-gradient(145deg,rgba(55,9,16,.98),rgba(31,17,38,.98))}
#${INTEGRITY_ID}.ok{border-color:rgba(16,185,129,.32);background:linear-gradient(145deg,rgba(5,46,36,.96),rgba(8,24,47,.98))}
#${ID} .k,#${INTEGRITY_ID} .k{font:900 11px/1.2 system-ui;letter-spacing:.13em;color:#7dd3fc;text-transform:uppercase}
#${INTEGRITY_ID} .k{color:#fca5a5}#${INTEGRITY_ID}.ok .k{color:#6ee7b7}
#${ID} h3,#${INTEGRITY_ID} h3{margin:8px 0 6px;font:950 21px/1.15 system-ui;color:#fff}
#${ID} p,#${INTEGRITY_ID} p{margin:0;color:#cbd5e1;font:750 13px/1.45 system-ui}
#${INTEGRITY_ID} .missing-list{display:grid;gap:8px;margin-top:13px}
#${INTEGRITY_ID} .missing-row{padding:11px 12px;border-radius:15px;background:rgba(2,6,23,.36);border:1px solid rgba(248,113,113,.18)}
#${INTEGRITY_ID} .missing-row b{display:block;font-size:13px;color:#fff}.missing-row span{display:block;margin-top:3px;font-size:11px;color:#fecaca;font-weight:750}
#${INTEGRITY_ID} .safe-note{margin-top:12px;padding:10px 12px;border-radius:14px;background:rgba(251,191,36,.09);color:#fde68a;font-size:11px;font-weight:800;line-height:1.45}
#${ID} .prep{width:100%;margin-top:14px;border:0;border-radius:17px;padding:15px;background:linear-gradient(135deg,#0ea5e9,#4f46e5);color:#fff;font:900 15px system-ui}
#${ID} .preview{display:none;margin-top:14px;padding-top:14px;border-top:1px solid rgba(148,163,184,.2)}
#${ID} textarea{box-sizing:border-box;width:100%;min-height:360px;border:1px solid rgba(148,163,184,.24);border-radius:14px;background:#020817;color:#e5eefb;padding:12px;font:12px/1.45 ui-monospace,monospace}
#${ID} .actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:9px}
#${ID} .actions button{border:1px solid rgba(148,163,184,.24);border-radius:14px;padding:12px;background:rgba(15,23,42,.72);color:#fff;font:850 12px system-ui}
#${ID} .open{background:linear-gradient(135deg,#0f766e,#0e7490)!important}`;
  document.head.appendChild(s);
}

function findPdfCard(){
  const nodes=[...document.querySelectorAll('h1,h2,h3,h4,div,span')];
  const title=nodes.find(el=>S(el.textContent)==='PDF DCO');
  if(!title)return null;
  return title.closest('.dco-card,.card,section')||title.parentElement?.parentElement||title.parentElement;
}

function findControlContainer(pdfCard){
  if(!pdfCard)return null;
  let p=pdfCard.parentElement;
  while(p&&p!==document.body){
    const txt=S(p.textContent);
    if(txt.includes('Lecture rapide du dossier')&&txt.includes('Alertes à traiter'))return p;
    p=p.parentElement;
  }
  return pdfCard.parentElement;
}

function renderIntegrity(pdfCard,src){
  let card=document.getElementById(INTEGRITY_ID);
  const integrity=collectIntegrity(src);
  const versionDiff=src?rememberAndCompare(src,integrity):{removed:[]};
  if(!card){
    card=document.createElement('section');
    card.id=INTEGRITY_ID;
    pdfCard.insertAdjacentElement('afterend',card);
  }

  const missing=integrity.missing||[];
  const removed=versionDiff.removed||[];
  const hasAlert=missing.length||removed.length;
  card.classList.toggle('ok',!hasAlert);

  if(!src){
    card.innerHTML='<div class="k">Contrôle intégrité DCO</div><h3>En attente du PDF DCO</h3><p>Après import, TBR vérifiera automatiquement que chaque vente saisie avec un numéro client existe bien dans le DCO.</p>';
    return;
  }

  if(!hasAlert){
    card.innerHTML=`<div class="k">Contrôle intégrité DCO · ${VERSION}</div><h3>✓ Aucun client TBR disparu détecté</h3><p>Toutes les ventes TBR avec un numéro client sont retrouvées dans les lignes de vente du DCO de ${monthText(integrity.month)}.</p>`;
    return;
  }

  const rows=[];
  missing.forEach(x=>rows.push(`<div class="missing-row"><b>VENTE TBR ABSENTE · N° ${x.num} — ${x.name}</b><span>${x.type||'Type non renseigné'}${x.date?` · vente ${x.date}`:''} · numéro client absent du DCO importé</span></div>`));
  removed.forEach(x=>{
    if(missing.some(m=>m.num===x.num))return;
    rows.push(`<div class="missing-row"><b>DISPARU ENTRE VERSIONS · N° ${x.num} — ${x.name||'Client'}</b><span>${x.type||'Type non renseigné'} · présent dans une version DCO précédente mémorisée, absent de la version actuelle</span></div>`);
  });

  card.innerHTML=`<div class="k">Alerte intégrité DCO · ${VERSION}</div><h3>⚠️ ${missing.length} vente(s) TBR absente(s) du DCO</h3><p>TBR compare maintenant les numéros clients saisis dans l’application avec les numéros réellement présents dans le PDF.</p><div class="missing-list">${rows.join('')}</div><div class="safe-note">Ces ventes sont signalées en priorité, mais leur montant n’est pas ajouté automatiquement au total à réclamer tant que leur traitement DCO n’est pas confirmé.</div>`;
}

function mount(){
  const pdfCard=findPdfCard();
  if(!pdfCard)return;
  addStyle();
  const src=getSource();
  renderIntegrity(pdfCard,src);

  let card=document.getElementById(ID);
  if(card)return;
  const container=findControlContainer(pdfCard);
  if(!container)return;

  card=document.createElement('section');
  card.id=ID;
  card.innerHTML=`<div class="k">Réclamation DCO assistée · ${VERSION}</div><h3>✉️ Préparer mon mail de réclamation</h3><p>Le mail inclut maintenant les ventes TBR totalement absentes du DCO, séparées des montants chiffrés pour éviter toute fausse créance.</p><button class="prep" type="button">Préparer le mail détaillé</button><div class="preview"><textarea aria-label="Mail DCO"></textarea><div class="actions"><button class="copy" type="button">Copier le mail</button><button class="open" type="button">Ouvrir ma messagerie</button></div></div>`;

  const integrityCard=document.getElementById(INTEGRITY_ID);
  (integrityCard||pdfCard).insertAdjacentElement('afterend',card);

  const prep=card.querySelector('.prep');
  const pre=card.querySelector('.preview');
  const ta=card.querySelector('textarea');
  const copy=card.querySelector('.copy');
  const open=card.querySelector('.open');
  let current=null;

  prep.onclick=()=>{
    const live=getSource();
    if(!live){
      prep.textContent='Importe d’abord ton DCO';
      setTimeout(()=>prep.textContent='Préparer le mail détaillé',2200);
      return;
    }
    current=build(live);
    ta.value=current.body;
    pre.style.display='block';
    const miss=current.audit.integrity.missing.length;
    prep.textContent=miss?`Mail prêt · ${miss} vente(s) absente(s)`:`Mail prêt · ${M(current.audit.safeClaim)} à vérifier`;
    renderIntegrity(pdfCard,live);
  };

  copy.onclick=async()=>{
    if(!ta.value)return;
    try{await navigator.clipboard.writeText(ta.value)}catch(_){ta.focus();ta.select();document.execCommand('copy')}
    copy.textContent='✓ Copié';
    setTimeout(()=>copy.textContent='Copier le mail',1600);
  };

  open.onclick=()=>{
    const live=getSource();
    if(!live)return;
    if(!current)current=build(live);
    location.href='mailto:?subject='+encodeURIComponent(current.subject)+'&body='+encodeURIComponent(ta.value||current.body);
  };
}

function boot(){
  mount();
  const obs=new MutationObserver(()=>mount());
  obs.observe(document.body||document.documentElement,{childList:true,subtree:true});
  window.addEventListener('storage',()=>mount());
  setInterval(mount,1200);
}

window.TBR_DCO_INTEGRITY={
  version:VERSION,
  collect:()=>{const src=getSource();return src?collectIntegrity(src):null;},
  buildMail:()=>{const src=getSource();return src?build(src):null;}
};

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
else boot();
})();
