from pathlib import Path
import re

path = Path("index.html")
text = path.read_text(encoding="utf-8")
original = text


def sub_once(pattern: str, replacement: str, label: str, flags=0):
    global text
    new_text, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f"Patch failed for {label}: expected 1 match, got {count}")
    text = new_text


def replace_once(old: str, new: str, label: str):
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"Patch failed for {label}: expected 1 exact match, got {count}")
    text = text.replace(old, new, 1)


# Version visible par le mécanisme de mise à jour de TBR.
replace_once(
    'const APP_VERSION = "8.30.0-openai-global";',
    'const APP_VERSION = "8.31.0-pdf-sale-import";',
    "app version",
)

# Champs du document qui peuvent réellement préremplir la fiche de vente.
sub_once(
    r"const TBR_PV_FIELDS = \[.*?\n\];",
    '''const TBR_PV_FIELDS = [
  ["nomClient","Nom du client"],["numClient","N° client"],["refDocument","Référence du document"],
  ["dateVente","Date de vente / installation"],["typeClient","Type de client"],["engagement","Engagement"],
  ["fi200start","FI200 Start"],["codePromo","Promotion abonnement"],["aboMensuelHT","Abonnement mensuel HT"],
  ["aboMaintenanceTTC","Maintenance TTC"],["aboTelesurveillanceTTC","Télésurveillance TTC"],
  ["codesAbo","Codes remise abonnement"],["packs","Packs / produits"],["statut","Statut"]
];''',
    "document fields",
    flags=re.S,
)

sub_once(
    r"function pvFmtValue\(k,v\)\{.*?\n\}\nfunction pvSame",
    '''function pvFmtValue(k,v){
  if(k==="packs") return (v||[]).map(p=>`${p.reference||"EXT"} ${p.nom||"Pack"} · ${pvMoney(p.prixCatalogueHT).toFixed(2)}€ · ${p.statutMat||"Normal"}`).join(" / ")||"Aucun";
  if(k==="codesAbo") return (v||[]).map(c=>c.code).join(", ")||"Aucun";
  if(k==="typeClient") return v==="PRO"?"Professionnel":"Résidentiel";
  if(k==="engagement") return `${v||0} mois`;
  if(k==="fi200start") return v?"Oui":"Non";
  if(k==="aboMensuelHT"||k==="aboMaintenanceTTC"||k==="aboTelesurveillanceTTC") return `${pvMoney(v).toFixed(2)} €`;
  return String(v??"")||"—";
}
function pvSame''',
    "value formatter",
    flags=re.S,
)

