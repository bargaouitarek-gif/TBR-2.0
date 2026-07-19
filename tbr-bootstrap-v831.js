const APP_VERSION = "8.31.0-pdf-sale-import";
(async()=>{
  const BASE="./app-base-v830.html";
  const CACHE="tbr-bootstrap-v831";
  let html="";
  try{
    const res=await fetch(BASE+"?v=831",{cache:"no-store"});
    if(!res.ok) throw new Error("Base TBR indisponible");
    html=await res.text();
    if("caches" in window){const c=await caches.open(CACHE);await c.put(BASE,new Response(html,{headers:{"Content-Type":"text/html;charset=utf-8"}}));}
  }catch(e){
    if("caches" in window){const c=await caches.open(CACHE);const r=await c.match(BASE);if(r)html=await r.text();}
    if(!html) throw e;
  }

  const must=(oldValue,newValue,label)=>{
    if(!html.includes(oldValue)) throw new Error("Mise à jour incomplète : "+label);
    html=html.replace(oldValue,newValue);
  };

  html=html.split("2.1-ai-memory-20260719").join("2.2-pdf-sale-20260719");
  must('const APP_VERSION = "8.30.0-openai-global";','const APP_VERSION = "8.31.0-pdf-sale-import";',"version");

  must(`const TBR_PV_FIELDS = [
  ["nomClient","Nom du client"],["numClient","N° client"],["dateInstallation","Date d’installation"],
  ["typeClient","Type de client"],["engagement","Engagement"],["statut","Statut"],
  ["codePromo","Promotion abonnement"],["aboMaintenanceTTC","Maintenance TTC"],
  ["aboTelesurveillanceTTC","Télésurveillance TTC"],["packs","Packs / produits"]
];`,`const TBR_PV_FIELDS = [
  ["nomClient","Nom du client"],["numClient","N° client"],["refDocument","Référence du document"],
  ["dateVente","Date de vente / installation"],["typeClient","Type de client"],["engagement","Engagement"],
  ["fi200start","FI200 Start"],["codePromo","Promotion abonnement"],["aboMensuelHT","Abonnement mensuel HT"],
  ["aboMaintenanceTTC","Maintenance TTC"],["aboTelesurveillanceTTC","Télésurveillance TTC"],
  ["codesAbo","Codes remise abonnement"],["packs","Packs / produits"],["statut","Statut"]
];`,"champs de saisie");

  must(`function pvFmtValue(k,v){
  if(k==="packs") return (v||[]).map(p=>\`${'${p.reference||"EXT"}'} ${'${p.nom||"Pack"}'} · ${'${pvMoney(p.prixCatalogueHT).toFixed(2)}'}€ · ${'${p.statutMat||"Normal"}'}\`).join(" / ")||"Aucun";
  if(k==="typeClient") return v==="PRO"?"Professionnel":"Résidentiel";
  if(k==="engagement") return \`${'${v||0}'} mois\`;
  if(k==="aboMaintenanceTTC"||k==="aboTelesurveillanceTTC") return \`${'${pvMoney(v).toFixed(2)}'} €\`;
  return String(v??"")||"—";
}`,`function pvFmtValue(k,v){
  if(k==="packs") return (v||[]).map(p=>\`${'${p.reference||"EXT"}'} ${'${p.nom||"Pack"}'} · ${'${pvMoney(p.prixCatalogueHT).toFixed(2)}'}€ · ${'${p.statutMat||"Normal"}'}\`).join(" / ")||"Aucun";
  if(k==="codesAbo") return (v||[]).map(c=>c.code).join(", ")||"Aucun";
  if(k==="typeClient") return v==="PRO"?"Professionnel":"Résidentiel";
  if(k==="engagement") return \`${'${v||0}'} mois\`;
  if(k==="fi200start") return v?"Oui":"Non";
  if(k==="aboMensuelHT"||k==="aboMaintenanceTTC"||k==="aboTelesurveillanceTTC") return \`${'${pvMoney(v).toFixed(2)}'} €\`;
  return String(v??"")||"—";
}`,"affichage des champs");

  must(`function pvSame(k,a,b){
  if(k==="packs") return JSON.stringify((a||[]).map(pvPackKey).sort())===JSON.stringify((b||[]).map(pvPackKey).sort());`, `function pvSame(k,a,b){
  if(k==="packs") return JSON.stringify((a||[]).map(pvPackKey).sort())===JSON.stringify((b||[]).map(pvPackKey).sort());
  if(k==="codesAbo") return JSON.stringify((a||[]).map(x=>x.code).sort())===JSON.stringify((b||[]).map(x=>x.code).sort());`,"comparaison des codes");

  must(`  const out={confidence:{},warnings:[],rawText:raw};
  let m;
  const pvSignals={` , `  const out={confidence:{},warnings:[],rawText:raw};
  let m;
  if(/PROC[EÈ]S\\s+VERBAL\\s+D['’]?INSTALLATION|PV\\s+D['’]?INSTALLATION/i.test(text)){out.documentType="PV_INSTALLATION";out.documentLabel="Procès-verbal d’installation";}
  else if(/\\bCONTRAT\\b/i.test(text)){out.documentType="CONTRAT";out.documentLabel="Contrat";}
  else if(/PROPOSITION\\s+COMMERCIALE/i.test(text)){out.documentType="PROPOSITION_COMMERCIALE";out.documentLabel="Proposition commerciale";}
  else {out.documentType="DOCUMENT_COMMERCIAL";out.documentLabel="Document commercial";}
  const pvSignals={` ,"type de document");

  must(`  if(m){out.numClient=m[1];out.confidence.numClient=.99;} else out.warnings.push("Numéro client introuvable");

  // Nom`, `  if(m){out.numClient=m[1];out.confidence.numClient=.99;}
  m=upper.match(/(?:REF(?:[EÉ]RENCE)?\\s+DOCUMENT|REF\\s+DOCUMENT)\\s*[:#-]?\\s*([A-Z]\\d{7,})/);
  if(m){out.refDocument=m[1];out.confidence.refDocument=.98;}

  // Nom`,"référence document");

  must(`  m=text.match(/PROC[EÈ]S\\s+VERBAL\\s+D['’]?INSTALLATION[\\s:.-]*(\\d{1,2}[\\/.\\-]\\d{1,2}[\\/.\\-]\\d{4})/i)
    ||text.match(/Date\\s+d['’]?installation\\s*[:\\-]?\\s*(\\d{1,2}[\\/.\\-]\\d{1,2}[\\/.\\-]\\d{4})/i)
    ||text.match(/\\b(\\d{1,2}[\\/.\\-]\\d{1,2}[\\/.\\-]20\\d{2})\\b/);
  if(m){out.dateInstallation=pvDateISO(m[1]);out.confidence.dateInstallation=.98;}`, `  m=text.match(/(?:PROC[EÈ]S\\s+VERBAL\\s+D['’]?INSTALLATION|CONTRAT|PROPOSITION\\s+COMMERCIALE)[\\s:.-]*(\\d{1,2}[\\/.\\-]\\d{1,2}[\\/.\\-]\\d{4})/i)
    ||text.match(/Date\\s+d['’]?(?:installation|contrat|offre)\\s*[:\\-]?\\s*(\\d{1,2}[\\/.\\-]\\d{1,2}[\\/.\\-]\\d{4})/i)
    ||text.match(/\\b(\\d{1,2}[\\/.\\-]\\d{1,2}[\\/.\\-]20\\d{2})\\b/);
  if(m){const iso=pvDateISO(m[1]);out.dateVente=iso;out.confidence.dateVente=.98;if(out.documentType==="PV_INSTALLATION"){out.dateInstallation=iso;out.confidence.dateInstallation=.98;}}`,"date du document");

  must(`  out.statut="Installe"; out.installation=true; out.confidence.statut=.99;
  if(/6\\s*MOIS`, `  if(out.documentType==="PV_INSTALLATION"){out.statut="Installe";out.installation=true;out.confidence.statut=.99;}
  else if(out.documentType==="CONTRAT"){out.statut="Vendu";out.installation=false;out.confidence.statut=.92;}
  else {out.statut="En attente";out.installation=false;out.confidence.statut=.80;}
  if(/6\\s*MOIS`,"statut document");

  must(`  else if(/3\\s*MOIS\\s+D['’]?ABONNEMENT[^.]{0,80}-?\\s*50\\s*%|3\\s*MOIS[^.]{0,60}50\\s*%/i.test(text)){out.codePromo="3MO5POSTART";out.confidence.codePromo=.97;}

  // Récapitulatif abonnement`, `  else if(/3\\s*MOIS\\s+D['’]?ABONNEMENT[^.]{0,80}-?\\s*50\\s*%|3\\s*MOIS[^.]{0,60}50\\s*%/i.test(text)){out.codePromo="3MO5POSTART";out.confidence.codePromo=.97;}
  if(/200\\s*€?\\s*HT\\s+DE\\s+REMISE\\s+SUR\\s+L['’]?INSTALLATION|399[,.]00\\s*€?.{0,55}199[,.]00\\s*€?/i.test(text)){out.fi200start=true;out.confidence.fi200start=.97;}
  if(out.typeClient==="PRO"&&/ABONNEMENT\\s+MENSUEL\\s+HT/i.test(text)){const am=text.match(/TOTAL\\s+OFFRE\\s+S[EÉ]CURIT[EÉ]\\s+VERISURE\\s+\\d+[,.]\\d{2}\\s*€?\\s+(\\d+[,.]\\d{2})\\s*€/i);if(am){out.aboMensuelHT=pvMoney(am[1]);out.confidence.aboMensuelHT=.88;}else if(/\\b65[,.]00\\s*€/i.test(text)){out.aboMensuelHT=65;out.confidence.aboMensuelHT=.76;}}
  const aboCodes=CODES_ABO.filter(c=>new RegExp(\`\\\\b${'${c.code}'}\\\\b\`,"i").test(upper)).map(c=>({id:Date.now()+Math.random(),code:c.code,montant:c.montant}));
  if(aboCodes.length){out.codesAbo=aboCodes;out.confidence.codesAbo=.98;}

  // Récapitulatif abonnement`,"remises et codes");

  must(`    {ref:"P3",nom:"P3 — PÉRIMÉTRIQUE",prix:149,rx:/PACK\\s+P[EÉ]RIM[EÉ]TRIQUE\\s*-?\\s*P3|\\bP3\\b[^\\n]{0,60}D[EÉ]TECTEUR\\s+DE\\s+CHOC/i},
    {ref:"V3",nom:"V3 — VOLUMÉTRIQUE",prix:199,rx:/PACK\\s+VOLUM[EÉ]TRIQUE\\s*-?\\s*V3|\\bV3\\b[^\\n]{0,60}MOUVEMENT/i}
  ];`, `    {ref:"P3",nom:"P3 — PÉRIMÉTRIQUE",prix:149,rx:/PACK\\s+P[EÉ]RIM[EÉ]TRIQUE\\s*-?\\s*P3|\\bP3\\b[^\\n]{0,60}D[EÉ]TECTEUR\\s+DE\\s+CHOC/i},
    {ref:"P4",nom:"P4 — 1 CONTACT",prix:59,rx:/PACK\\s+P[EÉ]RIM[EÉ]TRIQUE\\s*-?\\s*P4|\\bP4\\b[^\\n]{0,60}D[EÉ]TECTEUR\\s+DE\\s+CHOC/i},
    {ref:"V1",nom:"V1 — VOLUMÉTRIQUE",prix:299,rx:/PACK\\s+VOLUM[EÉ]TRIQUE\\s*-?\\s*V1|\\bV1\\b[^\\n]{0,60}MOUVEMENT/i},
    {ref:"V2",nom:"V2 — VOLUMÉTRIQUE",prix:299,rx:/PACK\\s+VOLUM[EÉ]TRIQUE\\s*-?\\s*V2|\\bV2\\b[^\\n]{0,60}MOUVEMENT/i},
    {ref:"V3",nom:"V3 — VOLUMÉTRIQUE",prix:199,rx:/PACK\\s+VOLUM[EÉ]TRIQUE\\s*-?\\s*V3|\\bV3\\b[^\\n]{0,60}MOUVEMENT/i},
    {ref:"V4",nom:"V4 — VOLUMÉTRIQUE",prix:119,rx:/PACK\\s+VOLUM[EÉ]TRIQUE\\s*-?\\s*V4|\\bV4\\b[^\\n]{0,60}MOUVEMENT/i}
  ];`,"catalogue packs");

  must(`  if(!out.nomClient) out.warnings.push("Nom client à confirmer");
  if(!out.dateInstallation) out.warnings.push("Date d’installation introuvable");
  if(!out.packs?.length) out.warnings.push("Aucun pack reconnu automatiquement");`, `  if(!out.nomClient) out.warnings.push("Nom client à confirmer");
  if(!out.dateVente) out.warnings.push("Date du document à confirmer");
  if(out.documentType==="PV_INSTALLATION"&&!out.numClient) out.warnings.push("Numéro client introuvable sur le PV");
  if(out.documentType!=="PV_INSTALLATION"&&!out.numClient) out.warnings.push("Numéro client à compléter avec le PV final");
  if(!out.packs?.length) out.warnings.push("Aucun pack reconnu automatiquement");`,"avertissements");

  must(`  out.documentRecognized=!!(out.numClient && score>=7);`, `  out.documentRecognized=out.documentType==="PV_INSTALLATION"?!!(out.numClient&&score>=7):!!((out.refDocument||out.nomClient)&&pvSignals.verisure&&pvSignals.offer&&score>=6);`,"reconnaissance générale");

  must(`    if(!fs.length){setPvError("Ajoute au moins une capture du PV.");return;}`, `    if(!fs.length){setPvError("Importe au moins un PDF ou une capture.");return;}`,"sélection document");
  must(`    setPvBusy(true);setPvError("");setPvResult(null);setPvProgress(\`Contrôle de ${'${fs.length}'} capture(s)…\`);`, `    setPvBusy(true);setPvError("");setPvResult(null);setPvProgress(\`Lecture de ${'${fs.length}'} document(s)…\`);`,"progression");
  must(`  };
  const togglePVField=k=>setPvSelected(x=>({...x,[k]:!x[k]}));`, `  };
  useEffect(()=>{if(pvFiles.length===1&&!pvBusy&&!pvResult&&!pvError){const f=pvFiles[0];if(f&&(f.type==="application/pdf"||/\\.pdf$/i.test(f.name))){const t=setTimeout(()=>analyzePVFiles(),80);return()=>clearTimeout(t);}}},[pvFiles.length]);
  const togglePVField=k=>setPvSelected(x=>({...x,[k]:!x[k]}));`,"analyse automatique PDF");

  must(`    patch.sourceDocument={type:"PV_INSTALLATION",files:pvResult.fileNames||[],importedAt:new Date().toISOString(),quality:pvResult.quality||[]};
    patch.pvVerified=true;patch.statut="Installe";patch.installation=true;
    if(pvResult.dateInstallation)patch.dateInstallation=pvResult.dateInstallation;`, `    patch.sourceDocument={type:pvResult.documentType||"DOCUMENT_COMMERCIAL",label:pvResult.documentLabel||"Document",files:pvResult.fileNames||[],importedAt:new Date().toISOString(),quality:pvResult.quality||[],refDocument:pvResult.refDocument||null};
    patch.pvVerified=pvResult.documentType==="PV_INSTALLATION";patch.statut=pvResult.statut||base.statut;patch.installation=!!pvResult.installation;
    if(pvResult.dateInstallation)patch.dateInstallation=pvResult.dateInstallation;
    if(pvResult.dateVente)patch.dateVente=pvResult.dateVente;`,"application document");
  must(`    if(target){setVentes(ventes.map(v=>v.id===target.id?{...merged,id:target.id}:v));setForm({...merged,id:target.id});setEditingId(target.id);}
    else {setForm(merged);setEditingId(null);setShowForm(true);}`, `    if(target){setForm({...merged,id:target.id});setEditingId(target.id);setShowForm(true);}
    else {setForm(merged);setEditingId(null);setShowForm(true);}`,"validation avant sauvegarde");

  must(`aria-label="Sélectionner plusieurs captures du PV"`,`aria-label="Importer un PDF, un contrat, une proposition ou des captures"`,"libellé import");
  must(`🖼️ ${'${pvFiles.length?"Ajouter d’autres captures":"Ajouter captures du PV"}'}`,`📄 ${'${pvFiles.length?"Ajouter un document":"Importer un PDF"}'}`,"bouton import");
  must(`Ajoute 4, 5, 6 captures ou plus, même en plusieurs sélections et dans n’importe quel ordre. TBR les regroupe comme un seul PV, ignore une capture inexploitable si les autres suffisent, puis retrouve la fiche par le numéro client.`,`Importe de préférence le PDF complet du PV, du contrat ou de la proposition commerciale. TBR lit le document et préremplit la fiche. Rien n’est enregistré avant ta validation finale. Les captures restent possibles en secours.`,"aide import");
  html=html.replace(`capture(s) prête(s)`,`document(s) prêt(s)`);
  html=html.replace(`Contrôle du PV avant mise à jour`,`Vérification avant préremplissage`);
  html=html.replace(`Valider et appliquer le PV`,`Préremplir la fiche`);
  html=html.replace(`Le PV confirme l’installation, mais TBR ne devine jamais VD/VF ni le partenaire.`,`VD ou VF reste ton choix. Sélectionne-le avant de préremplir la fiche.`);
  html=html.replace(`Document refusé : ${'${pvError}'}`,`Lecture impossible : ${'${pvError}'}`);

  document.open();document.write(html);document.close();
})().catch(err=>{
  console.error(err);
  const el=document.getElementById("boot-msg");
  if(el){el.className="msg err";el.textContent="TBR n’a pas pu charger la mise à jour. Recharge la page. Tes ventes n’ont pas été modifiées.";}
});