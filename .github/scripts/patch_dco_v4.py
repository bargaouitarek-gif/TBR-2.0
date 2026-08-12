import re
from pathlib import Path

path = Path('index.html')
s = path.read_text(encoding='utf-8')
original = s

# 1) Invalidate the legacy DCO cache: its per-client rows may have been parsed from the wrong PDF pages.
old = 'const DCO_CACHE_KEY="tbr_dco_cache_v2";'
new = 'const DCO_CACHE_KEY="tbr_dco_cache_v4_source_first";'
assert old in s, 'DCO cache marker not found'
s = s.replace(old, new, 1)

# 2) Preserve PDF coordinates. The old parser flattened every page, then treated unrelated numbers as money.
marker = '  function getFirst(text,regex){'
assert marker in s, 'getFirst marker not found'
read_items = r'''  async function readPageItems(pdf,pageNo){
    const page=await pdf.getPage(pageNo);
    const tc=await page.getTextContent();
    return tc.items.map(function(it){
      const str=String(it.str||"").trim();
      const tr=it.transform||[0,0,0,0,0,0];
      return {x:Number(tr[4]||0),y:Number(tr[5]||0),str:str};
    }).filter(it=>it.str);
  }

'''
s = s.replace(marker, read_items + marker, 1)

# 3) Column-aware DCO readers for the current Verisure PDF layout.
parser_re = re.compile(r'\n  function parseClientRows\(pages\)\{.*?\n  function buildAnalysis\(summary,rows,installs,moisUsed\)\{', re.S)
parser_new = r'''
  function parseClientRows(items){
    const rows=[];
    const seen={};
    const catRx=/^(REFVD|REFVF|PURVD|PURVF|PREVD|PREVF|RMK|PURGU|DIS)$/i;
    const asNum=it=>it?toNum(it.str):0;
    const findNum=(row,x0,x1)=>row.find(it=>it.x>=x0&&it.x<x1&&/^-?\d+(?:[,.]\d+)?$/.test(it.str));
    const clients=(items||[]).filter(it=>it.x>=65&&it.x<135&&/^\d{6,8}$/.test(it.str));
    clients.forEach(c=>{
      const num=normNum(c.str);
      if(!num||seen[num]) return;
      let row=(items||[]).filter(it=>Math.abs(it.y-c.y)<=4.6);
      let cat=row.find(it=>catRx.test(it.str));
      if(!cat){row=(items||[]).filter(it=>Math.abs(it.y-c.y)<=6.8);cat=row.find(it=>catRx.test(it.str));}
      if(!cat) return;
      const caPacks=asNum(findNum(row,235,284));
      const comBase=asNum(findNum(row,284,321));
      const startVD=asNum(findNum(row,321,383));
      const minoIntegrale=asNum(findNum(row,383,455));
      const aboFixe=asNum(findNum(row,455,505));
      const aboVariable=asNum(findNum(row,505,580));
      const nbIt=row.find(it=>it.x>=38&&it.x<76&&/^-?[01]$/.test(it.str));
      const nb=nbIt?Number(nbIt.str):((comBase||startVD||caPacks)?1:0);
      const nameParts=row.filter(it=>it.x>=115&&it.x<195&&!catRx.test(it.str)&&!/^-?\d+(?:[,.]\d+)?$/.test(it.str)).map(it=>it.str);
      const nom=nameParts.join(' ').replace(/\s+/g,' ').trim()||'Client';
      const comVente=round2(comBase+startVD+minoIntegrale+aboFixe+aboVariable);
      const comPacks=round2(caPacks*0.25);
      seen[num]=true;
      rows.push({nb,num,nom,catpub:String(cat.str).toUpperCase(),engagement:0,caPacks,comVente,comPacks,offre:'',comBase,startVD,minoIntegrale,aboFixe,aboVariable,packDerived:true,isAnnulation:nb<=0});
    });
    return rows;
  }

  function parseInstallRows(items){
    const installs={};
    const clients=(items||[]).filter(it=>it.x>=75&&it.x<165&&/^\d{6,8}$/.test(it.str));
    clients.forEach(c=>{
      const row=(items||[]).filter(it=>Math.abs(it.y-c.y)<=4.8);
      const val=row.find(it=>it.x>=455&&it.x<575&&/^-?\d+(?:[,.]\d+)?$/.test(it.str));
      installs[normNum(c.str)]=val?round2(toNum(val.str)):0;
    });
    return installs;
  }

  function getPalierVDJuly2026(n){
    n=Number(n)||0;
    const p={4:700,5:900,6:1100,7:1300,8:1500,9:1700,10:1900,11:2100,12:2300,13:2500,14:2700,15:2900,16:3100,17:3300,18:3500,19:3700,20:3900};
    if(n<4) return 0;
    if(p[n]!=null) return p[n];
    return 3900+(n-20)*200;
  }

  function julyAboxDecommission(vente){
    return round2(-(vente.codesAbo||[]).reduce((sum,c)=>{
      const raw=typeof c==='string'?c:String((c&&c.code)||'');
      const m=(raw.match(/ABO(\d+)/i)||[])[1];
      const amount=typeof c==='object'&&c&&c.montant!=null?Number(c.montant):Number(m||0);
      return sum+(Number.isFinite(amount)?amount:0);
    },0)*3);
  }

  function buildAnalysis(summary,rows,installs,moisUsed){'''
