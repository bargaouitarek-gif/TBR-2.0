(async()=>{
  const fail=message=>{throw new Error(message);};
  const response=await fetch("./index.html?dco-audit-base=20260725",{cache:"no-store"});
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

  replaceExact(
    'rows.push({nb,num,nom,catpub,engagement,caPacks:last[0],comVente:last[1],comPacks:last[2],offre,isAnnulation:nb<=0||/annulation/i.test(offre)});',
    'rows.push({nb,num,matchKey:num,confidence:100,nom,catpub,engagement,caPacks:last[0],comVente:last[1],comPacks:last[2],offre,isAnnulation:nb<=0||/annulation/i.test(offre)});',
    "Clé numéro client"
  );

  const detailLine='  const detailValue=(v,empty="—")=>{if(v===undefined||v===null||v==="") return empty; return String(v);};\n';
  replaceExact(detailLine,detailLine+"\n"+"  const dcoClaimCases=dcoData?(dcoData.analyses||[]).filter(a=>Number(a.verseEnMoins||0)>0.99||a.type===\"missing_dco\"):[];\n  const dcoOverpaidCases=dcoData?(dcoData.analyses||[]).filter(a=>Number(a.verseEnPlus||0)>0.99):[];\n  const dcoReviewCases=dcoData?(dcoData.analyses||[]).filter(a=>a.statut!==\"ok\"&&Number(a.verseEnMoins||0)<1&&Number(a.verseEnPlus||0)<1):[];\n  const dcoConformCases=dcoData?(dcoData.analyses||[]).filter(a=>a.statut===\"ok\"):[];\n  const dcoGlobalClaims=dcoData?(dcoData.globalRows||[]).filter(r=>r.money&&r.label!==\"Installations total\"&&Number(r.ecart)<-0.99):[];\n  const dcoGlobalOverpaid=dcoData?(dcoData.globalRows||[]).filter(r=>r.money&&r.label!==\"Installations total\"&&Number(r.ecart)>0.99):[];\n\n  const buildDcoClaimMail=()=>{\n    if(!dcoData) return \"\";\n    const month=`${MOIS_NOMS[dcoData.moisUsed.mois-1]} ${dcoData.moisUsed.annee}`;\n    const clientLines=dcoClaimCases.map(a=>{\n      const missing=(a.lines||[]).filter(l=>Number(l.ecart)<-0.99).map(l=>`   - ${l.label} : attendu ${money(l.tbr)}, versé ${money(l.dco)}, manque ${money(Math.abs(l.ecart))}`).join(\"\\\\n\");\n      return `• Client n° ${a.num} — ${a.nom||\"Client\"}\\\\n  Montant à régulariser : ${money(a.verseEnMoins||Math.abs(a.ecart||0))}${missing?\"\\\\n\"+missing:\"\"}`;\n    });\n    const globalLines=dcoGlobalClaims.map(r=>`• ${r.label} : attendu ${money(r.tbr)}, versé ${money(r.dco)}, manque ${money(Math.abs(r.ecart))}`);\n    const details=[...clientLines,...globalLines].join(\"\\\\n\\\\n\")||\"• Écart global détecté : détail à confirmer dans TBR.\";\n    return `Bonjour,\\\\n\\\\nAprès contrôle de mon DCO de ${month}, TBR a identifié un montant total de ${money(dcoData.verseEnMoins||0)} versé en moins.\\\\n\\\\nVoici le détail des éléments à vérifier et à régulariser :\\\\n\\\\n${details}\\\\n\\\\nTotal demandé en régularisation : ${money(dcoData.verseEnMoins||0)}.\\\\n\\\\nLes éventuels montants versés en plus ont été isolés et ne sont pas inclus dans cette demande.\\\\n\\\\nMerci de vérifier ces éléments et de me confirmer la régularisation.\\\\n\\\\nBien cordialement,\\\\nTarek Bargaoui`;\n  };\n\n  const prepareDcoMail=async()=>{\n    const body=buildDcoClaimMail();\n    if(!body) return;\n    try{\n      await navigator.clipboard.writeText(body);\n      alert(\"Le mail de réclamation est prêt et copié. Tu peux le coller directement dans Outlook.\");\n    }catch(e){\n      window.prompt(\"Mail prêt à copier :\",body);\n    }\n  };\n","Point d’insertion audit");

  replaceExact(
    '<div className="v8-eyebrow">Contrôle paie</div>\n           <h2>Importe ton DCO, TBR détecte le mois et compare avec tes saisies.</h2>\n           <p>Le contrôle sépare les écarts fiables, les packs et les commissions vente à vérifier.</p>',
    '<div className="v8-eyebrow">Moteur d’audit DCO</div>\n           <h2>Importe ton PDF : TBR te dit immédiatement ce qui manque et pourquoi.</h2>\n           <p>Le numéro client est la clé principale. Les montants à réclamer sont séparés de ce qui a été versé en plus.</p>',
    "Présentation DCO"
  );

  replacePattern(
    /          <section className="dco-verdict">[\s\S]*?          <\/section>\n\n          <section className="dco-card dco-explain-panel">[\s\S]*?          <\/section>/,
    "          <section className=\"dco-card\" style={{border:(dcoData.verseEnMoins||0)>0?\"2px solid #dc2626\":\"2px solid #16a34a\",background:(dcoData.verseEnMoins||0)>0?\"linear-gradient(135deg,#fff1f2,#ffffff)\":\"linear-gradient(135deg,#f0fdf4,#ffffff)\"}}>\n            <div className=\"v8-eyebrow\">Résultat prioritaire</div>\n            <h2 style={{margin:\"8px 0\",fontSize:\"clamp(28px,6vw,48px)\",color:(dcoData.verseEnMoins||0)>0?\"#b91c1c\":\"#15803d\"}}>{(dcoData.verseEnMoins||0)>0?`🚨 Il te manque ${money(dcoData.verseEnMoins)}`:\"✅ Aucun montant manquant détecté\"}</h2>\n            <p style={{margin:\"0 0 14px\",fontWeight:800}}>{dcoClaimCases.length+dcoGlobalClaims.length} élément(s) à réclamer · {dcoData.couverture}% des numéros clients DCO retrouvés dans TBR.</p>\n            {(dcoData.verseEnMoins||0)>0&&<button className=\"dco-upload-btn\" onClick={prepareDcoMail}>Préparer le mail de réclamation</button>}\n          </section>\n\n          {(dcoClaimCases.length>0||dcoGlobalClaims.length>0)&&(\n            <section className=\"dco-card dco-alerts-panel\" style={{border:\"2px solid #ef4444\"}}>\n              <div className=\"dco-title\">🔴 À réclamer maintenant</div>\n              <div className=\"dco-sub\">Chaque dossier est identifié d’abord par son numéro client. Les montants versés en plus ne compensent jamais les sommes manquantes.</div>\n              <div className=\"dco-alerts-list\">\n                {dcoClaimCases.map((a,i)=><div className=\"dco-alert-item client neg\" key={\"claim\"+a.num}>\n                  <div className=\"dco-alert-num\">{i+1}</div>\n                  <div className=\"dco-alert-body\"><strong>{a.nom||\"Client\"}</strong><span>N° {a.num} · {a.catpub||\"—\"}</span><em>{a.title||\"Montant versé en moins\"}</em>{(a.lines||[]).filter(l=>Number(l.ecart)<-0.99).length>0&&<ul>{(a.lines||[]).filter(l=>Number(l.ecart)<-0.99).map((l,j)=><li key={j}>{l.label} : attendu {money(l.tbr)} · versé {money(l.dco)} · manque {money(Math.abs(l.ecart))}</li>)}</ul>}</div>\n                  <b className=\"neg\">{money(a.verseEnMoins||Math.abs(a.ecart||0))}</b>\n                </div>)}\n                {dcoGlobalClaims.map((r,i)=><div className=\"dco-alert-item global neg\" key={\"global-claim\"+i}><div className=\"dco-alert-num\">{dcoClaimCases.length+i+1}</div><div className=\"dco-alert-body\"><strong>{r.label}</strong><span>Écart global</span><em>Attendu {money(r.tbr)} · versé {money(r.dco)}</em></div><b className=\"neg\">{money(Math.abs(r.ecart))}</b></div>)}\n              </div>\n            </section>\n          )}\n\n          {dcoReviewCases.length>0&&(\n            <section className=\"dco-card dco-warning\">\n              <div className=\"dco-title\">🟠 À vérifier sans réclamer automatiquement</div>\n              <div className=\"dco-sub\">Ces dossiers demandent une correction de fiche ou une vérification avant toute demande.</div>\n              {dcoReviewCases.map(a=><div className=\"dco-line\" key={\"review\"+a.num}><span><b>{a.nom||\"Client\"}</b><em>N° {a.num} · {a.title}</em></span><b>À vérifier</b></div>)}\n            </section>\n          )}\n\n          {(dcoOverpaidCases.length>0||dcoGlobalOverpaid.length>0)&&(\n            <details className=\"dco-card\" style={{border:\"1px solid #86efac\"}}>\n              <summary style={{cursor:\"pointer\",fontWeight:950,color:\"#15803d\"}}>🟢 Versé en plus : {money(dcoData.verseEnPlus||0)} — à ne pas réclamer</summary>\n              <div className=\"dco-sub\" style={{marginTop:10}}>Information uniquement. Ces sommes restent séparées des montants manquants.</div>\n              {dcoOverpaidCases.map(a=><div className=\"dco-line pos\" key={\"plus\"+a.num}><span>{a.nom||\"Client\"}<em>N° {a.num}</em></span><b>{money(a.verseEnPlus||0)}</b></div>)}\n              {dcoGlobalOverpaid.map((r,i)=><div className=\"dco-line pos\" key={\"global-plus\"+i}><span>{r.label}<em>Écart global</em></span><b>{money(r.ecart)}</b></div>)}\n            </details>\n          )}\n\n          <details className=\"dco-card\">\n            <summary style={{cursor:\"pointer\",fontWeight:950}}>Voir les totaux techniques DCO / TBR</summary>\n            <div className=\"dco-compare-grid\" style={{marginTop:14}}>\n              <div className=\"dco-compare-box\"><span>DCO reçu</span><strong>{money(dcoData.totalDCO)}</strong><small>{dcoData.vNettes} ventes nettes · {dcoData.vDirectes} VD</small></div>\n              <div className=\"dco-compare-box\"><span>TBR attendu</span><strong>{money((dcoData.tbrSummary||{}).total||0)}</strong><small>{(dcoData.tbrSummary||{}).vNettes||0} ventes nettes · {(dcoData.tbrSummary||{}).vDirectes||0} VD</small></div>\n              <div className=\"dco-compare-box bad\"><span>Versé en moins</span><strong>{money(dcoData.verseEnMoins||0)}</strong><small>À réclamer après vérification des dossiers rouges.</small></div>\n              <div className=\"dco-compare-box good\"><span>Versé en plus</span><strong>{money(dcoData.verseEnPlus||0)}</strong><small>À conserver séparément, sans compensation.</small></div>\n            </div>\n          </details>",
    "Verdict DCO"
  );

  replacePattern(
    /\n          \{getDcoAlerts\(dcoData\)\.length>0&&\([\s\S]*?\n          \)\}\n\n          <section className="dco-grid">/,
    '\n\n          <section className="dco-grid">',
    "Anciennes alertes"
  );

  replacePattern(
    /(          <section className="dco-grid">[\s\S]*?          <\/section>)(\n\n          \{dcoData\.nonRetrouves>0&&\()/,
    '          <details className="dco-card"><summary style={{cursor:"pointer",fontWeight:950}}>Voir la synthèse complète et les écarts globaux</summary>\n$1\n          </details>$2',
    "Synthèse technique"
  );

  replaceExact('<div className="dco-title">Contrôle client par client</div>','<div className="dco-title">Dossiers nécessitant ton attention</div>',"Titre clients");
  replaceExact('<div className="dco-sub">Chaque ligne DCO est comparée au numéro client saisi dans TBR.</div>','<div className="dco-sub">Les dossiers conformes sont masqués. La comparaison repose en priorité sur le numéro client.</div>',"Sous-titre clients");
  replaceExact('{[...dcoData.analyses].sort((a,b)=>analysisRank(a)-analysisRank(b)).map((a,i)=>(','{[...dcoData.analyses].filter(a=>a.statut!=="ok").sort((a,b)=>analysisRank(a)-analysisRank(b)).map((a,i)=>(',"Filtre clients");

  replacePattern(
    /              \)\}\n            <\/div>\n          <\/section>\n        <\/>\n      \)\}/,
    "              ))}\n            </div>\n            {dcoConformCases.length>0&&(\n              <details style={{marginTop:14}}>\n                <summary style={{cursor:\"pointer\",fontWeight:900,color:\"#15803d\"}}>Afficher les {dcoConformCases.length} dossiers conformes</summary>\n                <div className=\"dco-clients\" style={{marginTop:10}}>{dcoConformCases.map(a=><div className=\"dco-line pos\" key={\"ok\"+a.num}><span>{a.nom||\"Client\"}<em>N° {a.num} · correspondance par numéro client</em></span><b>Conforme</b></div>)}</div>\n              </details>\n            )}\n          </section>\n        </>\n      )}",
    "Dossiers conformes"
  );

  const required=[
    "matchKey:num",
    "const dcoClaimCases=",
    "Il te manque",
    "Préparer le mail de réclamation",
    "à ne pas réclamer",
    'filter(a=>a.statut!=="ok")'
  ];
  required.forEach(token=>{if(!html.includes(token))fail("Validation incomplète : "+token);});

  html=html.replace('</head>','<meta name="tbr-dco-audit" content="2026-07-25"></head>');
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
