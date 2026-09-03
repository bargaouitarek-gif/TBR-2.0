from pathlib import Path
import re, json

def one(s,old,new,label):
    n=s.count(old)
    if n!=1: raise SystemExit(f'{label}: expected 1, got {n}')
    return s.replace(old,new,1)

# Engine 1.4.0: recompute deltas, preserve negative paid values, gate global claims.
p=Path('tbr-dco-engine.js'); s=p.read_text()
s=one(s,'/* TBR 2.0 — DCO canonical engine 1.3.0 */','/* TBR 2.0 — DCO canonical engine 1.4.0 */','engine banner')
s=one(s,"const VERSION='1.3.0';","const VERSION='1.4.0';",'engine version')
s=one(s,"""  const expected=blankAmounts();
  const paid=blankAmounts();
  const analysis=""","""  const expected=blankAmounts();
  const paid=blankAmounts();
  const seenAmounts={sale:false,packs:false,installation:false};
  const analysis=""",'matched seen state')
s=one(s,"""    paid[key]=Math.max(paid[key],R(dco));
    expected[key]=Math.max(expected[key],R(tbr));
""","""    const nextPaid=R(dco),nextExpected=R(tbr);
    if(!seenAmounts[key]||Math.abs(nextExpected-nextPaid)>Math.abs(expected[key]-paid[key])){
      paid[key]=nextPaid;
      expected[key]=nextExpected;
      seenAmounts[key]=true;
    }
""",'preserve negative paid')
s=one(s,"""      const e=R(l?.ecart);
      if(!(e<-.99))return;
      const nature=natureFor(l?.label);
      if(nature==='Installation'&&!ownsInstallation(salesByNum,a?.num))return;
      const paid=R(l?.dco), expected=R(l?.tbr);
      add({
        scope:'client',num:a?.num,name:S(a?.nom)||'Client',type:S(a?.catpub),
        nature,paid,expected,amount:Math.abs(e),
""","""      const nature=natureFor(l?.label);
      if(nature==='Installation'&&!ownsInstallation(salesByNum,a?.num))return;
      const paid=R(l?.dco), expected=R(l?.tbr);
      const amount=R(Math.max(0,expected-paid));
      if(!(amount>.99))return;
      add({
        scope:'client',num:a?.num,name:S(a?.nom)||'Client',type:S(a?.catpub),
        nature,paid,expected,amount,
""",'recompute client shortage')
s=one(s,"""    const e=R(x?.ecart);
    if(!(e<-.99))return;
    const num=normNum(x?.num);
    if(!ownsInstallation(salesByNum,num))return;
    const paid=R(x?.dco), expected=R(x?.tbr);
    add({
      scope:'client',num,name:S(x?.nom)||'Client',type:S(x?.catpub),
      nature:'Installation',paid,expected,amount:Math.abs(e),
""","""    const num=normNum(x?.num);
    if(!ownsInstallation(salesByNum,num))return;
    const paid=R(x?.dco), expected=R(x?.tbr);
    const amount=R(Math.max(0,expected-paid));
    if(!(amount>.99))return;
    add({
      scope:'client',num,name:S(x?.nom)||'Client',type:S(x?.catpub),
      nature:'Installation',paid,expected,amount,
""",'recompute installation shortage')
s=one(s,"""  (d.globalRows||[]).forEach(r=>{
    const e=R(r?.ecart);
    if(!r?.money||!(e<-.99)||isAggregateDuplicate(r?.label))return;
    const label=S(r?.label)||'Écart global';
    const paid=R(r?.dco), expected=R(r?.tbr);
    add({
      scope:'global',num:'',name:'',type:'',nature:label,paid,expected,amount:Math.abs(e),
""","""  (d.globalRows||[]).forEach(r=>{
    if(!r?.money||r?.claimable===false||isAggregateDuplicate(r?.label))return;
    const label=S(r?.label)||'Écart global';
    const paid=R(r?.dco), expected=R(r?.tbr);
    const amount=R(Math.max(0,expected-paid));
    if(!(amount>.99))return;
    add({
      scope:'global',num:'',name:'',type:'',nature:label,paid,expected,amount,
""",'gate global shortage')
s=one(s,"""  (src?.data?.globalRows||[]).forEach(r=>{
    const e=R(r?.ecart);
    if(!r?.money||!(e>.99)||isAggregateDuplicate(r?.label))return;
    const label=S(r?.label)||'Écart global';
    add({
      scope:'global',num:'',name:'',type:'',nature:label,
      paid:R(r?.dco),expected:R(r?.tbr),amount:e,
""","""  (src?.data?.globalRows||[]).forEach(r=>{
    if(!r?.money||r?.claimable===false||isAggregateDuplicate(r?.label))return;
    const label=S(r?.label)||'Écart global';
    const paid=R(r?.dco),expected=R(r?.tbr),amount=R(Math.max(0,paid-expected));
    if(!(amount>.99))return;
    add({
      scope:'global',num:'',name:'',type:'',nature:label,
      paid,expected,amount,
""",'gate global overpaid')
s=one(s,"""  const uniqueClientStatus=new Set(clients.map(c=>c.num)).size===clients.length;

  return{
""","""  const uniqueClientStatus=new Set(clients.map(c=>c.num)).size===clients.length;
  const sourceIntegrity=src?.data?.dcoIntegrity||src?.cache?.raw?.integrity||null;
  const claimSafe=!!(sourceIntegrity&&sourceIntegrity.claimSafe===true);
  const unverifiedGlobal=(src?.data?.globalRows||[]).filter(r=>r?.money&&r?.claimable===false).map(r=>({label:S(r.label),paid:R(r.dco),expected:R(r.tbr)}));

  return{
""",'source integrity')
s=one(s,"""    overpaidLedger,
    palierImpact,
    totals:{confirmed,missingPotential,overpaid},
""","""    overpaidLedger,
    palierImpact,
    sourceIntegrity,
    claimSafe,
    unverifiedGlobal,
    totals:{confirmed,missingPotential,overpaid},
""",'engine return safety')
s=one(s,"""      overpaidEqualsLedger:Math.abs(overpaid-R(overpaidLedger.reduce((sum,x)=>sum+R(x.amount),0)))<0.01
""","""      overpaidEqualsLedger:Math.abs(overpaid-R(overpaidLedger.reduce((sum,x)=>sum+R(x.amount),0)))<0.01,
      sourceIntegritySafe:claimSafe
""",'engine safety invariant')
p.write_text(s)

