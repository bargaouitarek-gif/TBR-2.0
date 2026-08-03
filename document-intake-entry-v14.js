(async()=>{
  const VERSION="2026.07.26-android-share-v16";
  const originalFetch=window.fetch.bind(window);
  const runtimeUrl=new URL(`document-intake-runtime.js?v=${encodeURIComponent(VERSION)}`,location.href).href;
  const simpleUrl=new URL(`saisie-simple-bootstrap.js?v=${encodeURIComponent(VERSION)}`,location.href).href;
  const shareUrl=new URL(`share-target-bootstrap.js?v=${encodeURIComponent(VERSION)}`,location.href).href;
  const manifestUrl=new URL(`manifest.webmanifest?v=${encodeURIComponent(VERSION)}`,location.href).href;
  const iconUrl=new URL("tbr-icon.svg",location.href).href;
  window.__tbrOriginalFetchV13=originalFetch;

  window.fetch=async function(input,init){
    const response=await originalFetch(input,init);
    try{
      const url=typeof input==="string"?input:(input&&input.url?input.url:String(input||""));
      if(/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[^/]+\/index\.html(?:\?|$)/i.test(url)){
        const html=await response.text();
        const headLinks=`<link rel="manifest" href="${manifestUrl}"><link rel="icon" href="${iconUrl}" type="image/svg+xml">`;
        const withManifest=html.includes("manifest.webmanifest")
          ?html
          :(html.includes("</head>")?html.replace("</head>",headLinks+"</head>"):headLinks+html);
        const scripts=`<script src="${runtimeUrl}"></script><script src="${simpleUrl}"></script><script src="${shareUrl}"></script>`;
        const injected=withManifest.includes("share-target-bootstrap.js")
          ?withManifest
          :(withManifest.includes("</body>")?withManifest.replace("</body>",scripts+"</body>"):withManifest+scripts);
        const headers=new Headers(response.headers);
        headers.delete("content-length");
        headers.delete("content-encoding");
        return new Response(injected,{status:response.status,statusText:response.statusText,headers});
      }
    }catch(error){
      console.warn("Injection de la réception PDF différée",error);
    }
    return response;
  };

  const response=await originalFetch(`pay-correction-bootstrap.js?v=${encodeURIComponent(VERSION)}-${Date.now()}`,{cache:"no-store"});
  if(!response.ok) throw new Error("Moteur TBR indisponible");
  let source=await response.text();
  source=source.replace('const VERSION="2026.07.26-partner-bonus-v11";','const VERSION="'+VERSION+'";');
  (0,eval)(source);
})().catch(error=>{
  console.error(error);
  const target=document.getElementById("boot-msg");
  if(target){target.className="boot-error";target.textContent="TBR n’a pas pu charger la réception des PDF : "+(error&&error.message?error.message:error);}
});
