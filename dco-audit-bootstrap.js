(async()=>{
  const fail=message=>{throw new Error(message);};
  const response=await fetch("./index.html?dco-command-base=20260726",{cache:"no-store"});
  if(!response.ok) fail("Base TBR indisponible");
  let html=await response.text();

  const replaceExact=(before,after,label)=>{
    if(!html.includes(before)) fail(label+" introuvable");
    html=html.replace(before,after);
  };
  const replacePattern=(pattern,after,label)=>{
    if(!pattern.test(html)) fail(label+" introuvable");
    html=html.replace(pattern,after);
  };
  const replaceAfter=(anchor,before,after,label)=>{
    const anchorAt=html.indexOf(anchor);
    if(anchorAt<0) fail(label+" : ancre introuvable");
    const beforeAt=html.indexOf(before,anchorAt);
    if(beforeAt<0) fail(label+" : fermeture introuvable");
    html=html.slice(0,beforeAt)+after+html.slice(beforeAt+before.length);
  };

  replacePattern(
    /  function parseClientRows\(pages\)\{[\s\S]*?\n  \}\n\n  function parseInstallRows/,
    `  function parseClientRows(pages){
    const candidates=[];
    const pageList=Array.isArray(pages)?pages:[pages];
    const cats="REFVD|REFVF|PURVD|PURVF|PREVD|PREVF|RMK|PURGU|DIS";
    const catRx=new RegExp("\\\\b("+cats+")\\\\b","i");

    const parseCandidate=c=>{
      if(!c||!c.num) return null;
      const body=(c.parts||[]).join(" ").replace(/\\s+/g," ").trim();
      const catMatch=body.match(catRx);
      if(!catMatch) return null;
      const catpub=catMatch[1].toUpperCase();
      const nom=body.slice(0,catMatch.index).replace(/TOTAL|ANNEXE.*$/gi,"").trim()||"Client";
      let tail=body.slice((catMatch.index||0)+catMatch[0].length).trim();
      let engagement=0;
      const eng=tail.match(/^(\\d{1,2})\\s*mois\\b/i);
      if(eng){engagement=Number(eng[1]);tail=tail.slice(eng[0].length).trim();}
      const offerMatch=tail.match(/\\b(ACQ\\s*(?:start|location)|annulation_[A-Z0-9_]+)\\b/i);
      const offre=offerMatch?offerMatch[1].replace(/\\s+/g," "):"";
      const numericPart=offerMatch?tail.slice(0,offerMatch.index):tail;
      const nums=(numericPart.match(/-?\\d+(?:[,.]\\d+)?/g)||[]).map(toNum);
      if(nums.length<3) return null;
      const last=nums.slice(-3);
      return {nb:c.nb,num:c.num,matchKey:c.num,confidence:100,nom,catpub,engagement,caPacks:last[0],comVente:last[1],comPacks:last[2],offre,isAnnulation:c.nb<=0||/annulation/i.test(offre),page:c.page,raw:body};
    };

    pageList.forEach((rawPage,pageIndex)=>{
      const lines=(Array.isArray(rawPage)?rawPage:[rawPage]).map(x=>String(x||"").replace(/\\s+/g," ").trim()).filter(Boolean);
      let current=null;
      let pendingNb=null;
      let pendingAt=-99;
      const flush=()=>{if(current){candidates.push(current);current=null;}};

      lines.forEach((line,lineIndex)=>{
        const complete=line.match(/^(-?1|0)\\s+(\\d{6,8})(?:\\s+(.*))?$/);
        if(complete){flush();pendingNb=null;current={nb:Number(complete[1]),num:normNum(complete[2]),parts:complete[3]?[complete[3]]:[],page:pageIndex+1};return;}
        const nbOnly=line.match(/^(-?1|0)$/);
        if(nbOnly){flush();pendingNb=Number(nbOnly[1]);pendingAt=lineIndex;return;}
        const splitStart=(pendingNb!==null&&lineIndex-pendingAt<=2)?line.match(/^(\\d{6,8})(?:\\s+(.*))?$/):null;
        if(splitStart){flush();current={nb:pendingNb,num:normNum(splitStart[1]),parts:splitStart[2]?[splitStart[2]]:[],page:pageIndex+1};pendingNb=null;return;}
        if(current) current.parts.push(line);
        if(pendingNb!==null&&lineIndex-pendingAt>2) pendingNb=null;
      });
      flush();
    });

    const bestByNumber={};
    candidates.map(parseCandidate).filter(Boolean).forEach(row=>{
      const score=(row.nom||"").length+(row.offre?30:0)+(Math.abs(row.comVente)+Math.abs(row.comPacks)>0?50:0);
      const old=bestByNumber[row.num];
      if(!old||score>old._score) bestByNumber[row.num]={...row,_score:score};
    });
    return Object.values(bestByNumber).map(({_score,...row})=>row);
  }

  function parseInstallRows`,
    "Lecteur PDF DCO par numéro client"
  );

  const detailLine='  const detailValue=(v,empty="—")=>{if(v===undefined||v===null||v==="") return empty; return String(v);};\n';
  replaceExact(
    detailLine,
    detailLine+`
  const [dcoViewMode,setDcoViewMode]=useState("claims");
  const dcoClaimCases=dcoData?(dcoData.analyses||[]).filter(a=>Number(a.verseEnMoins||0)>0.99||a.type==="missing_dco"):[];
  const dcoOverpaidCases=dcoData?(dcoData.analyses||[]).filter(a=>Number(a.verseEnPlus||0)>0.99):[];
  const dcoReviewCases=dcoData?(dcoData.analyses||[]).filter(a=>a.statut!=="ok"&&Number(a.verseEnMoins||0)<1&&Number(a.verseEnPlus||0)<1):[];
  const dcoConformCases=dcoData?(dcoData.analyses||[]).filter(a=>a.statut==="ok"):[];
  const dcoGlobalClaims=dcoData?(dcoData.globalRows||[]).filter(r=>r.money&&r.label!=="Installations total"&&Number(r.ecart)<-0.99):[];
  const dcoGlobalOverpaid=dcoData?(dcoData.globalRows||[]).filter(r=>r.money&&r.label!=="Installations total"&&Number(r.ecart)>0.99):[];
  const dcoVisibleCases=dcoViewMode==="claims"?dcoClaimCases:dcoViewMode==="review"?dcoReviewCases:[...(dcoData?dcoData.analyses||[]:[])].sort((a,b)=>analysisRank(a)-analysisRank(b));
  const dcoCriticalCount=dcoClaimCases.length+dcoGlobalClaims.length;
  const dcoConfidence=dcoData?Math.max(0,Math.min(100,Number(dcoData.couverture||0))):0;

  const buildDcoClaimMail=()=>{
    if(!dcoData) return "";
    const month=\`${MOIS_NOMS[dcoData.moisUsed.mois-1]} ${dcoData.moisUsed.annee}\`;
    const clientLines=dcoClaimCases.map(a=>{
      const missing=(a.lines||[]).filter(l=>Number(l.ecart)<-0.99).map(l=>\`   - ${l.label} : attendu ${money(l.tbr)}, versé ${money(l.dco)}, manque ${money(Math.abs(l.ecart))}\`).join("\\n");
      return \`• Client n° ${a.num} — ${a.nom||"Client"}\\n  Montant à régulariser : ${money(a.verseEnMoins||Math.abs(a.ecart||0))}${missing?"\\n"+missing:""}\`;
    });
    const globalLines=dcoGlobalClaims.map(r=>\`• ${r.label} : attendu ${money(r.tbr)}, versé ${money(r.dco)}, manque ${money(Math.abs(r.ecart))}\`);
    const details=[...clientLines,...globalLines].join("\\n\\n")||"• Écart global détecté : détail à confirmer dans TBR.";
    return \`Bonjour,\\n\\nAprès contrôle de mon DCO de ${month}, TBR a identifié un montant total de ${money(dcoData.verseEnMoins||0)} versé en moins.\\n\\nVoici le détail des éléments à vérifier et à régulariser :\\n\\n${details}\\n\\nTotal demandé en régularisation : ${money(dcoData.verseEnMoins||0)}.\\n\\nLes éventuels montants versés en plus ont été isolés et ne sont pas inclus dans cette demande.\\n\\nMerci de vérifier ces éléments et de me confirmer la régularisation.\\n\\nBien cordialement,\\nTarek Bargaoui\`;
  };

  const copyDcoText=async(text,success)=>{
    try{await navigator.clipboard.writeText(text);alert(success);}
    catch(e){window.prompt("Texte prêt à copier :",text);}
  };
  const prepareDcoMail=()=>copyDcoText(buildDcoClaimMail(),"Le mail complet est copié. Tu peux le coller dans Outlook.");
  const copyDcoSnapshot=()=>{
    if(!dcoData) return;
    const month=\`${MOIS_NOMS[dcoData.moisUsed.mois-1]} ${dcoData.moisUsed.annee}\`;
    const lines=dcoClaimCases.map(a=>\`• N° ${a.num} — ${a.nom||"Client"} : ${money(a.verseEnMoins||Math.abs(a.ecart||0))} à réclamer\`);
    copyDcoText(\`AUDIT DCO — ${month}\\nÀ récupérer : ${money(dcoData.verseEnMoins||0)}\\nVersé en plus : ${money(dcoData.verseEnPlus||0)}\\nCouverture : ${dcoConfidence}%\\n\\n${lines.join("\\n")}\`,"La synthèse est copiée.");
  };
`,
    "Variables du centre de contrôle"
  );

  replacePattern(
    /      <section className="dco-hero">[\s\S]*?      <\/section>\n\n      <section className="dco-card">/,
    `      <section className="dco-hero dco-hero-command">
        <div className="dco-command-kicker"><span></span>DCO // CONTROL CENTER</div>
        <div className="dco-hero-command-grid">
          <div>
            <h2>Ton argent.<br/><em>Dossier par dossier.</em></h2>
            <p>TBR lit le PDF, retrouve chaque numéro client et transforme ton DCO en décisions simples : réclamer, vérifier ou classer.</p>
          </div>
          <button className="dco-hero-import" onClick={()=>fileRef.current.click()}>
            <span>{nomFichier?"Nouveau contrôle":"Lancer un contrôle"}</span>
            <b>{nomFichier?"Changer de PDF":"Importer le PDF DCO"}</b>
            <i>→</i>
          </button>
        </div>
      </section>

      <section className="dco-card dco-upload-dock">`,
    "Nouvel accueil DCO"
  );

  replacePattern(
    /          <section className="dco-verdict">[\s\S]*?          <\/section>\n\n          <section className="dco-card dco-explain-panel">[\s\S]*?          <\/section>/,
    `          <section className={"dco-command-center "+((dcoData.verseEnMoins||0)>0?"is-alert":"is-clear")}>
            <div className="dco-command-head">
              <div className="dco-live"><span></span>Audit terminé · {MOIS_NOMS[dcoData.moisUsed.mois-1]} {dcoData.moisUsed.annee}</div>
              <div className="dco-command-file">{nomFichier||"PDF DCO"} · {dcoData.rows.length} dossiers lus</div>
            </div>

            <div className="dco-money-stage">
              <div className="dco-money-main">
                <span>{(dcoData.verseEnMoins||0)>0?"À récupérer":"Situation"}</span>
                <strong>{(dcoData.verseEnMoins||0)>0?money(dcoData.verseEnMoins):"Tout est conforme"}</strong>
                <p>{(dcoData.verseEnMoins||0)>0
                  ?\`${dcoCriticalCount} dossier(s) demandent une action. Les montants versés en plus restent volontairement séparés.\`
                  :"Aucun manque détecté sur les éléments rapprochés par TBR."}</p>
              </div>
              <div className="dco-confidence-orbit" style={{background:\`conic-gradient(#61f5c4 ${dcoConfidence}%,rgba(255,255,255,.10) 0)\`}}>
                <div><strong>{dcoConfidence}%</strong><span>numéros<br/>retrouvés</span></div>
              </div>
            </div>

            <div className="dco-command-stats">
              <div className="danger"><span>Dossiers rouges</span><b>{dcoCriticalCount}</b></div>
              <div className="warning"><span>À vérifier</span><b>{dcoReviewCases.length}</b></div>
              <div className="success"><span>Conformes</span><b>{dcoConformCases.length}</b></div>
              <div className="positive"><span>Versé en plus</span><b>{money(dcoData.verseEnPlus||0)}</b></div>
            </div>

            <div className="dco-command-actions">
              {(dcoData.verseEnMoins||0)>0&&<button className="primary" onClick={prepareDcoMail}><span>✉</span>Préparer la réclamation</button>}
              <button onClick={copyDcoSnapshot}><span>⧉</span>Copier la synthèse</button>
              <button onClick={()=>fileRef.current.click()}><span>↻</span>Remplacer le PDF</button>
            </div>
          </section>

          {(dcoClaimCases.length>0||dcoGlobalClaims.length>0)&&(
            <section className="dco-mission">
              <div className="dco-section-head">
                <div><span>MISSION PRIORITAIRE</span><h3>Récupérer ce qui manque</h3></div>
                <b>{money(dcoData.verseEnMoins||0)}</b>
              </div>
              <div className="dco-case-stack">
                {dcoClaimCases.map((a,i)=>(
                  <details className="dco-case" key={"mission-"+a.num} open={i===0}>
                    <summary>
                      <div className="dco-case-index">{String(i+1).padStart(2,"0")}</div>
                      <div className="dco-case-id"><span>N° CLIENT {a.num}</span><strong>{a.nom||"Client"}</strong><small>{a.title||"Écart détecté"} · {a.catpub||"—"}</small></div>
                      <div className="dco-case-money"><span>À réclamer</span><b>{money(a.verseEnMoins||Math.abs(a.ecart||0))}</b><i>⌄</i></div>
                    </summary>
                    <div className="dco-case-proof">
                      <div className="dco-proof-title"><span>PREUVE DU CALCUL</span><b>Correspondance sécurisée par numéro client</b></div>
                      {(a.lines||[]).filter(l=>Number(l.ecart)<-0.99).map((l,j)=>(
                        <div className="dco-proof-row" key={j}>
                          <strong>{l.label}</strong>
                          <span>Attendu <b>{money(l.tbr)}</b></span>
                          <span>Versé <b>{money(l.dco)}</b></span>
                          <em>Manque {money(Math.abs(l.ecart))}</em>
                        </div>
                      ))}
                      {(a.lines||[]).filter(l=>Number(l.ecart)<-0.99).length===0&&<div className="dco-proof-note">{a.detail||"Le dossier existe dans TBR mais n'apparaît pas correctement dans le DCO."}</div>}
                      <div className="dco-case-tools">
                        {a.vente&&onEditClient&&<button onClick={()=>onEditClient(a.vente)}>Ouvrir la fiche client</button>}
                        <button onClick={()=>copyDcoText(\`Client n° ${a.num} — ${a.nom||"Client"} : ${money(a.verseEnMoins||Math.abs(a.ecart||0))} à régulariser.\`,"La ligne client est copiée.")}>Copier cette anomalie</button>
                      </div>
                    </div>
                  </details>
                ))}
                {dcoGlobalClaims.map((r,i)=>(
                  <div className="dco-case dco-case-global" key={"global-"+i}>
                    <div className="dco-case-index">G{i+1}</div>
                    <div className="dco-case-id"><span>ÉCART GLOBAL</span><strong>{r.label}</strong><small>Attendu {money(r.tbr)} · Versé {money(r.dco)}</small></div>
                    <div className="dco-case-money"><span>À réclamer</span><b>{money(Math.abs(r.ecart))}</b></div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {dcoReviewCases.length>0&&(
            <section className="dco-review-strip">
              <div><span>À VÉRIFIER AVANT RÉCLAMATION</span><strong>{dcoReviewCases.length} dossier(s) incertain(s)</strong><small>Ils sont isolés pour éviter une fausse réclamation.</small></div>
              <button onClick={()=>{setDcoViewMode("review");setTimeout(()=>document.getElementById("dco-explorer")?.scrollIntoView({behavior:"smooth"}),50);}}>Les examiner →</button>
            </section>
          )}

          {(dcoOverpaidCases.length>0||dcoGlobalOverpaid.length>0)&&(
            <details className="dco-overpaid">
              <summary><div><span>VERSÉ EN PLUS — INFORMATION UNIQUEMENT</span><strong>{money(dcoData.verseEnPlus||0)}</strong></div><b>Voir le détail +</b></summary>
              <div className="dco-overpaid-list">
                {dcoOverpaidCases.map(a=><div key={"plus-"+a.num}><span>N° {a.num} · {a.nom||"Client"}</span><b>{money(a.verseEnPlus||0)}</b></div>)}
                {dcoGlobalOverpaid.map((r,i)=><div key={"gplus-"+i}><span>{r.label}</span><b>{money(r.ecart)}</b></div>)}
              </div>
            </details>
          )}`,
    "Centre de contrôle DCO"
  );

  replacePattern(
    /\n          \{getDcoAlerts\(dcoData\)\.length>0&&\([\s\S]*?\n          \)\}\n\n          <section className="dco-grid">/,
    '\n\n          <details className="dco-tech-vault"><summary><span>Données techniques</span><b>Ouvrir le coffre des calculs +</b></summary>\n          <section className="dco-grid">',
    "Anciennes alertes et ouverture technique"
  );

  replacePattern(
    /(          <section className="dco-grid">[\s\S]*?          <\/section>)(\n\n          \{dcoData\.nonRetrouves>0&&\()/,
    '$1\n          </details>$2',
    "Fermeture technique"
  );

  replaceExact('<section className="dco-card">\n            <div className="dco-title">Contrôle client par client</div>','<section className="dco-card dco-explorer" id="dco-explorer">\n            <div className="dco-title">Explorateur des dossiers</div>',"Titre explorateur");
  replaceExact('<div className="dco-sub">Chaque ligne DCO est comparée au numéro client saisi dans TBR.</div>','<div className="dco-sub">Choisis ce que tu veux examiner. Les dossiers conformes ne parasitent plus ta vue.</div>\n            <div className="dco-filter-dock">\n              <button className={dcoViewMode==="claims"?"active danger":""} onClick={()=>setDcoViewMode("claims")}>À réclamer <b>{dcoClaimCases.length}</b></button>\n              <button className={dcoViewMode==="review"?"active warning":""} onClick={()=>setDcoViewMode("review")}>À vérifier <b>{dcoReviewCases.length}</b></button>\n              <button className={dcoViewMode==="all"?"active":""} onClick={()=>setDcoViewMode("all")}>Tous <b>{(dcoData.analyses||[]).length}</b></button>\n            </div>',"Filtres explorateur");
  replaceExact('{[...dcoData.analyses].sort((a,b)=>analysisRank(a)-analysisRank(b)).map((a,i)=>(','{dcoVisibleCases.map((a,i)=>(',"Liste filtrée");

  const css=`
<style id="tbr-dco-command-css">
.dco-v9{--ink:#07101f;--paper:#f4f7fb;--red:#ff3b4e;--red2:#b90f2d;--mint:#61f5c4;--amber:#ffbf48;--line:rgba(8,18,35,.1);max-width:1120px!important;margin:0 auto!important;padding-bottom:60px!important;color:var(--ink)}
.dco-v9 .dco-hero-command{position:relative;overflow:hidden;display:block!important;min-height:300px;padding:34px!important;border-radius:32px!important;background:radial-gradient(circle at 84% 18%,rgba(97,245,196,.20),transparent 28%),radial-gradient(circle at 5% 100%,rgba(255,59,78,.22),transparent 31%),#07101f!important;color:white!important;box-shadow:0 28px 70px rgba(7,16,31,.25)!important}
.dco-hero-command:after{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:34px 34px;mask-image:linear-gradient(to bottom,black,transparent);pointer-events:none}
.dco-command-kicker{position:relative;z-index:1;display:flex;align-items:center;gap:10px;font-size:11px;font-weight:950;letter-spacing:.19em;color:#b9c7d9}.dco-command-kicker span{width:9px;height:9px;border-radius:50%;background:var(--mint);box-shadow:0 0 18px var(--mint)}
.dco-hero-command-grid{position:relative;z-index:1;display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:35px;align-items:end;margin-top:48px}
.dco-hero-command h2{margin:0!important;font-size:clamp(42px,7vw,75px)!important;line-height:.93!important;letter-spacing:-.065em!important;color:#fff!important;max-width:720px}.dco-hero-command h2 em{font-style:normal;color:var(--mint)}
.dco-hero-command p{max-width:650px;margin:22px 0 0!important;color:#b9c7d9!important;font-size:15px!important;line-height:1.65!important}
.dco-hero-import{display:grid;grid-template-columns:1fr auto;text-align:left;align-items:center;gap:4px 14px;padding:20px 22px;border:1px solid rgba(255,255,255,.2);border-radius:20px;background:rgba(255,255,255,.08);color:#fff;backdrop-filter:blur(16px);cursor:pointer}.dco-hero-import span{grid-column:1;font-size:10px;text-transform:uppercase;letter-spacing:.13em;color:#9fb0c5;font-weight:900}.dco-hero-import b{grid-column:1;font-size:16px}.dco-hero-import i{grid-column:2;grid-row:1/3;font-style:normal;font-size:28px;color:var(--mint)}
.dco-upload-dock{margin-top:-17px!important;position:relative;z-index:2;border:0!important;border-radius:22px!important;box-shadow:0 18px 45px rgba(12,26,48,.14)!important}.dco-upload-dock .dco-mini-note{border-top:1px solid var(--line);padding-top:12px!important}
.dco-command-center{margin-top:22px;border-radius:30px;padding:26px;background:#07101f;color:white;box-shadow:0 25px 65px rgba(7,16,31,.22);position:relative;overflow:hidden}.dco-command-center:before{content:"";position:absolute;width:300px;height:300px;border-radius:50%;right:-130px;top:-160px;background:rgba(255,59,78,.2);filter:blur(5px)}.dco-command-center.is-clear:before{background:rgba(97,245,196,.18)}
.dco-command-head,.dco-money-stage,.dco-command-stats,.dco-command-actions{position:relative;z-index:1}.dco-command-head{display:flex;justify-content:space-between;align-items:center;gap:16px;padding-bottom:24px;border-bottom:1px solid rgba(255,255,255,.09)}.dco-live{font-size:11px;font-weight:950;letter-spacing:.12em;text-transform:uppercase;display:flex;align-items:center;gap:9px}.dco-live span{width:8px;height:8px;border-radius:50%;background:var(--mint);box-shadow:0 0 16px var(--mint)}.dco-command-file{font-size:12px;color:#94a6bc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:48%}
.dco-money-stage{display:grid;grid-template-columns:1fr 170px;align-items:center;gap:28px;padding:32px 0}.dco-money-main>span{display:block;font-size:12px;font-weight:950;text-transform:uppercase;letter-spacing:.18em;color:#ff8794}.is-clear .dco-money-main>span{color:var(--mint)}.dco-money-main>strong{display:block;margin-top:7px;font-size:clamp(48px,10vw,92px);line-height:.95;letter-spacing:-.065em}.dco-money-main p{max-width:620px;color:#aebcd0;margin:14px 0 0;line-height:1.55}
.dco-confidence-orbit{width:148px;height:148px;border-radius:50%;padding:9px;justify-self:end;box-shadow:0 0 42px rgba(97,245,196,.12)}.dco-confidence-orbit>div{height:100%;border-radius:50%;display:grid;place-content:center;text-align:center;background:#0b1729}.dco-confidence-orbit strong{font-size:30px}.dco-confidence-orbit span{font-size:10px;color:#9aabc0;text-transform:uppercase;letter-spacing:.1em;line-height:1.3}
.dco-command-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.dco-command-stats>div{padding:15px 16px;border-radius:15px;background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.07)}.dco-command-stats span{display:block;color:#8ea1b8;font-size:10px;text-transform:uppercase;letter-spacing:.1em;font-weight:900}.dco-command-stats b{display:block;margin-top:6px;font-size:19px}.dco-command-stats .danger b{color:#ff7180}.dco-command-stats .warning b{color:var(--amber)}.dco-command-stats .success b,.dco-command-stats .positive b{color:var(--mint)}
.dco-command-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}.dco-command-actions button{border:1px solid rgba(255,255,255,.13);background:rgba(255,255,255,.07);color:#fff;border-radius:14px;padding:13px 16px;font-weight:900;cursor:pointer}.dco-command-actions button span{margin-right:7px}.dco-command-actions .primary{background:linear-gradient(135deg,#ff4457,#b90f2d);border:0;box-shadow:0 12px 28px rgba(255,59,78,.24)}
.dco-mission{margin-top:22px;border-radius:28px;background:#fff;border:1px solid rgba(185,15,45,.15);box-shadow:0 20px 55px rgba(24,36,56,.09);padding:24px}.dco-section-head{display:flex;justify-content:space-between;align-items:end;gap:20px;margin-bottom:18px}.dco-section-head span{font-size:10px;color:var(--red2);font-weight:950;letter-spacing:.17em}.dco-section-head h3{margin:5px 0 0;font-size:26px;letter-spacing:-.035em}.dco-section-head>b{font-size:27px;color:var(--red2)}
.dco-case-stack{display:grid;gap:10px}.dco-case{border:1px solid #e8edf4;border-radius:18px;background:#fbfcfe;overflow:hidden}.dco-case summary,.dco-case-global{display:grid;grid-template-columns:48px minmax(0,1fr) auto;align-items:center;gap:14px;padding:16px;cursor:pointer;list-style:none}.dco-case summary::-webkit-details-marker{display:none}.dco-case-index{height:42px;border-radius:13px;display:grid;place-items:center;background:#101d31;color:#fff;font-size:11px;font-weight:950;letter-spacing:.08em}.dco-case-id span{display:block;color:#8b97a8;font-size:9px;letter-spacing:.13em;font-weight:950}.dco-case-id strong{display:block;font-size:16px;margin-top:3px}.dco-case-id small{display:block;color:#7d8998;margin-top:3px}.dco-case-money{text-align:right}.dco-case-money span{display:block;font-size:9px;color:#a43848;text-transform:uppercase;letter-spacing:.11em;font-weight:950}.dco-case-money b{display:inline-block;color:var(--red2);font-size:20px;margin-top:3px}.dco-case-money i{font-style:normal;margin-left:10px;color:#9aa6b6}
.dco-case-proof{padding:0 16px 17px 78px}.dco-proof-title{display:flex;justify-content:space-between;gap:15px;padding:14px 0;border-top:1px dashed #dce2eb}.dco-proof-title span{font-size:9px;letter-spacing:.15em;color:#9a4050;font-weight:950}.dco-proof-title b{font-size:11px;color:#506176}.dco-proof-row{display:grid;grid-template-columns:minmax(130px,1.3fr) 1fr 1fr auto;gap:10px;align-items:center;padding:10px 12px;margin-top:7px;border-radius:12px;background:#fff}.dco-proof-row span{font-size:11px;color:#68778a}.dco-proof-row em{font-style:normal;color:var(--red2);font-weight:950;font-size:12px}.dco-proof-note{padding:12px;background:#fff;border-radius:12px;color:#5e6d80;line-height:1.5}.dco-case-tools{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.dco-case-tools button{border:1px solid #d7deea;background:#fff;border-radius:11px;padding:9px 12px;font-weight:850;cursor:pointer;color:#26364c}
.dco-review-strip{display:flex;justify-content:space-between;gap:20px;align-items:center;margin-top:18px;padding:19px 22px;border-radius:20px;background:#fff7e5;border:1px solid #ffdda0}.dco-review-strip span{display:block;font-size:9px;color:#9e6400;letter-spacing:.13em;font-weight:950}.dco-review-strip strong{display:block;margin-top:4px}.dco-review-strip small{display:block;color:#8a7041;margin-top:2px}.dco-review-strip button{border:0;background:#ffbf48;border-radius:12px;padding:11px 14px;font-weight:950;cursor:pointer}
.dco-overpaid{margin-top:14px;border-radius:20px;background:#ebfff8;border:1px solid #a8efd7;overflow:hidden}.dco-overpaid summary{display:flex;justify-content:space-between;align-items:center;gap:15px;padding:18px 20px;cursor:pointer;list-style:none}.dco-overpaid summary::-webkit-details-marker{display:none}.dco-overpaid span{display:block;font-size:9px;color:#087b5c;letter-spacing:.12em;font-weight:950}.dco-overpaid strong{display:block;margin-top:3px;font-size:22px;color:#076b51}.dco-overpaid summary>b{font-size:12px;color:#087b5c}.dco-overpaid-list{border-top:1px solid #bcefdc;padding:8px 18px 14px}.dco-overpaid-list>div{display:flex;justify-content:space-between;padding:9px 0;color:#215e4e}
.dco-tech-vault{margin-top:18px;border:1px solid #dce3ed;border-radius:18px;background:#fff;overflow:hidden}.dco-tech-vault>summary{display:flex;justify-content:space-between;align-items:center;padding:16px 19px;cursor:pointer;list-style:none}.dco-tech-vault>summary::-webkit-details-marker{display:none}.dco-tech-vault>summary span{font-size:10px;color:#8996a7;font-weight:950;letter-spacing:.13em;text-transform:uppercase}.dco-tech-vault>summary b{font-size:12px}.dco-tech-vault .dco-grid{padding:0 12px 12px}
.dco-explorer{margin-top:18px!important;border-radius:24px!important}.dco-filter-dock{display:flex;gap:8px;overflow:auto;margin:15px 0 18px;padding:5px;background:#eef2f7;border-radius:15px}.dco-filter-dock button{white-space:nowrap;border:0;background:transparent;border-radius:11px;padding:10px 13px;font-weight:900;color:#617086;cursor:pointer}.dco-filter-dock button b{margin-left:5px;padding:2px 6px;border-radius:20px;background:#fff}.dco-filter-dock button.active{background:#111e31;color:#fff;box-shadow:0 7px 16px rgba(17,30,49,.18)}.dco-filter-dock button.active.danger{background:#b90f2d}.dco-filter-dock button.active.warning{background:#b77600}
.dco-explorer .dco-client{border-radius:16px!important;border-color:#e1e7ef!important}.dco-explorer .dco-client summary{padding:15px!important}
@media(max-width:760px){
 .dco-v9{padding:0 10px 48px!important}.dco-v9 .dco-hero-command{border-radius:24px!important;padding:25px 21px!important;min-height:0}.dco-hero-command-grid{grid-template-columns:1fr;margin-top:35px}.dco-hero-command h2{font-size:46px!important}.dco-hero-import{width:100%}
 .dco-upload-dock{margin-left:6px!important;margin-right:6px!important}.dco-command-center{border-radius:23px;padding:20px}.dco-command-head{align-items:flex-start}.dco-command-file{max-width:46%}.dco-money-stage{grid-template-columns:1fr 102px;gap:12px}.dco-money-main>strong{font-size:50px}.dco-money-main p{font-size:12px}.dco-confidence-orbit{width:94px;height:94px;padding:6px}.dco-confidence-orbit strong{font-size:20px}.dco-confidence-orbit span{font-size:7px}
 .dco-command-stats{grid-template-columns:1fr 1fr}.dco-command-actions button{flex:1 1 44%;padding:12px 10px}.dco-command-actions .primary{flex-basis:100%}
 .dco-mission{padding:17px;border-radius:22px}.dco-section-head{align-items:flex-start}.dco-section-head h3{font-size:21px}.dco-section-head>b{font-size:19px}.dco-case summary,.dco-case-global{grid-template-columns:42px minmax(0,1fr);gap:10px}.dco-case-money{grid-column:2;text-align:left;display:flex;align-items:center;gap:8px}.dco-case-money span{display:none}.dco-case-money b{font-size:18px}.dco-case-proof{padding:0 12px 14px}.dco-proof-title{display:block}.dco-proof-title b{display:block;margin-top:5px}.dco-proof-row{grid-template-columns:1fr 1fr}.dco-proof-row>strong{grid-column:1/-1}.dco-proof-row em{grid-column:1/-1}
 .dco-review-strip{align-items:flex-start;flex-direction:column}.dco-review-strip button{width:100%}.dco-overpaid summary{align-items:flex-start}.dco-tech-vault>summary b{font-size:10px}
}
</style>`;
  html=html.replace('</head>',css+'<meta name="tbr-dco-command-center" content="2026-07-26"></head>');

  const required=[
    "matchKey:c.num",
    "const dcoClaimCases=",
    "DCO // CONTROL CENTER",
    "À récupérer",
    "MISSION PRIORITAIRE",
    "dco-filter-dock",
    "tbr-dco-command-center"
  ];
  required.forEach(token=>{if(!html.includes(token))fail("Validation incomplète : "+token);});

  document.open();
  document.write(html);
  document.close();
})().catch(error=>{
  console.error(error);
  const target=document.getElementById("boot-msg");
  if(target){
    target.className="boot-error";
    target.textContent="Le contrôle DCO n’a pas pu charger : "+(error&&error.message?error.message:error);
  }
});