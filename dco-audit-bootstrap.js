(async()=>{
  const SNAPSHOT="5fd7ade1955a6024ca972d77beaf35c8c23f339c";
  const EMBEDDED_VERSION="2026.07.26-dco-command-v5";
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