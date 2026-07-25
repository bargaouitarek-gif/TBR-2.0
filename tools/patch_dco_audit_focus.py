from pathlib import Path
import re

path = Path('index.html')
text = path.read_text(encoding='utf-8')
original = text


def replace_once(pattern: str, replacement: str, label: str, flags: int = 0) -> None:
    global text
    text, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f'{label}: expected one replacement, got {count}')


new_parser = r'''  function parseClientRows(pages){
    const candidates=[];
    const pageList=Array.isArray(pages)?pages:[pages];
    const cats="REFVD|REFVF|PURVD|PURVF|PREVD|PREVF|RMK|PURGU|DIS";
    const catRx=new RegExp("\\b("+cats+")\\b","i");

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
      return {
        nb:c.nb,
        num:c.num,
        matchKey:c.num,
        nom,
        catpub,
        engagement,
        caPacks:last[0],
        comVente:last[1],
        comPacks:last[2],
        offre,
        isAnnulation:c.nb<=0||/annulation/i.test(offre),
        page:c.page,
        confidence:100,
        raw:body
      };
    };

    pageList.forEach((rawPage,pageIndex)=>{
      const lines=(Array.isArray(rawPage)?rawPage:[rawPage]).map(x=>String(x||"").replace(/\\s+/g," ").trim()).filter(Boolean);
      let current=null;
      let pendingNb=null;
      let pendingAt=-99;
      const flush=()=>{
        if(current){candidates.push(current);current=null;}
      };

      lines.forEach((line,lineIndex)=>{
        const complete=line.match(/^(-?1|0)\\s+(\\d{6,8})(?:\\s+(.*))?$/);
        if(complete){
          flush();
          pendingNb=null;
          current={nb:Number(complete[1]),num:normNum(complete[2]),parts:complete[3]?[complete[3]]:[],page:pageIndex+1};
          return;
        }

        const nbOnly=line.match(/^(-?1|0)$/);
        if(nbOnly){
          flush();
          pendingNb=Number(nbOnly[1]);
          pendingAt=lineIndex;
          return;
        }

        const splitStart=(pendingNb!==null&&lineIndex-pendingAt<=2)?line.match(/^(\\d{6,8})(?:\\s+(.*))?$/):null;
        if(splitStart){
          flush();
          current={nb:pendingNb,num:normNum(splitStart[1]),parts:splitStart[2]?[splitStart[2]]:[],page:pageIndex+1};
          pendingNb=null;
          return;
        }

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
  }'''

replace_once(
    r'  function parseClientRows\(pages\)\{.*?\n  \}\n\n  function parseInstallRows',
    new_parser + '\n\n  function parseInstallRows',
    'replace parseClientRows',
    re.S,
)

helpers = r'''  const dcoClaimCases=dcoData?(dcoData.analyses||[]).filter(a=>Number(a.verseEnMoins||0)>0.99||a.type==="missing_dco"):[];
  const dcoOverpaidCases=dcoData?(dcoData.analyses||[]).filter(a=>Number(a.verseEnPlus||0)>0.99):[];
  const dcoReviewCases=dcoData?(dcoData.analyses||[]).filter(a=>a.statut!=="ok"&&Number(a.verseEnMoins||0)<1&&Number(a.verseEnPlus||0)<1):[];
  const dcoConformCases=dcoData?(dcoData.analyses||[]).filter(a=>a.statut==="ok"):[];
  const dcoGlobalClaims=dcoData?(dcoData.globalRows||[]).filter(r=>r.money&&r.label!=="Installations total"&&Number(r.ecart)<-0.99):[];
  const dcoGlobalOverpaid=dcoData?(dcoData.globalRows||[]).filter(r=>r.money&&r.label!=="Installations total"&&Number(r.ecart)>0.99):[];

  const buildDcoClaimMail=()=>{
    if(!dcoData) return "";
    const month=`${MOIS_NOMS[dcoData.moisUsed.mois-1]} ${dcoData.moisUsed.annee}`;
    const clientLines=dcoClaimCases.map(a=>{
      const missing=(a.lines||[]).filter(l=>Number(l.ecart)<-0.99).map(l=>`   - ${l.label} : attendu ${money(l.tbr)}, versé ${money(l.dco)}, manque ${money(Math.abs(l.ecart))}`).join("\n");
      return `• Client n° ${a.num} — ${a.nom||"Client"}\n  Montant à régulariser : ${money(a.verseEnMoins||Math.abs(a.ecart||0))}${missing?"\n"+missing:""}`;
    });
    const globalLines=dcoGlobalClaims.map(r=>`• ${r.label} : attendu ${money(r.tbr)}, versé ${money(r.dco)}, manque ${money(Math.abs(r.ecart))}`);
    const details=[...clientLines,...globalLines].join("\n\n")||"• Écart global détecté : détail à confirmer dans TBR.";
    return `Bonjour,\n\nAprès contrôle de mon DCO de ${month}, TBR a identifié un montant total de ${money(dcoData.verseEnMoins||0)} versé en moins.\n\nVoici le détail des éléments à vérifier et à régulariser :\n\n${details}\n\nTotal demandé en régularisation : ${money(dcoData.verseEnMoins||0)}.\n\nLes éventuels montants versés en plus ont été isolés et ne sont pas inclus dans cette demande.\n\nMerci de vérifier ces éléments et de me confirmer la régularisation.\n\nBien cordialement,\nTarek Bargaoui`;
  };

  const prepareDcoMail=async()=>{
    const body=buildDcoClaimMail();
    if(!body) return;
    try{
      await navigator.clipboard.writeText(body);
      alert("Le mail de réclamation est prêt et copié. Tu peux le coller directement dans Outlook.");
    }catch(e){
      window.prompt("Mail prêt à copier :",body);
    }
  };
'''

