(()=>{
  const VERSION="2026.07.26-unfreeze-saisie-v15";
  if(window.__tbrSimpleSaisieV15) return;
  window.__tbrSimpleSaisieV15=true;

  const textOf=element=>String(element&&element.textContent||"").replace(/\s+/g," ").trim();
  const findButton=label=>[...document.querySelectorAll("button")].find(button=>textOf(button).includes(label));
  let mountTimer=null;

  function addStyles(){
    if(document.getElementById("tbr-simple-saisie-v15-style")) return;
    const style=document.createElement("style");
    style.id="tbr-simple-saisie-v15-style";
    style.textContent=`
      .tbr-simple-saisie-v15{position:relative;display:grid;gap:11px;margin:0 0 18px;padding:0;isolation:isolate}
      .tbr-simple-saisie-v15:before{content:"";position:absolute;inset:-12px;z-index:-1;border-radius:30px;background:radial-gradient(circle at 12% 0%,rgba(56,189,248,.13),transparent 40%),radial-gradient(circle at 88% 0%,rgba(99,102,241,.14),transparent 42%);filter:blur(8px);pointer-events:none}
      .tbr-simple-main{min-height:92px;width:100%;display:flex;align-items:center;gap:16px;padding:18px 19px;border:1px solid rgba(125,211,252,.34);border-radius:25px;background:radial-gradient(circle at 5% 0%,rgba(56,189,248,.30),transparent 46%),linear-gradient(135deg,#09213c 0%,#102554 55%,#292660 100%);color:#fff;text-align:left;box-shadow:0 20px 46px rgba(56,189,248,.17),inset 0 1px 0 rgba(255,255,255,.10);cursor:pointer}
      .tbr-simple-main:active{transform:scale(.988)}
      .tbr-simple-main-icon{flex:0 0 54px;width:54px;height:54px;display:grid;place-items:center;border-radius:18px;background:linear-gradient(145deg,#38bdf8,#6366f1);box-shadow:0 12px 28px rgba(56,189,248,.30);font-size:27px;font-weight:1000}
      .tbr-simple-main-copy{min-width:0;flex:1}.tbr-simple-main-copy strong{display:block;font-size:20px;line-height:1.12;letter-spacing:-.02em}.tbr-simple-main-copy span{display:block;margin-top:6px;color:#c8e9ff;font-size:11px;font-weight:750;line-height:1.35}
      .tbr-simple-main-arrow{font-size:26px;color:#bae6fd;font-weight:950}
      .tbr-simple-secondary{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      .tbr-simple-secondary button{min-height:52px;padding:12px 10px;border-radius:17px;border:1px solid rgba(148,163,184,.18);background:linear-gradient(145deg,rgba(15,23,42,.84),rgba(10,20,39,.78));color:#e5eefb;font-size:12px;font-weight:950;box-shadow:inset 0 1px 0 rgba(255,255,255,.045);cursor:pointer}
      .tbr-simple-secondary button:active{transform:scale(.985)}
      .tbr-simple-secondary small{display:block;margin-top:3px;color:#8294ad;font-size:8px;font-weight:800}
      .tbr-simple-choice{position:fixed;inset:0;z-index:13000;display:none;place-items:center;padding:18px;background:rgba(2,6,23,.86);backdrop-filter:blur(18px)}
      .tbr-simple-choice.show{display:grid}
      .tbr-simple-choice-card{width:min(470px,100%);padding:22px;border-radius:29px;border:1px solid rgba(125,211,252,.24);background:radial-gradient(circle at 90% 0%,rgba(99,102,241,.22),transparent 38%),linear-gradient(145deg,#0b1a30,#07111f);box-shadow:0 36px 100px rgba(0,0,0,.58);color:#fff}
      .tbr-simple-choice-head{display:flex;align-items:flex-start;gap:12px}.tbr-simple-choice-head>div{flex:1}.tbr-simple-choice-head span{display:block;color:#7dd3fc;font-size:9px;font-weight:1000;letter-spacing:.16em}.tbr-simple-choice-head h2{margin:7px 0 4px;font-size:29px;letter-spacing:-.04em}.tbr-simple-choice-head p{margin:0;color:#94a3b8;font-size:11px}.tbr-simple-choice-close{width:42px;height:42px;border-radius:14px;border:1px solid rgba(148,163,184,.18);background:rgba(15,23,42,.70);color:#cbd5e1;font-size:22px;font-weight:900}
      .tbr-simple-options{display:grid;gap:10px;margin-top:18px}.tbr-simple-option{display:flex;align-items:center;gap:14px;width:100%;padding:15px;border-radius:19px;border:1px solid rgba(125,211,252,.18);background:rgba(15,23,42,.70);color:#fff;text-align:left;cursor:pointer}.tbr-simple-option:active{transform:scale(.988)}.tbr-simple-option i{flex:0 0 48px;width:48px;height:48px;display:grid;place-items:center;border-radius:15px;background:rgba(56,189,248,.13);font-size:25px;font-style:normal}.tbr-simple-option strong{display:block;font-size:15px}.tbr-simple-option span{display:block;margin-top:4px;color:#9fb0c7;font-size:10px;line-height:1.35}.tbr-simple-option b{margin-left:auto;color:#7dd3fc;font-size:20px}
      .tbr-simple-cancel{width:100%;margin-top:11px;padding:13px;border-radius:15px;border:1px solid rgba(148,163,184,.17);background:rgba(15,23,42,.56);color:#cbd5e1;font-weight:950}
      @media(max-width:480px){.tbr-simple-main{min-height:84px;padding:15px;border-radius:22px}.tbr-simple-main-icon{width:49px;height:49px;flex-basis:49px}.tbr-simple-main-copy strong{font-size:18px}.tbr-simple-choice-card{padding:18px;border-radius:24px}}
    `;
    document.head.appendChild(style);
  }

  function closeChoice(){document.getElementById("tbr-simple-choice-v15")?.classList.remove("show");}

  function openChoice(sources){
    let modal=document.getElementById("tbr-simple-choice-v15");
    if(!modal){
      modal=document.createElement("div");
      modal.id="tbr-simple-choice-v15";
      modal.className="tbr-simple-choice";
      modal.innerHTML=`<section class="tbr-simple-choice-card" role="dialog" aria-modal="true"><header class="tbr-simple-choice-head"><div><span>AJOUTER UNE VENTE</span><h2>Choisis ton document</h2><p>Une seule étape, TBR s’occupe du reste.</p></div><button class="tbr-simple-choice-close" data-close>×</button></header><div class="tbr-simple-options"><button class="tbr-simple-option" data-choice="pdf"><i>📄</i><div><strong>Choisir un PDF</strong><span>Proposition, contrat ou PV d’installation</span></div><b>›</b></button><button class="tbr-simple-option" data-choice="photos"><i>📷</i><div><strong>Ajouter des photos</strong><span>Captures du procès-verbal d’installation</span></div><b>›</b></button></div><button class="tbr-simple-cancel" data-close>Annuler</button></section>`;
      modal.addEventListener("click",event=>{if(event.target===modal||event.target.closest("[data-close]")) closeChoice();});
      document.body.appendChild(modal);
    }
    modal.querySelector('[data-choice="pdf"]').onclick=()=>{
      closeChoice();
      const pdfButton=document.getElementById("tbr-doc-launcher");
      const pdfInput=document.getElementById("tbr-doc-file-input");
      if(pdfButton) pdfButton.click();
      else if(pdfInput) pdfInput.click();
      else alert("Le lecteur PDF se prépare. Réessaie dans une seconde.");
    };
    modal.querySelector('[data-choice="photos"]').onclick=()=>{
      closeChoice();
      const photoButton=findButton("Ajouter captures du PV")||sources.photo;
      if(photoButton) photoButton.click();
      else alert("Le lecteur photo n’est pas encore disponible.");
    };
    modal.classList.add("show");
  }

  function hideOldExplanation(){
    const candidates=[...document.querySelectorAll("div,p,section")].filter(element=>textOf(element).includes("Ajoute 4, 5, 6 captures"));
    if(!candidates.length) return;
    candidates.sort((a,b)=>textOf(a).length-textOf(b).length);
    let target=candidates[0];
    while(target.parentElement&&target.parentElement!==document.body&&textOf(target.parentElement)===textOf(target)&&target.parentElement.children.length<=2) target=target.parentElement;
    target.style.setProperty("display","none","important");
    target.dataset.tbrSimpleHidden="explanation";
  }

  function mount(){
    addStyles();
    const existing=document.getElementById("tbr-simple-saisie-v15");
    if(existing&&existing.isConnected) return true;

    const manual=findButton("Saisir à la main");
    const photo=findButton("Ajouter captures du PV");
    if(!manual||!photo) return false;
    const oldGrid=manual.parentElement;
    if(!oldGrid||!oldGrid.parentElement) return false;

    const panel=document.createElement("section");
    panel.id="tbr-simple-saisie-v15";
    panel.className="tbr-simple-saisie-v15";
    panel.innerHTML=`<button type="button" class="tbr-simple-main" id="tbr-simple-add-document"><span class="tbr-simple-main-icon">＋</span><span class="tbr-simple-main-copy"><strong>Ajouter un document</strong><span>PDF ou photos · TBR prépare la vente</span></span><span class="tbr-simple-main-arrow">›</span></button><div class="tbr-simple-secondary"><button type="button" id="tbr-simple-manual">✍️ Saisie manuelle<small>Remplir la fiche toi-même</small></button><button type="button" id="tbr-simple-documents">🗂 Mes documents<small id="tbr-simple-doc-count">0 fichier</small></button></div>`;
    oldGrid.parentElement.insertBefore(panel,oldGrid);

    const sources={manual,photo};
    panel.querySelector("#tbr-simple-add-document").onclick=()=>openChoice(sources);
    panel.querySelector("#tbr-simple-manual").onclick=()=>manual.click();
    panel.querySelector("#tbr-simple-documents").onclick=()=>{
      const vault=document.querySelector(".tbr-doc-vault-btn");
      if(vault) vault.click();
      else alert("Le coffre documentaire se prépare. Réessaie dans une seconde.");
    };

    const vault=document.querySelector(".tbr-doc-vault-btn");
    const count=(textOf(vault).match(/(\d+)\s*fichier/)||[])[1]||"0";
    panel.querySelector("#tbr-simple-doc-count").textContent=`${count} fichier${count==="1"?"":"s"}`;
    oldGrid.style.setProperty("display","none","important");
    oldGrid.dataset.tbrSimpleHidden="actions";
    hideOldExplanation();
    return true;
  }

  function scheduleMount(){
    if(mountTimer!==null) return;
    mountTimer=window.setTimeout(()=>{
      mountTimer=null;
      mount();
    },180);
  }

  const observer=new MutationObserver(scheduleMount);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  mount();
  window.setTimeout(scheduleMount,700);
  window.setTimeout(scheduleMount,1800);
  try{localStorage.setItem("cc_version",VERSION);}catch(error){}
})();