# Claim runtime 2.4.0: keep signs and block unsafe source PDFs.
p=Path('tbr-dco-claim-mail.js'); s=p.read_text()
s=one(s,'/* TBR 2.0 — DCO canonical mail runtime 2.3.0 */','/* TBR 2.0 — DCO canonical mail runtime 2.4.0 */','claim banner')
s=one(s,"const VERSION='2.3.0';","const VERSION='2.4.0';",'claim version')
s=one(s,"const ENGINE_VERSION='1.3.0';","const ENGINE_VERSION='1.4.0';",'claim engine')
s=one(s,"const M=v=>`${Math.abs(R(v)).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})} €`;","const M=v=>`${R(v).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})} €`;",'signed money')
s=one(s,"""  const label=monthText(month);
  const ledger=result.ledger||[];
""","""  const label=monthText(month);
  if(!result.claimSafe){
    const failed=result.sourceIntegrity?.failed||[];
    const body=['Bonjour,','',`Le contrôle automatique du DCO de ${label} a détecté une incohérence dans le document ou dans sa lecture.`,`Par sécurité, TBR ne génère aucune réclamation chiffrée tant que ce contrôle n’est pas conforme.`,''];
    failed.forEach(c=>body.push(`- ${c.name} : détail ${M(c.actual)} · synthèse ${M(c.expected)}`));
    if(!result.sourceIntegrity)body.push('- Ancien DCO en cache : réimporte le PDF pour appliquer le nouveau contrôle multi-format.');
    body.push('','Aucun montant de réclamation n’a été calculé automatiquement.');
    return{subject:`Contrôle DCO ${label} — incohérence détectée`,body:body.join('\\n'),total:0,ledger:[],result,integrity:{month,missing:[],removed:[]},palierImpact:[],checkOk:false,blocked:true};
  }
  const ledger=result.ledger||[];
""",'blocked claim')
s=one(s,"""    checkOk:!!(result.invariants?.confirmedEqualsLedger&&result.invariants?.missingStatusExclusive&&result.invariants?.uniqueClientStatus&&result.invariants?.noComponentNetting&&result.invariants?.noCrossNetting&&result.invariants?.overpaidEqualsLedger)
""","""    checkOk:!!(result.claimSafe&&result.invariants?.confirmedEqualsLedger&&result.invariants?.missingStatusExclusive&&result.invariants?.uniqueClientStatus&&result.invariants?.noComponentNetting&&result.invariants?.noCrossNetting&&result.invariants?.overpaidEqualsLedger&&result.invariants?.sourceIntegritySafe)
""",'claim check')
p.write_text(s)

