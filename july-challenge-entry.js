(async()=>{
  const VERSION="2026.08.02-july-challenge-v25";
  if(window.__tbrJulyChallengeV25)return;
  window.__tbrJulyChallengeV25=true;
  window.__tbrJulyChallengeDiagnostics={version:VERSION,raw:false,home:false,detail:false};

  const nativeFetch=window.fetch.bind(window);

  function replaceAny(source,variants,after,label){
    const list=Array.isArray(variants)?variants:[variants];
    for(const before of list){
      if(source.includes(before)) return source.replace(before,after);
    }
    throw new Error("Challenge juillet : "+label+" introuvable");
  }

  function patchRawApplication(html){
    if(html.includes("tbr-july-challenge-engine-v25"))return html;
    let source=html;

    source=replaceAny(source,
      'function calcCommission(v,ip){',
      'function calcCommission(v,ip,challengeJuilletOverride){\n  const challengeJuillet=typeof challengeJuilletOverride==="boolean"?challengeJuilletOverride:!!window.__tbrChallengeJuilletActive;',
      'entrée du calcul de commission');

    source=replaceAny(source,
      '  const caPacksNet=caPacks-promoAbo.deductionCAHT;',
      '  const caPacksNet=challengeJuillet?caPacks:caPacks-promoAbo.deductionCAHT;',
      'malus abonnement court');

    source=replaceAny(source,[
      '  if(min) malus-=40;\n  const off=(v.packs||[]).filter(p=>p.statutMat==="Offert").length;\n  if(off>0){malus-=off*10;malusDetail.push(`${off} pack(s) offert(s) mat → -${off*10}€`);}',
      '  if(min) malus-=40;\n  const off=(v.packs||[]).filter(p=>p.statutMat=="Offert").length;\n  if(off>0){malus-=off*10;malusDetail.push(`${off} pack(s) offert(s) mat → -${off*10}€`);}'
    ],
      '  if(min&&!challengeJuillet) malus-=40;\n  else if(min&&challengeJuillet) malusDetail.push("Challenge juillet 2026 → malus Intégrale de 40 € annulé");\n  const off=(v.packs||[]).filter(p=>p.statutMat==="Offert").length;\n  if(off>0&&!challengeJuillet){malus-=off*10;malusDetail.push(`${off} pack(s) offert(s) mat → -${off*10}€`);}\n  else if(off>0&&challengeJuillet) malusDetail.push(`Challenge juillet 2026 → forfait pack offert annulé : ${off*10} € récupérés`);',
      'malus Intégrale et packs offerts');

    source=replaceAny(source,
      '    const impRemise=remiseAboPacks*5;\n    malus-=impRemise;\n    malusDetail.push(`Remise abo pack ${remiseAboPacks}€/mois → -${impRemise}€`);',
      '    const impRemise=remiseAboPacks*(challengeJuillet?3:5);\n    malus-=impRemise;\n    malusDetail.push(challengeJuillet?`Challenge juillet 2026 → ABOX réduite : 3 € × ${remiseAboPacks} = -${impRemise} €`:`Remise abo pack ${remiseAboPacks}€/mois → -${impRemise}€`);',
      'pénalité ABOX des packs');

    source=replaceAny(source,
      '  (v.codesAbo||[]).forEach(c=>{\n    const ci=CODES_ABO.find(x=>x.code===c.code);\n    const imp=ci?ci.impact:(10+(c.montant||0)*5);\n    malus-=imp;malusDetail.push(`${c.code} → -${imp}€`);\n  });',
      '  (v.codesAbo||[]).forEach(c=>{\n    const ci=CODES_ABO.find(x=>x.code===c.code);\n    const montant=Number(ci&&ci.montant!==undefined?ci.montant:(c.montant||0));\n    const imp=challengeJuillet?montant*3:(ci?ci.impact:(10+montant*5));\n    malus-=imp;\n    malusDetail.push(challengeJuillet?`${c.code} → challenge juillet 2026 : forfait 10 € annulé, 3 € × ${montant} = -${imp} €`:`${c.code} → -${imp}€`);\n  });',
      'codes ABOX');

    source=replaceAny(source,[
      '    const vd=Math.max(0,actives.filter(v=>v.typeVente==="VD").length-aimtVD);\n    let totalCom=0;\n    const details=actives.map(v=>{const r=calcCommission(v,ip);totalCom+=r.total;return{...v,result:r};});',
      '    const vd=Math.max(0,actives.filter(v=>v.typeVente=="VD").length-aimtVD);\n    let totalCom=0;\n    const details=actives.map(v=>{const r=calcCommission(v,ip);totalCom+=r.total;return{...v,result:r};});'
    ],
      '    const vd=Math.max(0,actives.filter(v=>v.typeVente==="VD").length-aimtVD);\n    const challengeJuilletActive=Number(moisActif&&moisActif.annee)===2026&&Number(moisActif&&moisActif.mois)===7&&vd>=7;\n    window.__tbrChallengeJuilletActive=challengeJuilletActive;\n    let totalCom=0;\n    const details=actives.map(v=>{const r=calcCommission(v,ip,challengeJuilletActive);totalCom+=r.total;return{...v,result:r};});',
      'activation à 7 VD nettes');

    source=replaceAny(source,
      '    return{vn,vd,totalCom,pv,pvd,bsgp,totalChall,grand:totalCom+pv+pvd+bsgp+totalChall,details,ip,ann:annCourantes+aimtVD+aimtVF,annCourantes,aimtVD,aimtVF,aimtNeutres:aimtAllItems.length-aimtItems.length};',
      '    const challengeJuilletGain=challengeJuilletActive?details.reduce((sum,item)=>{const normal=calcCommission(item,ip,false);return sum+Math.max(0,Number(item.result.total||0)-Number(normal.total||0));},0):0;\n    const challengeJuilletAvant=totalCom-challengeJuilletGain+pv+pvd+bsgp+totalChall;\n    return{vn,vd,totalCom,pv,pvd,bsgp,totalChall,grand:totalCom+pv+pvd+bsgp+totalChall,details,ip,ann:annCourantes+aimtVD+aimtVF,annCourantes,aimtVD,aimtVF,aimtNeutres:aimtAllItems.length-aimtItems.length,challengeJuilletActive,challengeJuilletGain,challengeJuilletAvant};',
      'synthèse mensuelle');

    window.__tbrJulyChallengeDiagnostics.raw=true;
    return source.replace('</body>','<script id="tbr-july-challenge-engine-v25">window.__tbrJulyChallengeEngineVersion="'+VERSION+'";<\/script></body>');
  }

  function patchHomePayModule(text){
    if(text.includes("tbr-july-pay-v25"))return text;
    let source=text;

    const rowAnchor='{code:"★",label:"Challenges",note:"Primes exceptionnelles saisies",value:Number(syn.totalChall||0)},';
    source=replaceAny(source,rowAnchor,rowAnchor+'\n    ...(syn.challengeJuilletActive?[{code:"J7",label:"Challenge juillet 2026",note:syn.vd+" VD nettes · avantage appliqué à toutes les ventes",value:Number(syn.challengeJuilletGain||0),detailKey:"july2026",challengeJuly:true}]:[]),','ligne du challenge');

    const commandAnchor='<div className="tbr-pay-total-zone">';
    source=replaceAny(source,commandAnchor,'{syn.challengeJuilletActive&&<button type="button" className="tbr-july-pay-v25" onClick={()=>setPayDetail("july2026")}><span>CHALLENGE JUILLET 2026 · ACTIVÉ</span><strong>+{fmt(syn.challengeJuilletGain||0)}</strong><small>{syn.vd} VD nettes · avantage appliqué à toutes les ventes du mois · voir le détail ›</small></button>}\n        '+commandAnchor,'bloc vert d’accueil');

    const cssAnchor='.tbr-pay-line.is-zero{opacity:.58}';
    source=replaceAny(source,cssAnchor,cssAnchor+'.tbr-july-pay-v25{position:relative;z-index:2;width:100%;display:grid;grid-template-columns:1fr auto;gap:4px 14px;align-items:center;margin:18px 0 0;padding:15px 17px;border:1px solid rgba(74,222,128,.42);border-radius:20px;background:linear-gradient(135deg,rgba(6,78,59,.74),rgba(14,116,144,.54));color:#fff;text-align:left;box-shadow:0 16px 38px rgba(16,185,129,.18);cursor:pointer}.tbr-july-pay-v25 span{color:#86efac;font-size:9px;font-weight:1000;letter-spacing:.12em}.tbr-july-pay-v25 strong{grid-row:1/3;grid-column:2;color:#86efac;font-size:24px}.tbr-july-pay-v25 small{color:#d1fae5;font-size:9px;font-weight:800}','style du bloc vert');

    window.__tbrJulyChallengeDiagnostics.home=true;
    return source;
  }

  function patchPayDetailModule(text){
    if(text.includes("tbr-july-detail-v25"))return text;
    let source=text;
    const anchors=[
      '  const payDetailData=payDetail==="deductions"?{',
      '  const payDetailData=payDetail=="deductions"?{'
    ];
    const patch='  const julyDetails=safeDetails.map(v=>{const normal=calcCommission(v,ip,false);const gain=Math.max(0,Number(v.result&&v.result.total||0)-Number(normal.total||0));return gain>=.01?{name:v.nomClient||"Client",num:v.numClient||"—",amount:gain,total:Number(v.result&&v.result.total||0),causes:["Commission avec challenge : "+fmt(v.result&&v.result.total||0),"Commission sans challenge : "+fmt(normal.total||0),"Gain récupéré sur ce dossier : "+fmt(gain)].concat((v.result&&v.result.malusDetail)||[])}:null;}).filter(Boolean);\n  const payDetailData=payDetail==="july2026"?{title:"Challenge juillet 2026",total:Number(syn.challengeJuilletGain||0),intro:"Le seuil de 7 VD nettes est atteint. Les règles exceptionnelles sont appliquées à toutes les ventes de juillet 2026.",rows:julyDetails}:payDetail==="deductions"?{';
    source=replaceAny(source,anchors,patch,'détail vente par vente');
    window.__tbrJulyChallengeDiagnostics.detail=true;
    return source.replace('(async()=>{','(async()=>{\n  const __tbrJulyDetail="tbr-july-detail-v25";');
  }

  window.fetch=async function(input,init){
    const response=await nativeFetch(input,init);
    const url=typeof input==="string"?input:(input&&input.url)||"";
    const value=String(url);
    let transformed=null;
    try{
      if(/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[^/]+\/index\.html(?:\?|$)/i.test(value)) transformed=patchRawApplication(await response.text());
      else if(/(?:^|\/)home-pay-bootstrap\.js(?:\?|$)/i.test(value)) transformed=patchHomePayModule(await response.text());
      else if(/(?:^|\/)pay-detail-bootstrap\.js(?:\?|$)/i.test(value)) transformed=patchPayDetailModule(await response.text());
    }catch(error){
      console.error("Challenge juillet 2026 non chargé",error);
      throw error;
    }
    if(transformed!==null){
      const headers=new Headers(response.headers);headers.delete("content-length");headers.delete("content-encoding");
      return new Response(transformed,{status:response.status,statusText:response.statusText,headers});
    }
    return response;
  };

  await new Promise((resolve,reject)=>{
    const script=document.createElement("script");
    script.src=new URL(`document-intake-entry-v14.js?v=${encodeURIComponent(VERSION)}-${Date.now()}`,location.href).href;
    script.async=true;
    script.onload=resolve;
    script.onerror=()=>reject(new Error("Le moteur stable TBR n’a pas pu être chargé"));
    document.head.appendChild(script);
  });
})().catch(error=>{
  console.error(error);
  const target=document.getElementById("boot-msg");
  if(target){target.className="boot-error";target.innerHTML="Le challenge juillet n’a pas pu être activé : "+(error&&error.message?error.message:error)+"<br><button onclick='location.reload()'>Réessayer</button>";}
});
