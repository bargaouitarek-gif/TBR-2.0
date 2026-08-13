from pathlib import Path
import re

p=Path('index.html')
s=p.read_text(encoding='utf-8')
start='      <section id="dco-native-mail-v2"'
end='      {loading&&<section className="dco-card dco-loading">JUMPER analyse ton PDF et croise avec tes ventes...</section>}'
if start not in s or end not in s:
    raise SystemExit('Native DCO mail anchors not found')

a=s.index(start)
b=s.index(end,a)
block=r'''      <section id="dco-native-mail-v2" className="dco-card" style={{border:"1px solid rgba(56,189,248,.38)",background:"linear-gradient(145deg,rgba(8,24,47,.99),rgba(31,38,78,.99))"}}>
        <div className="dco-title">✉️ Préparer ma réclamation DCO</div>
        <div className="dco-sub">Mail lisible : uniquement les écarts en ta défaveur, classés par client et par rémunération.</div>
        <button className="dco-upload-btn" style={{width:"100%",marginTop:12,padding:"14px 16px"}} onClick={()=>{
          if(!dcoData){alert("Importe d’abord ton DCO pour préparer la réclamation.");return;}
          const alerts=getDcoAlerts(dcoData);
          const moneyN=v=>`${Math.abs(Number(v)||0).toLocaleString("fr-FR",{minimumFractionDigits:2,maximumFractionDigits:2})} €`;
          const shortageRows=[];
          const parseLine=(line,client)=>{
            const m=String(line||"").match(/^(.+?)\s*:\s*DCO\s*(-?\d+(?:[.,]\d+)?)\s*€?\s*·\s*TBR\s*(-?\d+(?:[.,]\d+)?)\s*€?\s*·\s*écart\s*([+-]?\d+(?:[.,]\d+)?)\s*€?/i);
            if(!m)return;
            const label=m[1].trim();
            const paid=Number(m[2].replace(',','.'));
            const expected=Number(m[3].replace(',','.'));
            const diff=Number(m[4].replace(',','.'));
            if(!(diff<0))return;
            const missing=Math.abs(diff);
            let nature=label;
            let why="Le montant versé est inférieur au montant attendu pour cette rémunération.";
            if(/pack/i.test(label)){nature="Rémunération Packs";why="La rémunération des packs apparaît inférieure au montant attendu. Merci de vérifier les packs pris en compte et la règle de calcul appliquée.";}
            else if(/install/i.test(label)){nature="Installation";why=`L’installation a été rémunérée ${moneyN(paid)} au lieu des ${moneyN(expected)} attendus.`;}
            else if(/commission|vente/i.test(label)){nature="Commission sur la vente";why=`La commission versée est de ${moneyN(paid)} au lieu des ${moneyN(expected)} attendus. Merci de vérifier le barème appliqué à cette vente.`;}
            else if(/challenge|booster|bonus/i.test(label)){nature=label;why=`Cette rémunération a été versée ${moneyN(paid)} au lieu des ${moneyN(expected)} attendus. Merci de vérifier la règle appliquée.`;}
            shortageRows.push({...client,nature,paid,expected,missing,why});
          };
          alerts.forEach(a=>{
            const title=String(a.title||"").trim();
            const sub=String(a.sub||"").trim();
            const num=(sub.match(/(?:N°|n°|client\s*n°?)\s*([0-9]+)/i)||title.match(/(?:N°|n°|client\s*n°?)\s*([0-9]+)/i)||[])[1]||"";
            const type=(sub.match(/\b(PURVD|PREVD|RMK|DIS|VD|VAD)\b/i)||[])[1]||"";
            const name=title.replace(/\s*[—-]\s*(?:N°|n°|client\s*n°?).*$/i,"").trim();
            const client={name,num,type};
            (a.lines||[]).forEach(x=>parseLine(x,client));
          });
          const total=shortageRows.reduce((sum,r)=>sum+r.missing,0);
          const month=`${MOIS_NOMS[dcoData.moisUsed.mois-1]} ${dcoData.moisUsed.annee}`;
          const lines=["Bonjour,","",`Après vérification de mon DCO de ${month}, j’ai identifié plusieurs rémunérations qui semblent avoir été versées pour un montant inférieur à celui attendu.`,"","Je vous transmets ci-dessous uniquement les écarts en ma défaveur, dossier par dossier et par type de rémunération.",""];
          if(!shortageRows.length){lines.push("Aucun montant versé en moins n’a été identifié dans les écarts actuellement analysables.");}
          else{
            const groups=[];
            shortageRows.forEach(r=>{let g=groups.find(x=>x.name===r.name&&x.num===r.num);if(!g){g={name:r.name,num:r.num,type:r.type,rows:[]};groups.push(g);}g.rows.push(r);});
            groups.forEach((g,i)=>{
              lines.push(`${i+1}. ${g.name||"Client"}${g.num?` — Client n° ${g.num}`:""}${g.type?` — ${g.type}`:""}`,"");
              let gt=0;
              g.rows.forEach(r=>{gt+=r.missing;lines.push(r.nature,`Montant versé : ${moneyN(r.paid)}`,`Montant attendu : ${moneyN(r.expected)}`,`Montant manquant : ${moneyN(r.missing)}`,`Pourquoi : ${r.why}`,"");});
              lines.push(`Total manquant à vérifier sur ce dossier : ${moneyN(gt)}`,"","---","");
            });
            lines.push("RÉCAPITULATIF DES MONTANTS EN MA DÉFAVEUR","");
            shortageRows.forEach(r=>lines.push(`${r.name||"Client"}${r.num?` — n° ${r.num}`:""} — ${r.nature} : ${moneyN(r.missing)}`));
            lines.push("",`TOTAL DES ÉCARTS EN MA DÉFAVEUR À VÉRIFIER : ${moneyN(total)}`);
          }
          lines.push("","Je vous remercie de vérifier ces éléments dossier par dossier et rubrique par rubrique, et de me préciser pour chaque différence le barème ou la règle de rémunération appliqué(e).","","Lorsque ces écarts correspondent effectivement à des rémunérations qui auraient dû m’être versées, je vous remercie de procéder à leur régularisation.","","Cordialement,","Tarek");
          const body=lines.join("\n");
          const subject=`Demande de vérification et de régularisation — DCO ${month}`;
          window.__tbrDcoMail={subject,body,total,shortageRows};
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
s=s[:a]+block+s[b:]
p.write_text(s,encoding='utf-8')
print('native DCO shortage-only mail updated')
