(async()=>{
  const VERSION="2026.08.02-july-challenge-safe-v23";
  if(window.__tbrJulyChallengeSafeV23)return;
  window.__tbrJulyChallengeSafeV23=true;

  const nativeFetch=window.fetch.bind(window);
  const patchedUrls=new Set();

  function patchRawApplication(html){
    if(html.includes("tbr-july-challenge-engine-v23"))return html;
    let source=html;
    const required=[];
    const replace=(before,after,label)=>{
      if(!source.includes(before)){
        required.push(label);
        return;
      }
      source=source.replace(before,after);
    };

    replace(
      "function calcCommission(v,ip){",
      "function calcCommission(v,ip,challengeJuilletOverride){\n  const challengeJuillet=typeof challengeJuilletOverride===\"boolean\"?challengeJuilletOverride:!!window.__tbrChallengeJuilletActive;",
      "entrée du calcul"
    );

    replace(
      "  const caPacksNet=caPacks-promoAbo.deductionCAHT;",
      "  const caPacksNet=challengeJuillet?caPacks:caPacks-promoAbo.deductionCAHT;",
      "abonnements courts"
    );

    replace(
      "  if(min) malus-=40;\n  const off=(v.packs||[]).filter(p=>p.statutMat===\"Offert\").length;\n  if(off>0){malus-=off*10;malusDetail.push(`${off} pack(s) offert(s) mat → -${off*10}€`);}",
      "  if(min&&!challengeJuillet) malus-=40;\n  else if(min&&challengeJuillet) malusDetail.push(\"Challenge juillet 2026 → malus Intégrale de 40 € annulé\");\n  const off=(v.packs||[]).filter(p=>p.statutMat===\"Offert\").length;\n  if(off>0&&!challengeJuillet){malus-=off*10;malusDetail.push(`${off} pack(s) offert(s) mat → -${off*10}€`);}\n  else if(off>0&&challengeJuillet) malusDetail.push(`Challenge juillet 2026 → forfait pack offert annulé : ${off*10} € récupérés`);",
      "Intégrale et packs offerts"
    );

    replace(
      "    const impRemise=remiseAboPacks*5;\n    malus-=impRemise;\n    malusDetail.push(`Remise abo pack ${remiseAboPacks}€/mois → -${impRemise}€`);",
      "    const impRemise=remiseAboPacks*(challengeJuillet?3:5);\n    malus-=impRemise;\n    malusDetail.push(challengeJuillet?`Challenge juillet 2026 → ABOX réduite : 3 € × ${remiseAboPacks} = -${impRemise} €`:`Remise abo pack ${remiseAboPacks}€/mois → -${impRemise}€`);",
      "ABOX packs"
    );

    replace(
      "  (v.codesAbo||[]).forEach(c=>{\n    const ci=CODES_ABO.find(x=>x.code===c.code);\n    const imp=ci?ci.impact:(10+(c.montant||0)*5);\n    malus-=imp;malusDetail.push(`${c.code} → -${imp}€`);\n  });",
      "  (v.codesAbo||[]).forEach(c=>{\n    const ci=CODES_ABO.find(x=>x.code===c.code);\n    const montant=Number(ci&&ci.montant!==undefined?ci.montant:(c.montant||0));\n    const imp=challengeJuillet?montant*3:(ci?ci.impact:(10+montant*5));\n    malus-=imp;\n    malusDetail.push(challengeJuillet?`${c.code} → challenge juillet 2026 : forfait 10 € annulé, 3 € × ${montant} = -${imp} €`:`${c.code} → -${imp}€`);\n  });",
      "codes ABOX"
    );

    replace(
      "    const vd=Math.max(0,actives.filter(v=>v.typeVente===\"VD\").length-aimtVD);\n    let totalCom=0;\n    const details=actives.map(v=>{const r=calcCommission(v,ip);totalCom+=r.total;return{...v,result:r};});",
      "    const vd=Math.max(0,actives.filter(v=>v.typeVente===\"VD\").length-aimtVD);\n    const challengeJuilletActive=Number(moisActif&&moisActif.annee)===2026&&Number(moisActif&&moisActif.mois)===7&&vd>=7;\n    window.__tbrChallengeJuilletActive=challengeJuilletActive;\n    let totalCom=0;\n    const details=actives.map(v=>{const r=calcCommission(v,ip,challengeJuilletActive);totalCom+=r.total;return{...v,result:r};});",
      "activation mensuelle"
    );

    replace(
      "    return{vn,vd,totalCom,pv,pvd,bsgp,totalChall,grand:totalCom+pv+pvd+bsgp+totalChall,details,ip,ann:annCourantes+aimtVD+aimtVF,annCourantes,aimtVD,aimtVF,aimtNeutres:aimtAllItems.length-aimtItems.length};",
      "    const challengeJuilletGain=challengeJuilletActive?details.reduce((sum,item)=>{const normal=calcCommission(item,ip,false);return sum+Math.max(0,Number(item.result.total||0)-Number(normal.total||0));},0):0;\n    const challengeJuilletAvant=totalCom-challengeJuilletGain+pv+pvd+bsgp+totalChall;\n    return{vn,vd,totalCom,pv,pvd,bsgp,totalChall,grand:totalCom+pv+pvd+bsgp+totalChall,details,ip,ann:annCourantes+aimtVD+aimtVF,annCourantes,aimtVD,aimtVF,aimtNeutres:aimtAllItems.length-aimtItems.length,challengeJuilletActive,challengeJuilletGain,challengeJuilletAvant};",
      "synthèse du challenge"
    );

    if(required.length){
      console.warn("Challenge juillet non injecté, points absents :",required);
      return html;
    }

    source=source.replace("</body>",`<script id="tbr-july-challenge-engine-v23">window.__tbrJulyChallengeEngineVersion=${JSON.stringify(VERSION)};<\/script></body>`);
    return source;
  }

  function patchHomePayModule(text){
    if(text.includes("tbr-july-pay-v23"))return text;
    let source=text;
    const rowAnchor='{code:"★",label:"Challenges",note:"Primes exceptionnelles saisies",value:Number(syn.totalChall||0)},';
    if(source.includes(rowAnchor)){
      source=source.replace(rowAnchor,rowAnchor+'\n    ...(syn.challengeJuilletActive?[{code:"J7",label:"Challenge juillet 2026",note:syn.vd+" VD nettes · règles appliquées à toutes les ventes",value:Number(syn.challengeJuilletGain||0),challengeJuly:true}]:[]),');
    }
    const commandAnchor='<div className="tbr-pay-total-zone">';
    if(source.includes(commandAnchor)){
      source=source.replace(commandAnchor,`{syn.challengeJuilletActive&&<button type="button" className="tbr-july-pay-v23" onClick={()=>setPayDetail("july2026")}><span>CHALLENGE JUILLET 2026 · ACTIVÉ</span><strong>+{fmt(syn.challengeJuilletGain||0)}</strong><small>{syn.vd} VD nettes · avantage appliqué à toutes les ventes du mois · voir le détail ›</small></button>}\n        ${commandAnchor}`);
    }
    const detailAnchor='  const payDetailData=payDetail==="deductions"?{';
    if(source.includes(detailAnchor)){
      source=source.replace(detailAnchor,`  const julyDetails=safeDetails.map(v=>{const normal=calcCommission(v,ip,false);const gain=Math.max(0,Number(v.result&&v.result.total||0)-Number(normal.total||0));return gain>=.01?{name:v.nomClient||"Client",num:v.numClient||"—",amount:gain,total:Number(v.result&&v.result.total||0),causes:["Commission avec challenge : "+fmt(v.result&&v.result.total||0),"Commission sans challenge : "+fmt(normal.total||0),"Gain récupéré sur ce dossier : "+fmt(gain)].concat((v.result&&v.result.malusDetail)||[])}:null;}).filter(Boolean);\n  const payDetailData=payDetail==="july2026"?{title:"Challenge juillet 2026",total:Number(syn.challengeJuilletGain||0),intro:"Le seuil de 7 VD nettes est atteint. Le calcul exceptionnel est appliqué rétroactivement à toutes les ventes de juillet 2026.",rows:julyDetails}:payDetail==="deductions"?{`);
    }
    const cssAnchor='.tbr-pay-line.is-zero{opacity:.58}';
    if(source.includes(cssAnchor)){
      source=source.replace(cssAnchor,cssAnchor+'.tbr-july-pay-v23{position:relative;z-index:2;width:100%;display:grid;grid-template-columns:1fr auto;gap:4px 14px;align-items:center;margin:18px 0 0;padding:15px 17px;border:1px solid rgba(74,222,128,.32);border-radius:20px;background:linear-gradient(135deg,rgba(6,78,59,.42),rgba(14,116,144,.30));color:#fff;text-align:left;box-shadow:0 16px 38px rgba(16,185,129,.13)}.tbr-july-pay-v23 span{color:#86efac;font-size:9px;font-weight:1000;letter-spacing:.12em}.tbr-july-pay-v23 strong{grid-row:1/3;grid-column:2;color:#86efac;font-size:24px}.tbr-july-pay-v23 small{color:#cbd5e1;font-size:9px;font-weight:800}');
    }
    return source;
  }

  window.fetch=async function(input,init){
    const response=await nativeFetch(input,init);
    try{
      const url=typeof input==="string"?input:(input&&input.url)||"";
      const value=String(url);
      if(/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[^/]+\/index\.html(?:\?|$)/i.test(value)){
        const html=patchRawApplication(await response.text());
        const headers=new Headers(response.headers);headers.delete("content-length");headers.delete("content-encoding");
        patchedUrls.add(value);
        return new Response(html,{status:response.status,statusText:response.statusText,headers});
      }
      if(/(?:^|\/)home-pay-bootstrap\.js(?:\?|$)/i.test(value)){
        const text=patchHomePayModule(await response.text());
        const headers=new Headers(response.headers);headers.delete("content-length");headers.delete("content-encoding");
        return new Response(text,{status:response.status,statusText:response.statusText,headers});
      }
    }catch(error){
      console.error("Challenge juillet 2026 : transformation ignorée pour préserver le démarrage",error);
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
  window.fetch=window.fetch||fetch;
  const target=document.getElementById("boot-msg");
  if(target){target.className="boot-error";target.innerHTML="TBR reste en mode stable : le challenge juillet n’a pas été chargé.<br><button onclick='location.reload()'>Ouvrir TBR sans risque</button>";}
});
