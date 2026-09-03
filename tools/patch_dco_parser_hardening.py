from pathlib import Path

def one(s,a,b,label):
    n=s.count(a)
    if n!=1: raise SystemExit(f'{label}: expected 1 got {n}')
    return s.replace(a,b,1)

p=Path('tbr-dco-parser.js'); s=p.read_text()
s=one(s,'.sort((a,b)=>Number(a.y)-Number(b.y)||Number(a.x)-Number(b.x))','.sort((a,b)=>Number(b.y)-Number(a.y)||Number(a.x)-Number(b.x))','pdfjs name order')
s=one(s,'isAnnulation:nb<0','isAnnulation:nb<=0','zero nb non-active')
s=one(s,"filter(x=>/ANNEXE\\s*1.*DETAILS.*COMMISSIONS.*VENTES/i.test(x.t))","filter(x=>/DETAILS\\s+SUR\\s+LES\\s+COMMISSIONS\\s+DES\\s+VENTES/i.test(x.t))",'sales heading independent annex')
s=one(s,"const installDetails=texts.findIndex(t=>/DETAILS.*COMMISSIONS.*INSTALLATIONS/i.test(t));","const installDetails=texts.findIndex(t=>/DETAILS\\s+SUR\\s+LES\\s+COMMISSIONS\\s+DES\\s+INSTALLATIONS/i.test(t));",'install heading')
s=one(s,"const packsDetails=texts.findIndex(t=>/ANNEXE\\s*2.*DETAILS.*COMMISSIONS.*PACKS/i.test(t));","const packsDetails=texts.findIndex(t=>/DETAILS\\s+SUR\\s+LES\\s+COMMISSIONS\\s+DES\\s+PACKS/i.test(t));",'packs heading independent annex')
s=one(s,"""  const netRows=sum((rows||[]).map(r=>Number(r.nb)||0));
  const saleDetail""","""  const grossRows=sum((rows||[]).map(r=>Math.max(0,Number(r.nb)||0)));
  const annulRows=sum((rows||[]).map(r=>Math.min(0,Number(r.nb)||0)));
  const netRows=sum((rows||[]).map(r=>Number(r.nb)||0));
  const saleDetail""",'volume totals')
s=one(s,"""  if(Number(summary?.vNettes)||Number(summary?.vNettes)===0)checks.push(check('ventesNettes'""","""  if(Number(summary?.vBrutes)||Number(summary?.vBrutes)===0)checks.push(check('ventesBrutes',grossRows,summary.vBrutes,.011,true));
  if(Number(summary?.annuls)||Number(summary?.annuls)===0)checks.push(check('annulations',annulRows,summary.annuls,.011,true));
  if(Number(summary?.vNettes)||Number(summary?.vNettes)===0)checks.push(check('ventesNettes'""",'volume checks')
s=one(s,'totals:{netRows,saleDetail,packsDetail,installDetail}','totals:{grossRows,annulRows,netRows,saleDetail,packsDetail,installDetail}','integrity volume totals')
p.write_text(s)

p=Path('tbr-dco-claim-mail.js'); s=p.read_text()
s=one(s,"""  if(globalRows.length){
    lines.push('ÉCARTS GLOBAUX / PALIERS / BONUS À VÉRIFIER','');
    globalRows.forEach((r,i)=>lines.push(`${i+1}. ${r.nature}`,`Montant versé : ${M(r.paid)}`,`Montant attendu : ${M(r.expected)}`,`Montant manquant : ${M(r.amount)}`,`Pourquoi : ${r.why}`,''));
    lines.push('---','');
  }

""","""  if(globalRows.length){
    lines.push('ÉCARTS GLOBAUX / PALIERS / BONUS À VÉRIFIER','');
    globalRows.forEach((r,i)=>lines.push(`${i+1}. ${r.nature}`,`Montant versé : ${M(r.paid)}`,`Montant attendu : ${M(r.expected)}`,`Montant manquant : ${M(r.amount)}`,`Pourquoi : ${r.why}`,''));
    lines.push('---','');
  }
  const unverifiedGlobal=result.unverifiedGlobal||[];
  if(unverifiedGlobal.length){
    lines.push('ÉCARTS GLOBAUX NON AJOUTÉS AU TOTAL','');
    unverifiedGlobal.forEach(r=>lines.push(`- ${r.label} : DCO ${M(r.paid)} · TBR ${M(r.expected)} — volumes DCO/TBR à réconcilier.`));
    lines.push('Ces montants ne sont pas réclamés automatiquement tant que les volumes ne concordent pas.','','---','');
  }

""",'explain unverified paliers')
p.write_text(s)

p=Path('tests/dco-parser-multiformat-check.js'); s=p.read_text()
s=one(s,"['multiline zero-Nb row stays zero',detailed.rows.find(x=>x.num==='2009306').nb===0],","['multiline zero-Nb row stays zero and non-active',detailed.rows.find(x=>x.num==='2009306').nb===0&&detailed.rows.find(x=>x.num==='2009306').isAnnulation===true],",'zero row test')
p.write_text(s)

p=Path('tests/dco-final-reliability-check.js'); s=p.read_text()
s=one(s,"['claim money preserves negative signs', !claim.includes('Math.abs(R(v)).toLocaleString')]","['claim money preserves negative signs', !claim.includes('Math.abs(R(v)).toLocaleString')],\n  ['unreconciled paliers are explained but not claimed', claim.includes('ÉCARTS GLOBAUX NON AJOUTÉS AU TOTAL') && claim.includes('volumes DCO/TBR à réconcilier')]",'claim explain test')
p.write_text(s)
Path('tools/patch_dco_parser_hardening.py').unlink(missing_ok=True)
