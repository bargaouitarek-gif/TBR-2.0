(async()=>{
  const VERSION="2026.07.26-pay-details-v9";
  const response=await fetch(`home-pay-bootstrap.js?v=${encodeURIComponent(VERSION)}`,{cache:"no-store"});
  if(!response.ok) throw new Error("Tableau de paye TBR indisponible");
  let source=await response.text();

  source=source.replace('const VERSION="2026.07.26-home-pay-v8";','const VERSION="'+VERSION+'";');

  const varsAnchor='  const payVfCount=safeDetails.filter(v=>v.typeVente==="VF").length;';
  const varsPatch=String.raw`  const payVfCount=safeDetails.filter(v=>v.typeVente==="VF").length;
  const [payDetail,setPayDetail]=useState(null);
  const payRound=value=>Math.round(Number(value||0)*100)/100;
  const explainPayMalus=v=>{
    const causes=[];
    if(v.remsc&&v.remsc!=="Aucun") causes.push("Remise commerciale : "+v.remsc);
    if(v.codePromo) causes.push("Code promotionnel : "+v.codePromo);
    if(Array.isArray(v.codesAbo)&&v.codesAbo.length) causes.push("Offre abonnement : "+v.codesAbo.join(", "));
    const packsTouches=(v.packs||[]).filter(p=>p&&p.statutMat&&p.statutMat!=="Normal");
    if(packsTouches.length) causes.push("Packs remisés ou offerts : "+packsTouches.map(p=>(p.reference||p.nom||"Pack")+" ("+p.statutMat+")").join(", "));
    if(v.fi200start) causes.push("Frais d’installation offerts : FI200 START");
    if(!causes.length) causes.push("Malus calculé par TBR à partir des conditions enregistrées sur cette vente.");
    return causes;
  };
  const deductionDetails=safeDetails.filter(v=>Math.abs(Number((v.result&&v.result.malus)||0))>=0.01).map(v=>({
    name:v.nomClient||"Client",
    num:v.numClient||"—",
    amount:payRound((v.result&&v.result.malus)||0),
    total:payRound((v.result&&v.result.total)||0),
    causes:explainPayMalus(v)
  }));
  const adjustmentDetails=safeDetails.map(v=>{
    const r=v.result||{};
    const classified=Number(r.kit||0)+Number(r.partnerSale||0)+Number(r.bonus||0)+Number(r.packs||0)+Number(r.install||0)+Number(r.partnerInstall||0)+Number(r.malus||0);
    const total=Number(r.total||0);
    const gap=payRound(total-classified);
    if(Math.abs(gap)<0.01) return null;
    return{
      name:v.nomClient||"Client",
      num:v.numClient||"—",
      amount:gap,
      total:payRound(total),
      classified:payRound(classified),
      causes:[
        "Total calculé pour le dossier : "+fmt(total),
        "Éléments déjà classés dans le tableau : "+fmt(classified),
        "Différence restant à identifier : "+fmt(gap)
      ]
    };
  }).filter(Boolean);
  const adjustmentAssigned=payRound(adjustmentDetails.reduce((sum,item)=>sum+Number(item.amount||0),0));
  const globalAdjustment=payRound(payAdjustment-adjustmentAssigned);
  if(Math.abs(globalAdjustment)>=0.01) adjustmentDetails.push({
    name:"Ajustement global",
    num:"Hors dossier client",
    amount:globalAdjustment,
    total:Number(syn.grand||0),
    classified:payRound(Number(syn.grand||0)-globalAdjustment),
    causes:[
      "Total TBR affiché : "+fmt(syn.grand||0),
      "Somme des éléments identifiés : "+fmt(Number(syn.grand||0)-globalAdjustment),
      "Écart non encore rattaché à une rubrique : "+fmt(globalAdjustment)
    ]
  });
  payRows.forEach(item=>{
    if(item.label==="Déductions et malus") item.detailKey="deductions";
    if(item.label==="Autres ajustements") item.detailKey="adjustments";
  });
  const payDetailData=payDetail==="deductions"?{
    title:"Déductions et malus",
    total:payBreakdown.deductions,
    intro:"Chaque ligne ci-dessous correspond à un dossier qui retire de l’argent de ta rémunération.",
    rows:deductionDetails
  }:payDetail==="adjustments"?{
    title:"Autres ajustements",
    total:payAdjustment,
    intro:"Cette rubrique montre ce qui existe dans le total TBR mais n’était pas encore rangé dans une catégorie précise.",
    rows:adjustmentDetails
  }:null;`;
  if(!source.includes(varsAnchor)) throw new Error("Point de détail de la paye introuvable");
  source=source.replace(varsAnchor,varsPatch);

  const rowAnchor='<div className="tbr-pay-lines">{payRows.map((item,index)=><div className={("tbr-pay-line "+(item.negative?"is-negative":"")+(item.value===0?" is-zero":""))} key={item.label}><span className="tbr-pay-code">{item.code}</span><div><strong>{item.label}</strong><small>{item.note}</small></div><b>{fmt(item.value)}</b></div>)}</div>';
  const rowPatch=String.raw`<div className="tbr-pay-lines">{payRows.map((item,index)=><button type="button" className={("tbr-pay-line "+(item.negative?"is-negative":"")+(item.value===0?" is-zero":"")+(item.detailKey?" is-clickable":""))} key={item.label} onClick={()=>item.detailKey&&setPayDetail(item.detailKey)} disabled={!item.detailKey}><span className="tbr-pay-code">{item.code}</span><div><strong>{item.label}</strong><small>{item.note}</small>{item.detailKey&&<em className="tbr-pay-open">Voir le détail ›</em>}</div><b>{fmt(item.value)}</b></button>)}</div>`;
  if(!source.includes(rowAnchor)) throw new Error("Lignes de paye à rendre cliquables introuvables");
  source=source.replace(rowAnchor,rowPatch);

  const modalAnchor=`      </section>

      <section className="flight-hero">`;
  const modalPatch=String.raw`      </section>

      {payDetailData&&<div className="tbr-pay-modal" onClick={()=>setPayDetail(null)}>
        <section className="tbr-pay-modal-card" onClick={event=>event.stopPropagation()}>
          <div className="tbr-pay-modal-head">
            <div><span>DÉTAIL COMPLET</span><h2>{payDetailData.title}</h2><p>{payDetailData.intro}</p></div>
            <button type="button" onClick={()=>setPayDetail(null)} aria-label="Fermer">×</button>
          </div>
          <div className="tbr-pay-modal-total"><span>Total de la rubrique</span><b>{fmt(payDetailData.total)}</b></div>
          <div className="tbr-pay-modal-list">
            {payDetailData.rows.length?payDetailData.rows.map((detail,index)=><article key={(detail.num||"detail")+"-"+index}>
              <div className="tbr-pay-modal-row-head"><div><strong>{detail.name}</strong><small>N° client {detail.num}</small></div><b>{fmt(detail.amount)}</b></div>
              <ul>{detail.causes.map((cause,causeIndex)=><li key={causeIndex}>{cause}</li>)}</ul>
            </article>):<div className="tbr-pay-empty">Aucun dossier détaillé n’a été trouvé pour cette rubrique. Le montant doit être contrôlé dans le calcul global.</div>}
          </div>
          <button type="button" className="tbr-pay-modal-close" onClick={()=>setPayDetail(null)}>Fermer le détail</button>
        </section>
      </div>}

      <section className="flight-hero">`;
  if(!source.includes(modalAnchor)) throw new Error("Emplacement du détail de paye introuvable");
  source=source.replace(modalAnchor,modalPatch);

  const cssAnchor='.tbr-pay-line.is-zero{opacity:.58}';
  const cssPatch=String.raw`.tbr-pay-line.is-zero{opacity:.58}.tbr-pay-line{font:inherit;text-align:left;width:100%;color:inherit}.tbr-pay-line:disabled{cursor:default}.tbr-pay-line.is-clickable{cursor:pointer;transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease}.tbr-pay-line.is-clickable:hover,.tbr-pay-line.is-clickable:active{transform:translateY(-1px);border-color:rgba(248,113,113,.42);box-shadow:0 12px 30px rgba(127,29,29,.16)}.tbr-pay-open{display:block;margin-top:5px;color:#fda4af;font-style:normal;font-size:8px;font-weight:1000;letter-spacing:.08em;text-transform:uppercase}.tbr-pay-modal{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:18px;background:rgba(2,6,23,.82);backdrop-filter:blur(15px)}.tbr-pay-modal-card{width:min(720px,100%);max-height:min(860px,92vh);overflow:auto;padding:24px;border-radius:30px;background:radial-gradient(circle at 90% 0%,rgba(239,68,68,.16),transparent 34%),linear-gradient(145deg,#0c172b,#07111f);border:1px solid rgba(248,113,113,.26);box-shadow:0 35px 100px rgba(0,0,0,.55);color:#f8fafc}.tbr-pay-modal-head{display:flex;align-items:flex-start;gap:18px}.tbr-pay-modal-head>div{flex:1}.tbr-pay-modal-head span{color:#fda4af;font-size:9px;font-weight:1000;letter-spacing:.16em}.tbr-pay-modal-head h2{margin:6px 0;font-size:30px;letter-spacing:-.04em}.tbr-pay-modal-head p{margin:0;color:#9fb0c6;font-size:11px;line-height:1.55}.tbr-pay-modal-head>button{width:42px;height:42px;border:1px solid rgba(248,113,113,.25);border-radius:14px;background:rgba(127,29,29,.22);color:#fecaca;font-size:25px;cursor:pointer}.tbr-pay-modal-total{display:flex;align-items:center;gap:14px;margin:19px 0;padding:16px 18px;border-radius:20px;background:rgba(69,10,10,.28);border:1px solid rgba(248,113,113,.20)}.tbr-pay-modal-total span{color:#cbd5e1;font-size:11px;font-weight:900}.tbr-pay-modal-total b{margin-left:auto;color:#fda4af;font-size:27px}.tbr-pay-modal-list{display:grid;gap:10px}.tbr-pay-modal-list article{padding:15px;border-radius:19px;background:rgba(15,23,42,.72);border:1px solid rgba(148,163,184,.14)}.tbr-pay-modal-row-head{display:flex;align-items:flex-start;gap:12px}.tbr-pay-modal-row-head>div{flex:1}.tbr-pay-modal-row-head strong{display:block;font-size:14px}.tbr-pay-modal-row-head small{display:block;margin-top:3px;color:#8294ad;font-size:9px}.tbr-pay-modal-row-head>b{color:#fda4af;font-size:17px;white-space:nowrap}.tbr-pay-modal-list ul{margin:11px 0 0;padding-left:18px;color:#cbd5e1;font-size:10px;line-height:1.55}.tbr-pay-modal-list li+li{margin-top:4px}.tbr-pay-empty{padding:18px;border-radius:18px;background:rgba(15,23,42,.65);color:#cbd5e1;font-size:11px;line-height:1.55}.tbr-pay-modal-close{width:100%;margin-top:16px;padding:14px;border:0;border-radius:16px;background:linear-gradient(135deg,#38bdf8,#6366f1);color:#fff;font-weight:1000;cursor:pointer}`;
  if(!source.includes(cssAnchor)) throw new Error("Style des lignes de paye introuvable");
  source=source.replace(cssAnchor,cssPatch);

  try{localStorage.setItem("cc_version",VERSION);}catch(e){}
  (0,eval)(source);
})().catch(error=>{
  console.error(error);
  const target=document.getElementById("boot-msg");
  if(target){target.className="boot-error";target.textContent="TBR n’a pas pu charger le détail de la paye : "+(error&&error.message?error.message:error);}
});