(async()=>{
  const VERSION="2026.07.26-document-button-v13";
  if(window.__tbrDocumentRuntimeLoadedV13) return;
  window.__tbrDocumentRuntimeLoadedV13=true;

  const fetcher=window.__tbrOriginalFetchV13||window.fetch.bind(window);
  if(window.__tbrOriginalFetchV13) window.fetch=window.__tbrOriginalFetchV13;

  const response=await fetcher(new URL(`document-intake-bootstrap.js?v=${encodeURIComponent(VERSION)}`,location.href).href,{cache:"no-store"});
  if(!response.ok) throw new Error("Module documentaire introuvable");
  const source=await response.text();
  const start=source.indexOf("  const VAULT_KEY=");
  const end=source.lastIndexOf("})().catch");
  if(start<0||end<=start) throw new Error("Corps du moteur documentaire introuvable");

  const body=source.slice(start,end);
  const wrapped="(async()=>{const VERSION="+JSON.stringify(VERSION)+";\n"+body+"\n})().catch(error=>{console.error(error);const target=document.getElementById('boot-msg');if(target){target.className='boot-error';target.textContent='TBR n’a pas pu afficher le bouton PDF : '+(error&&error.message?error.message:error);}});";
  (0,eval)(wrapped);
})().catch(error=>{
  console.error(error);
  const target=document.getElementById("boot-msg");
  if(target){target.className="boot-error";target.textContent="TBR n’a pas pu lancer l’import PDF : "+(error&&error.message?error.message:error);}
});