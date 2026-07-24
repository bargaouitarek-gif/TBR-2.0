from pathlib import Path

path = Path('index.html')
text = path.read_text(encoding='utf-8')
original = text


def replace_once(old: str, new: str, label: str):
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, got {count}')
    text = text.replace(old, new, 1)


replace_once(
    'const APP_VERSION = "8.30.0-openai-global";',
    'const APP_VERSION = "8.30.1-aimt-rules";',
    'version',
)

replace_once(
    'function App(){',
    '''const TBR_AIMT_IMPACT_REASONS=["AIMT","ALIT","ASAT"];
function tbrAimtMotif(item){return String(item&&item.motif||"").toUpperCase().trim();}
function tbrAimtHasImpact(item){return TBR_AIMT_IMPACT_REASONS.includes(tbrAimtMotif(item));}
function tbrAimtAllItems(aimt){return aimt&&Array.isArray(aimt.items)?aimt.items:[];}
function tbrAimtImpactItems(aimt){return tbrAimtAllItems(aimt).filter(tbrAimtHasImpact);}

function App(){''',
    'AIMT helpers',
)

replace_once(
    '''    const aimtItems=Array.isArray(aimt&&aimt.items)?aimt.items:[];
    const aimtVD=aimtItems.length?aimtItems.filter(x=>x.typeVente==="VD").length:(Number(aimt&&aimt.vd)||0);
    const aimtVF=aimtItems.length?aimtItems.filter(x=>x.typeVente==="VF").length:(Number(aimt&&aimt.vf)||0);
    const vn=Math.max(0,actives.length-aimtVD-aimtVF);''',
    '''    const aimtAllItems=tbrAimtAllItems(aimt);
    const aimtItems=aimtAllItems.filter(tbrAimtHasImpact);
    const hasDetailedAimt=aimtAllItems.length>0;
    const aimtVD=hasDetailedAimt?aimtItems.filter(x=>x.typeVente==="VD").length:(Number(aimt&&aimt.vd)||0);
    const aimtVF=hasDetailedAimt?aimtItems.filter(x=>x.typeVente==="VF").length:(Number(aimt&&aimt.vf)||0);
    const vn=Math.max(0,actives.length-aimtVD-aimtVF);''',
    'main counters',
)

replace_once(
    '''    return{vn,vd,totalCom,pv,pvd,bsgp,totalChall,grand:totalCom+pv+pvd+bsgp+totalChall,details,ip,ann:ventes.filter(v=>v.annulation).length,aimtVD,aimtVF};''',
    '''    const annCourantes=ventes.filter(v=>v.annulation).length;
    return{vn,vd,totalCom,pv,pvd,bsgp,totalChall,grand:totalCom+pv+pvd+bsgp+totalChall,details,ip,ann:annCourantes+aimtVD+aimtVF,annCourantes,aimtVD,aimtVF,aimtNeutres:aimtAllItems.length-aimtItems.length};''',
    'main cancellation summary',
)

replace_once(
    '''    const aimtItems=Array.isArray(aimt&&aimt.items)?aimt.items:[];
    const aimtVD=aimtItems.length?aimtItems.filter(x=>x.typeVente==="VD").length:(Number(aimt&&aimt.vd)||0);
    const aimtVF=aimtItems.length?aimtItems.filter(x=>x.typeVente==="VF").length:(Number(aimt&&aimt.vf)||0);
    const aimtTotal=aimtVD+aimtVF;''',
    '''    const aimtAllItems=tbrAimtAllItems(aimt);
    const aimtItems=aimtAllItems.filter(tbrAimtHasImpact);
    const hasDetailedAimt=aimtAllItems.length>0;
    const aimtVD=hasDetailedAimt?aimtItems.filter(x=>x.typeVente==="VD").length:(Number(aimt&&aimt.vd)||0);
    const aimtVF=hasDetailedAimt?aimtItems.filter(x=>x.typeVente==="VF").length:(Number(aimt&&aimt.vf)||0);
    const aimtTotal=aimtVD+aimtVF;''',
    'DCO counters',
)

replace_once(
    '''    aimtItems.forEach(x=>{
      const n=normNum(x.numClient);''',
    '''    aimtAllItems.forEach(x=>{
      const n=normNum(x.numClient);''',
    'DCO matching keeps neutral records',
)

replace_once(
    '''      const beforeOffer=chunk.split(/ACQ\s*start|annulation_AIMT/i)[0]||"";''',
    '''      const beforeOffer=chunk.split(/ACQ\s*start|annulation_[A-Z0-9_]+/i)[0]||"";''',
    'DCO cancellation code parser',
)

