(async()=>{
  const VERSION="2026.07.26-document-intake-v12";
  const response=await fetch(`pay-correction-bootstrap.js?v=${encodeURIComponent(VERSION)}`,{cache:"no-store"});
  if(!response.ok) throw new Error("Moteur TBR indisponible");
  let source=await response.text();
  source=source.replace('const VERSION="2026.07.26-partner-bonus-v11";','const VERSION="'+VERSION+'";');
  await (0,eval)(source);

  const VAULT_KEY="tbr_document_vault_v1";
  const DB_NAME="tbr_document_files_v1";
  const DB_STORE="files";
  const DOC_PRIORITY={PROPOSITION_COMMERCIALE:1,CONTRAT:2,PV_INSTALLATION:3,DOCUMENT:0};
  const DOC_LABEL={PROPOSITION_COMMERCIALE:"Proposition commerciale",CONTRAT:"Contrat",PV_INSTALLATION:"PV d’installation",DOCUMENT:"Document"};
  const MONTHS=["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
  const PACK_PRICES={P1:399,P2:199,P3:149,P4:59,I1:199,I2:199,I3:199,I4:199,I5:199,V1:299,V2:299,V3:199,V4:119,A1:199,A2:199,A3:199,A4:39,A5:199,S1:29,S2:49,S3:149,S4:149,S5:149,S6:10};

  const norm=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g,"'").replace(/\s+/g," ").trim();
  const safeJson=(text,fallback)=>{try{return JSON.parse(text);}catch{return fallback;}};
  const nowIso=()=>new Date().toISOString();
  const uid=()=>`doc_${Date.now()}_${Math.random().toString(36).slice(2,9)}`;

  function openDb(){
    return new Promise((resolve,reject)=>{
      const request=indexedDB.open(DB_NAME,1);
      request.onupgradeneeded=()=>{
        const db=request.result;
        if(!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE,{keyPath:"id"});
      };
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error||new Error("Stockage documentaire indisponible"));
    });
  }
  async function putFile(id,file){
    const db=await openDb();
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(DB_STORE,"readwrite");
      tx.objectStore(DB_STORE).put({id,name:file.name,type:file.type||"application/pdf",size:file.size,lastModified:file.lastModified,blob:file});
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
    });
    db.close();
  }
  async function getFile(id){
    const db=await openDb();
    const result=await new Promise((resolve,reject)=>{
      const tx=db.transaction(DB_STORE,"readonly");
      const req=tx.objectStore(DB_STORE).get(id);
      req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error);
    });
    db.close();
    return result;
  }
  async function deleteFile(id){
    const db=await openDb();
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(DB_STORE,"readwrite");
      tx.objectStore(DB_STORE).delete(id);
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
    });
    db.close();
  }

  function loadVault(){return safeJson(localStorage.getItem(VAULT_KEY)||"[]",[]);}
  function saveVault(items){localStorage.setItem(VAULT_KEY,JSON.stringify(items));}

  function activeMonth(){
    const label=document.querySelector(".tbr-month-display strong")?.textContent||"";
    const normalized=norm(label).toLowerCase();
    const yearMatch=normalized.match(/(20\d{2})/);
    const monthIndex=MONTHS.findIndex(m=>normalized.includes(norm(m).toLowerCase()));
    const today=new Date();
    return {annee:yearMatch?Number(yearMatch[1]):today.getFullYear(),mois:monthIndex>=0?monthIndex+1:today.getMonth()+1};
  }
  function monthKey(){const m=activeMonth();return `cc_ventes_${m.annee}_${String(m.mois).padStart(2,"0")}`;}
  function loadSales(){return safeJson(localStorage.getItem(monthKey())||"[]",[]);}
  function saveSales(sales){localStorage.setItem(monthKey(),JSON.stringify(sales));}

  async function readPdf(file){
    if(!window.pdfjsLib) throw new Error("Le lecteur PDF TBR n’est pas encore prêt. Ferme puis rouvre la page Saisie.");
    const buffer=await file.arrayBuffer();
    const pdf=await window.pdfjsLib.getDocument({data:buffer}).promise;
    let text="";
    const pageTexts=[];
    for(let pageNo=1;pageNo<=pdf.numPages;pageNo++){
      const page=await pdf.getPage(pageNo);
      const content=await page.getTextContent();
      const pageText=content.items.map(item=>item.str).join(" ").replace(/\s+/g," ").trim();
      pageTexts.push(pageText);text+=`\n--- PAGE ${pageNo} ---\n${pageText}`;
    }
    return {text,pages:pdf.numPages,pageTexts};
  }

  function detectType(text,fileName){
    const value=norm(`${fileName||""} ${text}`).toUpperCase();
    if(/PROC[EÈ]S VERBAL D['’]?INSTALLATION|PV D['’]?INSTALLATION|PV INSTALLATION/.test(value)) return "PV_INSTALLATION";
    if(/CONTRAT|CONDITIONS PARTICULI[EÈ]RES|MANDAT SEPA|SIGNATURE DU CLIENT|DOCUMENT CONTRACTUEL/.test(value)) return "CONTRAT";
    if(/PROPOSITION COMMERCIALE|DEVIS|OFFRE S[EÉ]CURIT[EÉ]|R[EÉ]CAPITULATIF DES PRIX|BON DE COMMANDE/.test(value)) return "PROPOSITION_COMMERCIALE";
    return "DOCUMENT";
  }
  function dateIso(value){
    const match=String(value||"").match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](20\d{2})/);
    return match?`${match[3]}-${match[2].padStart(2,"0")}-${match[1].padStart(2,"0")}`:"";
  }
  function extractName(text){
    const patterns=[
      /(?:NOM\s+PR[EÉ]NOM|NOM DU CLIENT|CLIENT)\s*[:\-]?\s*(?:MONSIEUR|MADAME|M\.?|MME\.?)?\s*([^\n\r]{3,70}?)(?=\s+(?:ADRESSE|DATE|SIRET|ENGAGEMENT|T[EÉ]L[EÉ]PHONE|EMAIL|COURRIEL|N°|NUM[EÉ]RO)|$)/i,
      /(?:DONN[EÉ]ES DE FACTURATION|DONN[EÉ]ES D['’]INSTALLATION)[\s\S]{0,220}?(?:NOM\s+PR[EÉ]NOM)\s*[:\-]?\s*([^\n\r]{3,70})/i
    ];
    for(const pattern of patterns){const match=text.match(pattern);if(match)return norm(match[1]).replace(/\b(?:ADRESSE|DATE|SIRET|ENGAGEMENT).*$/i,"").trim();}
    return "";
  }
  function extractPacks(text){
    const upper=norm(text).toUpperCase();
    const refs=[...new Set((upper.match(/\b(?:P[1-4]|I[1-5]|V[1-4]|A[1-5]|S[1-6])\b/g)||[]))];
    return refs.map(ref=>{
      const around=upper.slice(Math.max(0,upper.indexOf(ref)-90),upper.indexOf(ref)+140);
      const offered=/OFFERT|100\s*%|0[,.]00\s*€/.test(around);
      const half=/50\s*%|REMISE\s*-?50/.test(around);
      return {id:Date.now()+Math.random(),reference:ref,nom:`${ref} — extrait du document`,prixCatalogueHT:PACK_PRICES[ref]||0,statutMat:offered?"Offert":half?"Remise -50%":"Normal",remiseAbo:0,sourceDocument:true};
    });
  }
  function parseDocument(text,fileName){
    const normalized=norm(text);const upper=normalized.toUpperCase();const type=detectType(normalized,fileName);
    const num=(upper.match(/(?:N[°Oº]?\s*CLIENT|NUM[EÉ]RO CLIENT)\s*[:#-]?\s*(\d{6,9})/)||upper.match(/\b(2\d{6})\b/)||[])[1]||"";
    const eng=(upper.match(/ENGAGEMENT(?: JURIDIQUE)?\s*[:\-]?\s*(12|24|36)\s*MOIS/)||upper.match(/\b(12|24|36)\s*MOIS\b/)||[])[1];
    const firstDate=(normalized.match(/\b\d{1,2}[\/.-]\d{1,2}[\/.-]20\d{2}\b/)||[])[0]||"";
    const installDate=(normalized.match(/(?:DATE D['’]?INSTALLATION|PROC[EÈ]S VERBAL D['’]?INSTALLATION)\s*[:\-]?\s*(\d{1,2}[\/.-]\d{1,2}[\/.-]20\d{2})/i)||[])[1]||"";
    const typeClient=/PROFESSIONNEL|SIRET\s*[:\-]?\s*\d/.test(upper)?"PRO":"RESI";
    let codePromo="";
    if(/6\s*MOIS[^.]{0,80}50\s*%|6MO5POSTART/.test(upper)) codePromo="6MO5POSTART";
    else if(/3\s*MOIS[^.]{0,80}50\s*%|3MO5POSTART/.test(upper)) codePromo="3MO5POSTART";
    else if(/REMSC5/.test(upper)) codePromo="REMSC5";
    else if(/\bREMSC\b/.test(upper)) codePromo="REMSC";
    const partner=(upper.match(/\b(BPCE|LEROY MERLIN|GENERALI|COVEA|FONCIA|CAFPI|TOTAL ENERG(?:IE|Y)|EDF)\b/)||[])[1]||"";
    const fields={
      nomClient:extractName(normalized),numClient:String(num),engagement:eng?Number(eng):36,typeClient,
      codePromo,dateVente:dateIso(firstDate)||new Date().toISOString().slice(0,10),
      dateInstallation:dateIso(installDate),packs:extractPacks(normalized),
      installation:type==="PV_INSTALLATION",statut:type==="PV_INSTALLATION"?"Installe":"Vendu"
    };
    return {type,priority:DOC_PRIORITY[type],label:DOC_LABEL[type],fields,partnerDetected:partner,pagesTextLength:normalized.length};
  }

  function baseSale(){
    return {id:Date.now()+Math.random(),nomClient:"",numClient:"",dateVente:new Date().toISOString().slice(0,10),typeVente:"VD",typeClient:"RESI",engagement:36,remsc:"Aucun",codesAbo:[],installation:false,annulation:false,typeAnnulation:"",numClientAnn:"",statut:"Vendu",packs:[],fi200start:false,tva20:false,codePromo:"",aboMaintenanceTTC:39.34,aboTelesurveillanceTTC:13.56,aboMensuelHT:65,partenaire:false,partenaireNom:"Leroy Merlin",partenaireCategorie:"APPARTEMENT",partenaireCA:"",sourceDocument:null,pvVerified:false,dateInstallation:"",pvHistory:[],documents:[],fieldSources:{}};
  }
  function mergeByPriority(existing,parsed,docMeta,choices){
    const sale={...baseSale(),...(existing||{})};
    sale.documents=Array.isArray(sale.documents)?[...sale.documents]:[];
    sale.fieldSources=sale.fieldSources&&typeof sale.fieldSources==="object"?{...sale.fieldSources}:{};
    const incoming={...parsed.fields,...choices};
    Object.entries(incoming).forEach(([field,value])=>{
      if(value===undefined||value===null||value===""||(Array.isArray(value)&&!value.length)) return;
      const currentPriority=Number(sale.fieldSources[field]?.priority||0);
      if(parsed.priority>=currentPriority){
        sale[field]=value;
        sale.fieldSources[field]={documentId:docMeta.id,type:parsed.type,priority:parsed.priority,fileName:docMeta.fileName,importedAt:docMeta.importedAt};
      }
    });
    sale.documents=[...sale.documents.filter(item=>item.id!==docMeta.id),docMeta].sort((a,b)=>new Date(a.importedAt)-new Date(b.importedAt));
    sale.sourceDocument={type:parsed.type,files:[docMeta.fileName],importedAt:docMeta.importedAt,documentId:docMeta.id,priority:parsed.priority};
    if(parsed.type==="PV_INSTALLATION"){sale.pvVerified=true;sale.installation=true;sale.statut="Installe";}
    return sale;
  }

  function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[char]));}
  function modalShell(){
    let modal=document.getElementById("tbr-doc-modal");
    if(modal)return modal;
    modal=document.createElement("div");modal.id="tbr-doc-modal";modal.className="tbr-doc-modal";modal.innerHTML='<div class="tbr-doc-card" role="dialog" aria-modal="true"></div>';
    modal.addEventListener("click",event=>{if(event.target===modal)closeModal();});
    document.body.appendChild(modal);return modal;
  }
  function closeModal(){document.getElementById("tbr-doc-modal")?.classList.remove("show");}
  function showMessage(title,text){const modal=modalShell();modal.querySelector(".tbr-doc-card").innerHTML=`<div class="tbr-doc-head"><div><span>DOCUMENTS TBR</span><h2>${escapeHtml(title)}</h2></div><button data-close>×</button></div><p class="tbr-doc-copy">${escapeHtml(text)}</p><button class="tbr-doc-primary" data-close>Fermer</button>`;modal.querySelectorAll("[data-close]").forEach(button=>button.onclick=closeModal);modal.classList.add("show");}

  async function importFile(file){
    if(!file)return;
    if(!(file.type==="application/pdf"||/\.pdf$/i.test(file.name))){showMessage("Format non accepté","Cette première version accepte les PDF. Les captures photo resteront disponibles avec l’import PV déjà présent.");return;}
    const modal=modalShell();modal.querySelector(".tbr-doc-card").innerHTML='<div class="tbr-doc-loading"><b>JUMPER lit le document…</b><span>Identification, extraction et préparation de la fiche.</span></div>';modal.classList.add("show");
    try{
      const read=await readPdf(file);const parsed=parseDocument(read.text,file.name);const sales=loadSales();const found=parsed.fields.numClient?sales.find(s=>String(s.numClient||"").replace(/\D/g,"")===String(parsed.fields.numClient).replace(/\D/g,"")):null;
      const card=modal.querySelector(".tbr-doc-card");
      card.innerHTML=`
        <div class="tbr-doc-head"><div><span>ANALYSE DOCUMENTAIRE</span><h2>${escapeHtml(parsed.label)}</h2><p>${read.pages} page(s) · priorité ${parsed.priority}/3 · ${found?"fiche existante retrouvée":"nouvelle vente"}</p></div><button data-close>×</button></div>
        <div class="tbr-doc-authority"><b>${parsed.type==="PV_INSTALLATION"?"Document de référence":"Document préparatoire"}</b><span>${parsed.type==="PV_INSTALLATION"?"Le PV pourra remplacer les valeurs du contrat et de la proposition.":parsed.type==="CONTRAT"?"Le contrat remplace la proposition, mais jamais un PV déjà enregistré.":"La proposition remplit les informations manquantes sans écraser un contrat ou un PV."}</span></div>
        <div class="tbr-doc-grid">
          <label><span>N° client</span><input id="tbr-doc-num" inputmode="numeric" value="${escapeHtml(parsed.fields.numClient)}"></label>
          <label><span>Nom client</span><input id="tbr-doc-name" value="${escapeHtml(parsed.fields.nomClient)}"></label>
          <label><span>VD / VF</span><select id="tbr-doc-sale-type"><option value="VD" ${found?.typeVente!=="VF"?"selected":""}>VD</option><option value="VF" ${found?.typeVente==="VF"?"selected":""}>VF</option></select></label>
          <label><span>Rési / Pro</span><select id="tbr-doc-client-type"><option value="RESI" ${parsed.fields.typeClient!=="PRO"?"selected":""}>Résidentiel</option><option value="PRO" ${parsed.fields.typeClient==="PRO"?"selected":""}>Professionnel</option></select></label>
          <label><span>Engagement</span><select id="tbr-doc-engagement">${[0,12,24,36].map(v=>`<option value="${v}" ${Number(parsed.fields.engagement)===v?"selected":""}>${v} mois</option>`).join("")}</select></label>
          <label><span>Promotion</span><input id="tbr-doc-promo" value="${escapeHtml(parsed.fields.codePromo)}" placeholder="Aucune"></label>
        </div>
        <label class="tbr-doc-check"><input type="checkbox" id="tbr-doc-partner" ${found?.partenaire||parsed.partnerDetected?"checked":""}><span>Vente partenaire${parsed.partnerDetected?` · ${escapeHtml(parsed.partnerDetected)}`:""}</span></label>
        <div class="tbr-doc-findings"><div><span>Packs reconnus</span><b>${parsed.fields.packs.length}</b></div><div><span>Date détectée</span><b>${escapeHtml(parsed.fields.dateInstallation||parsed.fields.dateVente||"—")}</b></div><div><span>Statut proposé</span><b>${escapeHtml(parsed.fields.statut)}</b></div></div>
        <div class="tbr-doc-warning">Vérifie les informations avant validation. TBR conserve le PDF original sur cet appareil et garde la source de chaque champ.</div>
        <div class="tbr-doc-actions"><button class="tbr-doc-secondary" data-close>Annuler</button><button class="tbr-doc-primary" id="tbr-doc-confirm">${found?"Mettre à jour la fiche":"Créer la vente"}</button></div>`;
      card.querySelectorAll("[data-close]").forEach(button=>button.onclick=closeModal);
      card.querySelector("#tbr-doc-confirm").onclick=async()=>{
        const number=card.querySelector("#tbr-doc-num").value.replace(/\D/g,"");const name=card.querySelector("#tbr-doc-name").value.trim();
        if(!number){alert("Le numéro client est obligatoire pour relier les documents et contrôler le DCO.");return;}
        const button=card.querySelector("#tbr-doc-confirm");button.disabled=true;button.textContent="Enregistrement…";
        const documentId=uid();await putFile(documentId,file);
        const importedAt=nowIso();
        const meta={id:documentId,fileName:file.name,mimeType:file.type||"application/pdf",size:file.size,type:parsed.type,label:parsed.label,priority:parsed.priority,pages:read.pages,numClient:number,nomClient:name,importedAt,monthKey:monthKey(),extracted:{...parsed.fields,numClient:number,nomClient:name},storage:"indexeddb"};
        const choices={numClient:number,nomClient:name,typeVente:card.querySelector("#tbr-doc-sale-type").value,typeClient:card.querySelector("#tbr-doc-client-type").value,engagement:Number(card.querySelector("#tbr-doc-engagement").value),codePromo:card.querySelector("#tbr-doc-promo").value.trim(),partenaire:card.querySelector("#tbr-doc-partner").checked,partenaireNom:parsed.partnerDetected||found?.partenaireNom||"Leroy Merlin"};
        const latestSales=loadSales();const index=latestSales.findIndex(s=>String(s.numClient||"").replace(/\D/g,"")===number);
        const merged=mergeByPriority(index>=0?latestSales[index]:null,parsed,meta,choices);
        if(index>=0)latestSales[index]={...merged,id:latestSales[index].id};else latestSales.unshift(merged);
        saveSales(latestSales);const vault=loadVault();saveVault([...vault.filter(item=>item.id!==documentId),meta]);
        localStorage.setItem("tbr.document.last.import",JSON.stringify({documentId,numClient:number,type:parsed.type,at:importedAt}));
        button.textContent="Enregistré ✓";setTimeout(()=>location.reload(),500);
      };
    }catch(error){showMessage("Lecture impossible",error&&error.message?error.message:"Le document n’a pas pu être analysé.");}
  }

  async function openDocument(id,download){
    const item=await getFile(id);if(!item||!item.blob){showMessage("Document introuvable","Le PDF n’est plus présent dans le stockage local de cet appareil.");return;}
    const url=URL.createObjectURL(item.blob);
    if(download){const link=document.createElement("a");link.href=url;link.download=item.name||"document.pdf";document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);}
    else {window.open(url,"_blank","noopener");setTimeout(()=>URL.revokeObjectURL(url),60000);}
  }
  function showVault(){
    const items=loadVault().sort((a,b)=>new Date(b.importedAt)-new Date(a.importedAt));const modal=modalShell();const card=modal.querySelector(".tbr-doc-card");
    card.innerHTML=`<div class="tbr-doc-head"><div><span>COFFRE DOCUMENTAIRE</span><h2>${items.length} document(s)</h2><p>PDF conservés localement sur cet appareil.</p></div><button data-close>×</button></div><div class="tbr-doc-vault-list">${items.length?items.map(item=>`<article><div><strong>${escapeHtml(item.nomClient||"Client")}</strong><span>N° ${escapeHtml(item.numClient||"—")} · ${escapeHtml(item.label||DOC_LABEL[item.type]||"Document")}</span><small>${escapeHtml(item.fileName)} · ${new Date(item.importedAt).toLocaleString("fr-FR")}</small></div><div><button data-open="${item.id}">Ouvrir</button><button data-download="${item.id}">Exporter</button><button class="danger" data-delete="${item.id}">Supprimer</button></div></article>`).join(""):"<div class='tbr-doc-empty'>Aucun document conservé.</div>"}</div><button class="tbr-doc-primary" data-close>Fermer</button>`;
    card.querySelectorAll("[data-close]").forEach(button=>button.onclick=closeModal);
    card.querySelectorAll("[data-open]").forEach(button=>button.onclick=()=>openDocument(button.dataset.open,false));
    card.querySelectorAll("[data-download]").forEach(button=>button.onclick=()=>openDocument(button.dataset.download,true));
    card.querySelectorAll("[data-delete]").forEach(button=>button.onclick=async()=>{if(!confirm("Supprimer ce PDF du coffre ? La vente restera enregistrée."))return;const id=button.dataset.delete;await deleteFile(id);saveVault(loadVault().filter(item=>item.id!==id));showVault();});
    modal.classList.add("show");
  }

  function addStyles(){if(document.getElementById("tbr-doc-v12-style"))return;const style=document.createElement("style");style.id="tbr-doc-v12-style";style.textContent=`
    .tbr-doc-launcher{grid-column:1/-1;display:grid;grid-template-columns:1fr auto;gap:10px;padding:15px 16px;border-radius:20px;border:1px solid rgba(125,211,252,.32);background:radial-gradient(circle at 10% 0%,rgba(56,189,248,.24),transparent 45%),linear-gradient(135deg,#071a34,#151b49);color:#fff;box-shadow:0 18px 40px rgba(56,189,248,.16);cursor:pointer;text-align:left}.tbr-doc-launcher strong{display:block;font-size:15px}.tbr-doc-launcher span{display:block;margin-top:4px;color:#bae6fd;font-size:11px;line-height:1.35}.tbr-doc-launcher b{align-self:center;padding:8px 10px;border-radius:12px;background:rgba(255,255,255,.11);font-size:11px}.tbr-doc-vault-btn{grid-column:1/-1;border:1px solid rgba(148,163,184,.18);border-radius:15px;padding:10px 12px;background:rgba(15,23,42,.66);color:#cbd5e1;font-weight:900;cursor:pointer}
    .tbr-doc-modal{position:fixed;inset:0;z-index:12000;display:none;place-items:center;padding:16px;background:rgba(2,6,23,.84);backdrop-filter:blur(16px)}.tbr-doc-modal.show{display:grid}.tbr-doc-card{width:min(760px,100%);max-height:92vh;overflow:auto;padding:23px;border-radius:30px;border:1px solid rgba(125,211,252,.24);background:radial-gradient(circle at 88% 0%,rgba(99,102,241,.20),transparent 35%),linear-gradient(145deg,#09172a,#07111f);box-shadow:0 35px 100px rgba(0,0,0,.55);color:#f8fafc}.tbr-doc-head{display:flex;align-items:flex-start;gap:16px}.tbr-doc-head>div{flex:1}.tbr-doc-head span{color:#7dd3fc;font-size:9px;font-weight:1000;letter-spacing:.16em}.tbr-doc-head h2{margin:6px 0;font-size:30px;letter-spacing:-.04em}.tbr-doc-head p{margin:0;color:#94a3b8;font-size:11px}.tbr-doc-head>button{width:42px;height:42px;border-radius:14px;border:1px solid rgba(148,163,184,.18);background:rgba(15,23,42,.70);color:#cbd5e1;font-size:23px}.tbr-doc-copy{color:#cbd5e1;line-height:1.55}.tbr-doc-loading{padding:45px 20px;text-align:center}.tbr-doc-loading b{display:block;font-size:24px}.tbr-doc-loading span{display:block;margin-top:8px;color:#94a3b8}.tbr-doc-authority{margin:18px 0;padding:14px 15px;border-radius:18px;background:rgba(56,189,248,.08);border:1px solid rgba(56,189,248,.20)}.tbr-doc-authority b{display:block;color:#7dd3fc;font-size:12px}.tbr-doc-authority span{display:block;margin-top:5px;color:#cbd5e1;font-size:11px;line-height:1.45}.tbr-doc-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.tbr-doc-grid label>span{display:block;margin:0 0 5px;color:#94a3b8;font-size:9px;font-weight:900;text-transform:uppercase}.tbr-doc-grid input,.tbr-doc-grid select{width:100%;padding:11px 12px;border-radius:13px;border:1px solid rgba(148,163,184,.20);background:rgba(2,6,23,.52);color:#f8fafc}.tbr-doc-check{display:flex;align-items:center;gap:9px;margin-top:12px;padding:12px;border-radius:15px;background:rgba(15,23,42,.58);color:#cbd5e1;font-weight:850}.tbr-doc-check input{width:19px;height:19px}.tbr-doc-findings{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px}.tbr-doc-findings>div{padding:12px;border-radius:15px;background:rgba(15,23,42,.58);border:1px solid rgba(148,163,184,.13)}.tbr-doc-findings span{display:block;color:#94a3b8;font-size:8px;font-weight:900;text-transform:uppercase}.tbr-doc-findings b{display:block;margin-top:5px;color:#e0f2fe;font-size:13px}.tbr-doc-warning{margin-top:12px;padding:11px 12px;border-radius:14px;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.22);color:#fde68a;font-size:10px;line-height:1.45}.tbr-doc-actions{display:grid;grid-template-columns:1fr 1.4fr;gap:9px;margin-top:16px}.tbr-doc-primary,.tbr-doc-secondary{padding:13px;border-radius:15px;font-weight:1000;cursor:pointer}.tbr-doc-primary{border:0;background:linear-gradient(135deg,#38bdf8,#6366f1);color:#fff}.tbr-doc-secondary{border:1px solid rgba(148,163,184,.20);background:rgba(15,23,42,.66);color:#cbd5e1}.tbr-doc-vault-list{display:grid;gap:9px;margin:18px 0}.tbr-doc-vault-list article{display:flex;align-items:center;gap:12px;padding:13px;border-radius:17px;background:rgba(15,23,42,.62);border:1px solid rgba(148,163,184,.14)}.tbr-doc-vault-list article>div:first-child{flex:1;min-width:0}.tbr-doc-vault-list strong,.tbr-doc-vault-list span,.tbr-doc-vault-list small{display:block}.tbr-doc-vault-list span{margin-top:3px;color:#7dd3fc;font-size:10px}.tbr-doc-vault-list small{margin-top:3px;color:#8294ad;font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tbr-doc-vault-list article>div:last-child{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end}.tbr-doc-vault-list button{padding:7px 8px;border-radius:10px;border:1px solid rgba(56,189,248,.20);background:rgba(56,189,248,.10);color:#bae6fd;font-size:9px;font-weight:900}.tbr-doc-vault-list button.danger{border-color:rgba(248,113,113,.22);background:rgba(127,29,29,.16);color:#fecaca}.tbr-doc-empty{padding:20px;text-align:center;color:#94a3b8}
    @media(max-width:600px){.tbr-doc-card{padding:17px;border-radius:24px}.tbr-doc-head h2{font-size:25px}.tbr-doc-grid{grid-template-columns:1fr}.tbr-doc-findings{grid-template-columns:1fr}.tbr-doc-vault-list article{align-items:flex-start;flex-direction:column}.tbr-doc-vault-list article>div:last-child{justify-content:flex-start}.tbr-doc-actions{grid-template-columns:1fr}}
  `;document.head.appendChild(style);}

  function mount(){
    addStyles();
    const manual=[...document.querySelectorAll("button")].find(button=>button.textContent.includes("Saisir à la main"));
    if(!manual)return;
    const grid=manual.parentElement;if(!grid||grid.querySelector("#tbr-doc-launcher"))return;
    const input=document.createElement("input");input.type="file";input.accept="application/pdf,.pdf";input.style.display="none";input.id="tbr-doc-file-input";input.onchange=event=>{const file=event.target.files&&event.target.files[0];event.target.value="";importFile(file);};document.body.appendChild(input);
    const button=document.createElement("button");button.id="tbr-doc-launcher";button.className="tbr-doc-launcher";button.type="button";button.innerHTML="<div><strong>📄 Ajouter une vente par document</strong><span>Proposition, contrat ou PV : TBR lit, prépare et conserve le PDF.</span></div><b>IMPORTER</b>";button.onclick=()=>input.click();
    const vault=document.createElement("button");vault.type="button";vault.className="tbr-doc-vault-btn";vault.textContent=`🗂️ Coffre documentaire · ${loadVault().length} fichier(s)`;vault.onclick=showVault;
    grid.appendChild(button);grid.appendChild(vault);
  }

  const observer=new MutationObserver(mount);observer.observe(document.documentElement,{childList:true,subtree:true});
  mount();
  try{localStorage.setItem("cc_version",VERSION);}catch(e){}
})().catch(error=>{
  console.error(error);
  const target=document.getElementById("boot-msg");
  if(target){target.className="boot-error";target.textContent="TBR n’a pas pu charger le moteur documentaire : "+(error&&error.message?error.message:error);}
});