from pathlib import Path

path = Path('index.html')
text = path.read_text(encoding='utf-8')
original = text

old_parse = '''  function parseClientRows(p2){
    const rows=[];
    const text=(Array.isArray(p2)?p2.join(" "):String(p2||"")).replace(/\s+/g," ").trim();
    const starts=[];
    const startRx=/(?:^|\s)(-?1|0)\s+(\d{6,8})(?=\s)/g;
    let sm;
    while((sm=startRx.exec(text))!==null) starts.push({index:sm.index+(sm[0].startsWith(" ")?1:0),nb:Number(sm[1]),num:normNum(sm[2])});
    const cats="REFVD|REFVF|PURVD|PURVF|PREVD|PREVF|RMK|PURGU";
    const seen={};
    starts.forEach((st,i)=>{
      const end=i+1<starts.length?starts[i+1].index:text.length;
      const chunk=text.slice(st.index,end).replace(/^(-?1|0)\s+\d{6,8}\s+/,"").trim();
      const catMatch=chunk.match(new RegExp("\\b("+cats+")\\b","i"));
      if(!catMatch||!st.num||seen[st.num]) return;
      const catpub=catMatch[1].toUpperCase();
      const nom=chunk.slice(0,catMatch.index).replace(/TOTAL|ANNEXE.*$/gi,"").trim()||"Client";
      let tail=chunk.slice((catMatch.index||0)+catMatch[0].length).trim();
      let engagement=0;
      const eng=tail.match(/^(\d{1,2})\s*mois\b/i);
      if(eng){engagement=Number(eng[1]);tail=tail.slice(eng[0].length).trim();}
      const offerMatch=tail.match(/\b(ACQ\s*(?:start|location)|annulation_[A-Z0-9_]+)\b/i);
      const offre=offerMatch?offerMatch[1].replace(/\s+/g," "):"";
      const numericPart=offerMatch?tail.slice(0,offerMatch.index):tail;
      const nums=(numericPart.match(/-?\d+(?:[,.]\d+)?/g)||[]).map(toNum);
      if(nums.length<3) return;
      const last=nums.slice(-3);
      seen[st.num]=true;
      rows.push({nb:st.nb,num:st.num,nom,catpub,engagement,caPacks:last[0],comVente:last[1],comPacks:last[2],offre,isAnnulation:st.nb<=0||/annulation/i.test(offre)});
    });
    return rows;
  }'''

new_parse = '''  function parseClientRows(pages){
    const rows=[];
    const rawLines=Array.isArray(pages)?pages.flatMap(p=>Array.isArray(p)?p:[p]):[String(pages||"")];
    const lines=rawLines.map(x=>String(x||"").replace(/\s+/g," ").trim()).filter(Boolean);
    const cats="REFVD|REFVF|PURVD|PURVF|PREVD|PREVF|RMK|PURGU|DIS";
    const seen={};
    let current="";
    let pendingNb=null;
    const flush=()=>{
      const chunk=current.replace(/\s+/g," ").trim();
      current="";
      if(!chunk) return;
      const start=chunk.match(/^(-?1|0)\s+(\d{6,8})\s+(.*)$/);
      if(!start) return;
      const nb=Number(start[1]), num=normNum(start[2]);
      if(!num||seen[num]) return;
      const body=start[3]||"";
      const catMatch=body.match(new RegExp("\\b("+cats+")\\b","i"));
      if(!catMatch) return;
      const catpub=catMatch[1].toUpperCase();
      const nom=body.slice(0,catMatch.index).replace(/TOTAL|ANNEXE.*$/gi,"").trim()||"Client";
      let tail=body.slice((catMatch.index||0)+catMatch[0].length).trim();
      let engagement=0;
      const eng=tail.match(/^(\d{1,2})\s*mois\b/i);
      if(eng){engagement=Number(eng[1]);tail=tail.slice(eng[0].length).trim();}
      const offerMatch=tail.match(/\b(ACQ\s*(?:start|location)|annulation_[A-Z0-9_]+)\b/i);
      const offre=offerMatch?offerMatch[1].replace(/\s+/g," "):"";
      const numericPart=offerMatch?tail.slice(0,offerMatch.index):tail;
      const nums=(numericPart.match(/-?\d+(?:[,.]\d+)?/g)||[]).map(toNum);
      if(nums.length<3) return;
      const last=nums.slice(-3);
      seen[num]=true;
      rows.push({nb,num,nom,catpub,engagement,caPacks:last[0],comVente:last[1],comPacks:last[2],offre,isAnnulation:nb<=0||/annulation/i.test(offre)});
    };
    lines.forEach(line=>{
      const completeStart=line.match(/^(-?1|0)\s+(\d{6,8})(?:\s+(.*))?$/);
      if(completeStart){
        flush();
        pendingNb=null;
        current=line;
        return;
      }
      const nbOnly=line.match(/^(-?1|0)$/);
      if(nbOnly){
        flush();
        pendingNb=Number(nbOnly[1]);
        return;
      }
      const numAfterNb=pendingNb!==null?line.match(/^(\d{6,8})(?:\s+(.*))?$/):null;
      if(numAfterNb){
        current=`${pendingNb} ${numAfterNb[1]}${numAfterNb[2]?" "+numAfterNb[2]:""}`;
        pendingNb=null;
        return;
      }
      if(current) current += " " + line;
    });
    flush();
    return rows;
  }'''

if old_parse not in text:
    raise SystemExit('parseClientRows block not found')
text = text.replace(old_parse, new_parse, 1)

old_pages = '''      const p1Lines=pdf.numPages>=1?await readPageLines(pdf,1):[];
      const p2Lines=pdf.numPages>=2?await readPageLines(pdf,2):[];
      const p3Lines=pdf.numPages>=3?await readPageLines(pdf,3):[];
      const p1=p1Lines.join(" ");
      const p2=p2Lines.join(" ");
      const p3=p3Lines.join(" ");
      const summary=parseSummary(p1);
      const moisUsed=summary.moisDoc||moisDCO;
      setMoisDCO(moisUsed);
      const rows=parseClientRows(p2Lines);
      const installs=parseInstallRows(p3);'''

new_pages = '''      const allPageLines=[];
      for(let pageNo=1;pageNo<=pdf.numPages;pageNo++) allPageLines.push(await readPageLines(pdf,pageNo));
      const allText=allPageLines.map(lines=>lines.join(" ")).join(" ");
      let summary=parseSummary(allText);
      const moisUsed=summary.moisDoc||moisDCO;
      setMoisDCO(moisUsed);
      const rows=parseClientRows(allPageLines);
      const installs=parseInstallRows(allText);'''

if old_pages not in text:
    raise SystemExit('fixed page reader block not found')
text = text.replace(old_pages, new_pages, 1)

required = [
    'function parseClientRows(pages)',
    'let pendingNb=null;',
    'const numAfterNb=pendingNb!==null?',
    'const allPageLines=[];',
    'const rows=parseClientRows(allPageLines);',
    'const installs=parseInstallRows(allText);',
]
for token in required:
    if token not in text:
        raise SystemExit('missing '+token)

if text == original:
    raise SystemExit('no changes')
path.write_text(text, encoding='utf-8')
print('DCO multipage and split-number parser patch applied')