# Lecteur général : PV, contrat ou proposition. Le numéro client reste prioritaire et aucun rapprochement par nom n'est fait.
new_parser = r'''function parsePVText(raw){
  const text=pvNorm(raw), upper=text.toUpperCase();
  const out={confidence:{},warnings:[],rawText:raw};
  let m;

  if(/PROC[EÈ]S\s+VERBAL\s+D['’]?INSTALLATION|PV\s+D['’]?INSTALLATION/i.test(text)){
    out.documentType="PV_INSTALLATION";out.documentLabel="Procès-verbal d’installation";
  }else if(/\bCONTRAT\b/i.test(text)){
    out.documentType="CONTRAT";out.documentLabel="Contrat";
  }else if(/PROPOSITION\s+COMMERCIALE|DEVIS\s+COMMERCIAL/i.test(text)){
    out.documentType="PROPOSITION_COMMERCIALE";out.documentLabel="Proposition commerciale";
  }else{
    out.documentType="DOCUMENT_COMMERCIAL";out.documentLabel="Document commercial";
  }

  const pvSignals={
    verisure:/\bVERISURE\b/i.test(text),
    offer:/OFFRE\s+S[EÉ]CURIT[EÉ]\s+VERISURE|S[EÉ]CURIT[EÉ]\s+START/i.test(text),
    packs:/PACKS?\s+PROTECTION|PACK\s+(?:P[EÉ]RIM[EÉ]TRIQUE|VOLUM[EÉ]TRIQUE|S[EÉ]CURIT[EÉ]\s+INT[EÉ]GRALE)/i.test(text),
    pricing:/R[EÉ]CAPITULATIF\s+DES\s+PRIX|TOTAL\s+INSTALLATION|TOTAL\s+MAT[EÉ]RIEL/i.test(text)
  };

  m=upper.match(/(?:N[°Oº]?\s*CLIENT|NUM[EÉ]RO\s+CLIENT)\s*[:#-]?\s*(\d{6,9})/);
  if(!m) m=upper.match(/(?:CLIENT)\s*[:#-]?\s*(2\d{6})\b/);
  if(!m&&out.documentType==="PV_INSTALLATION") m=upper.match(/\b(2\d{6})\b/);
  if(m){out.numClient=m[1];out.confidence.numClient=.99;}

  m=upper.match(/(?:REF(?:[EÉ]RENCE)?\s+DOCUMENT|REF\s+DOCUMENT)\s*[:#-]?\s*([A-Z]\d{7,})/);
  if(m){out.refDocument=m[1];out.confidence.refDocument=.98;}

  const namePatterns=[
    /(?:Nom\s*Pr[eé]nom|Nom\s+du\s+client)\s*:\s*(?:Monsieur|Madame|M\.?|Mme\.?)?\s*([A-ZÀ-ÖØ-Ý][A-ZÀ-ÖØ-Ý' -]{2,70}?)(?=\s+(?:D[eé]nomination|Statut|Date|Adresse|SIRET|Engagement|TVA|Code)|$)/i,
    /(?:Donn[eé]es\s+de\s+facturation).{0,280}?(?:Nom\s*Pr[eé]nom)\s*:\s*(?:Monsieur|Madame|M\.?|Mme\.?)?\s*([A-ZÀ-ÖØ-Ý][A-ZÀ-ÖØ-Ý' -]{2,70}?)(?=\s+(?:D[eé]nomination|Statut|Date|Adresse|SIRET|TVA|Code)|$)/i
  ];
  for(const rx of namePatterns){m=text.match(rx);if(m)break;}
  if(m){out.nomClient=pvNorm(m[1]).replace(/\b(?:STATUT|DATE|ADRESSE|SIRET|TVA).*$/i,"").trim();out.confidence.nomClient=.94;}

  m=text.match(/(?:PROC[EÈ]S\s+VERBAL\s+D['’]?INSTALLATION|CONTRAT|PROPOSITION\s+COMMERCIALE)[\s:.-]*(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{4})/i)
    ||text.match(/Date\s+d['’]?(?:installation|offre|contrat)\s*[:\-]?\s*(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{4})/i)
    ||text.match(/\b(\d{1,2}[\/.\-]\d{1,2}[\/.\-]20\d{2})\b/);
  if(m){
    const iso=pvDateISO(m[1]);out.dateVente=iso;out.confidence.dateVente=.98;
    if(out.documentType==="PV_INSTALLATION"){out.dateInstallation=iso;out.confidence.dateInstallation=.98;}
  }

  m=upper.match(/ENGAGEMENT\s*(?:JURIDIQUE\s*)?[:\-]?\s*(\d{1,2})\s*MOIS/)||upper.match(/\b(12|24|36)\s*MOIS\b/);
  if(m){out.engagement=Number(m[1]);out.confidence.engagement=.96;}

  if(/S[EÉ]CURIT[EÉ]\s+START\s+PRO|\bMOP\d*[- ]?\d*\b|SIRET\s*\/\s*NUM[EÉ]RO\s+D['’]?IDENTIFICATION\s*:\s*\d{9,}/i.test(text)){
    out.typeClient="PRO";out.pvLocal="PRO";out.confidence.typeClient=.97;
  }else if(/\bLOCAL\s+MAISONS?\b|\bMAISONS?\b/i.test(text)){
    out.typeClient="RESI";out.pvLocal="MAISON";out.confidence.typeClient=.94;
  }else if(/APPARTEMENT/i.test(text)){
    out.typeClient="RESI";out.pvLocal="APPARTEMENT";out.confidence.typeClient=.94;
  }

  if(out.documentType==="PV_INSTALLATION"){
    out.statut="Installe";out.installation=true;out.confidence.statut=.99;
  }else if(out.documentType==="CONTRAT"){
    out.statut="Vendu";out.installation=false;out.confidence.statut=.92;
  }else{
    out.statut="En attente";out.installation=false;out.confidence.statut=.80;
  }

  if(/200\s*€?\s*HT\s+DE\s+REMISE\s+SUR\s+L['’]?INSTALLATION|399[,.]00\s*€?.{0,55}199[,.]00\s*€?/i.test(text)){
    out.fi200start=true;out.confidence.fi200start=.97;
  }

  if(/6\s*MOIS\s+D['’]?ABONNEMENT[^.]{0,100}-?\s*50\s*%|6\s*MOIS[^.]{0,70}50\s*%/i.test(text)){
    out.codePromo="6MO5POSTART";out.confidence.codePromo=.98;
  }else if(/3\s*MOIS\s+D['’]?ABONNEMENT[^.]{0,100}-?\s*50\s*%|3\s*MOIS[^.]{0,70}50\s*%/i.test(text)){
    out.codePromo="3MO5POSTART";out.confidence.codePromo=.98;
  }

  if(out.typeClient==="PRO"){
    m=text.match(/S[EÉ]CURIT[EÉ]\s+START\s+PRO\s*-?\s*\d+.{0,180}?\d+[,.]\d{2}\s*€?\s+\d+[,.]\d{2}\s*€?\s+(\d+[,.]\d{2})\s*€/i)
      ||text.match(/TOTAL\s+OFFRE\s+S[EÉ]CURIT[EÉ]\s+VERISURE\s+\d+[,.]\d{2}\s*€?\s+(\d+[,.]\d{2})\s*€/i);
    if(m){out.aboMensuelHT=pvMoney(m[1]);out.confidence.aboMensuelHT=.90;}
    else if(/ABONNEMENT\s+MENSUEL\s+HT/i.test(text)&&/\b65[,.]00\s*€/i.test(text)){out.aboMensuelHT=65;out.confidence.aboMensuelHT=.78;}
  }else{
    const vals=[...text.matchAll(/([0-9]+[,.][0-9]{2})\s*€?/g)].map(x=>pvMoney(x[1]));
    outer: for(let i=0;i<vals.length;i++) for(let j=i+1;j<Math.min(vals.length,i+10);j++) for(let k=j+1;k<Math.min(vals.length,j+6);k++){
      if(vals[i]>20&&vals[j]>2&&vals[j]<30&&Math.abs(vals[i]+vals[j]-vals[k])<.08){
        out.aboMaintenanceTTC=vals[i];out.aboTelesurveillanceTTC=vals[j];
        out.confidence.aboMaintenanceTTC=.78;out.confidence.aboTelesurveillanceTTC=.78;break outer;
      }
    }
  }

  const packs=[];
  const catalog=Object.values(CATEGORIES_PACKS).flat();
  for(const d of catalog){
    const ref=String(d.ref||"").toUpperCase();
    const headerRx=new RegExp(`PACK\\s+.{0,130}?(?:-|–|—)\\s*${ref}\\b`,"i");
    if(!headerRx.test(text)) continue;
    const remiseMatch=text.match(new RegExp(`REMISE\\s+DE\\s+(25|50|100)\\s*%[^.]{0,240}(?:\\b${ref}\\b|PACK\\s+.{0,110}?(?:-|–|—)\\s*${ref}\\b)`,"i"));
    let statut="Normal";
    if(remiseMatch&&remiseMatch[1]==="100") statut="Offert";
    else if(remiseMatch&&remiseMatch[1]==="50") statut="Remise -50%";
    else if(remiseMatch&&remiseMatch[1]==="25") statut="Remise -25%";
    else if(new RegExp(`${d.prix}[,.]00\\s*€?.{0,65}0[,.]00\\s*€?`,"i").test(text)) statut="Offert";
    else if(new RegExp(`${d.prix}[,.]00\\s*€?.{0,65}${(d.prix/2).toFixed(2).replace(".","[,.]")}\\s*€?`,"i").test(text)) statut="Remise -50%";
    packs.push({...newPack(d.ref,d.nom,d.prix),statutMat:statut,sourcePV:true});
  }
  if(packs.length){out.packs=packs;out.confidence.packs=.91;}

  const detectedAbo=CODES_ABO.filter(c=>new RegExp(`\\b${c.code}\\b`,"i").test(upper)).map(c=>({id:Date.now()+Math.random(),code:c.code,montant:c.montant}));
  if(detectedAbo.length){out.codesAbo=detectedAbo;out.confidence.codesAbo=.98;}

  const partnerPatterns=[
    ["BPCE",/\bBPCE\b|BANQUE\s+POPULAIRE|CAISSE\s+D['’]?EPARGNE/i],
    ["Leroy Merlin",/LEROY\s+MERLIN/i],["Generali",/\bGENERALI\b/i],["COVEA",/\bCOVEA\b|MAAF|MMA|GMF/i],
    ["MDP / Foncia",/\bFONCIA\b|MAISON\s+DES\s+PARTENAIRES/i],["CAFPI",/\bCAFPI\b/i],
    ["Total Énergie",/TOTAL\s+ENERG/i],["EDF Pro",/\bEDF\b/i]
  ];
  const partnerHit=partnerPatterns.find(([,rx])=>rx.test(text));
  if(partnerHit){out.partenaireDetecte=partnerHit[0];out.confidence.partenaire=.86;}

  if(!out.nomClient) out.warnings.push("Nom client à confirmer");
  if(!out.dateVente) out.warnings.push("Date du document à confirmer");
  if(out.documentType==="PV_INSTALLATION"&&!out.numClient) out.warnings.push("Numéro client introuvable sur le PV");
  if(out.documentType!=="PV_INSTALLATION"&&!out.numClient) out.warnings.push("Le numéro client n’est pas encore présent : il devra être complété avec le PV.");
  if(!out.packs?.length) out.warnings.push("Aucun pack reconnu automatiquement");

  const score=(out.numClient?4:0)+(out.refDocument?2:0)+(out.dateVente?2:0)+(out.nomClient?2:0)+(out.engagement?1:0)+(out.packs?.length?2:0)
    +(pvSignals.verisure?1:0)+(pvSignals.offer?2:0)+(pvSignals.packs?1:0)+(pvSignals.pricing?1:0);
  out.recognitionScore=score;
  out.documentRecognized=out.documentType==="PV_INSTALLATION"
    ? !!(out.numClient&&score>=7)
    : !!((out.refDocument||out.nomClient)&&pvSignals.verisure&&pvSignals.offer&&score>=6);
  return out;
}
function loadTesseract'''
sub_once(
    r"function parsePVText\(raw\)\{.*?\n\}\nfunction loadTesseract",
    new_parser,
    "general document parser",
    flags=re.S,
)

