const VERSION="tbr-2026-07-26-pay-details-v9";
// Compatibility validation: home-pay-v8 home-month-v7
const CACHE_NAME=`${VERSION}-offline`;
const SCOPE_PATH=new URL(self.registration.scope).pathname.replace(/\/$/,"");
const scoped=path=>`${SCOPE_PATH}${path.startsWith("/")?path:"/"+path}`||"/";
const CORE=[scoped("/"),scoped("/index.html"),scoped("/index-audit.html"),scoped("/pay-detail-bootstrap.js"),scoped("/home-pay-bootstrap.js"),scoped("/dco-audit-bootstrap.js")];

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
  if(event.data&&event.data.type==="SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET") return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin) return;
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