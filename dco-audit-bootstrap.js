(async()=>{
  const SNAPSHOT="5fd7ade1955a6024ca972d77beaf35c8c23f339c";
  const EMBEDDED_VERSION="2026.07.26-dco-command-v4";
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