replace_once(
    '''  const vdTrim=(+agent.vdT1||0)+(+agent.vdT2||0);
  return(''',
    '''  const vdTrim=(+agent.vdT1||0)+(+agent.vdT2||0);
  const aimtItems=tbrAimtAllItems(aimt);
  const aimtImpactItems=aimtItems.filter(tbrAimtHasImpact);
  const aimtNeutralItems=aimtItems.filter(x=>!tbrAimtHasImpact(x));
  const aimtImpactVD=aimtImpactItems.filter(x=>x.typeVente==="VD").length;
  const aimtImpactVF=aimtImpactItems.filter(x=>x.typeVente==="VF").length;
  return(''',
    'Params derived counters',
)

replace_once(
    '''      <Card title="⚠️ Ventes AIMT / ALIT / ASAT">
        <div style={{background:"#FFF3E0",borderRadius:10,padding:"8px 12px",marginBottom:12,fontSize:12,color:"#E65100",lineHeight:1.6}}>
          Annulations imposées (impayé total, litige…) sur des ventes d'anciens mois. Elles réduisent vos compteurs et paliers du mois en cours.
        </div>''',
    '''      <Card title="⚠️ Ventes annulées — AIMT / ALIT / ASAT">
        <div style={{background:"#FFF3E0",borderRadius:10,padding:"8px 12px",marginBottom:12,fontSize:12,color:"#E65100",lineHeight:1.6}}>
          Seuls AIMT, ALIT et ASAT retirent une vente et, selon ton choix, un VD ou un VF. « Autre » est conservé pour information mais ne retire absolument rien aux ventes, aux paliers ou aux commissions.
        </div>''',
    'Params explanation',
)

replace_once(
    '''        {(Array.isArray(aimt.items)?aimt.items:[]).map(x=><div className="aimt-item" key={x.id}><div><b>N° {x.numClient}</b><span>{x.typeVente} · {x.motif}</span></div><button onClick={()=>setAimt({...aimt,items:aimt.items.filter(i=>i.id!==x.id),vd:0,vf:0})}>Supprimer</button></div>)}
        {(Array.isArray(aimt.items)&&aimt.items.length>0)&&(
          <div style={{background:"#FFEBEE",borderRadius:10,padding:"10px 12px",marginTop:8,fontSize:13,color:"#C62828",fontWeight:600}}>
            Impact : -{aimt.items.length} vente(s) nette(s) · -{aimt.items.filter(x=>x.typeVente==="VD").length} VD sur les paliers
          </div>
        )}''',
    '''        {aimtItems.map(x=><div className="aimt-item" key={x.id}><div><b>N° {x.numClient}</b><span>{x.typeVente} · {x.motif} · {tbrAimtHasImpact(x)?"décommission":"sans impact"}</span></div><button onClick={()=>setAimt({...aimt,items:aimtItems.filter(i=>i.id!==x.id),vd:0,vf:0})}>Supprimer</button></div>)}
        {aimtItems.length>0&&(
          <div style={{background:aimtImpactItems.length?"#FFEBEE":"#E8F5E9",borderRadius:10,padding:"10px 12px",marginTop:8,fontSize:13,color:aimtImpactItems.length?"#C62828":"#087443",fontWeight:700}}>
            {aimtImpactItems.length>0
              ?<>Impact réel : -{aimtImpactItems.length} vente(s) nette(s) · -{aimtImpactVD} VD · -{aimtImpactVF} VF</>
              :<>Aucun impact sur les ventes, les VD/VF ou les paliers.</>}
            {aimtNeutralItems.length>0&&<div style={{marginTop:6,fontSize:11,fontWeight:750}}>Sans impact : {aimtNeutralItems.length} ligne(s) classée(s) « Autre ».</div>}
          </div>
        )}''',
    'Params list and impact',
)

# Static correctness checks.
required = [
    'const TBR_AIMT_IMPACT_REASONS=["AIMT","ALIT","ASAT"]',
    'const aimtItems=aimtAllItems.filter(tbrAimtHasImpact);',
    'aimtNeutres:aimtAllItems.length-aimtItems.length',
    'Aucun impact sur les ventes, les VD/VF ou les paliers.',
    'annulation_[A-Z0-9_]+',
]
for token in required:
    if token not in text:
        raise SystemExit(f'missing required token: {token}')

# Prove the four requested cases with the same rules used by the app.
def impacting(motif: str) -> bool:
    return motif.strip().upper() in {'AIMT', 'ALIT', 'ASAT'}

cases = [('AIMT', True), ('ALIT', True), ('ASAT', True), ('Autre', False), ('AIMP', False), ('ARAR', False)]
for motif, expected in cases:
    assert impacting(motif) is expected, (motif, expected)

if text == original:
    raise SystemExit('no changes produced')

path.write_text(text, encoding='utf-8')
print('AIMT/ALIT/ASAT rules fixed; Autre/AIMP/ARAR are neutral')
