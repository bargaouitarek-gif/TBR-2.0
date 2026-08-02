(async()=>{
  const VERSION="2026.08.02-july-challenge-v18";
  if(window.__tbrJulyChallengeEntryLoaded) return;
  window.__tbrJulyChallengeEntryLoaded=true;

  const originalFetch=window.fetch.bind(window);
  window.fetch=async function(input,init){
    const response=await originalFetch(input,init);
    const url=typeof input==="string"?input:(input&&input.url)||"";
    if(!String(url).includes("dco-audit-bootstrap.js")) return response;

    let source=await response.text();
    const replaceOnce=(before,after,label)=>{
      if(!source.includes(before)) throw new Error(label+" introuvable");
      source=source.replace(before,after);
    };

    replaceOnce('function calcCommission(v,ip){','function calcCommission(v,ip,challengeJuilletOverride){\n  const challengeJuillet=typeof challengeJuilletOverride==="boolean"?challengeJuilletOverride:!!window.__tbrChallengeJuilletActive;',"Entrée du calcul de commission");
    replaceOnce('  const caPacksNet=caPacks-promoAbo.deductionCAHT;','  const caPacksNet=challengeJuillet?caPacks:caPacks-promoAbo.deductionCAHT;',"Malus abonnement court");
    replaceOnce('  if(min) malus-=40;\n  const off=(v.packs||[]).filter(p=>p.statutMat==="Offert").length;\n  if(off>0){malus-=off*10;malusDetail.push(`${off} pack(s) offert(s) mat → -${off*10}€`);}','  if(min&&!challengeJuillet) malus-=40;\n  else if(min&&challengeJuillet) malusDetail.push("Challenge juillet → malus Intégrale de 40€ annulé");\n  const off=(v.packs||[]).filter(p=>p.statutMat==="Offert").length;\n  if(off>0&&!challengeJuillet){malus-=off*10;malusDetail.push(`${off} pack(s) offert(s) mat → -${off*10}€`);}\n  else if(off>0&&challengeJuillet) malusDetail.push(`Challenge juillet → forfait pack offert annulé (${off*10}€ récupérés)`);',"Malus Intégrale et packs offerts");
    replaceOnce('    const impRemise=remiseAboPacks*5;\n    malus-=impRemise;\n    malusDetail.push(`Remise abo pack ${remiseAboPacks}€/mois → -${impRemise}€`);','    const impRemise=remiseAboPacks*(challengeJuillet?3:5);\n    malus-=impRemise;\n    malusDetail.push(challengeJuillet?`Challenge juillet → pénalité ABOX réduite à 3€ × ${remiseAboPacks} = -${impRemise}€`:`Remise abo pack ${remiseAboPacks}€/mois → -${impRemise}€`);',"Pénalité ABOX des packs");
    replaceOnce('  (v.codesAbo||[]).forEach(c=>{\n    const ci=CODES_ABO.find(x=>x.code===c.code);\n    const imp=ci?ci.impact:(10+(c.montant||0)*5);\n    malus-=imp;malusDetail.push(`${c.code} → -${imp}€`);\n  });','  (v.codesAbo||[]).forEach(c=>{\n    const ci=CODES_ABO.find(x=>x.code===c.code);\n    const montant=Number(ci?ci.montant:(c.montant||0));\n    const imp=challengeJuillet?montant*3:(ci?ci.impact:(10+montant*5));\n    malus-=imp;\n    malusDetail.push(challengeJuillet?`${c.code} → challenge juillet : forfait 10€ annulé, pénalité 3€ × ${montant} = -${imp}€`:`${c.code} → -${imp}€`);\n  });',"Codes ABOX");
    replaceOnce('    const vd=Math.max(0,actives.filter(v=>v.typeVente==="VD").length-aimtVD);\n    let totalCom=0;\n    const details=actives.map(v=>{const r=calcCommission(v,ip);totalCom+=r.total;return{...v,result:r};});','    const vd=Math.max(0,actives.filter(v=>v.typeVente==="VD").length-aimtVD);\n    const challengeJuilletActive=Number(moisActif&&moisActif.annee)===2026&&Number(moisActif&&moisActif.mois)===7&&vd>=7;\n    window.__tbrChallengeJuilletActive=challengeJuilletActive;\n    let totalCom=0;\n    const details=actives.map(v=>{const r=calcCommission(v,ip,challengeJuilletActive);totalCom+=r.total;return{...v,result:r};});',"Activation mensuelle du challenge");
    replaceOnce('    return{vn,vd,totalCom,pv,pvd,bsgp,totalChall,grand:totalCom+pv+pvd+bsgp+totalChall,details,ip,ann:annCourantes+aimtVD+aimtVF,annCourantes,aimtVD,aimtVF,aimtNeutres:aimtAllItems.length-aimtItems.length};','    const challengeJuilletGain=details.reduce((sum,item)=>{const normal=calcCommission(item,ip,false);return sum+Math.max(0,Number(item.result.total||0)-Number(normal.total||0));},0);\n    return{vn,vd,totalCom,pv,pvd,bsgp,totalChall,grand:totalCom+pv+pvd+bsgp+totalChall,details,ip,ann:annCourantes+aimtVD+aimtVF,annCourantes,aimtVD,aimtVF,aimtNeutres:aimtAllItems.length-aimtItems.length,challengeJuilletActive,challengeJuilletGain};',"Synthèse du challenge");

    const dcoVdAnchor='    const tbrVD=Math.max(0,tbrVDBase-externalAimtVD);';
    if(source.includes(dcoVdAnchor)) source=source.replace(dcoVdAnchor,dcoVdAnchor+'\n    window.__tbrChallengeJuilletActive=Number(moisUsed&&moisUsed.annee)===2026&&Number(moisUsed&&moisUsed.mois)===7&&tbrVD>=7;');

    return new Response(source,{status:response.status,statusText:response.statusText,headers:response.headers});
  };

  await new Promise((resolve,reject)=>{
    const script=document.createElement("script");
    script.src=new URL(`document-intake-entry-v14.js?v=${encodeURIComponent(VERSION)}`,location.href).href;
    script.onload=resolve;
    script.onerror=()=>reject(new Error("Moteur TBR indisponible"));
    document.head.appendChild(script);
  });
})().catch(error=>{
  console.error(error);
  const target=document.getElementById("boot-msg");
  if(target){target.className="boot-error";target.textContent="TBR n’a pas pu activer le challenge juillet : "+(error&&error.message?error.message:error);}
});