# Messages génériques et import PDF prioritaire.
for old, new, label in [
    ('if(!usable) throw new Error("Aucune capture exploitable. Ajoute des captures nettes et complètes du PV.");',
     'if(!usable) throw new Error("Aucun document exploitable. Importe le PDF complet ou des captures nettes.");', "no usable document"),
    ('if(!fs.length){setPvError("Ajoute au moins une capture du PV.");return;}',
     'if(!fs.length){setPvError("Importe au moins un PDF ou une capture.");return;}', "no selected document"),
    ('setPvProgress(`Contrôle de ${fs.length} capture(s)…`);',
     'setPvProgress(`Lecture de ${fs.length} document(s)…`);', "progress copy"),
]:
    replace_once(old, new, label)

# Un PDF complet est analysé automatiquement dès sa sélection. Les captures multiples restent possibles.
replace_once(
    '  };\n  const togglePVField=k=>setPvSelected(x=>({...x,[k]:!x[k]}));',
    '''  };
  useEffect(()=>{
    if(pvFiles.length===1&&!pvBusy&&!pvResult&&!pvError){
      const f=pvFiles[0];
      if(f&&(f.type==="application/pdf"||/\\.pdf$/i.test(f.name))){const t=setTimeout(()=>analyzePVFiles(),80);return()=>clearTimeout(t);}
    }
  },[pvFiles.length]);
  const togglePVField=k=>setPvSelected(x=>({...x,[k]:!x[k]}));''',
    "automatic PDF analysis",
)

