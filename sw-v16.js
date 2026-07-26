const VERSION="tbr-2026-07-26-android-share-v16";
// Compatibility: unfreeze-saisie-v15 simple-saisie-v14 document-button-v13 document-intake-v12 partner-bonus-v11 pay-details-v9 home-pay-v8 home-month-v7
const CACHE_NAME=`${VERSION}-offline`;
const SCOPE_PATH=new URL(self.registration.scope).pathname.replace(/\/$/,"");
const scoped=path=>`${SCOPE_PATH}${path.startsWith("/")?path:"/"+path}`||"/";
const SHARE_DB="tbr_share_inbox_v1";
const SHARE_STORE="items";
const CORE=[
  scoped("/"),
  scoped("/index.html"),
  scoped("/index-audit.html"),
  scoped("/manifest.webmanifest"),
  scoped("/tbr-icon.svg"),
  scoped("/document-intake-entry-v14.js"),
  scoped("/document-intake-runtime.js"),
  scoped("/saisie-simple-bootstrap.js"),
  scoped("/share-target-bootstrap.js"),
  scoped("/document-intake-bootstrap.js"),
  scoped("/pay-correction-bootstrap.js"),
  scoped("/pay-detail-bootstrap.js"),
  scoped("/home-pay-bootstrap.js"),
  scoped("/dco-audit-bootstrap.js")
];

function openShareDb(){
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(SHARE_DB,1);
    request.onupgradeneeded=()=>{
      const db=request.result;
      if(!db.objectStoreNames.contains(SHARE_STORE))db.createObjectStore(SHARE_STORE,{keyPath:"id"});
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error||new Error("Boîte de réception TBR indisponible"));
  });
}
async function storeSharedFile(file,form){
  const id=`share_${Date.now()}_${Math.random().toString(36).slice(2,9)}`;
  const db=await openShareDb();
  await new Promise((resolve,reject)=>{
    const tx=db.transaction(SHARE_STORE,"readwrite");
    tx.objectStore(SHARE_STORE).put({
      id,
      name:file.name||"document.pdf",
      type:file.type||"application/pdf",
      size:file.size||0,
      lastModified:file.lastModified||Date.now(),
      blob:file,
      title:String(form.get("title")||""),
      text:String(form.get("text")||""),
      url:String(form.get("url")||""),
      receivedAt:new Date().toISOString()
    });
    tx.oncomplete=resolve;
    tx.onerror=()=>reject(tx.error);
    tx.onabort=()=>reject(tx.error);
  });
  db.close();
  return id;
}

self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>Promise.allSettled(CORE.map(url=>cache.add(new Request(url,{cache:"reload"}))))));
  self.skipWaiting();
});

self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key.startsWith("tbr-")&&key!==CACHE_NAME).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("message",event=>{
  if(event.data&&event.data.type==="SKIP_WAITING")self.skipWaiting();
});

self.addEventListener("fetch",event=>{
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;

  if(event.request.method==="POST"&&url.pathname===scoped("/share-target")){
    event.respondWith((async()=>{
      try{
        const form=await event.request.formData();
        const file=form.get("pdf");
        if(!file||typeof file.arrayBuffer!=="function"){
          return Response.redirect(new URL(scoped("/?share-error=missing-pdf"),self.location.origin).href,303);
        }
        const id=await storeSharedFile(file,form);
        return Response.redirect(new URL(scoped(`/?shared=${encodeURIComponent(id)}`),self.location.origin).href,303);
      }catch(error){
        console.error("Réception du PDF partagé impossible",error);
        return Response.redirect(new URL(scoped("/?share-error=receive"),self.location.origin).href,303);
      }
    })());
    return;
  }

  if(event.request.method!=="GET")return;
  event.respondWith((async()=>{
    try{
      const response=await fetch(event.request);
      if(response&&response.ok){
        const cache=await caches.open(CACHE_NAME);
        cache.put(event.request,response.clone()).catch(()=>{});
      }
      return response;
    }catch(error){
      return (await caches.match(event.request))||(event.request.mode==="navigate"?await caches.match(scoped("/")):Response.error());
    }
  })());
});
