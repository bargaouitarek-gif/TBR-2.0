(async()=>{
  const VERSION="2026.07.26-partner-bonus-v11";
  const response=await fetch(`pay-detail-bootstrap.js?v=${encodeURIComponent(VERSION)}`,{cache:"no-store"});
  if(!response.ok) throw new Error("Module de détail de paye indisponible");
  let source=await response.text();

  source=source.replace('const VERSION="2026.07.26-pay-details-v9";','const VERSION="'+VERSION+'";');

  const homeLoadAnchor='  let source=await response.text();';
  const homeLoadPatch=`  let source=await response.text();
  const tbrSaleBefore='    acc.sales+=Number(r.kit||0)+Number(r.partnerSale||0);';
  const tbrSaleAfter='    const partnerSale=Number(r.partnerSale||0);\\n    const saleCommission=partnerSale!==0?partnerSale:Number(r.kit||0);\\n    acc.sales+=saleCommission;';
  if(!source.includes(tbrSaleBefore)) throw new Error("Somme des commissions ventes introuvable");
  source=source.replace(tbrSaleBefore,tbrSaleAfter);
  const tbrBonusBefore='    acc.vdBonus+=Number(r.bonus||0);';
  const tbrBonusAfter='    acc.vdBonus+=partnerSale!==0?0:Number(r.bonus||0);';
  if(!source.includes(tbrBonusBefore)) throw new Error("Somme des bonus ventes introuvable");
  source=source.replace(tbrBonusBefore,tbrBonusAfter);
  const tbrInstallBefore='    acc.install+=Number(r.install||0)+Number(r.partnerInstall||0);';
  const tbrInstallAfter='    const partnerInstall=Number(r.partnerInstall||0);\\n    const installCommission=partnerInstall!==0?partnerInstall:Number(r.install||0);\\n    acc.install+=installCommission;';
  if(!source.includes(tbrInstallBefore)) throw new Error("Somme des commissions installation introuvable");
  source=source.replace(tbrInstallBefore,tbrInstallAfter);`;
  if(!source.includes(homeLoadAnchor)) throw new Error("Chargement du tableau de paye introuvable");
  source=source.replace(homeLoadAnchor,homeLoadPatch);

  const classifiedBefore='    const classified=Number(r.kit||0)+Number(r.partnerSale||0)+Number(r.bonus||0)+Number(r.packs||0)+Number(r.install||0)+Number(r.partnerInstall||0)+Number(r.malus||0);';
  const classifiedAfter='    const partnerSale=Number(r.partnerSale||0);\\n    const saleCommission=partnerSale!==0?partnerSale:Number(r.kit||0);\\n    const saleBonus=partnerSale!==0?0:Number(r.bonus||0);\\n    const partnerInstall=Number(r.partnerInstall||0);\\n    const installCommission=partnerInstall!==0?partnerInstall:Number(r.install||0);\\n    const classified=saleCommission+saleBonus+Number(r.packs||0)+installCommission+Number(r.malus||0);';
  if(!source.includes(classifiedBefore)) throw new Error("Ventilation client du détail de paye introuvable");
  source=source.replace(classifiedBefore,classifiedAfter);

  const pascaline={kit:155,partnerSale:155,bonus:100,packs:0,install:0,partnerInstall:0,malus:0,total:155};
  const pascalineSale=pascaline.partnerSale!==0?pascaline.partnerSale:pascaline.kit;
  const pascalineBonus=pascaline.partnerSale!==0?0:pascaline.bonus;
  const pascalineInstall=pascaline.partnerInstall!==0?pascaline.partnerInstall:pascaline.install;
  const pascalineClassified=pascalineSale+pascalineBonus+pascaline.packs+pascalineInstall+pascaline.malus;
  if(pascalineClassified!==pascaline.total) throw new Error("Le bonus partenaire de Pascaline reste compté à tort");

  try{localStorage.setItem("cc_version",VERSION);}catch(e){}
  (0,eval)(source);
})().catch(error=>{
  console.error(error);
  const target=document.getElementById("boot-msg");
  if(target){target.className="boot-error";target.textContent="TBR n’a pas pu corriger le détail de la paye : "+(error&&error.message?error.message:error);}
});