# Le document ne modifie jamais directement une vente : il préremplit le formulaire, puis Tarek valide.
new_apply = r'''  const applyPV=()=>{
    if(!pvResult)return;
    const target=pvTarget;
    const base=normalizePartnerDraft({...newVente(),...(target||form)}),patch={};
    TBR_PV_FIELDS.forEach(([k])=>{if(pvSelected[k]&&pvResult[k]!==undefined)patch[k]=pvResult[k];});
    if(pvTypeVente) patch.typeVente=pvTypeVente;
    else if(!target) patch.typeVente="";
    if(pvTypeVente==="VF"&&pvPartnerChoice){
      patch.partenaire=pvPartnerChoice==="Oui";
      if(patch.partenaire){patch.partenaireNom=pvPartnerName||pvResult.partenaireDetecte||"BPCE";patch.partenaireCategorie=pvResult.pvLocal==="PRO"?"PRO":pvResult.pvLocal==="MAISON"?"MAISON":"APPARTEMENT";}
    }else if(pvTypeVente==="VD") patch.partenaire=false;
    patch.sourceDocument={type:pvResult.documentType||"DOCUMENT_COMMERCIAL",label:pvResult.documentLabel||"Document",files:pvResult.fileNames||[],importedAt:new Date().toISOString(),quality:pvResult.quality||[],refDocument:pvResult.refDocument||null};
    patch.documentVerified=true;
    if(pvResult.documentType==="PV_INSTALLATION") patch.pvVerified=true;
    if(pvResult.dateInstallation)patch.dateInstallation=pvResult.dateInstallation;
    if(pvResult.dateVente)patch.dateVente=pvResult.dateVente;
    const changedFields={};
    Object.keys(patch).forEach(k=>{if(!["sourceDocument"].includes(k)&&!pvSame(k,base[k],patch[k]))changedFields[k]={avant:base[k],apres:patch[k]};});
    const history=[...(base.pvHistory||[]),{date:new Date().toISOString(),source:pvResult.documentLabel||"Document commercial",files:pvResult.fileNames||[],changes:changedFields}];
    const merged=normalizePartnerDraft({...base,...patch,pvHistory:history});
    setForm(target?{...merged,id:target.id}:merged);
    setEditingId(target?target.id:null);
    setShowForm(true);
    setPvResult(null);setPvTarget(null);setPvSelected({});setPvTypeVente("");setPvPartnerChoice("");setPvPartnerName("BPCE");setPvFiles([]);setPvError("");
    setTimeout(()=>document.getElementById("tbr-sale-form-top")?.scrollIntoView({behavior:"smooth",block:"start"}),80);
  };
  const addChall'''
