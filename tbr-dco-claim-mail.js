/* TBR 2.0 — Mail de réclamation DCO — préparation locale, aucun envoi automatique */
(function(){
  'use strict';
  const VERSION='1.0.0';
  const ID='tbr-dco-claim-mail';
  const STYLE_ID='tbr-dco-claim-mail-style';
  const MONTHS=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];

  const J=v=>{try{return JSON.parse(v)}catch(_){return null}};
  const N=v=>Number.isFinite(Number(v))?Number(v):0;
  const R=v=>Math.round(N(v)*100)/100;
  const M=v=>new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(N(v));
  const S=v=>String(v==null?'':v).trim();
  const P=v=>String(v).padStart(2,'0');

  function getSource(){
    const c5=J(localStorage.getItem('tbr_dco_cache_v5_double_source'));
    if(c5&&c5.data)return{cache:c5,data:c5.data,key:'tbr_dco_cache_v5_double_source'};
    const c2=J(localStorage.getItem('tbr_dco_cache_v2'));
    if(c2&&c2.data)return{cache:c2,data:c2.data,key:'tbr_dco_cache_v2'};
    return null;
  }

  function getMonth(src){
    const active=J(localStorage.getItem('dco_moisActif'))||{};
    const d=src&&src.data||{},c=src&&src.cache||{};
    const m=d.moisUsed||d.moisDoc||c.month||active||{};
    return{annee:N(m.annee)||N(active.annee)||new Date().getFullYear(),mois:N(m.mois)||N(active.mois)||new Date().getMonth()+1};
  }

  function monthLabel(m){return `${MONTHS[Math.max(0,Math.min(11,m.mois-1))]} ${m.annee}`;}

  function challenge75(v){
    if(!v||v.annulation||v.typeVente!=='VD'||!/^2026-07-/.test(S(v.dateVente))||!/^2026-07-/.test(S(v.dateInstallation)))return null;
    const d=S(v.dateVente),i=S(v.dateInstallation),day=new Date(d+'T12:00:00').getDay();
    if(day===0)return null;
    if(d>='2026-07-11'&&d<='2026-07-14'&&i<'2026-07-16')return'11–14 juillet';
    if(d>='2026-07-25'&&d<='2026-07-28'&&i<'2026-07-30')return'25–28 juillet';
    return null;
  }

  function collect(src){
    const d=src.data||{},m=getMonth(src);
    const confirmed=[];
    const verify=[];
    const installs=[];
    const challenges=[];
    const boosts=[];

    (Array.isArray(d.globalRows)?d.globalRows:[]).forEach(r=>{
      const ec=R(r&&r.ecart);
      if(!r||!r.money||ec>=-0.99||S(r.label)==='Installations total')return;
      confirmed.push({
        title:S(r.label)||'Rubrique DCO',
        dco:R(r.dco),
        tbr:R(r.tbr),
        missing:Math.abs(ec),
        why:S(r.detail||r.niveau||r.cause)
      });
    });

    (Array.isArray(d.analyses)?d.analyses:[]).forEach(a=>{
      const lines=Array.isArray(a.lines)?a.lines:[];
      lines.forEach(l=>{
        const ec=R(l&&l.ecart);
        if(ec>=-0.99)return;
        verify.push({
          client:S(a.nom)||'Client',
          num:S(a.num)||'—',
          title:S(l.label)||'Écart client',
          dco:R(l.dco),
          tbr:R(l.tbr),
          missing:Math.abs(ec),
          why:S(l.niveau||a.detail||a.title),
          type:S(a.type)
        });
      });
    });

    const installSource=(Array.isArray(d.installationIssues)&&d.installationIssues.length)?d.installationIssues:(Array.isArray(d.installationCandidates)?d.installationCandidates:[]);
    installSource.forEach(x=>{
      const ec=R(x&&x.ecart);
      if(ec>=-0.99)return;
      installs.push({client:S(x.nom)||'Client',num:S(x.num)||'—',dco:R(x.dco),tbr:R(x.tbr),missing:Math.abs(ec),why:S(x.cause)});
    });

    const ch=J(localStorage.getItem(`dco_challenges_${m.annee}_${m.mois}`));
    (Array.isArray(ch)?ch:[]).forEach(c=>{
      const q=Math.max(1,N(c.qte)||1),unit=N(c.montant);
      challenges.push({name:S(c.nom)||'Challenge sans nom',qty:q,unit:unit,total:R(q*unit)});
    });

    const ventes=J(localStorage.getItem(`cc_ventes_${m.annee}_${P(m.mois)}`));
    (Array.isArray(ventes)?ventes:[]).forEach(v=>{
      const windowName=challenge75(v);
      if(!windowName)return;
      boosts.push({client:S(v.nomClient)||'Client',num:S(v.numClient)||'—',sale:S(v.dateVente),install:S(v.dateInstallation),window:windowName,amount:75});
    });

    return{
      month:m,
      monthText:monthLabel(m),
      confirmed,
      verify,
      installs,
      challenges,
      boosts,
      totalDco:R(d.totalDCO||((d.tbrSummary||{}).totalDCO)),
      claim:R(d.verseEnMoins),
      overpaid:R(d.verseEnPlus),
      coverage:N(d.couverture),
      sourceFirst:!!d.sourceFirst,
      sourceAudit:d.sourceAudit||null,
      agent:J(localStorage.getItem('dco_agent'))||{}
    };
  }

  function line(prefix,title,dco,tbr,missing,why){
    let s=`${prefix} ${title} : DCO ${M(dco)} · attendu TBR ${M(tbr)} · manque ${M(missing)}.`;
    if(why)s+=` Pourquoi : ${why}.`;
    return s;
  }

  function buildMail(src){
    const a=collect(src);
    const agent=S(a.agent.prenom);
    const subject=`Demande de vérification DCO — ${a.monthText}${a.claim>0?` — écart ${M(a.claim)}`:''}`;
    const out=[];
    out.push('Bonjour,','');
    out.push(`Je souhaite demander une vérification détaillée de mon DCO de ${a.monthText}.`);
    if(a.totalDco)out.push(`Montant DCO officiel détecté : ${M(a.totalDco)}.`);
    out.push(`Montant actuellement identifié comme manque confirmé : ${M(a.claim)}.`);
    if(a.overpaid>0)out.push(`Montant versé en plus identifié séparément : ${M(a.overpaid)}. Ce montant ne compense pas le manque signalé.`);
    out.push('');

    out.push('1) ÉCARTS CONFIRMÉS À CONTRÔLER / RÉCLAMER');
    if(a.confirmed.length){
      a.confirmed.forEach((x,i)=>out.push(line(`${i+1}.`,x.title,x.dco,x.tbr,x.missing,x.why)));
    }else if(a.claim>0){
      out.push(`- Le moteur DCO indique ${M(a.claim)} de manque confirmé, mais le détail structuré de la rubrique n'est pas disponible dans les données locales. Merci de vérifier le détail de calcul.`);
    }else{
      out.push('- Aucun manque confirmé n’est actuellement chiffré par le moteur source-first.');
    }
    out.push('');

    out.push('2) ÉCARTS CLIENT / COMMISSION / PACK À VÉRIFIER');
    if(a.verify.length){
      a.verify.slice(0,30).forEach((x,i)=>out.push(line(`${i+1}. N° ${x.num} — ${x.client} —`,x.title,x.dco,x.tbr,x.missing,x.why)));
      if(a.verify.length>30)out.push(`- ${a.verify.length-30} autre(s) écart(s) client sont visibles dans TBR.`);
      out.push('- Ces écarts client sont signalés comme pistes de contrôle et ne sont pas ajoutés automatiquement au montant réclamé lorsqu’une règle source fiable manque.');
    }else out.push('- Aucun écart client négatif détaillé n’est présent dans le contrôle actuel.');
    out.push('');

    out.push('3) INSTALLATIONS À VÉRIFIER');
    if(a.installs.length){
      a.installs.slice(0,20).forEach((x,i)=>out.push(line(`${i+1}. N° ${x.num} — ${x.client} —`,'Installation',x.dco,x.tbr,x.missing,x.why||'écart d’installation détecté')));
      if(a.installs.length>20)out.push(`- ${a.installs.length-20} autre(s) installation(s) à vérifier dans TBR.`);
      out.push('- Les installations restent séparées du manque confirmé tant que le forfait exact applicable n’est pas suffisamment justifié par la source.');
    }else out.push('- Aucun manque d’installation structuré n’est détecté dans les données actuelles.');
    out.push('');

    out.push('4) CHALLENGES / BOOSTERS À CONTRÔLER');
    if(a.challenges.length){
      a.challenges.forEach((x,i)=>out.push(`${i+1}. ${x.name} : ${x.qty} × ${M(x.unit)} = ${M(x.total)} saisi(s) dans TBR.`));
      out.push('- Les challenges saisis sont listés pour contrôle mais ne sont pas transformés automatiquement en créance, car certains challenges peuvent être intégrés dans les commissions, paliers ou décommissions du DCO.');
    }else out.push('- Aucun challenge manuel n’est saisi pour ce mois dans TBR.');
    if(a.boosts.length){
      out.push('');
      out.push('Boosters +75 € détectés dans les dates TBR :');
      a.boosts.forEach((x,i)=>out.push(`${i+1}. N° ${x.num} — ${x.client} — vente ${x.sale}, installation ${x.install}, fenêtre ${x.window} : +${M(x.amount)} potentiel à vérifier sur le DCO.`));
    }
    out.push('');

    out.push('5) DEMANDE');
    out.push('Merci de me confirmer, rubrique par rubrique et client par client, le calcul appliqué sur les commissions de vente, les packs, les installations, les paliers, les bonus et les challenges, et de régulariser tout montant effectivement dû.');
    out.push('Je peux transmettre le DCO et les éléments TBR correspondants si nécessaire.');
    if(agent)out.push('',`Cordialement,`,` ${agent}`);

    return{subject,body:out.join('\n'),audit:a};
  }

  function styles(){
    if(document.getElementById(STYLE_ID))return;
    const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
#${ID}{margin:14px 0;padding:16px;border:1px solid rgba(56,189,248,.28);border-radius:24px;background:linear-gradient(145deg,rgba(8,24,47,.98),rgba(22,32,65,.98));color:#f8fafc;box-shadow:0 18px 46px rgba(2,6,23,.28)}
#${ID} .cm-kicker{font:900 10px/1.2 system-ui;letter-spacing:.13em;color:#7dd3fc;text-transform:uppercase}
#${ID} h3{margin:7px 0 5px;font:950 18px/1.15 system-ui;color:#fff}
#${ID} p{margin:0;color:#cbd5e1;font:750 12px/1.45 system-ui}
#${ID} .cm-btn{width:100%;margin-top:13px;border:0;border-radius:16px;padding:14px 15px;background:linear-gradient(135deg,#0284c7,#4f46e5);color:#fff;font:900 14px/1.2 system-ui;box-shadow:0 10px 26px rgba(37,99,235,.24)}
#${ID} .cm-preview{display:none;margin-top:13px;padding-top:13px;border-top:1px solid rgba(148,163,184,.2)}
#${ID} textarea{width:100%;min-height:280px;resize:vertical;border:1px solid rgba(148,163,184,.24);border-radius:14px;background:#020817;color:#e5eefb;padding:12px;font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;outline:none}
#${ID} .cm-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:9px}
#${ID} .cm-actions button{border:1px solid rgba(148,163,184,.24);border-radius:14px;padding:12px;background:rgba(15,23,42,.72);color:#fff;font:850 12px/1.2 system-ui}
#${ID} .cm-actions button.cm-open{background:linear-gradient(135deg,#0f766e,#0e7490);border:0}
#${ID} .cm-note{margin-top:9px!important;color:#94a3b8!important;font-size:11px!important}
`;
    document.head.appendChild(s);
  }

  function mount(){
    const root=document.querySelector('.dco-v9');
    if(!root)return;
    styles();
    let card=document.getElementById(ID);
    if(card&&card.isConnected)return;
    card=document.createElement('section');card.id=ID;
    card.innerHTML=`<div class="cm-kicker">Réclamation DCO assistée · ${VERSION}</div><h3>✉️ Préparer mon mail de réclamation</h3><p>TBR reprend les écarts du contrôle et prépare un mail lisible : montant, rubrique, client, commission, pack, installation et challenges à vérifier. Rien n’est envoyé sans ton action.</p><button class="cm-btn" type="button">Préparer le mail détaillé</button><div class="cm-preview"><textarea aria-label="Mail de réclamation DCO"></textarea><div class="cm-actions"><button type="button" class="cm-copy">Copier le mail</button><button type="button" class="cm-open">Ouvrir ma messagerie</button></div><p class="cm-note">Le destinataire reste vide volontairement : tu choisis la bonne adresse dans ta messagerie.</p></div>`;
    const expert=document.getElementById('tbr-dco-expert-v3');
    if(expert&&expert.parentNode===root)expert.insertAdjacentElement('afterend',card);
    else{
      const upload=root.querySelector('.dco-upload-row');
      const uploadCard=upload&&upload.closest('.dco-card');
      if(uploadCard&&uploadCard.parentNode===root)uploadCard.insertAdjacentElement('afterend',card);else root.insertBefore(card,root.firstChild);
    }

    const prep=card.querySelector('.cm-btn'),preview=card.querySelector('.cm-preview'),ta=card.querySelector('textarea'),copy=card.querySelector('.cm-copy'),open=card.querySelector('.cm-open');
    let current=null;
    prep.addEventListener('click',()=>{
      const src=getSource();
      if(!src){prep.textContent='Importe d’abord ton DCO';setTimeout(()=>prep.textContent='Préparer le mail détaillé',2600);return;}
      current=buildMail(src);ta.value=current.body;preview.style.display='block';prep.textContent=`Mail prêt · ${M(current.audit.claim)} confirmé`;setTimeout(()=>preview.scrollIntoView({behavior:'smooth',block:'nearest'}),60);
    });
    copy.addEventListener('click',async()=>{
      if(!ta.value)return;
      try{await navigator.clipboard.writeText(ta.value);copy.textContent='✓ Copié';}catch(_){ta.focus();ta.select();document.execCommand('copy');copy.textContent='✓ Copié';}
      setTimeout(()=>copy.textContent='Copier le mail',1800);
    });
    open.addEventListener('click',()=>{
      const src=getSource();
      if(!src)return;
      if(!current)current=buildMail(src);
      const body=ta.value||current.body;
      location.href='mailto:?subject='+encodeURIComponent(current.subject)+'&body='+encodeURIComponent(body);
    });
  }

  function boot(){mount();new MutationObserver(mount).observe(document.documentElement,{childList:true,subtree:true});setInterval(mount,1500);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