replace_once(
    r'(  const detailValue=\(v,empty="—"\)=>\{if\(v===undefined\|\|v===null\|\|v===""\) return empty; return String\(v\);\};\n)',
    r'\1\n' + helpers,
    'insert DCO audit helpers',
)

text = text.replace(
    '<div className="v8-eyebrow">Contrôle paie</div>\n           <h2>Importe ton DCO, TBR détecte le mois et compare avec tes saisies.</h2>\n           <p>Le contrôle sépare les écarts fiables, les packs et les commissions vente à vérifier.</p>',
    '<div className="v8-eyebrow">Moteur d’audit DCO</div>\n           <h2>Importe ton PDF : TBR te dit immédiatement ce qui manque et pourquoi.</h2>\n           <p>Le numéro client est la clé principale. Les montants à réclamer sont séparés de ce qui a été versé en plus.</p>',
    1,
)

priority_markup = r'''          <section className="dco-card" style={{border:(dcoData.verseEnMoins||0)>0?"2px solid #dc2626":"2px solid #16a34a",background:(dcoData.verseEnMoins||0)>0?"linear-gradient(135deg,#fff1f2,#ffffff)":"linear-gradient(135deg,#f0fdf4,#ffffff)"}}>
            <div className="v8-eyebrow">Résultat prioritaire</div>
            <h2 style={{margin:"8px 0",fontSize:"clamp(28px,6vw,48px)",color:(dcoData.verseEnMoins||0)>0?"#b91c1c":"#15803d"}}>{(dcoData.verseEnMoins||0)>0?`🚨 Il te manque ${money(dcoData.verseEnMoins)}`:"✅ Aucun montant manquant détecté"}</h2>
            <p style={{margin:"0 0 14px",fontWeight:800}}>{dcoClaimCases.length+dcoGlobalClaims.length} élément(s) à réclamer · {dcoData.couverture}% des numéros clients DCO retrouvés dans TBR.</p>
            {(dcoData.verseEnMoins||0)>0&&<button className="dco-upload-btn" onClick={prepareDcoMail}>Préparer le mail de réclamation</button>}
          </section>

          {(dcoClaimCases.length>0||dcoGlobalClaims.length>0)&&(
            <section className="dco-card dco-alerts-panel" style={{border:"2px solid #ef4444"}}>
              <div className="dco-title">🔴 À réclamer maintenant</div>
              <div className="dco-sub">Chaque dossier est identifié d’abord par son numéro client. Les montants versés en plus ne compensent jamais les sommes manquantes.</div>
              <div className="dco-alerts-list">
                {dcoClaimCases.map((a,i)=><div className="dco-alert-item client neg" key={"claim"+a.num}>
                  <div className="dco-alert-num">{i+1}</div>
                  <div className="dco-alert-body"><strong>{a.nom||"Client"}</strong><span>N° {a.num} · {a.catpub||"—"}</span><em>{a.title||"Montant versé en moins"}</em>{(a.lines||[]).filter(l=>Number(l.ecart)<-0.99).length>0&&<ul>{(a.lines||[]).filter(l=>Number(l.ecart)<-0.99).map((l,j)=><li key={j}>{l.label} : attendu {money(l.tbr)} · versé {money(l.dco)} · manque {money(Math.abs(l.ecart))}</li>)}</ul>}</div>
                  <b className="neg">{money(a.verseEnMoins||Math.abs(a.ecart||0))}</b>
                </div>)}
                {dcoGlobalClaims.map((r,i)=><div className="dco-alert-item global neg" key={"global-claim"+i}><div className="dco-alert-num">{dcoClaimCases.length+i+1}</div><div className="dco-alert-body"><strong>{r.label}</strong><span>Écart global</span><em>Attendu {money(r.tbr)} · versé {money(r.dco)}</em></div><b className="neg">{money(Math.abs(r.ecart))}</b></div>)}
              </div>
            </section>
          )}

          {dcoReviewCases.length>0&&(
            <section className="dco-card dco-warning">
              <div className="dco-title">🟠 À vérifier sans réclamer automatiquement</div>
              <div className="dco-sub">Ces dossiers demandent une correction de fiche ou une vérification avant toute demande.</div>
              {dcoReviewCases.map(a=><div className="dco-line" key={"review"+a.num}><span><b>{a.nom||"Client"}</b><em>N° {a.num} · {a.title}</em></span><b>À vérifier</b></div>)}
            </section>
          )}

          {(dcoOverpaidCases.length>0||dcoGlobalOverpaid.length>0)&&(
            <details className="dco-card" style={{border:"1px solid #86efac"}}>
              <summary style={{cursor:"pointer",fontWeight:950,color:"#15803d"}}>🟢 Versé en plus : {money(dcoData.verseEnPlus||0)} — à ne pas réclamer</summary>
              <div className="dco-sub" style={{marginTop:10}}>Information uniquement. Ces sommes restent séparées des montants manquants.</div>
              {dcoOverpaidCases.map(a=><div className="dco-line pos" key={"plus"+a.num}><span>{a.nom||"Client"}<em>N° {a.num}</em></span><b>{money(a.verseEnPlus||0)}</b></div>)}
              {dcoGlobalOverpaid.map((r,i)=><div className="dco-line pos" key={"global-plus"+i}><span>{r.label}<em>Écart global</em></span><b>{money(r.ecart)}</b></div>)}
            </details>
          )}

          <details className="dco-card">
            <summary style={{cursor:"pointer",fontWeight:950}}>Voir les totaux techniques DCO / TBR</summary>
            <div className="dco-compare-grid" style={{marginTop:14}}>
              <div className="dco-compare-box"><span>DCO reçu</span><strong>{money(dcoData.totalDCO)}</strong><small>{dcoData.vNettes} ventes nettes · {dcoData.vDirectes} VD</small></div>
              <div className="dco-compare-box"><span>TBR attendu</span><strong>{money((dcoData.tbrSummary||{}).total||0)}</strong><small>{(dcoData.tbrSummary||{}).vNettes||0} ventes nettes · {(dcoData.tbrSummary||{}).vDirectes||0} VD</small></div>
              <div className="dco-compare-box bad"><span>Versé en moins</span><strong>{money(dcoData.verseEnMoins||0)}</strong><small>À réclamer après vérification des dossiers rouges.</small></div>
              <div className="dco-compare-box good"><span>Versé en plus</span><strong>{money(dcoData.verseEnPlus||0)}</strong><small>À conserver séparément, sans compensation.</small></div>
            </div>
          </details>'''

