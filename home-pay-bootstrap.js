(async()=>{
  const VERSION="2026.07.26-home-pay-v8";
  const response=await fetch(`dco-audit-bootstrap.js?v=${encodeURIComponent(VERSION)}`,{cache:"no-store"});
  if(!response.ok) throw new Error("Moteur TBR indisponible");
  let source=await response.text();

  source=source.replace('const EMBEDDED_VERSION="2026.07.26-home-month-v7";','const EMBEDDED_VERSION="'+VERSION+'";');

  const payVarsAnchor='  const warning=!onTrack||projVD<objVD;';
  const payVarsPatch=`  const warning=!onTrack||projVD<objVD;
  const payBreakdown=safeDetails.reduce((acc,v)=>{
    const r=v.result||{};
    acc.sales+=Number(r.kit||0)+Number(r.partnerSale||0);
    acc.vdBonus+=Number(r.bonus||0);
    acc.packs+=Number(r.packs||0);
    acc.install+=Number(r.install||0)+Number(r.partnerInstall||0);
    acc.deductions+=Number(r.malus||0);
    acc.packCount+=Array.isArray(v.packs)?v.packs.length:0;
    if(v.installation||v.statut==="Installe"||Number(r.install||0)>0||Number(r.partnerInstall||0)>0) acc.installedCount+=1;
    return acc;
  },{sales:0,vdBonus:0,packs:0,install:0,deductions:0,packCount:0,installedCount:0});
  const knownPayTotal=payBreakdown.sales+payBreakdown.vdBonus+payBreakdown.packs+payBreakdown.install+payBreakdown.deductions+Number(syn.pv||0)+Number(syn.pvd||0)+Number(syn.bsgp||0)+Number(syn.totalChall||0);
  const payAdjustment=Math.round((Number(syn.grand||0)-knownPayTotal)*100)/100;
  const payRows=[
    {code:"€",label:"Commissions ventes",note:"Kits et ventes partenaires",value:payBreakdown.sales},
    {code:"VD",label:"Bonus VD / VF",note:"Bonus liés au type de vente",value:payBreakdown.vdBonus},
    {code:"P",label:"Commissions packs",note:payBreakdown.packCount+" pack(s) saisi(s)",value:payBreakdown.packs},
    {code:"I",label:"Installations",note:payBreakdown.installedCount+" dossier(s) pris en compte",value:payBreakdown.install},
    {code:"V",label:"Palier ventes",note:syn.vn+" vente(s) nette(s)",value:Number(syn.pv||0)},
    {code:"D",label:"Palier VD",note:syn.vd+" vente(s) directe(s)",value:Number(syn.pvd||0)},
    {code:"S",label:"Bonus "+status,note:"Bonus de performance SGP",value:Number(syn.bsgp||0)},
    {code:"★",label:"Challenges",note:"Primes exceptionnelles saisies",value:Number(syn.totalChall||0)},
    {code:"−",label:"Déductions et malus",note:"Remises, offres et corrections",value:payBreakdown.deductions,negative:true}
  ].concat(Math.abs(payAdjustment)>=0.01?[{code:"±",label:"Autres ajustements",note:"Écart technique du calcul détaillé",value:payAdjustment,negative:payAdjustment<0}]:[]);
  const payVfCount=safeDetails.filter(v=>v.typeVente==="VF").length;`;

  const payHomeAnchor=`    <div className="flight-home">
      <section className="flight-hero">`;
  const payHomePatch=`    <div className="flight-home tbr-pay-home-v8">
      <section className="tbr-pay-command">
        <div className="tbr-pay-aura one"></div><div className="tbr-pay-aura two"></div>
        <div className="tbr-pay-head">
          <div><span className="tbr-pay-kicker"><i></i> PAYE EN DIRECT</span><h1>Ta rémunération, décortiquée.</h1><p>Estimation calculée à partir de tes saisies TBR, avant validation du DCO.</p></div>
          <div className="tbr-pay-period"><span>{MOIS_NOMS[moisActif.mois-1]}</span><b>{moisActif.annee}</b></div>
        </div>
        <div className="tbr-pay-total-zone">
          <div className="tbr-pay-total"><span>PAYE ESTIMÉE TBR</span><strong>{fmt(syn.grand||0)}</strong><small>Montant commercial estimé · contrôle DCO à venir</small></div>
          <div className="tbr-pay-radar"><div><strong>{syn.vn}</strong><span>VENTES NETTES</span></div><i></i></div>
        </div>
        <div className="tbr-pay-quick">
          <div><span>VD</span><b>{syn.vd}</b></div><div><span>VF</span><b>{payVfCount}</b></div><div><span>Installations</span><b>{payBreakdown.installedCount}</b></div><div><span>Packs</span><b>{payBreakdown.packCount}</b></div><div><span>Annulations</span><b>{syn.ann||0}</b></div>
        </div>
      </section>

      <section className="tbr-pay-breakdown">
        <div className="tbr-pay-section-head"><div><span>COMPOSITION DE TA PAYE</span><h2>D’où vient exactement {fmt(syn.grand||0)} ?</h2></div><em>Calcul TBR</em></div>
        <div className="tbr-pay-lines">{payRows.map((item,index)=><div className={("tbr-pay-line "+(item.negative?"is-negative":"")+(item.value===0?" is-zero":""))} key={item.label}><span className="tbr-pay-code">{item.code}</span><div><strong>{item.label}</strong><small>{item.note}</small></div><b>{fmt(item.value)}</b></div>)}</div>
        <div className="tbr-pay-reconcile"><span>Total recomposé</span><b>{fmt(payRows.reduce((sum,item)=>sum+Number(item.value||0),0))}</b><em>{Math.abs(payRows.reduce((sum,item)=>sum+Number(item.value||0),0)-Number(syn.grand||0))<0.01?"Calcul équilibré ✓":"À contrôler"}</em></div>
      </section>

      <section className="flight-hero">`;

  const payCss=`<style id="tbr-home-pay-v8">
  .tbr-pay-home-v8{display:flex!important;flex-direction:column!important;gap:18px!important}.tbr-pay-command,.tbr-pay-breakdown{position:relative;overflow:hidden;border:1px solid rgba(125,211,252,.20);border-radius:32px;background:radial-gradient(circle at 12% 0%,rgba(14,165,233,.22),transparent 32%),radial-gradient(circle at 92% 18%,rgba(99,102,241,.24),transparent 34%),linear-gradient(145deg,rgba(5,13,30,.98),rgba(8,18,40,.96));box-shadow:0 28px 70px rgba(2,6,23,.38),inset 0 1px 0 rgba(255,255,255,.06);color:#f8fafc}.tbr-pay-command{padding:28px}.tbr-pay-command:before,.tbr-pay-breakdown:before{content:"";position:absolute;inset:0;pointer-events:none;background-image:linear-gradient(rgba(125,211,252,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(125,211,252,.035) 1px,transparent 1px);background-size:44px 44px;mask-image:linear-gradient(to bottom,#000,transparent 88%)}.tbr-pay-aura{position:absolute;border-radius:50%;filter:blur(52px);pointer-events:none}.tbr-pay-aura.one{width:260px;height:180px;background:rgba(56,189,248,.16);left:-90px;top:40px}.tbr-pay-aura.two{width:270px;height:190px;background:rgba(99,102,241,.17);right:-100px;bottom:-60px}.tbr-pay-head,.tbr-pay-total-zone,.tbr-pay-quick,.tbr-pay-section-head,.tbr-pay-lines,.tbr-pay-reconcile{position:relative;z-index:1}.tbr-pay-head{display:flex;align-items:flex-start;justify-content:space-between;gap:22px}.tbr-pay-kicker{display:flex;align-items:center;gap:8px;color:#7dd3fc;font-size:10px;font-weight:1000;letter-spacing:.18em}.tbr-pay-kicker i{width:8px;height:8px;border-radius:50%;background:#38bdf8;box-shadow:0 0 18px #38bdf8}.tbr-pay-head h1{margin:9px 0 6px;font-size:clamp(28px,4vw,48px);line-height:.98;letter-spacing:-.05em}.tbr-pay-head p{margin:0;color:#94a3b8;font-size:12px;font-weight:750}.tbr-pay-period{min-width:112px;text-align:center;padding:11px 14px;border-radius:19px;background:rgba(2,6,23,.48);border:1px solid rgba(125,211,252,.20)}.tbr-pay-period span{display:block;color:#7dd3fc;font-size:11px;font-weight:950;text-transform:uppercase;letter-spacing:.12em}.tbr-pay-period b{display:block;margin-top:3px;font-size:25px}.tbr-pay-total-zone{display:grid;grid-template-columns:minmax(0,1fr) 190px;align-items:center;gap:22px;margin-top:28px;padding:22px;border-radius:27px;background:linear-gradient(135deg,rgba(2,6,23,.74),rgba(15,23,42,.52));border:1px solid rgba(125,211,252,.17);box-shadow:inset 0 0 45px rgba(56,189,248,.04)}.tbr-pay-total span{display:block;color:#a5b4fc;font-size:10px;font-weight:1000;letter-spacing:.18em}.tbr-pay-total strong{display:block;margin:8px 0 7px;color:#fff;font-size:clamp(50px,8vw,88px);line-height:.9;letter-spacing:-.065em;text-shadow:0 0 34px rgba(56,189,248,.22)}.tbr-pay-total small{color:#94a3b8;font-size:11px;font-weight:750}.tbr-pay-radar{position:relative;width:150px;height:150px;margin:auto;border-radius:50%;display:grid;place-items:center;background:conic-gradient(from 205deg,#38bdf8 0 72%,#6366f1 72% 86%,rgba(148,163,184,.12) 86% 100%);box-shadow:0 0 45px rgba(56,189,248,.16)}.tbr-pay-radar:before{content:"";position:absolute;inset:9px;border-radius:50%;background:#071126;border:1px solid rgba(255,255,255,.08)}.tbr-pay-radar>div{position:relative;z-index:1;text-align:center}.tbr-pay-radar strong{display:block;font-size:44px;line-height:1}.tbr-pay-radar span{display:block;margin-top:6px;color:#7dd3fc;font-size:8px;font-weight:1000;letter-spacing:.13em}.tbr-pay-radar i{position:absolute;width:11px;height:11px;border-radius:50%;top:8px;right:31px;background:#fff;box-shadow:0 0 18px #7dd3fc}.tbr-pay-quick{display:grid;grid-template-columns:repeat(5,1fr);gap:9px;margin-top:14px}.tbr-pay-quick>div{padding:12px;border-radius:17px;background:rgba(15,23,42,.56);border:1px solid rgba(148,163,184,.13);text-align:center}.tbr-pay-quick span{display:block;color:#94a3b8;font-size:9px;font-weight:950;text-transform:uppercase;letter-spacing:.08em}.tbr-pay-quick b{display:block;margin-top:4px;color:#e0f2fe;font-size:22px}.tbr-pay-breakdown{padding:24px}.tbr-pay-section-head{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;margin-bottom:17px}.tbr-pay-section-head span{color:#7dd3fc;font-size:9px;font-weight:1000;letter-spacing:.17em}.tbr-pay-section-head h2{margin:5px 0 0;font-size:clamp(21px,3vw,31px);letter-spacing:-.035em}.tbr-pay-section-head em{font-style:normal;padding:7px 10px;border-radius:999px;color:#a5b4fc;background:rgba(99,102,241,.14);border:1px solid rgba(129,140,248,.24);font-size:9px;font-weight:950}.tbr-pay-lines{display:grid;grid-template-columns:1fr 1fr;gap:9px}.tbr-pay-line{display:grid;grid-template-columns:43px minmax(0,1fr) auto;align-items:center;gap:11px;padding:13px;border-radius:18px;background:rgba(15,23,42,.58);border:1px solid rgba(148,163,184,.13)}.tbr-pay-code{width:39px;height:39px;border-radius:13px;display:grid;place-items:center;background:linear-gradient(145deg,rgba(56,189,248,.22),rgba(99,102,241,.20));border:1px solid rgba(125,211,252,.22);color:#bae6fd;font-size:11px;font-weight:1000}.tbr-pay-line strong{display:block;color:#f8fafc;font-size:12px}.tbr-pay-line small{display:block;margin-top:3px;color:#7f91aa;font-size:9px;font-weight:750}.tbr-pay-line>b{color:#7dd3fc;font-size:17px;white-space:nowrap}.tbr-pay-line.is-negative{border-color:rgba(248,113,113,.18);background:rgba(69,10,10,.18)}.tbr-pay-line.is-negative .tbr-pay-code{background:rgba(239,68,68,.13);border-color:rgba(248,113,113,.24);color:#fecaca}.tbr-pay-line.is-negative>b{color:#fda4af}.tbr-pay-line.is-zero{opacity:.58}.tbr-pay-reconcile{display:flex;align-items:center;gap:12px;margin-top:13px;padding:15px 17px;border-radius:19px;background:linear-gradient(135deg,rgba(14,165,233,.12),rgba(99,102,241,.10));border:1px solid rgba(125,211,252,.20)}.tbr-pay-reconcile span{color:#cbd5e1;font-size:11px;font-weight:900}.tbr-pay-reconcile b{margin-left:auto;color:#fff;font-size:23px}.tbr-pay-reconcile em{font-style:normal;color:#86efac;font-size:9px;font-weight:1000}.tbr-pay-home-v8 .flight-money-panel{display:none!important}.tbr-pay-home-v8 .flight-main-grid{grid-template-columns:1fr!important}.tbr-pay-home-v8 .flight-instruments{width:100%!important}.tbr-pay-home-v8 .flight-hero{order:3}.tbr-pay-home-v8 .flight-chart-card{order:4}.tbr-pay-home-v8 .flight-bottom-grid{order:5}
  @media(max-width:760px){.tbr-pay-command,.tbr-pay-breakdown{border-radius:24px;padding:17px}.tbr-pay-head{align-items:center}.tbr-pay-head h1{font-size:30px}.tbr-pay-period{min-width:86px;padding:9px}.tbr-pay-period b{font-size:21px}.tbr-pay-total-zone{grid-template-columns:1fr 105px;padding:16px;gap:10px}.tbr-pay-total strong{font-size:49px}.tbr-pay-radar{width:96px;height:96px}.tbr-pay-radar strong{font-size:31px}.tbr-pay-radar span{font-size:6px}.tbr-pay-radar i{width:8px;height:8px;right:21px}.tbr-pay-quick{grid-template-columns:repeat(3,1fr)}.tbr-pay-lines{grid-template-columns:1fr}.tbr-pay-line{grid-template-columns:39px minmax(0,1fr) auto;padding:11px}.tbr-pay-code{width:35px;height:35px}.tbr-pay-line>b{font-size:15px}.tbr-pay-reconcile{flex-wrap:wrap}.tbr-pay-reconcile b{font-size:20px}}
  @media(max-width:430px){.tbr-pay-head p{display:none}.tbr-pay-head h1{font-size:26px}.tbr-pay-total-zone{grid-template-columns:1fr}.tbr-pay-radar{display:none}.tbr-pay-total strong{font-size:52px}.tbr-pay-quick{grid-template-columns:repeat(5,1fr);gap:5px}.tbr-pay-quick>div{padding:9px 3px}.tbr-pay-quick span{font-size:7px}.tbr-pay-quick b{font-size:18px}.tbr-pay-section-head em{display:none}.tbr-pay-line small{font-size:8px}}
  </style>`;

  const definitions=`\n  const payVarsAnchor=${JSON.stringify(payVarsAnchor)};\n  const payVarsPatch=${JSON.stringify(payVarsPatch)};\n  const payHomeAnchor=${JSON.stringify(payHomeAnchor)};\n  const payHomePatch=${JSON.stringify(payHomePatch)};\n  const payCss=${JSON.stringify(payCss)};\n`;
  const definitionAnchor="  const finalWriteAnchor='  document.open();';";
  if(!source.includes(definitionAnchor)) throw new Error("Point de génération TBR introuvable");
  source=source.replace(definitionAnchor,definitions+definitionAnchor);

  const writeAnchor='  html=html.replace("</head>",tbrHomeHeaderCss+"</head>");\n\n  document.open();`';
  const writePatch='  html=html.replace("</head>",tbrHomeHeaderCss+"</head>");\n  const tbrPayVarsAnchor=${JSON.stringify(payVarsAnchor)};\n  const tbrPayVarsPatch=${JSON.stringify(payVarsPatch)};\n  if(!html.includes(tbrPayVarsAnchor)) fail("Calcul de la paye accueil introuvable");\n  html=html.replace(tbrPayVarsAnchor,tbrPayVarsPatch);\n  const tbrPayHomeAnchor=${JSON.stringify(payHomeAnchor)};\n  const tbrPayHomePatch=${JSON.stringify(payHomePatch)};\n  if(!html.includes(tbrPayHomeAnchor)) fail("Accueil paye introuvable");\n  html=html.replace(tbrPayHomeAnchor,tbrPayHomePatch);\n  const tbrPayCss=${JSON.stringify(payCss)};\n  html=html.replace("</head>",tbrPayCss+"</head>");\n\n  document.open();`';
  if(!source.includes(writeAnchor)) throw new Error("Écriture du nouvel accueil introuvable");
  source=source.replace(writeAnchor,writePatch);

  try{localStorage.setItem("cc_version",VERSION);}catch(e){}
  (0,eval)(source);
})().catch(error=>{
  console.error(error);
  const target=document.getElementById("boot-msg");
  if(target){target.className="boot-error";target.textContent="TBR n’a pas pu charger le tableau de paye : "+(error&&error.message?error.message:error);}
});