s, n = parser_re.subn('\n' + parser_new, s, count=1)
assert n == 1, f'parser block replacement count={n}'

# 4) Page 1 = official totals; Annex 1 = sales; recap page = installations.
old_parse = '''      const allText=allPageLines.map(lines=>lines.join(" ")).join(" ");
      let summary=parseSummary(allText);
      const moisUsed=summary.moisDoc||moisDCO;
      setMoisDCO(moisUsed);
      const rows=parseClientRows(allPageLines);
      const installationPages=allPageLines.filter(lines=>/COMMISSION SUR INSTALLATIONS|ANNEXE[^.]{0,80}INSTALLATION|DETAILS? SUR LES INSTALLATIONS/i.test(lines.join(" ")));
      const installText=(installationPages.length?installationPages:(pdf.numPages>=3?[allPageLines[2]]:[])).map(lines=>lines.join(" ")).join(" ");
      const installs=parseInstallRows(installText);'''
new_parse = '''      const summaryText=(allPageLines[0]||[]).join(" ");
      let summary=parseSummary(summaryText);
      const moisUsed=summary.moisDoc||moisDCO;
      setMoisDCO(moisUsed);
      const salesPageIndex=allPageLines.findIndex(lines=>/ANNEXE\s*1.*DETAILS.*COMMISSIONS.*VENTES/i.test(lines.join(" ")));
      if(salesPageIndex<0) throw new Error("Annexe ventes introuvable dans le DCO.");
      const salesItems=await readPageItems(pdf,salesPageIndex+1);
      const rows=parseClientRows(salesItems);
      const recapPageIndex=allPageLines.findIndex(lines=>/R[ÉE]CAPITULATIF.*COMMISSIONS.*VENTES|COM\s+installation/i.test(lines.join(" ")));
      const installItems=recapPageIndex>=0?await readPageItems(pdf,recapPageIndex+1):[];
      const installs=parseInstallRows(installItems);'''
assert old_parse in s, 'parseDCO source block not found'
s = s.replace(old_parse, new_parse, 1)

# 5) Never overwrite page-1 official totals with a derived table if the source already provides them.
old_sum = '''      if(sumComVentes) summary.comVentes=sumComVentes;
      if(sumComPacks) summary.comPacks=sumComPacks;
      if(sumInstalls) summary.comInstall=sumInstalls;'''
new_sum = '''      if(!summary.comVentes && sumComVentes) summary.comVentes=sumComVentes;
      if(!summary.comPacks && sumComPacks) summary.comPacks=sumComPacks;
      if(!summary.comInstall && sumInstalls) summary.comInstall=sumInstalls;'''
assert old_sum in s, 'summary override block not found'
s = s.replace(old_sum, new_sum, 1)