# index: load parser, use structural detection, carry integrity into canonical engine, gate paliers on reconciled volumes.
p=Path('index.html'); s=p.read_text()
s=one(s,'<script id="tbr-dco-engine-runtime" src="./tbr-dco-engine.js?v=1.3.0"></script>','<script id="tbr-dco-parser-runtime" src="./tbr-dco-parser.js?v=1.0.0"></script>\n<script id="tbr-dco-engine-runtime" src="./tbr-dco-engine.js?v=1.4.0"></script>','parser loader')
s=one(s,'<script id="tbr-dco-claim-mail-loader" src="./tbr-dco-claim-mail.js?v=2.3.0"></script>','<script id="tbr-dco-claim-mail-loader" src="./tbr-dco-claim-mail.js?v=2.4.0"></script>','claim loader')
s=one(s,'function buildAnalysis(summary,rows,installs,moisUsed){','function buildAnalysis(summary,rows,installs,moisUsed,dcoIntegrity=null,dcoSchema=null){','analysis signature')
old_re=r"      \{label:\"Palier ventes\",dco:summary\.palierV,tbr:palierVTbr,ecart:round2\(summary\.palierV-palierVTbr\),money:true,niveau:\"A\"\},\n      \{label:\"Palier VD\",dco:summary\.palierVD,tbr:palierVDTbr,ecart:round2\(summary\.palierVD-palierVDTbr\),money:true,niveau:\"A\"\},\n      \{label:\"Bonus SGP\",dco:summary\.bonusSGP,tbr:bonusTbr,ecart:round2\(summary\.bonusSGP-bonusTbr\),money:true,niveau:\"A\"\},"
new="""      {label:\"Palier ventes\",dco:summary.palierV,tbr:palierVTbr,ecart:round2(summary.palierV-palierVTbr),money:true,niveau:\"A\",claimable:Number(summary.vNettes)===Number(tbrNettes)},
      {label:\"Palier VD\",dco:summary.palierVD,tbr:palierVDTbr,ecart:round2(summary.palierVD-palierVDTbr),money:true,niveau:\"A\",claimable:Number(summary.vDirectes)===Number(tbrVD)},
      {label:\"Bonus SGP\",dco:summary.bonusSGP,tbr:bonusTbr,ecart:round2(summary.bonusSGP-bonusTbr),money:true,niveau:\"A\",claimable:Number(summary.vNettes)===Number(tbrNettes)&&Number(summary.vDirectes)===Number(tbrVD)},"""
