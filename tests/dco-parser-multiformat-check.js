const parser=require('../tbr-dco-parser.js');

const it=(x,y,str)=>({x,y,str:String(str)});
function compactFixture(){
  const sales=[
    it(44,100,1),it(66,100,2200592),it(160,100,'Doyen'),it(220,100,'PURVD'),it(274,100,12),it(286,100,'mois'),it(340,100,0),it(374,100,195),it(418,100,-20),
    it(44,120,1),it(66,120,2200708),it(135,120,'Noirault'),it(165,120,'Massol'),it(220,120,'REFVD'),it(274,120,36),it(286,120,'mois'),it(329,120,'99,5'),it(374,120,305),it(410,120,'24,88')
  ];
  const installs=[it(70,100,2200708),it(202,100,'Noirault'),it(232,100,'Massol'),it(319,100,40)];
  return{
    pageLines:[['Page 1'],['ANNEXE 1 – DETAILS SUR LES COMMISSIONS DES VENTES (avant IP)','CA base one shot €','COM vente €','COM Packs €'],['ANNEXE 2 – DETAILS SUR LES COMMISSIONS DES INSTALLATIONS']],
    pageItemsByIndex:{1:sales,2:installs},
    summary:{vNettes:2,comVentes:500,comPacks:4.88,comInstall:40}
  };
}
function detailedFixture(){
  const sales=[
    it(63,100,1),it(78,100,2223533),it(160,100,'TEST A'),it(230,100,'DIS'),it(261,100,0),it(297,100,100),it(353,100,0),it(430,100,0),it(482,100,0),it(547,100,0),
    it(63,120,1),it(78,120,2224986),it(160,120,'TEST B'),it(230,120,'PURVD'),it(261,120,98),it(297,120,110),it(353,120,100),it(430,120,0),it(482,120,0),it(547,120,-30),
    it(63,136,0),it(78,140,2009306),it(160,136,'MULTI'),it(160,144,'LINE'),it(230,140,'PREVD'),it(261,136,0),it(297,136,0),it(353,136,0),it(430,136,0),it(482,136,0),it(547,136,0)
  ];
  const recap=[
    it(85,100,1),it(122,100,2223533),it(180,100,'TEST A'),it(275,100,'DIS'),it(360,100,100),it(437,100,0),it(542,100,55),
    it(85,120,1),it(122,120,2224986),it(180,120,'TEST B'),it(260,120,'PURVD'),it(360,120,110),it(437,120,0),it(542,120,40),
    it(85,136,0),it(122,140,2009306),it(180,136,'MULTI'),it(180,144,'LINE'),it(260,140,'PREVD'),it(360,136,0),it(437,136,0),it(542,136,0)
  ];
  return{
    pageLines:[['Page 1'],['ANNEXE 1 – DETAILS SUR LES COMMISSIONS DES VENTES (avant IP)','CA Packs €','COM vente €','Start VD','Mino Intégrale','ABO fixe','ABO variable'],['ANNEXE 2 – DETAILS SUR LES COMMISSIONS DES PACKS'],['ANNEXE 3 – Récapitulatif des commissions sur les ventes','COM vente € COM Packs € COM installation €']],
    pageItemsByIndex:{1:sales,3:recap},
    summary:{vNettes:2,comVentes:280,comPacks:24.5,comInstall:95}
  };
}

const checks=[];
const compact=parser.parseDocument(compactFixture());
checks.push(
  ['parser runtime 1.0.0',parser.VERSION==='1.0.0'],
  ['compact schema detected',compact.schema.format==='compact'],
  ['compact reads direct sale commission',compact.rows.find(x=>x.num==='2200708').comVente===305],
  ['compact reads direct pack commission',compact.rows.find(x=>x.num==='2200708').comPacks===24.88],
  ['compact preserves negative pack amount',compact.rows.find(x=>x.num==='2200592').comPacks===-20],
  ['compact reads installation annex',compact.installs['2200708']===40],
  ['compact integrity passes when totals reconcile',compact.integrity.claimSafe===true]
);
const badCompact=compactFixture();badCompact.summary.comVentes=600;
checks.push(['summary/detail mismatch blocks claim',parser.parseDocument(badCompact).integrity.claimSafe===false]);

const detailed=parser.parseDocument(detailedFixture());
checks.push(
  ['detailed schema detected',detailed.schema.format==='detailed'],
  ['detailed sale adds Start VD and ABO adjustments',detailed.rows.find(x=>x.num==='2224986').comVente===180],
  ['detailed pack keeps 25 percent source rule',detailed.rows.find(x=>x.num==='2224986').comPacks===24.5],
  ['detailed installation comes from recap page',detailed.installs['2223533']===55&&detailed.installs['2224986']===40],
  ['multiline zero-Nb row stays zero and non-active',detailed.rows.find(x=>x.num==='2009306').nb===0&&detailed.rows.find(x=>x.num==='2009306').isAnnulation===true],
  ['detailed integrity passes',detailed.integrity.claimSafe===true]
);
checks.push(['unknown format rejected safely',parser.detect([['random PDF']]).format==='unknown']);

let failed=false;
for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} - ${name}`);if(!ok)failed=true;}
if(failed)process.exit(1);
console.log('PASS - DCO multi-format parser');
