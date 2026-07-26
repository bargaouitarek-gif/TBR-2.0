(async()=>{
  const SNAPSHOT="5fd7ade1955a6024ca972d77beaf35c8c23f339c";
  const EMBEDDED_VERSION="2026.07.26-home-month-v7";
  const RAW_ROOT=`https://raw.githubusercontent.com/bargaouitarek-gif/TBR-2.0/${SNAPSHOT}/`;
  const bootstrapResponse=await fetch(`${RAW_ROOT}dco-audit-bootstrap.js`,{cache:"no-store"});
  if(!bootstrapResponse.ok) throw new Error("Moteur DCO source indisponible");
  let source=await bootstrapResponse.text();

  const before='const response=await fetch("./index.html?dco-command-base=20260726",{cache:"no-store"});';
  const after=`const response=await fetch("${RAW_ROOT}index.html",{cache:"no-store"});`;
  if(!source.includes(before)) throw new Error("Point d’entrée du moteur DCO introuvable");
  source=source.replace(before,after);

  const htmlAnchor='  let html=await response.text();';
  const htmlPatch=`  let html=await response.text();
  const tbrEmbeddedVersion="${EMBEDDED_VERSION}";
  try{localStorage.setItem("cc_version",tbrEmbeddedVersion);}catch(e){}
  html=html.replace(/const\\s+APP_VERSION\\s*=\\s*"[^"]+"/,'const APP_VERSION = "'+tbrEmbeddedVersion+'"');`;
  if(!source.includes(htmlAnchor)) throw new Error("Synchronisation de version du moteur DCO introuvable");
  source=source.replace(htmlAnchor,htmlPatch);

  const parserStateBefore=String.raw`      let pendingNb=null;
      let pendingAt=-99;`;
  const parserStateAfter=String.raw`      let pendingNb=null;
      let pendingPrefix="";
      let pendingAt=-99;`;
  if(!source.includes(parserStateBefore)) throw new Error("État du lecteur DCO introuvable");
  source=source.replace(parserStateBefore,parserStateAfter);

  const parserLoopBefore=String.raw`        const nbOnly=line.match(/^(-?1|0)$/);
        if(nbOnly){flush();pendingNb=Number(nbOnly[1]);pendingAt=lineIndex;return;}
        const splitStart=(pendingNb!==null&&lineIndex-pendingAt<=2)?line.match(/^(\\d{6,8})(?:\\s+(.*))?$/):null;
        if(splitStart){flush();current={nb:pendingNb,num:normNum(splitStart[1]),parts:splitStart[2]?[splitStart[2]]:[],page:pageIndex+1};pendingNb=null;return;}`;
  const parserLoopAfter=String.raw`        const nbOnly=line.match(/^(-?1|0)$/);
        if(nbOnly){flush();pendingNb=Number(nbOnly[1]);pendingPrefix="";pendingAt=lineIndex;return;}
        const nbWithPrefix=line.match(/^(-?1|0)\\s+(.+)$/);
        if(nbWithPrefix&&!/^\\d{6,8}\\b/.test(nbWithPrefix[2])){
          flush();
          pendingNb=Number(nbWithPrefix[1]);
          pendingPrefix=nbWithPrefix[2].trim();
          pendingAt=lineIndex;
          return;
        }
        const splitStart=(pendingNb!==null&&lineIndex-pendingAt<=2)?line.match(/^(\\d{6,8})(?:\\s+(.*))?$/):null;
        if(splitStart){
          flush();
          current={nb:pendingNb,num:normNum(splitStart[1]),parts:[pendingPrefix,splitStart[2]||""].filter(Boolean),page:pageIndex+1};
          pendingNb=null;
          pendingPrefix="";
          return;
        }`;
  if(!source.includes(parserLoopBefore)) throw new Error("Boucle du lecteur DCO introuvable");
  source=source.replace(parserLoopBefore,parserLoopAfter);

  const parserExpiryBefore='        if(pendingNb!==null&&lineIndex-pendingAt>2) pendingNb=null;';
  const parserExpiryAfter='        if(pendingNb!==null&&lineIndex-pendingAt>2){pendingNb=null;pendingPrefix="";}';
  if(!source.includes(parserExpiryBefore)) throw new Error("Expiration du lecteur DCO introuvable");
  source=source.replace(parserExpiryBefore,parserExpiryAfter);

  const nomBefore='      const nom=body.slice(0,catMatch.index).replace(/TOTAL|ANNEXE.*$/gi,"").trim()||"Client";';
  const nomAfter='      let nom=body.slice(0,catMatch.index).replace(/TOTAL|ANNEXE.*$/gi,"").trim()||"Client";';
  if(!source.includes(nomBefore)) throw new Error("Nom client DCO introuvable");
  source=source.replace(nomBefore,nomAfter);

  const numericAnchor='      const numericPart=offerMatch?tail.slice(0,offerMatch.index):tail;';
  const numericPatch=String.raw`      const suffix=offerMatch?tail.slice(offerMatch.index+offerMatch[0].length).replace(/[^A-ZÀ-ÖØ-öø-ÿ0-9'’&(). -]/gi," ").replace(/\\s+/g," ").trim():"";
      if(suffix&&!/^(?:TOTAL|ANNEXE|Page\\b)/i.test(suffix)&&!/^[-+]?\\d+(?:[,.]\\d+)?$/.test(suffix)) nom=(nom+" "+suffix).replace(/\\s+/g," ").trim();
      const numericPart=offerMatch?tail.slice(0,offerMatch.index):tail;`;
  if(!source.includes(numericAnchor)) throw new Error("Montants du lecteur DCO introuvables");
  source=source.replace(numericAnchor,numericPatch);

  const aimtBlockBefore=String.raw`    const aimtAllItems=tbrAimtAllItems(aimt);
    const aimtItems=aimtAllItems.filter(tbrAimtHasImpact);
    const hasDetailedAimt=aimtAllItems.length>0;
    const aimtVD=hasDetailedAimt?aimtItems.filter(x=>x.typeVente==="VD").length:(Number(aimt&&aimt.vd)||0);
    const aimtVF=hasDetailedAimt?aimtItems.filter(x=>x.typeVente==="VF").length:(Number(aimt&&aimt.vf)||0);
    const aimtTotal=aimtVD+aimtVF;
    const tbrBrutes=active.length+cancelled.length;
    const tbrNettes=cancelled.length?active.length:Math.max(0,active.length-aimtTotal);
    const tbrAnnuls=cancelled.length?-cancelled.length:(aimtTotal?-aimtTotal:0);
    const tbrVDBase=active.filter(v=>v.typeVente==="VD").length;
    const tbrVD=cancelled.length?tbrVDBase:Math.max(0,tbrVDBase-aimtVD);`;
  const aimtBlockAfter=String.raw`    const aimtAllItems=tbrAimtAllItems(aimt);
    const aimtItems=aimtAllItems.filter(tbrAimtHasImpact);
    const hasDetailedAimt=aimtAllItems.length>0;
    const aimtVD=hasDetailedAimt?aimtItems.filter(x=>x.typeVente==="VD").length:(Number(aimt&&aimt.vd)||0);
    const aimtVF=hasDetailedAimt?aimtItems.filter(x=>x.typeVente==="VF").length:(Number(aimt&&aimt.vf)||0);
    const cancelledNums=new Set(cancelled.map(v=>normNum(v.numClientAnn||v.numClient)).filter(Boolean));
    const externalAimtItems=hasDetailedAimt?aimtItems.filter(x=>!cancelledNums.has(normNum(x.numClient))):[];
    const externalAimtVD=hasDetailedAimt?externalAimtItems.filter(x=>x.typeVente==="VD").length:aimtVD;
    const externalAimtVF=hasDetailedAimt?externalAimtItems.filter(x=>x.typeVente==="VF").length:aimtVF;
    const externalAimtTotal=externalAimtVD+externalAimtVF;
    const tbrBrutes=active.length+cancelled.length;
    const tbrNettes=Math.max(0,active.length-externalAimtTotal);
    const totalAnnulations=cancelled.length+externalAimtTotal;
    const tbrAnnuls=totalAnnulations?-totalAnnulations:0;
    const tbrVDBase=active.filter(v=>v.typeVente==="VD").length;
    const tbrVD=Math.max(0,tbrVDBase-externalAimtVD);`;

  const recalculationAnchor=String.raw`  const ventesAll=useMemo(()=>loadAllSales(moisDCO),[moisDCO]);
  const ventesActives=ventesAll.filter(v=>!v.annulation);`;
  const recalculationPatch=String.raw`  const ventesAll=useMemo(()=>loadAllSales(moisDCO),[moisDCO]);
  const ventesActives=ventesAll.filter(v=>!v.annulation);

  // Recalcul DCO automatique après modification AIMT, ALIT ou ASAT.
  useEffect(()=>{
    if(!dcoRaw||!dcoRaw.summary||!Array.isArray(dcoRaw.rows)) return;
    const refreshed=buildAnalysis(dcoRaw.summary,dcoRaw.rows,dcoRaw.installs||{},dcoRaw.moisUsed||moisDCO);
    setDcoData(refreshed);
    if(nomFichier){
      SV(DCO_CACHE_KEY,{name:nomFichier,date:dateImport||new Date().toISOString(),month:dcoRaw.moisUsed||moisDCO,raw:dcoRaw,data:refreshed});
    }
  },[dcoRaw,aimt,agent&&agent.statut,moisDCO.annee,moisDCO.mois]);`;

  const homeHeaderBefore=String.raw`      <div className="tbr-topbar">
        <div className="tbr-topbar-inner">
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <div style={{padding:6,borderRadius:24,background:"linear-gradient(135deg,rgba(56,189,248,.20),rgba(99,102,241,.24))",boxShadow:"0 18px 42px rgba(56,189,248,.22), inset 0 1px 0 rgba(255,255,255,.12)",border:"1px solid rgba(56,189,248,.28)"}}>
              <img src={TBR_LOGO_IMG} alt="TBR" style={{width:72,height:72,borderRadius:22,objectFit:"cover",boxShadow:"0 16px 34px rgba(56,189,248,.28)",border:"1px solid rgba(255,255,255,.16)",background:"#07111f",display:"block"}}/>
            </div>
            <div style={{display:"flex",alignItems:"center",minHeight:78}}><div style={{fontSize:16,color:"#111",fontWeight:900,lineHeight:1.12}}>{agent.prenom||"Commercial"} · {agent.statut}</div>
            </div></div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:10,color:"#6B7280",fontWeight:800,textTransform:"uppercase",letterSpacing:.7}}>Mois</div>
            <div style={{fontSize:13,fontWeight:900,color:"#111"}}>{MOIS_NOMS[moisActif.mois-1]} {moisActif.annee}</div>
          </div>
        </div>
        <div style={{maxWidth:430,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 16px 10px"}}>
          <button onClick={prevMois} style={{background:"#F3F4F6",border:"1px solid rgba(0,0,0,0.06)",borderRadius:14,padding:"8px 12px",fontWeight:900,color:"#111"}}>‹</button>
          <div style={{fontSize:12,color:"#6B7280",fontWeight:800}}>Suivi mensuel</div>
          <button onClick={nextMois} style={{background:"#F3F4F6",border:"1px solid rgba(0,0,0,0.06)",borderRadius:14,padding:"8px 12px",fontWeight:900,color:"#111"}}>›</button>
        </div>
      </div>`;

  const homeHeaderAfter=String.raw`      <div className="tbr-topbar tbr-month-header-v7">
        <div className="tbr-month-header-shell">
          <div className="tbr-month-profile">
            <div className="tbr-month-logo"><img src={TBR_LOGO_IMG} alt="TBR"/></div>
            <div className="tbr-month-person">
              <span>COCKPIT COMMERCIAL</span>
              <div><strong>{agent.prenom||"Commercial"}</strong><em>{agent.statut}</em></div>
            </div>
          </div>
          <div className="tbr-month-console">
            <div className="tbr-month-kicker"><i></i> MOIS ACTIF</div>
            <div className="tbr-month-navigation">
              <button className="tbr-month-arrow previous" onClick={prevMois} aria-label="Mois précédent" title="Mois précédent"><span>‹</span><small>Avant</small></button>
              <div className="tbr-month-display"><strong>{MOIS_NOMS[moisActif.mois-1]} {moisActif.annee}</strong><span>Période de travail sélectionnée</span></div>
              <button className="tbr-month-arrow next" onClick={nextMois} aria-label="Mois suivant" title="Mois suivant"><small>Après</small><span>›</span></button>
            </div>
          </div>
        </div>
      </div>`;

  const homeHeaderCss=String.raw`<style id="tbr-home-month-header-v7">
.tbr-topbar.tbr-month-header-v7{position:relative!important;z-index:80!important;padding:0!important;overflow:hidden!important;background:radial-gradient(circle at 8% 20%,rgba(56,189,248,.18),transparent 28%),radial-gradient(circle at 84% 0%,rgba(99,102,241,.20),transparent 32%),linear-gradient(135deg,#040b1c,#071126 56%,#08142b)!important;border-bottom:1px solid rgba(125,211,252,.18)!important;box-shadow:0 20px 55px rgba(2,6,23,.38)!important;color:#f8fafc!important}
.tbr-topbar.tbr-month-header-v7:before{content:"";position:absolute;inset:0;pointer-events:none;background-image:linear-gradient(rgba(125,211,252,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(125,211,252,.035) 1px,transparent 1px);background-size:42px 42px;mask-image:linear-gradient(to bottom,#000,transparent 92%)}
.tbr-topbar.tbr-month-header-v7:after{content:"";position:absolute;width:380px;height:180px;left:50%;bottom:-145px;transform:translateX(-50%);border-radius:50%;background:rgba(56,189,248,.18);filter:blur(44px);pointer-events:none}
.tbr-month-header-shell{position:relative;z-index:1;max-width:1180px;margin:0 auto;padding:18px 24px;display:grid;grid-template-columns:minmax(250px,.72fr) minmax(480px,1.28fr);gap:28px;align-items:center}
.tbr-month-profile{display:flex;align-items:center;gap:15px;min-width:0}.tbr-month-logo{flex:0 0 auto;padding:6px;border-radius:22px;background:linear-gradient(145deg,rgba(56,189,248,.20),rgba(99,102,241,.22));border:1px solid rgba(125,211,252,.26);box-shadow:0 14px 34px rgba(56,189,248,.20),inset 0 1px 0 rgba(255,255,255,.10)}.tbr-month-logo img{display:block;width:62px;height:62px;border-radius:18px;object-fit:cover;background:#07111f;box-shadow:0 10px 28px rgba(56,189,248,.24)}
.tbr-month-person{min-width:0}.tbr-month-person>span{display:block;color:#7dd3fc;font-size:9px;font-weight:950;letter-spacing:.16em;margin-bottom:7px}.tbr-month-person>div{display:flex;align-items:center;gap:9px;flex-wrap:wrap}.tbr-month-person strong{font-size:20px;line-height:1;color:#f8fafc;white-space:nowrap}.tbr-month-person em{font-style:normal;padding:5px 8px;border-radius:999px;background:rgba(99,102,241,.16);border:1px solid rgba(129,140,248,.30);color:#c7d2fe;font-size:9px;font-weight:950;letter-spacing:.08em}
.tbr-month-console{position:relative;padding:13px 14px 14px;border-radius:28px;background:linear-gradient(135deg,rgba(15,23,42,.82),rgba(8,17,31,.72));border:1px solid rgba(125,211,252,.22);box-shadow:inset 0 1px 0 rgba(255,255,255,.07),0 18px 42px rgba(2,6,23,.30);backdrop-filter:blur(18px);overflow:hidden}.tbr-month-console:before{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(105deg,transparent 12%,rgba(125,211,252,.08) 47%,transparent 72%)}
.tbr-month-kicker{position:relative;z-index:1;display:flex;justify-content:center;align-items:center;gap:8px;margin-bottom:8px;color:#7dd3fc;font-size:9px;font-weight:950;letter-spacing:.18em}.tbr-month-kicker i{width:7px;height:7px;border-radius:50%;background:#38bdf8;box-shadow:0 0 14px #38bdf8}
.tbr-month-navigation{position:relative;z-index:1;display:grid;grid-template-columns:104px minmax(210px,1fr) 104px;gap:10px;align-items:stretch}.tbr-month-arrow{min-height:68px;border:1px solid rgba(148,163,184,.20);border-radius:20px;background:linear-gradient(145deg,rgba(30,41,59,.72),rgba(15,23,42,.76));color:#e0f2fe;display:flex;align-items:center;justify-content:center;gap:8px;font-weight:950;cursor:pointer;box-shadow:inset 0 1px 0 rgba(255,255,255,.05);transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease}.tbr-month-arrow:hover,.tbr-month-arrow:active{transform:translateY(-1px);border-color:rgba(56,189,248,.58);box-shadow:0 10px 24px rgba(56,189,248,.13),inset 0 1px 0 rgba(255,255,255,.08)}.tbr-month-arrow span{font-size:29px;line-height:1;color:#7dd3fc}.tbr-month-arrow small{font-size:10px;color:#cbd5e1;font-weight:900;text-transform:uppercase;letter-spacing:.08em}
.tbr-month-display{min-width:0;display:grid;place-content:center;text-align:center;border-radius:21px;padding:8px 16px;background:radial-gradient(circle at 50% 0%,rgba(56,189,248,.17),transparent 60%),rgba(2,6,23,.58);border:1px solid rgba(56,189,248,.24);box-shadow:inset 0 0 28px rgba(56,189,248,.05)}.tbr-month-display strong{display:block;color:#fff;font-size:clamp(28px,3.4vw,42px);line-height:1;letter-spacing:-.045em;text-shadow:0 0 24px rgba(56,189,248,.22);white-space:nowrap}.tbr-month-display span{display:block;margin-top:7px;color:#94a3b8;font-size:9px;font-weight:900;letter-spacing:.11em;text-transform:uppercase}
@media(max-width:820px){.tbr-month-header-shell{grid-template-columns:1fr;padding:14px 16px;gap:12px}.tbr-month-profile{justify-content:center}.tbr-month-logo img{width:54px;height:54px}.tbr-month-logo{border-radius:19px}.tbr-month-person strong{font-size:18px}.tbr-month-console{border-radius:23px}.tbr-month-navigation{grid-template-columns:76px minmax(0,1fr) 76px}.tbr-month-arrow{min-height:62px;border-radius:17px;flex-direction:column;gap:1px}.tbr-month-arrow.next{flex-direction:column-reverse}.tbr-month-display strong{font-size:30px}}
@media(max-width:480px){.tbr-month-header-shell{padding:12px 11px}.tbr-month-profile{justify-content:flex-start}.tbr-month-logo img{width:48px;height:48px}.tbr-month-person>span{font-size:8px}.tbr-month-person strong{font-size:17px}.tbr-month-navigation{grid-template-columns:58px minmax(0,1fr) 58px;gap:7px}.tbr-month-arrow{min-height:58px}.tbr-month-arrow small{display:none}.tbr-month-arrow span{font-size:31px}.tbr-month-display{padding:8px}.tbr-month-display strong{font-size:25px}.tbr-month-display span{font-size:8px;letter-spacing:.07em}}
</style>`;

  const finalWriteAnchor='  document.open();';
  const finalWritePatch=`  const tbrAimtBlockBefore=${JSON.stringify(aimtBlockBefore)};
  const tbrAimtBlockAfter=${JSON.stringify(aimtBlockAfter)};
  if(!html.includes(tbrAimtBlockBefore)) fail("Calcul AIMT du contrôle DCO introuvable");
  html=html.replace(tbrAimtBlockBefore,tbrAimtBlockAfter);
  const tbrRecalculationAnchor=${JSON.stringify(recalculationAnchor)};
  const tbrRecalculationPatch=${JSON.stringify(recalculationPatch)};
  if(!html.includes(tbrRecalculationAnchor)) fail("Point de recalcul automatique DCO introuvable");
  html=html.replace(tbrRecalculationAnchor,tbrRecalculationPatch);
  const tbrHomeHeaderBefore=${JSON.stringify(homeHeaderBefore)};
  const tbrHomeHeaderAfter=${JSON.stringify(homeHeaderAfter)};
  if(!html.includes(tbrHomeHeaderBefore)) fail("Ancien sélecteur du mois introuvable");
  html=html.replace(tbrHomeHeaderBefore,tbrHomeHeaderAfter);
  const tbrHomeHeaderCss=${JSON.stringify(homeHeaderCss)};
  if(!html.includes("</head>")) fail("En-tête HTML introuvable");
  html=html.replace("</head>",tbrHomeHeaderCss+"</head>");

  document.open();`;
  if(!source.includes(finalWriteAnchor)) throw new Error("Écriture finale du moteur DCO introuvable");
  source=source.replace(finalWriteAnchor,finalWritePatch);

  try{localStorage.setItem("cc_version",EMBEDDED_VERSION);}catch(e){}
  source=source.replace(/\$\{/g,"\\${");
  (0,eval)(source);
})().catch(error=>{
  console.error(error);
  const target=document.getElementById("boot-msg");
  if(target){
    target.className="boot-error";
    target.textContent="Le contrôle DCO n’a pas pu charger : "+(error&&error.message?error.message:error);
  }
});