replace_once(
    r'          <section className="dco-verdict">.*?          </section>\n\n          <section className="dco-card dco-explain-panel">.*?          </section>',
    priority_markup,
    'replace verdict and explanation',
    re.S,
)

replace_once(
    r'\n          \{getDcoAlerts\(dcoData\)\.length>0&&\(.*?\n          \)\}\n\n          <section className="dco-grid">',
    '\n\n          <section className="dco-grid">',
    'remove duplicate alerts panel',
    re.S,
)

replace_once(
    r'(          <section className="dco-grid">.*?          </section>)(\n\n          \{dcoData\.nonRetrouves>0&&\()',
    r'          <details className="dco-card"><summary style={{cursor:"pointer",fontWeight:950}}>Voir la synthèse complète et les écarts globaux</summary>\n\1\n          </details>\2',
    'collapse technical grid',
    re.S,
)

text = text.replace('<div className="dco-title">Contrôle client par client</div>', '<div className="dco-title">Dossiers nécessitant ton attention</div>', 1)
text = text.replace('<div className="dco-sub">Chaque ligne DCO est comparée au numéro client saisi dans TBR.</div>', '<div className="dco-sub">Les dossiers conformes sont masqués. La comparaison repose en priorité sur le numéro client.</div>', 1)
text = text.replace('{[...dcoData.analyses].sort((a,b)=>analysisRank(a)-analysisRank(b)).map((a,i)=>(', '{[...dcoData.analyses].filter(a=>a.statut!=="ok").sort((a,b)=>analysisRank(a)-analysisRank(b)).map((a,i)=>(', 1)

conformes = r'''              ))}
            </div>
            {dcoConformCases.length>0&&(
              <details style={{marginTop:14}}>
                <summary style={{cursor:"pointer",fontWeight:900,color:"#15803d"}}>Afficher les {dcoConformCases.length} dossiers conformes</summary>
                <div className="dco-clients" style={{marginTop:10}}>{dcoConformCases.map(a=><div className="dco-line pos" key={"ok"+a.num}><span>{a.nom||"Client"}<em>N° {a.num} · correspondance par numéro client</em></span><b>Conforme</b></div>)}</div>
              </details>
            )}
          </section>
        </>
      )}'''

replace_once(
    r'              \)\}\n            </div>\n          </section>\n        </>\n      \)\}',
    conformes,
    'insert collapsed conforming clients',
)

required = [
    'matchKey:num',
    'const dcoClaimCases=',
    'Il te manque',
    'Préparer le mail de réclamation',
    'À ne pas réclamer',
    'filter(a=>a.statut!=="ok")',
    'Afficher les {dcoConformCases.length} dossiers conformes',
]
for token in required:
    if token not in text:
        raise SystemExit('missing required token: '+token)

if text == original:
    raise SystemExit('no changes')

path.write_text(text, encoding='utf-8')
print('Focused DCO audit patch applied')
