from pathlib import Path
p=Path('index.html')
s=p.read_text(encoding='utf-8')
anchor='''      {loading&&<section className="dco-card dco-loading">JUMPER analyse ton PDF et croise avec tes ventes...</section>}'''
if 'dco-native-mail-v2' in s:
    print('native mail already installed')
    raise SystemExit(0)
if anchor not in s:
    raise SystemExit('DCO native anchor not found')
block=r'''      <section id="dco-native-mail-v2" className="dco-card" style={{border:"1px solid rgba(56,189,248,.38)",background:"linear-gradient(145deg,rgba(8,24,47,.99),rgba(31,38,78,.99))"}}>
        <div className="dco-title">✉️ Préparer ma réclamation DCO</div>
        <div className="dco-sub">Le mail reprend uniquement le contrôle actuellement chargé. Les écarts non prouvés restent « à vérifier » et ne sont pas ajoutés au montant confirmé.</div>
        <button className="dco-upload-btn" style={{width:"100%",marginTop:12,padding:"14px 16px"}} onClick={()=>{
          if(!dcoData){alert("Importe d’abord ton DCO pour préparer la réclamation.");return;}
          const alerts=getDcoAlerts(dcoData);
          const confirmed=Number(dcoData.verseEnMoins||0);
          const over=Number(dcoData.verseEnPlus||0);
          const lines=[
            "Bonjour,","",
            `Je vous demande une vérification détaillée de mon DCO de ${MOIS_NOMS[dcoData.moisUsed.mois-1]} ${dcoData.moisUsed.annee}.`,
            `Montant total du DCO : ${money(dcoData.totalDCO||0)}.`,
            `Montant actuellement confirmé comme versé en moins : ${money(confirmed)}.`,
            over>0?`Montant versé en plus identifié séparément : ${money(over)} (non compensé avec les manques).`:"",
            "","DÉTAIL DES ÉCARTS À CONTRÔLER"
          ].filter(Boolean);
          if(alerts.length){alerts.forEach((a,i)=>{lines.push(`${i+1}. ${a.title} — ${a.sub||""} — ${a.amount||""}`);if(a.detail)lines.push(`   Motif : ${a.detail}`);(a.lines||[]).forEach(x=>lines.push(`   • ${x}`));});}else lines.push("Aucun écart significatif détecté par le contrôle actuel.");
          lines.push("","Merci de vérifier chaque ligne et de régulariser tout montant effectivement dû. Pour chaque différence, merci de m’indiquer la règle de calcul appliquée.","","Cordialement,","Tarek");
          const body=lines.join("\n");
          const subject=`Vérification DCO — ${MOIS_NOMS[dcoData.moisUsed.mois-1]} ${dcoData.moisUsed.annee}${confirmed>0?` — ${money(confirmed)} à régulariser`:""}`;
          window.__tbrDcoMail={subject,body};
          const old=document.getElementById('dco-native-mail-preview-v2');if(old)old.remove();
          const wrap=document.createElement('div');wrap.id='dco-native-mail-preview-v2';wrap.style.cssText='position:fixed;inset:0;z-index:99999;background:rgba(2,6,23,.88);padding:18px;overflow:auto';
          const box=document.createElement('div');box.style.cssText='max-width:760px;margin:20px auto;background:#07111f;color:#fff;border:1px solid rgba(56,189,248,.4);border-radius:24px;padding:18px';
          const h=document.createElement('h3');h.textContent='✉️ Mail de réclamation prêt';h.style.margin='0 0 12px';
          const ta=document.createElement('textarea');ta.value=body;ta.style.cssText='width:100%;min-height:55vh;box-sizing:border-box;background:#020817;color:#e5eefb;border:1px solid #334155;border-radius:14px;padding:12px;font:13px/1.5 system-ui';
          const row=document.createElement('div');row.style.cssText='display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:10px';
          const mk=(txt)=>{const b=document.createElement('button');b.textContent=txt;b.style.cssText='border:0;border-radius:13px;padding:12px;font-weight:800';return b};
          const copy=mk('Copier');copy.onclick=async()=>{try{await navigator.clipboard.writeText(ta.value);copy.textContent='✓ Copié'}catch(e){ta.select();document.execCommand('copy')}};
          const open=mk('Ouvrir messagerie');open.onclick=()=>{location.href='mailto:?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(ta.value)};
          const close=mk('Fermer');close.onclick=()=>wrap.remove();
          row.append(copy,open,close);box.append(h,ta,row);wrap.append(box);document.body.append(wrap);
        }}>Préparer le mail détaillé</button>
      </section>

'''
s=s.replace(anchor,block+anchor,1)
p.write_text(s,encoding='utf-8')
print('native DCO mail v2 installed')