# 6) July 2026 VD booster replaces the standard VD palier.
old_palier = '    const palierVDTbr=getPalierVD(tbrVD);'
new_palier = '    const sourceFirstJuly=moisUsed.annee===2026&&moisUsed.mois===7;\n    const palierVDTbr=sourceFirstJuly?getPalierVDJuly2026(tbrVD):getPalierVD(tbrVD);'
assert old_palier in s, 'palier VD line not found'
s = s.replace(old_palier, new_palier, 1)

# 7) July special: >=5 VD cancels legacy fixed decommissions; ABOX variable becomes 3 €/€.
old_penalty = '      const offeredPackPenalty=round2(-10*offeredPackCount);'
new_penalty = '''      const julySpecial=moisUsed.annee===2026&&moisUsed.mois===7&&tbrVD>=5;
      const offeredPackPenalty=julySpecial?0:round2(-10*offeredPackCount);'''
assert s.count(old_penalty) >= 2, 'offered pack penalty markers not found'
s = s.replace(old_penalty, new_penalty)
old_other = '      const otherMalus=round2((r.malus||0)-offeredPackPenalty);'
new_other = '      const otherMalus=julySpecial?julyAboxDecommission(vente):round2((r.malus||0)-offeredPackPenalty);'
assert s.count(old_other) >= 2, 'other malus markers not found'
s = s.replace(old_other, new_other)

# 8) Safety: client model differences are evidence to verify in July, not automatic money claims.
old_claim = '''      verseEnMoins:round2(clientVerseEnMoins+globalVerseEnMoins),
      verseEnPlus:round2(clientVerseEnPlus+globalVerseEnPlus),'''
new_claim = '''      verseEnMoins:sourceFirstJuly?round2(globalVerseEnMoins):round2(clientVerseEnMoins+globalVerseEnMoins),
      verseEnPlus:sourceFirstJuly?round2(globalVerseEnPlus):round2(clientVerseEnPlus+globalVerseEnPlus),
      clientVerseEnMoinsAControler:clientVerseEnMoins,
      clientVerseEnPlusAControler:clientVerseEnPlus,
      sourceFirst:sourceFirstJuly,'''
assert old_claim in s, 'claim totals block not found'
s = s.replace(old_claim, new_claim, 1)

# 9) Native visible UI marker and safer vocabulary.
old_hero = '''<div className="v8-eyebrow">Contrôle paie</div>
          <h2>Importe ton DCO, TBR détecte le mois et compare avec tes saisies.</h2>
          <p>Le contrôle sépare les écarts fiables, les packs et les commissions vente à vérifier.</p>'''
new_hero = '''<div className="v8-eyebrow">DCO Expert 4.0 · NATIF · SOURCE-FIRST</div>
          <h2>Ce qui est confirmé, ce qui est à vérifier, et ce qui est réellement réclamable.</h2>
          <p>Le PDF officiel reste la source de paiement. TBR n’annonce jamais une somme à réclamer à partir d’une donnée client incertaine.</p>'''
assert old_hero in s, 'DCO hero not found'
s = s.replace(old_hero, new_hero, 1)
s = s.replace('<span>versé en moins</span>', '<span>manque confirmé</span>', 1)
s = s.replace('<span>versé en plus</span>', '<span>versé en plus confirmé</span>', 1)
s = s.replace('Somme de toutes les lignes négatives, sans compensation avec les montants versés en plus.', 'Uniquement les écarts appuyés par une règle source fiable. Les divergences client restent à vérifier séparément.', 1)
s = s.replace('Somme de toutes les lignes positives, affichée séparément.', 'Affiché séparément : un trop-versé ne compense jamais un manque confirmé.', 1)

hook = '<div className="dco-howto">\n              <b>Comment lire :</b>'
assert hook in s, 'howto hook not found'
s = s.replace(hook, '<div className="dco-source-first-note"><b>Source-first :</b> les écarts client calculés à partir de tes saisies sont des pistes de contrôle. Ils ne sont pas transformés automatiquement en créance.</div>\n            ' + hook, 1)

assert s != original, 'No changes produced'
path.write_text(s, encoding='utf-8')
print('Native DCO 4.0 patch prepared successfully')
