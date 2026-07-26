(()=>{
  const VERSION="2026.07.26-android-share-v16";
  const SHARE_DB="tbr_share_inbox_v1";
  const SHARE_STORE="items";
  const VAULT_KEY="tbr_document_vault_v1";
  const CONTROL_KEY="tbr_control_documents_v1";
  if(window.__tbrShareTargetV16)return;
  window.__tbrShareTargetV16=true;

  let pendingShare=null;
  let pendingFile=null;
  let feedTimer=null;

  const safeJson=(text,fallback)=>{try{return JSON.parse(text);}catch{return fallback;}};
  const normalizeNum=value=>String(value||"").replace(/\D/g,"");
  const currentMonthValue=()=>{
    const label=String(document.querySelector(".tbr-month-display strong")?.textContent||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
    const names=["janvier","fevrier","mars","avril","mai","juin","juillet","aout","septembre","octobre","novembre","decembre"];
    const year=(label.match(/20\d{2}/)||[])[0];
    const monthIndex=names.findIndex(name=>label.includes(name));
    const now=new Date();
    return `${year||now.getFullYear()}-${String(monthIndex>=0?monthIndex+1:now.getMonth()+1).padStart(2,"0")}`;
  };
  const monthKey=value=>{
    const match=String(value||"").match(/^(20\d{2})-(0[1-9]|1[0-2])$/);
    return match?`cc_ventes_${match[1]}_${match[2]}`:`cc_ventes_${currentMonthValue().replace("-","_")}`;
  };
  const restoreStorage=(key,raw)=>raw===null?localStorage.removeItem(key):localStorage.setItem(key,raw);

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
  async function getShared(id){
    const db=await openShareDb();
    const result=await new Promise((resolve,reject)=>{
      const tx=db.transaction(SHARE_STORE,"readonly");
      const req=tx.objectStore(SHARE_STORE).get(id);
      req.onsuccess=()=>resolve(req.result||null);
      req.onerror=()=>reject(req.error);
    });
    db.close();
    return result;
  }
  async function deleteShared(id){
    if(!id)return;
    const db=await openShareDb();
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(SHARE_STORE,"readwrite");
      tx.objectStore(SHARE_STORE).delete(id);
      tx.oncomplete=resolve;
      tx.onerror=()=>reject(tx.error);
      tx.onabort=()=>reject(tx.error);
    });
    db.close();
  }

  function mergeIntoTarget(existing,incoming){
    if(!existing)return incoming;
    const merged={...existing};
    const incomingSources=incoming&&incoming.fieldSources&&typeof incoming.fieldSources==="object"?incoming.fieldSources:{};
    Object.keys(incomingSources).forEach(field=>{merged[field]=incoming[field];});
    merged.fieldSources={...(existing.fieldSources||{}),...incomingSources};
    const documents=[...(Array.isArray(existing.documents)?existing.documents:[]),...(Array.isArray(incoming.documents)?incoming.documents:[])];
    merged.documents=[...new Map(documents.map(item=>[item.id,item])).values()].sort((a,b)=>new Date(a.importedAt||0)-new Date(b.importedAt||0));
    if(incoming.sourceDocument)merged.sourceDocument=incoming.sourceDocument;
    if(incoming.pvVerified)merged.pvVerified=true;
    if(incoming.installation)merged.installation=true;
    if(incoming.statut==="Installe")merged.statut="Installe";
    return merged;
  }

  function updateVaultMeta(documentId,{purpose,targetKey,typeVente}){
    const vault=safeJson(localStorage.getItem(VAULT_KEY)||"[]",[]);
    const updated=vault.map(item=>item.id===documentId?{...item,purpose,monthKey:targetKey,typeVente,classificationAt:new Date().toISOString()}:item);
    localStorage.setItem(VAULT_KEY,JSON.stringify(updated));
    return updated.find(item=>item.id===documentId)||null;
  }

  function addControlDocument(meta){
    if(!meta)return;
    const items=safeJson(localStorage.getItem(CONTROL_KEY)||"[]",[]);
    localStorage.setItem(CONTROL_KEY,JSON.stringify([meta,...items.filter(item=>item.id!==meta.id)]));
  }

  function cleanSharedUrl(){
    const url=new URL(location.href);
    url.searchParams.delete("shared");
    url.searchParams.delete("file-handler");
    history.replaceState({},"",url.pathname+(url.searchParams.toString()?`?${url.searchParams}`:"")+url.hash);
  }

  function addStyles(){
    if(document.getElementById("tbr-share-v16-style"))return;
    const style=document.createElement("style");
    style.id="tbr-share-v16-style";
    style.textContent=`
      .tbr-share-classify{margin:14px 0;padding:15px;border-radius:19px;border:1px solid rgba(125,211,252,.24);background:linear-gradient(145deg,rgba(8,29,54,.92),rgba(19,24,68,.88));box-shadow:inset 0 1px 0 rgba(255,255,255,.05)}
      .tbr-share-classify>span{display:block;color:#7dd3fc;font-size:9px;font-weight:1000;letter-spacing:.14em}.tbr-share-classify h3{margin:6px 0 12px;font-size:18px;color:#fff}.tbr-share-row{display:grid;grid-template-columns:1fr 1.35fr;gap:10px}.tbr-share-field span{display:block;margin-bottom:5px;color:#9fb0c7;font-size:9px;font-weight:900;text-transform:uppercase}.tbr-share-field input{width:100%;padding:12px;border-radius:13px;border:1px solid rgba(148,163,184,.20);background:rgba(2,6,23,.58);color:#fff;color-scheme:dark}.tbr-share-purpose{display:grid;grid-template-columns:1fr 1fr;gap:8px}.tbr-share-purpose button{min-height:47px;padding:9px;border-radius:13px;border:1px solid rgba(148,163,184,.17);background:rgba(15,23,42,.72);color:#b9c7d9;font-size:10px;font-weight:950}.tbr-share-purpose button.active{border-color:rgba(56,189,248,.62);background:linear-gradient(135deg,rgba(14,116,144,.62),rgba(79,70,229,.64));color:#fff;box-shadow:0 10px 25px rgba(56,189,248,.14)}.tbr-share-origin{margin-top:10px;color:#8da2bb;font-size:9px;line-height:1.4}
      @media(max-width:600px){.tbr-share-row{grid-template-columns:1fr}.tbr-share-purpose button{min-height:50px}}
    `;
    document.head.appendChild(style);
  }

  function enhanceModal(){
    addStyles();
    const card=document.querySelector("#tbr-doc-modal .tbr-doc-card");
    const confirm=card?.querySelector("#tbr-doc-confirm");
    if(!card||!confirm||confirm.dataset.tbrShareEnhanced==="1")return;
    const warning=card.querySelector(".tbr-doc-warning");
    if(!warning)return;

    confirm.dataset.tbrShareEnhanced="1";
    const block=document.createElement("section");
    block.className="tbr-share-classify";
    block.innerHTML=`
      <span>CLASSEMENT SIMPLE</span>
      <h3>Où veux-tu ranger ce PDF ?</h3>
      <div class="tbr-share-row">
        <label class="tbr-share-field"><span>Mois concerné</span><input type="month" id="tbr-share-month" value="${pendingShare?.month||currentMonthValue()}"></label>
        <div class="tbr-share-field"><span>Utilisation</span><div class="tbr-share-purpose"><button type="button" data-purpose="SALE" class="active">Créer / compléter une vente</button><button type="button" data-purpose="CONTROL">Garder pour un contrôle</button></div></div>
      </div>
      <div class="tbr-share-origin">Le choix VD ou VF reste juste au-dessus. Le PDF original sera conservé dans Mes documents.</div>`;
    warning.parentElement.insertBefore(block,warning);

    let purpose="SALE";
    const baseText=confirm.textContent;
    const purposeButtons=[...block.querySelectorAll("[data-purpose]")];
    const setPurpose=value=>{
      purpose=value;
      purposeButtons.forEach(button=>button.classList.toggle("active",button.dataset.purpose===value));
      confirm.textContent=value==="CONTROL"?"Conserver pour le contrôle":baseText;
    };
    purposeButtons.forEach(button=>button.onclick=()=>setPurpose(button.dataset.purpose));

    const original=confirm.onclick;
    confirm.onclick=async event=>{
      const selectedMonth=block.querySelector("#tbr-share-month").value||currentMonthValue();
      const selectedType=card.querySelector("#tbr-doc-sale-type")?.value||"VD";
      const currentKey=monthKey(currentMonthValue());
      const targetKey=monthKey(selectedMonth);
      const beforeCurrent=localStorage.getItem(currentKey);
      const beforeTarget=localStorage.getItem(targetKey);
      const previousLast=localStorage.getItem("tbr.document.last.import");

      try{
        await original.call(confirm,event);
        const currentLast=localStorage.getItem("tbr.document.last.import");
        if(!currentLast||currentLast===previousLast)return;
        const last=safeJson(currentLast,null);
        if(!last?.documentId)return;

        const afterCurrent=safeJson(localStorage.getItem(currentKey)||"[]",[]);
        const imported=afterCurrent.find(sale=>sale?.sourceDocument?.documentId===last.documentId||(Array.isArray(sale?.documents)&&sale.documents.some(doc=>doc.id===last.documentId)));
        const meta=updateVaultMeta(last.documentId,{purpose,targetKey,typeVente:selectedType});

        if(purpose==="CONTROL"){
          restoreStorage(currentKey,beforeCurrent);
          addControlDocument(meta);
        }else if(targetKey!==currentKey){
          restoreStorage(currentKey,beforeCurrent);
          if(imported){
            const targetSales=safeJson(beforeTarget||"[]",[]);
            const number=normalizeNum(imported.numClient);
            const index=targetSales.findIndex(sale=>normalizeNum(sale.numClient)===number);
            if(index>=0)targetSales[index]=mergeIntoTarget(targetSales[index],imported);
            else targetSales.unshift(imported);
            localStorage.setItem(targetKey,JSON.stringify(targetSales));
          }
        }

        localStorage.setItem("tbr.document.last.import",JSON.stringify({...last,monthKey:targetKey,purpose,typeVente:selectedType}));
        if(pendingShare?.id){await deleteShared(pendingShare.id);pendingShare=null;pendingFile=null;cleanSharedUrl();}
      }catch(error){
        console.error("Classement du document impossible",error);
        alert("Le document a été lu, mais TBR n’a pas pu terminer son classement. Réessaie une fois.");
      }
    };
  }

  function feedPendingFile(){
    if(!pendingFile)return;
    const input=document.getElementById("tbr-doc-file-input");
    if(!input)return;
    try{
      const transfer=new DataTransfer();
      transfer.items.add(pendingFile);
      input.files=transfer.files;
      input.dispatchEvent(new Event("change",{bubbles:true}));
      pendingFile=null;
    }catch(error){
      console.error("Ouverture du PDF partagé impossible",error);
      alert("TBR a reçu le PDF mais n’a pas pu l’ouvrir automatiquement. Utilise Ajouter un document une fois.");
    }
  }

  function scheduleFeed(){
    if(feedTimer!==null)return;
    feedTimer=setTimeout(()=>{feedTimer=null;feedPendingFile();enhanceModal();},180);
  }

  async function consumeSharedIntent(){
    const id=new URL(location.href).searchParams.get("shared");
    if(!id)return;
    try{
      pendingShare=await getShared(id);
      if(!pendingShare?.blob)throw new Error("PDF partagé introuvable");
      pendingFile=pendingShare.blob instanceof File?pendingShare.blob:new File([pendingShare.blob],pendingShare.name||"document.pdf",{type:pendingShare.type||"application/pdf",lastModified:pendingShare.lastModified||Date.now()});
      scheduleFeed();
    }catch(error){
      console.error(error);
      alert("TBR n’a pas pu récupérer le PDF partagé. Partage-le de nouveau vers TBR.");
      cleanSharedUrl();
    }
  }

  if("launchQueue" in window&&typeof window.launchQueue.setConsumer==="function"){
    window.launchQueue.setConsumer(async params=>{
      const handle=params.files&&params.files[0];
      if(!handle)return;
      try{pendingFile=await handle.getFile();scheduleFeed();}catch(error){console.error("Fichier Android non reçu",error);}
    });
  }

  const observer=new MutationObserver(scheduleFeed);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  addStyles();
  enhanceModal();
  consumeSharedIntent();
  setTimeout(scheduleFeed,700);
  setTimeout(scheduleFeed,1800);
  try{localStorage.setItem("cc_version",VERSION);}catch(error){}
})();
