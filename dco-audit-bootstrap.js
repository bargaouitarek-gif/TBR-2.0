(async()=>{
  const SNAPSHOT="5fd7ade1955a6024ca972d77beaf35c8c23f339c";
  const EMBEDDED_VERSION="2026.07.26-dco-command-v6";
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

  const finalWriteAnchor='  document.open();';
  const finalWritePatch=`  const tbrAimtBlockBefore=${JSON.stringify(aimtBlockBefore)};
  const tbrAimtBlockAfter=${JSON.stringify(aimtBlockAfter)};
  if(!html.includes(tbrAimtBlockBefore)) fail("Calcul AIMT du contrôle DCO introuvable");
  html=html.replace(tbrAimtBlockBefore,tbrAimtBlockAfter);
  const tbrRecalculationAnchor=${JSON.stringify(recalculationAnchor)};
  const tbrRecalculationPatch=${JSON.stringify(recalculationPatch)};
  if(!html.includes(tbrRecalculationAnchor)) fail("Point de recalcul automatique DCO introuvable");
  html=html.replace(tbrRecalculationAnchor,tbrRecalculationPatch);

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