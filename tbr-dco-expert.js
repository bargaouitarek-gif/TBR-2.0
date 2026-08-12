/* TBR 2.0 — DCO Expert 3.1.0 — contrôle source-first, juillet 2026 */
(function(){
  const V='3.1.0', ID='tbr-dco-expert-v3';
  const J=x=>{try{return JSON.parse(x)}catch{return null}};
  const R=n=>Math.round((Number(n)||0)*100)/100;
  const M=n=>new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(Number(n)||0);
  const P=n=>String(n).padStart(2,'0');
  const sane=(n,max=100000)=>Number.isFinite(Number(n))&&Math.abs(Number(n))<=max;

  function ip(a){const n=Number(a&&a.ventesPrec)||0;return n>=6?1:n===5?.9:n===4?.8:n===3?.7:n===2?.6:n===1?.5:.4}
  function ca(v){return R((v.packs||[]).reduce((s,p)=>{let x=Number(p.prixCatalogueHT||p.prix||0),st=String(p.statutMat||'');if(st==='Offert')x=0;else if(st.includes('50%'))x*=.5;else if(st.includes('25%'))x*=.75;return s+x},0))}
  function cat(v){return R((v.packs||[]).reduce((s,p)=>s+Number(p.prixCatalogueHT||p.prix||0),0))}
  function kit(v,k){return (v.remsc==='REMSC'?110:v.remsc==='REMSC5'?145:Number(v.engagement)===36?130:180)*k}
  function bonus(v,c,k){if(v.typeVente==='VF')return v.typeClient==='PRO'?50*k:0;return (v.typeClient==='PRO'?(c>=100?200:100):(c>=100?100:50))*k}
  function abox(v){return R(-(v.codesAbo||[]).reduce((s,c)=>{let m=typeof c==='string'?((c.match(/ABO(\d+)/i)||[])[1]):c.montant||((String(c.code||'').match(/ABO(\d+)/i)||[])[1]);return s+(Number(m)||0)},0)*3)}
  function calc(v,k,special){
    if(v.annulation)return{sale:0,pack:0,install:0};
    if(v.partenaire){const c=String(v.partenaireCategorie||'APPARTEMENT').toUpperCase(),sale=c==='PRO'?120:c==='MAISON'?100:60,install=v.installation?(c==='APPARTEMENT'?40:60):0;return{sale,pack:0,install}}
    const c=ca(v),sale=R(kit(v,k)+bonus(v,c,k)+(special?abox(v):0)),pack=R(c*.25*k),install=v.installation?(cat(v)>=400?60:40):0;
    return{sale,pack,install};
  }
  function pv(n){if(n>=28)return 1750+Math.floor((n-28)/2)*150;let r=0,p={7:150,8:250,10:400,12:550,14:700,16:850,18:1000,20:1150,22:1300,24:1450,26:1600};for(const k in p)if(n>=Number(k))r=p[k];return r}
  function pvd(n){if(n<3)return 0;if(n>=10)return 1100+(n-10)*100;return({3:400,4:500,5:600,6:700,7:800,8:900,9:1000}[n]||0)}
  function pvdJul(n){const p={4:700,5:900,6:1100,7:1300,8:1500,9:1700,10:1900,11:2100,12:2300,13:2500,14:2700,15:2900,16:3100,17:3300,18:3500,19:3700};return p[n]??(n<4?0:null)}
  function sgp(s,vn,vd){s=String(s||'').toUpperCase();if(s==='PLATINIUM'){if(vd>=8)return 500+(vd-8)*100;if(vn>=8&&vd>=5)return 250+Math.max(0,Math.min(vd,7)-5)*75;if(vn>=8&&vd>=4)return 200}if(s==='GOLD'){if(vn>=8&&vd>=5)return 200+(vd-5)*75;if(vn>=8&&vd>=4)return 150}if(s==='SILVER'&&vn>=8&&vd>=4)return 100+(vd-4)*50;return 0}

  function vols(all,m){
    const a=all.filter(v=>!v.annulation),c=all.filter(v=>v.annulation);
    const x=J(localStorage.getItem(`dco_aimt_${m.annee}_${m.mois}`))||{},it=Array.isArray(x.items)?x.items:[];
    const av=it.length?it.filter(z=>z.typeVente==='VD').length:(Number(x.vd)||0),af=it.length?it.filter(z=>z.typeVente==='VF').length:(Number(x.vf)||0),at=av+af;
    return{active:a,brutes:a.length+c.length,nettes:c.length?a.length:Math.max(0,a.length-at),vd:c.length?a.filter(v=>v.typeVente==='VD').length:Math.max(0,a.filter(v=>v.typeVente==='VD').length-av)};
  }

  function ch75(v){
    if(v.annulation||v.typeVente!=='VD'||!/^2026-07-/.test(v.dateVente||'')||!/^2026-07-/.test(v.dateInstallation||''))return null;
    const d=v.dateVente,i=v.dateInstallation,day=new Date(d+'T12:00:00').getDay();if(day===0)return null;
    if(d>='2026-07-11'&&d<='2026-07-14'&&i<'2026-07-16')return'11–14 juillet';
    if(d>='2026-07-25'&&d<='2026-07-28'&&i<'2026-07-30')return'25–28 juillet';
    return null;
  }

  function summary(){
    const c=J(localStorage.getItem('tbr_dco_cache_v2'));if(!c)return null;
    const s=(c.raw&&c.raw.summary)||c.data||{},m=(c.raw&&c.raw.moisUsed)||s.moisDoc||c.month;
    if(!m)return null;
    const total=sane(s.totalDCO)?Number(s.totalDCO):0;
    const install=sane(s.comInstall,5000)?Number(s.comInstall):0;
    const palierV=sane(s.palierV,10000)?Number(s.palierV):0;
    const palierVD=sane(s.palierVD,10000)?Number(s.palierVD):0;
    const bonusSGP=sane(s.bonusSGP,10000)?Number(s.bonusSGP):0;
    let ventesPacks=sane(s.comVentesTotal,30000)?Number(s.comVentesTotal):0;
    if(!ventesPacks&&total)ventesPacks=R(total-install-palierV-palierVD-bonusSGP);
    const legacyData=c.data||{};
    const legacyCorrupt=Math.abs(Number(legacyData.verseEnPlus)||0)>50000||Math.abs(Number(legacyData.verseEnMoins)||0)>50000||Math.abs(Number(s.comVentes)||0)>50000||Math.abs(Number(s.comPacks)||0)>50000;
    return{cache:c,m,vBrutes:Number(s.vBrutes)||0,vNettes:Number(s.vNettes)||0,vDirectes:Number(s.vDirectes)||0,ventesPacks:R(ventesPacks),comInstall:R(install),palierV:R(palierV),palierVD:R(palierVD),bonusSGP:R(bonusSGP),total:R(total),legacyCorrupt};
  }

  function audit(){
    const s=summary();if(!s)return null;
    const all=J(localStorage.getItem(`cc_ventes_${s.m.annee}_${P(s.m.mois)}`))||[];
    const v=vols(all,s.m),a=J(localStorage.getItem('dco_agent'))||{statut:'PLATINIUM',ventesPrec:6},k=ip(a),jul=s.m.annee===2026&&s.m.mois===7,special=jul&&v.vd>=7;
    const rows=v.active.map(x=>({v:x,c:calc(x,k,special)}));
    const es=R(rows.reduce((t,x)=>t+x.c.sale,0)),ep=R(rows.reduce((t,x)=>t+x.c.pack,0)),ei=R(rows.reduce((t,x)=>t+x.c.install,0));
    const ventesPacksAttendus=R(es+ep),ev=pv(v.nettes),ed=jul?pvdJul(v.vd):pvd(v.vd),eb=sgp(a.statut,v.nettes,v.vd);
    const volChecks=[{l:'Ventes brutes',d:s.vBrutes,e:v.brutes},{l:'Ventes nettes',d:s.vNettes,e:v.nettes},{l:'Ventes directes',d:s.vDirectes,e:v.vd}];
    const okVol=volChecks.every(x=>x.d===x.e)&&ed!==null;
    const cats=[
      {l:'Ventes + packs',d:s.ventesPacks,e:ventesPacksAttendus,c:'strong',detail:`TBR : ventes ${M(es)} + packs ${M(ep)}`},
      {l:'Installations',d:s.comInstall,e:ei,c:'verify',detail:'Hors montant certain tant que les forfaits 55 € ne sont pas justifiés.'},
      {l:'Palier ventes',d:s.palierV,e:ev,c:'strong'},
      {l:'Palier VD',d:s.palierVD,e:ed,c:'strong'},
      {l:'Bonus S/G/P',d:s.bonusSGP,e:eb,c:'strong'}
    ].map(x=>Object.assign(x,{g:x.c==='verify'||x.e==null?null:R(x.e-x.d)}));
    const strong=cats.filter(x=>x.c==='strong'&&x.g!=null),claim=okVol?R(strong.filter(x=>x.g>0.99).reduce((t,x)=>t+x.g,0)):null,overpaid=okVol?R(strong.filter(x=>x.g<-0.99).reduce((t,x)=>t+(-x.g),0)):null,netCore=okVol?R(strong.reduce((t,x)=>t+x.g,0)):null;
    const paidCore=R(strong.reduce((t,x)=>t+x.d,0)),expectedCore=R(strong.reduce((t,x)=>t+x.e,0)),boost=v.active.map(x=>({v:x,w:ch75(x)})).filter(x=>x.w);
    return{s,v,a,jul,special,okVol,volChecks,cats,claim,overpaid,netCore,paidCore,expectedCore,installEstimate:ei,boost,potential:boost.length*75,es,ep};
  }

  function row(x){
    if(x.c==='verify')return`<div class="dx-row"><span>${x.l}</span><b>${M(x.d)} · estimation TBR ${M(x.e)}</b><em class="q">À vérifier</em>${x.detail?`<small class="dx-detail">${x.detail}</small>`:''}</div>`;
    const st=x.g==null?'À vérifier':Math.abs(x.g)<1?'Conforme':x.g>0?'Manque '+M(x.g):'Versé en plus '+M(-x.g),cl=x.g==null?'q':Math.abs(x.g)<1?'ok':x.g>0?'bad':'plus';
    return`<div class="dx-row"><span>${x.l}</span><b>${M(x.d)} → ${x.e==null?'—':M(x.e)}</b><em class="${cl}">${st}</em>${x.detail?`<small class="dx-detail">${x.detail}</small>`:''}</div>`;
  }

  function hideLegacy(root,p){
    root.querySelectorAll(':scope > .dco-verdict,:scope > .dco-explain-panel,:scope > .dco-alerts-panel,:scope > .dco-grid,:scope > .dco-warning').forEach(el=>el.style.display='none');
    Array.from(root.children).forEach(el=>{if(el===p||el.classList.contains('dco-hero')||el.classList.contains('dco-loading')||el.classList.contains('dco-error')||el.querySelector('.dco-upload-row'))return;if((el.textContent||'').includes('Contrôle client par client'))el.style.display='none'});
  }

  function render(){
    const root=document.querySelector('.dco-v9');if(!root)return;
    let p=document.getElementById(ID);
    if(!p){
      p=document.createElement('section');p.id=ID;
      const upload=root.querySelector('.dco-upload-row');const card=upload&&upload.closest('.dco-card');
      if(card&&card.parentNode===root)root.insertBefore(p,card.nextSibling);else root.insertBefore(p,root.firstChild);
    }
    const d=audit();hideLegacy(root,p);
    if(!d){p.innerHTML=`<div class="dx-hero"><small>DCO EXPERT ${V}</small><h2>Contrôle paie sécurisé</h2><p>Importe ton PDF DCO juste au-dessus. Le nouveau moteur travaille sur la synthèse officielle et ignore l'ancien calcul client devenu incohérent.</p></div>`;return}
    const verdict=!d.okVol?'Volumes à réconcilier avant de chiffrer une réclamation':d.claim>0?`Manque calculable : ${M(d.claim)}`:'Aucun manque calculable sur le cœur du DCO';
    const missing=d.cats.filter(x=>x.c==='strong'&&x.g>0.99),extra=d.cats.filter(x=>x.c==='strong'&&x.g<-0.99);
    const corrupt=d.s.legacyCorrupt?`<div class="dx-warning"><b>Ancien contrôle invalidé.</b> Les montants aberrants de plusieurs millions viennent du vieux parseur PDF. Ils sont volontairement ignorés ici.</div>`:'';
    const vols=d.volChecks.map(x=>`<div class="dx-vol ${x.d===x.e?'ok':'bad'}"><span>${x.l}</span><b>DCO ${x.d} · TBR ${x.e}</b></div>`).join('');
    p.innerHTML=`
      <div class="dx-hero"><small>DCO EXPERT ${V} · SOURCE-FIRST</small><h2>${verdict}</h2><p>DCO officiel ${M(d.s.total)} · ${d.s.vBrutes} ventes brutes · ${d.s.vNettes} nettes · ${d.s.vDirectes} VD. Aucun trop-versé ne vient compenser un manque.</p></div>
      ${corrupt}
      <div class="dx-kpis"><div><span>DCO officiel</span><b>${M(d.s.total)}</b></div><div><span>À réclamer calculable</span><b>${d.claim==null?'—':M(d.claim)}</b></div><div><span>Versé en plus</span><b>${d.overpaid==null?'—':M(d.overpaid)}</b></div><div><span>+75 potentiels</span><b>${d.boost.length} · ${M(d.potential)}</b></div></div>
      <div class="dx-grid">
        <div class="dx-card"><h3>Contrôle des volumes</h3>${vols}<p class="dx-note">Le montant à réclamer n'est chiffré que si les volumes DCO et TBR correspondent.</p></div>
        <div class="dx-card"><h3>Rubriques sûres</h3>${d.cats.map(row).join('')}<p class="dx-note"><b>Cœur vérifiable :</b> DCO ${M(d.paidCore)} · calcul TBR ${M(d.expectedCore)} · solde ${d.netCore==null?'—':M(d.netCore)}.</p></div>
        <div class="dx-card"><h3>Règles juillet 2026</h3><p><b>Palier VD spécial :</b> ${d.v.vd} VD ⇒ ${d.cats[3].e==null?'source incomplète':M(d.cats[3].e)}. Le barème standard ${M(pvd(d.v.vd))} n'est pas utilisé pour juillet.</p><p><b>Décommissions :</b> le moteur expert applique la règle ABOX à 3 € par euro d'abonnement dans le scénario spécial de juillet.</p><p><b>Packs :</b> le contrôle principal utilise « ventes + packs » ensemble, car l'annexe détaillée du PDF ne permet pas de rattacher proprement toutes les commissions packs client par client.</p></div>
        <div class="dx-card"><h3>À réclamer — calculable</h3>${d.claim==null?'<p class="dx-note">Pas de montant tant que les volumes ne sont pas réconciliés.</p>':missing.map(x=>`<p class="dx-claim"><b>${x.l}</b><span>${M(x.g)}</span></p>`).join('')||'<p class="dx-note">Aucun manque calculable dans les rubriques suffisamment sûres.</p>'}</div>
        <div class="dx-card"><h3>Versé en plus — séparé</h3>${d.overpaid==null?'<p class="dx-note">Pas de conclusion tant que les volumes ne sont pas réconciliés.</p>':extra.map(x=>`<p class="dx-claim"><b>${x.l}</b><span>${M(-x.g)}</span></p>`).join('')||'<p class="dx-note">Aucun versement en plus détecté dans les rubriques calculables.</p>'}</div>
        <div class="dx-card"><h3>Installations — à vérifier</h3><p><b>DCO :</b> ${M(d.s.comInstall)} · <b>estimation TBR :</b> ${M(d.installEstimate)}.</p><p class="dx-note">Je n'intègre volontairement aucun écart d'installation au montant certain : le DCO comporte notamment des forfaits à 55 € que le modèle TBR ne justifie pas encore assez sûrement.</p></div>
        <div class="dx-card"><h3>Boosters +75 — à vérifier</h3>${d.boost.map(x=>`<p class="dx-boost"><b>N° ${x.v.numClient||'—'} · ${x.v.nomClient||'Client'}</b><span>${x.w} · signé ${x.v.dateVente} · installé ${x.v.dateInstallation}</span></p>`).join('')||'<p class="dx-note">Aucune vente qualifiée automatiquement par les dates saisies.</p>'}<p class="dx-note">Les +75 € restent hors du montant certain jusqu'à confirmation de l'éligibilité exacte.</p></div>
      </div>`;
  }

  function boot(){
    let l=document.querySelector('link[data-dco-expert]');if(!l){l=document.createElement('link');l.rel='stylesheet';l.href='/tbr-dco-expert.css?v='+V;l.dataset.dcoExpert='1';document.head.appendChild(l)}
    render();new MutationObserver(render).observe(document.documentElement,{childList:true,subtree:true});setInterval(render,1500);window.TBR_DCO_EXPERT={version:V,audit,render};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