s,n=re.subn(old_re,new,s,count=1)
if n!=1: raise SystemExit(f'global claimable rows: {n}')
s=one(s,"""      installationCandidates:installationCandidates,
      nonRetrouves:nonRetrouves,
""","""      installationCandidates:installationCandidates,
      dcoIntegrity:dcoIntegrity||null,
      dcoSchema:dcoSchema||null,
      volumeReconciliation:{ventesNettes:Number(summary.vNettes)===Number(tbrNettes),ventesDirectes:Number(summary.vDirectes)===Number(tbrVD)},
      nonRetrouves:nonRetrouves,
""",'legacy integrity')
pattern=r"      const salesPageIndex=allPageLines\.findIndex\(lines=>/ANNEXE\\s\*1\.\*DETAILS\.\*COMMISSIONS\.\*VENTES/i\.test\(lines\.join\(\" \"\)\)\);.*?      const installs=parseInstallRows\(installItems\);"
replacement="""      if(!window.TBR_DCO_PARSER) throw new Error(\"Lecteur DCO multi-format non chargé.\");
      const schema=window.TBR_DCO_PARSER.detect(allPageLines);
      if(!schema||schema.format===\"unknown\") throw new Error(\"Format DCO non reconnu. La réclamation est bloquée par sécurité.\");
      const neededPages=[schema.salesPage,schema.installPage,schema.packsPage,schema.recapPage].filter((v,i,a)=>v>=0&&a.indexOf(v)===i);
      const pageItemsByIndex={};
      for(const idx of neededPages) pageItemsByIndex[idx]=await readPageItems(pdf,idx+1);
      const parsedDoc=window.TBR_DCO_PARSER.parseDocument({pageLines:allPageLines,pageItemsByIndex,summary});
      const rows=parsedDoc.rows;
      const installs=parsedDoc.installs;"""
s,n=re.subn(pattern,replacement,s,count=1,flags=re.S)
if n!=1: raise SystemExit(f'parseDCO structural block: {n}')
s=s.replace('const sumComPacks=round2(rows.reduce((s,r)=>s+(r.comPacks||0),0));','const sumComPacks=round2(rows.reduce((s,r)=>s+Number(r.comPacksRaw!=null?r.comPacksRaw:(r.comPacks||0)),0));',1)
s=one(s,'const raw={summary,rows,installs,moisUsed};\n      const analysed=buildAnalysis(summary,rows,installs,moisUsed);','const raw={summary,rows,installs,moisUsed,integrity:parsedDoc.integrity,schema:parsedDoc.schema,parserVersion:parsedDoc.version};\n      const analysed=buildAnalysis(summary,rows,installs,moisUsed,parsedDoc.integrity,parsedDoc.schema);','raw integrity')
s,n=re.subn(r'buildAnalysis\(dcoRaw\.summary,dcoRaw\.rows,dcoRaw\.installs,([^\)]*)\)',r'buildAnalysis(dcoRaw.summary,dcoRaw.rows,dcoRaw.installs,\1,dcoRaw.integrity||null,dcoRaw.schema||null)',s,count=1)
if n!=1: raise SystemExit(f'cached recompute integration: {n}')
p.write_text(s)

# Vercel serves parser explicitly.
p=Path('vercel.json'); cfg=json.loads(p.read_text())
if not any(x.get('src')=='tbr-dco-parser.js' for x in cfg.get('builds',[])):
    idx=next(i for i,x in enumerate(cfg['builds']) if x.get('src')=='tbr-dco-engine.js')
    cfg['builds'].insert(idx,{"src":"tbr-dco-parser.js","use":"@vercel/static"})
if not any(x.get('src')=='/tbr-dco-parser.js' for x in cfg.get('routes',[])):
    idx=next(i for i,x in enumerate(cfg['routes']) if x.get('src')=='/tbr-dco-engine.js')
    cfg['routes'].insert(idx,{"src":"/tbr-dco-parser.js","dest":"/tbr-dco-parser.js"})
