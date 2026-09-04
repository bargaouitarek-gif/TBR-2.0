from pathlib import Path

p = Path('index.html')
s = p.read_text(encoding='utf-8')

marker = "  const prevMois=()=>setMoisActif(m=>m.mois===1?{annee:m.annee-1,mois:12}:{...m,mois:m.mois-1});"
if marker not in s:
    raise SystemExit('marker prevMois introuvable')

fn = r'''  const exportDiagnostic=()=>{
    const clone=(v)=>{try{return JSON.parse(JSON.stringify(v));}catch(_){return v;}};
    const commissions=(syn.details||[]).map(v=>({
      id:v.id||null,
      numClient:v.numClient||v.numeroClient||v.num||v.clientNum||"",
      nomClient:v.nomClient||v.nom||v.client||"",
      typeVente:v.typeVente||v.catpub||"",
      dateVente:v.dateVente||v.date||"",
      installation:!!v.installation,
      annulation:!!v.annulation,
      partenaire:!!(v.partenaire||(v.result&&v.result.partner)),
      commission:clone(v.result||{})
    }));
    const diagnostic={
      meta:{
        mois:`${moisActif.annee}-${String(moisActif.mois).padStart(2,'0')}`,
        dateExport:new Date().toISOString(),
        versionTBR:"TBR 2.0",
        mode:"lecture-seule-localStorage"
      },
      donneesBrutes:{
        ventes:clone(ventes),
        challenges:clone(challenges),
        aimt:clone(aimt),
        agent:clone(agent),
        configMois:clone(moisConfig)
      },
      calculsTBR:{
        ip:syn.ip,
        volumes:{vn:syn.vn,vd:syn.vd,ann:syn.ann,annCourantes:syn.annCourantes,aimtVD:syn.aimtVD,aimtVF:syn.aimtVF,aimtNeutres:syn.aimtNeutres},
        paliers:{vn:syn.pv,vd:syn.pvd},
        bonusSGP:syn.bsgp,
        totalChall:syn.totalChall,
        totalCommissions:syn.totalCom,
        totalAccueil:syn.grand,
        commissions
      }
    };
    const blob=new Blob([JSON.stringify(diagnostic,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=`tbr-diagnostic-${moisActif.annee}-${String(moisActif.mois).padStart(2,'0')}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  };

'''
s = s.replace(marker, fn + marker, 1)

ui_marker = '          <div style={{fontSize:12,color:"#6B7280",fontWeight:800}}>Suivi mensuel</div>'
if ui_marker not in s:
    raise SystemExit('marker UI Suivi mensuel introuvable')
ui = '''          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
            <div style={{fontSize:12,color:"#6B7280",fontWeight:800}}>Suivi mensuel</div>
            <button onClick={exportDiagnostic} style={{background:"rgba(56,189,248,.12)",border:"1px solid rgba(56,189,248,.28)",borderRadius:12,padding:"7px 10px",fontWeight:900,color:"#0ea5e9",fontSize:11}}>Export diagnostic</button>
          </div>'''
s = s.replace(ui_marker, ui, 1)

p.write_text(s, encoding='utf-8')
print('Export diagnostic injecté dans index.html')
