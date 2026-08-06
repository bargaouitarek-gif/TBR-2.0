(()=>{
  const VERSION="2026.08.06-client-diagnostic-v29";
  const sessionId=`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
  let lastFailure="";
  const sent=new Set();
  const simplify=value=>{
    if(value instanceof Error) return `${value.name}: ${value.message}${value.stack?`\n${value.stack}`:""}`;
    if(typeof value==="string") return value;
    try{return JSON.stringify(value);}catch(error){return String(value);}
  };
  const report=(kind,details={})=>{
    const signature=`${kind}:${simplify(details).slice(0,500)}`;
    if(sent.has(signature)) return;
    sent.add(signature);
    const payload={
      version:VERSION,
      sessionId,
      kind,
      page:location.pathname+location.search,
      readyState:document.readyState,
      userAgent:navigator.userAgent,
      time:new Date().toISOString(),
      details
    };
    try{
      fetch("/api/client-error",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(payload),
        keepalive:true,
        cache:"no-store"
      }).catch(()=>{});
    }catch(error){}
  };
  window.__tbrClientReport=report;
  const nativeConsoleError=console.error.bind(console);
  console.error=(...args)=>{
    lastFailure=args.map(simplify).join(" | ").slice(0,5000);
    report("console.error",{message:lastFailure});
    nativeConsoleError(...args);
  };
  window.addEventListener("error",event=>{
    const target=event.target;
    if(target&&target!==window){
      const resource=target.src||target.href||target.currentSrc||target.tagName||"ressource inconnue";
      lastFailure=`Ressource non chargée : ${resource}`;
      report("resource-error",{resource,tag:target.tagName||""});
      return;
    }
    lastFailure=`${event.message||"Erreur JavaScript"} — ${event.filename||"fichier inconnu"}:${event.lineno||0}:${event.colno||0}`;
    report("javascript-error",{
      message:event.message||"",
      filename:event.filename||"",
      line:event.lineno||0,
      column:event.colno||0,
      stack:event.error&&event.error.stack?String(event.error.stack).slice(0,8000):""
    });
  },true);
  window.addEventListener("unhandledrejection",event=>{
    lastFailure=`Promesse rejetée : ${simplify(event.reason)}`;
    report("unhandled-rejection",{reason:simplify(event.reason).slice(0,8000)});
  });
  window.setTimeout(()=>{
    const body=document.body;
    const bodyText=body?String(body.innerText||"").trim():"";
    const interactive=document.querySelectorAll("button,input,select,textarea,a,[role='button']").length;
    const rootChildren=document.querySelector("#root")?document.querySelector("#root").children.length:0;
    const meaningful=bodyText.length>12||interactive>0||rootChildren>0;
    if(meaningful) return;
    const scripts=[...document.scripts].map(script=>script.src||"inline").slice(-25);
    let storageKeys=[];
    try{storageKeys=Object.keys(localStorage).slice(0,80);}catch(error){}
    report("blank-screen",{
      lastFailure:lastFailure||"Aucune erreur explicite capturée",
      title:document.title,
      bodyText:bodyText.slice(0,500),
      scripts,
      storageKeys
    });
    const panel=document.createElement("section");
    panel.id="tbr-diagnostic-panel";
    panel.style.cssText="position:fixed;z-index:2147483647;inset:18px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:28px;border:1px solid rgba(248,113,113,.45);border-radius:24px;background:rgba(7,17,31,.97);color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;box-shadow:0 30px 80px rgba(0,0,0,.55)";
    const safeFailure=(lastFailure||"Écran vide sans message d’erreur").replace(/[<>]/g,"");
    panel.innerHTML=`<div style="font-size:12px;font-weight:900;letter-spacing:.12em;color:#fca5a5">DIAGNOSTIC TBR ENVOYÉ</div><h1 style="margin:14px 0 10px;font-size:25px">Le moteur s’est arrêté pendant l’ouverture.</h1><p style="max-width:760px;margin:0;color:#cbd5e1;line-height:1.5">${safeFailure}</p><div style="margin-top:18px;color:#94a3b8;font-size:12px">Session ${sessionId}</div>`;
    if(body) body.appendChild(panel);
  },14000);
})();
