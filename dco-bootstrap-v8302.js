(async()=>{
  const BASE="./app-base-dco-v8301.html";
  const status=document.getElementById("boot-msg");
  const fail=msg=>{throw new Error(msg);};
  let html="";
  const res=await fetch(BASE+"?v=8302",{cache:"no-store"});
  if(!res.ok) fail("Base TBR indisponible");
  html=await res.text();

  const parserPattern=/  function parseClientRows\(p2\)\{[\s\S]*?\n  \}\n\n  function parseInstallRows/;
  if(!parserPattern.test(html)) fail("Lecteur clients introuvable");
  const parser=`  function parseClientRows(pages){
    const rows=[];
    const rawLines=Array.isArray(pages)?pages.flatMap(p=>Array.isArray(p)?p:[p]):[String(pages||"")];
    const lines=rawLines.map(x=>String(x||"").replace(/\\s+/g," ").trim()).filter(Boolean);
    const cats="REFVD|REFVF|PURVD|PURVF|PREVD|PREVF|RMK|PURGU|DIS";
    const seen={};
    let current="";
    let pendingNb=null;
    const flush=()=>{
      const chunk=current.replace(/\\s+/g," ").trim();
      current="";
      if(!chunk) return;
      const start=chunk.match(/^(-?1|0)\\s+(\\d{6,8})\\s+(.*)$/);
      if(!start) return;
      const nb=Number(start[1]),num=normNum(start[2]);
      if(!num||seen[num]) return;
      const body=start[3]||"";
      const catMatch=body.match(new RegExp("\\\\b("+cats+")\\\\b","i"));
      if(!catMatch) return;
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
      if(nums.length<3) return;
      const last=nums.slice(-3);
      seen[num]=true;
      rows.push({nb,num,nom,catpub,engagement,caPacks:last[0],comVente:last[1],comPacks:last[2],offre,isAnnulation:nb<=0||/annulation/i.test(offre)});
    };
    lines.forEach(line=>{
      const completeStart=line.match(/^(-?1|0)\\s+(\\d{6,8})(?:\\s+(.*))?$/);
      if(completeStart){flush();pendingNb=null;current=line;return;}
      const nbOnly=line.match(/^(-?1|0)$/);
      if(nbOnly){flush();pendingNb=Number(nbOnly[1]);return;}
      const numAfterNb=pendingNb!==null?line.match(/^(\\d{6,8})(?:\\s+(.*))?$/):null;
      if(numAfterNb){current=\\`${'${pendingNb}'} ${'${numAfterNb[1]}'}${'${numAfterNb[2]?" "+numAfterNb[2]:""}'}\\`;pendingNb=null;return;}
      if(current) current += " " + line;
    });
    flush();
    return rows;
  }

  function parseInstallRows`;
  html=html.replace(parserPattern,parser);

  const pagesPattern=/      const p1Lines=pdf\.numPages>=1\?await readPageLines\(pdf,1\):\[\];[\s\S]*?      const installs=parseInstallRows\(p3\);/;
  if(!pagesPattern.test(html)) fail("Lecture fixe des pages introuvable");
  html=html.replace(pagesPattern,`      const allPageLines=[];
      for(let pageNo=1;pageNo<=pdf.numPages;pageNo++) allPageLines.push(await readPageLines(pdf,pageNo));
      const allText=allPageLines.map(lines=>lines.join(" ")).join(" ");
      const summary=parseSummary(allText);
      const moisUsed=summary.moisDoc||moisDCO;
      setMoisDCO(moisUsed);
      const rows=parseClientRows(allPageLines);
      const installs=parseInstallRows(allText);`);

  html=html.replace('const APP_VERSION = "8.30.1-aimt-rules";','const APP_VERSION = "8.30.2-dco-multiline";');
  html=html.split("2.1-ai-memory-20260719").join("2.2-dco-multiline-20260724");

  const required=[
    "function parseClientRows(pages)",
    "let pendingNb=null;",
    "const allPageLines=[];",
    "const rows=parseClientRows(allPageLines);",
    "const installs=parseInstallRows(allText);"
  ];
  required.forEach(token=>{if(!html.includes(token))fail("Validation incomplète : "+token);});

  document.open();
  document.write(html);
  document.close();
})().catch(err=>{
  console.error(err);
  const el=document.getElementById("boot-msg");
  if(el){el.className="msg err";el.textContent="La copie test n’a pas pu charger le correctif DCO : "+(err&&err.message?err.message:err);}
});