sub_once(
    r"  const applyPV=\(\)=>\{.*?\n  \};\n  const addChall",
    new_apply,
    "safe apply document",
    flags=re.S,
)

# VD/VF reste un choix humain obligatoire avant l'enregistrement final.
new_submit = r'''  const submit=()=>{
    const clean=normalizePartnerDraft(form);
    if(!clean.typeVente){alert("Choisis VD ou VF avant d’enregistrer la vente.");return;}
    const wasDcoEdit=!!(editRequest&&editingId===editRequest.id);
    if(editingId){setVentes(ventes.map(x=>x.id===editingId?{...clean,id:editingId}:x));setEditingId(null);}
    else setVentes([...ventes,{...clean,id:Date.now()}]);
    setForm(newVente());setShowForm(false);setEditPackId(null);
    if(wasDcoEdit&&onEditDone) setTimeout(onEditDone,60);
  };

  const kitHT'''
sub_once(
    r"  const submit=\(\)=>\{.*?\n  \};\n\n  const kitHT",
    new_submit,
    "VD VF validation",
    flags=re.S,
)

# Interface claire : PDF complet en premier, captures seulement en secours.
replacements = [
    ('aria-label="Sélectionner plusieurs captures du PV"', 'aria-label="Importer un PDF, un contrat, une proposition ou des captures"'),
    ('🖼️ {pvFiles.length?"Ajouter d’autres captures":"Ajouter captures du PV"}', '📄 {pvFiles.length?"Ajouter un document":"Importer un PDF"}'),
    ('Ajoute 4, 5, 6 captures ou plus, même en plusieurs sélections et dans n’importe quel ordre. TBR les regroupe comme un seul PV, ignore une capture inexploitable si les autres suffisent, puis retrouve la fiche par le numéro client.',
     'Importe de préférence le PDF complet du PV, du contrat ou de la proposition commerciale. TBR lit le document, préremplit la fiche de vente et ne l’enregistre qu’après ta validation. Les captures restent possibles en secours.'),
    ('{pvFiles.length} capture(s) prête(s)', '{pvFiles.length} document(s) prêt(s)'),
    ('{pvBusy?"Analyse en cours…":`Analyser les ${pvFiles.length} capture(s)`}', '{pvBusy?"Analyse en cours…":`Analyser ${pvFiles.length>1?"les documents":"le document"}`}'),
    ('Document refusé : {pvError}', 'Lecture impossible : {pvError}'),
    ('<Card title="Contrôle du PV avant mise à jour">', '<Card title="Vérification avant préremplissage">'),
    ('`Fiche existante retrouvée : ${pvTarget.nomClient||pvResult.nomClient}`:"Nouvelle vente détectée"', '`Fiche existante retrouvée par numéro client : ${pvTarget.nomClient||pvResult.nomClient}`:"Nouvelle fiche à préremplir"'),
    ('N° client {pvResult.numClient||"—"} · le PV est prioritaire uniquement pour les champs cochés ci-dessous.', 'N° client {pvResult.numClient||"à compléter avec le PV"} · {pvResult.documentLabel||"Document"} · seuls les champs cochés seront préremplis.'),
    ('<small style={{color:"#94a3b8",fontWeight:900}}>PV</small>', '<small style={{color:"#94a3b8",fontWeight:900}}>DOCUMENT</small>'),
    ('Le PV confirme l’installation, mais TBR ne devine jamais VD/VF ni le partenaire.', 'VD ou VF reste ton choix. Tu peux le sélectionner ici ou directement dans la fiche préremplie.'),
    ('Valider et appliquer le PV', 'Préremplir la fiche'),
]
for old, new in replacements:
    if old not in text:
        raise SystemExit(f"Patch failed for UI copy: missing {old[:70]}")
    text = text.replace(old, new, 1)

# Le libellé d'erreur de reconnaissance ne doit plus parler seulement de captures/PV.
text = text.replace(
    'throw new Error(`Captures analysées, mais le numéro client ou les éléments essentiels n’ont pas été reconnus (score ${r.recognitionScore||0}). Aucune donnée n’a été modifiée. Essaie des captures avec le zoom du document légèrement augmenté.`);',
    'throw new Error(`Document lu, mais les éléments essentiels n’ont pas été reconnus (score ${r.recognitionScore||0}). Aucune donnée n’a été modifiée. Importe le PDF complet ou des pages plus nettes.`);',
    1,
)

if text == original:
    raise SystemExit("No changes produced")

# Garde-fous simples avant écriture.
required = [
    'const APP_VERSION = "8.31.0-pdf-sale-import";',
    'out.fi200start=true',
    'out.codePromo="6MO5POSTART"',
    'patch.typeVente=""',
    'Choisis VD ou VF avant d’enregistrer la vente.',
    'Importer un PDF',
    'Préremplir la fiche',
]
for token in required:
    if token not in text:
        raise SystemExit(f"Validation failed: missing {token}")

path.write_text(text, encoding="utf-8")
print("PDF sale import patch applied successfully")