p.write_text(json.dumps(cfg,ensure_ascii=False,indent=2)+'\n')

# Validator follows parser + versions and rejects old parse path.
p=Path('validate-dco-build.js'); s=p.read_text()
s=one(s,"  const engine = read('tbr-dco-engine.js');","  const parser = read('tbr-dco-parser.js');\n  const engine = read('tbr-dco-engine.js');",'validator parser read')
s=one(s,'  new Function(engine);','  new Function(parser);\n  new Function(engine);','validator parser syntax')
s=s.replace("    'function parseClientRows(items)',\n    'const installs=parseInstallRows(installItems);',","    'tbr-dco-parser-runtime',\n    'TBR_DCO_PARSER.parseDocument',")
s=s.replace("\"const VERSION='1.3.0'\"","\"const VERSION='1.4.0'\"")
s=s.replace("\"const VERSION='2.3.0'\"","\"const VERSION='2.4.0'\"")
s=s.replace("\"const ENGINE_VERSION='1.3.0'\"","\"const ENGINE_VERSION='1.4.0'\"")
s=one(s,"  requireTokens('moteur DCO canonique', engine, [","  requireTokens('parseur DCO multi-format', parser, [\n    \"const VERSION='1.0.0'\",\n    \"format:'compact'\",\n    \"format:'detailed'\",\n    'claimSafe'\n  ]);\n\n  requireTokens('moteur DCO canonique', engine, [",'validator parser tokens')
s=s.replace("for (const active of ['index.html','index-audit.html','tbr-dco-engine.js'","for (const active of ['index.html','index-audit.html','tbr-dco-parser.js','tbr-dco-engine.js'")
p.write_text(s)

# Reliability test versions + new safety assertions.
p=Path('tests/dco-final-reliability-check.js'); s=p.read_text()
s=s.replace("engine runtime 1.3.0', engine && engine.VERSION==='1.3.0","engine runtime 1.4.0', engine && engine.VERSION==='1.4.0")
s=s.replace("claim runtime 2.3.0', claim.includes(\"const VERSION='2.3.0'\")","claim runtime 2.4.0', claim.includes(\"const VERSION='2.4.0'\")")
s=s.replace("claim requires engine 1.3.0', claim.includes(\"const ENGINE_VERSION='1.3.0'\")","claim requires engine 1.4.0', claim.includes(\"const ENGINE_VERSION='1.4.0'\")")
s=s.replace('tbr-dco-engine.js?v=1.3.0','tbr-dco-engine.js?v=1.4.0')
s=s.replace("index.includes('tbr-dco-claim-mail.js?v=2.3.0')","index.includes('tbr-dco-claim-mail.js?v=2.4.0')")
s=one(s,"  ['canonical loaders are cache-busted', index.includes('tbr-dco-claim-mail.js?v=2.4.0') && index.includes('tbr-dco-dashboard-fix.js?v=1.4.0')]","  ['canonical loaders are cache-busted', index.includes('tbr-dco-claim-mail.js?v=2.4.0') && index.includes('tbr-dco-dashboard-fix.js?v=1.4.0')],\n  ['multi-format parser loader present', index.includes('tbr-dco-parser.js?v=1.0.0') && index.includes('TBR_DCO_PARSER.parseDocument')],\n  ['claim blocks unsafe source integrity', claim.includes('if(!result.claimSafe)') && claim.includes('aucune réclamation chiffrée')],\n  ['claim money preserves negative signs', !claim.includes('Math.abs(R(v)).toLocaleString')]",'reliability checks')
# Existing synthetic sources need explicit safe integrity so normal fixtures remain claimable.
s=s.replace("  data:{\n    analyses:[","  data:{\n    dcoIntegrity:{claimSafe:true,failed:[]},\n    analyses:[",2)
p.write_text(s)

# Remove helper after successful patch; workflow removes itself separately.
Path('tools/patch_dco_multiformat.py').unlink(missing_ok=True)
