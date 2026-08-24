from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 occurrence, got {count}")
    return text.replace(old, new, 1)


# 1) Canonical engine 1.2.0: overpayments stay separate from shortages.
p = Path('tbr-dco-engine.js')
s = p.read_text(encoding='utf-8')
s = replace_once(s, '/* TBR 2.0 — DCO canonical engine 1.1.0 */', '/* TBR 2.0 — DCO canonical engine 1.2.0 */', 'engine banner')
s = replace_once(s, "const VERSION='1.1.0';", "const VERSION='1.2.0';", 'engine version')
s = replace_once(s, """  const shortage={
    sale:R(Math.max(0,expected.sale-paid.sale)),
    packs:R(Math.max(0,expected.packs-paid.packs)),
    installation:R(Math.max(0,expected.installation-paid.installation))
  };
  return{analysis,expected,paid,shortage};
""", """  const shortage={
    sale:R(Math.max(0,expected.sale-paid.sale)),
    packs:R(Math.max(0,expected.packs-paid.packs)),
    installation:R(Math.max(0,expected.installation-paid.installation))
  };
  const overpaid={
    sale:R(Math.max(0,paid.sale-expected.sale)),
    packs:R(Math.max(0,paid.packs-expected.packs)),
    installation:R(Math.max(0,paid.installation-expected.installation))
  };
  return{analysis,expected,paid,shortage,overpaid};
""", 'matched amounts')
s = s.replace("status:'cancelled',expected:blankAmounts(),paid:blankAmounts(),shortage:blankAmounts(),shortageTotal:0", "status:'cancelled',expected:blankAmounts(),paid:blankAmounts(),shortage:blankAmounts(),shortageTotal:0,overpaid:blankAmounts(),overpaidTotal:0")
s = s.replace("status:'missing_dco',expected,paid:blankAmounts(),shortage,shortageTotal:amountTotal(shortage),directTotal:R(missing.directTotal)", "status:'missing_dco',expected,paid:blankAmounts(),shortage,shortageTotal:amountTotal(shortage),overpaid:blankAmounts(),overpaidTotal:0,directTotal:R(missing.directTotal)")
s = s.replace("status:'matched',expected:amounts.expected,paid:amounts.paid,shortage:amounts.shortage,shortageTotal:amountTotal(amounts.shortage)", "status:'matched',expected:amounts.expected,paid:amounts.paid,shortage:amounts.shortage,shortageTotal:amountTotal(amounts.shortage),overpaid:amounts.overpaid,overpaidTotal:amountTotal(amounts.overpaid)")
s = s.replace("status:'missing_dco',expected:blankAmounts(),paid:blankAmounts(),shortage:blankAmounts(),shortageTotal:0,directTotal:0", "status:'missing_dco',expected:blankAmounts(),paid:blankAmounts(),shortage:blankAmounts(),shortageTotal:0,overpaid:blankAmounts(),overpaidTotal:0,directTotal:0")
s = replace_once(s, """      expected:amounts.expected,paid:amounts.paid,shortage:blankAmounts(),shortageTotal:0
""", """      expected:amounts.expected,paid:amounts.paid,shortage:blankAmounts(),shortageTotal:0,overpaid:blankAmounts(),overpaidTotal:0
""", 'missing tbr amounts')
s = replace_once(s, """  const confirmed=R(ledger.reduce((s,x)=>s+R(x.amount),0));
  const missingPotential=R(missingSales.reduce((s,x)=>s+R(x.directTotal),0));

  const missingStatusExclusive=missingSales.every(m=>{
""", """  const confirmed=R(ledger.reduce((s,x)=>s+R(x.amount),0));
  const missingPotential=R(missingSales.reduce((s,x)=>s+R(x.directTotal),0));
  const clientOverpaid=R(clients.filter(c=>c.status==='matched').reduce((sum,c)=>sum+R(c.overpaidTotal),0));
  const globalOverpaid=R((src?.data?.globalRows||[])
    .filter(r=>r?.money&&R(r?.ecart)>.99&&!isAggregateDuplicate(r?.label))
    .reduce((sum,r)=>sum+R(r.ecart),0));
  const overpaid=R(clientOverpaid+globalOverpaid);

  const missingStatusExclusive=missingSales.every(m=>{
""", 'engine totals')
s = replace_once(s, """    totals:{confirmed,missingPotential},
    invariants:{
""", """    totals:{confirmed,missingPotential,overpaid},
    invariants:{
""", 'engine returned totals')
s = replace_once(s, """      confirmedEqualsLedger:Math.abs(confirmed-R(ledger.reduce((s,x)=>s+R(x.amount),0)))<0.01,
      noComponentNetting:ordinaryLedger.every(x=>R(x.amount)===R(Math.max(0,R(x.expected)-R(x.paid))))
""", """      confirmedEqualsLedger:Math.abs(confirmed-R(ledger.reduce((s,x)=>s+R(x.amount),0)))<0.01,
      noComponentNetting:ordinaryLedger.every(x=>R(x.amount)===R(Math.max(0,R(x.expected)-R(x.paid)))),
      noCrossNetting:clients.filter(c=>c.status==='matched').every(c=>['sale','packs','installation'].every(k=>!(R(c.shortage?.[k])>.99&&R(c.overpaid?.[k])>.99)))
""", 'engine invariants')
p.write_text(s, encoding='utf-8')


# 2) Claim runtime follows engine 1.2.0.
p = Path('tbr-dco-claim-mail.js')
s = p.read_text(encoding='utf-8')
s = replace_once(s, '/* TBR 2.0 — DCO canonical mail runtime 2.1.0 */', '/* TBR 2.0 — DCO canonical mail runtime 2.2.0 */', 'claim banner')
s = replace_once(s, "const VERSION='2.1.0';", "const VERSION='2.2.0';", 'claim version')
s = replace_once(s, "const ENGINE_VERSION='1.1.0';", "const ENGINE_VERSION='1.2.0';", 'claim engine version')
s = replace_once(s, 'result.invariants?.uniqueClientStatus&&result.invariants?.noComponentNetting', 'result.invariants?.uniqueClientStatus&&result.invariants?.noComponentNetting&&result.invariants?.noCrossNetting', 'claim invariant check')
s = replace_once(s, '{detail:{version:VERSION,engineVersion:ENGINE_VERSION,total:mail.total}}', '{detail:{version:VERSION,engineVersion:ENGINE_VERSION,total:mail.total,overpaid:mail.result?.totals?.overpaid||0}}', 'claim canonical event')
p.write_text(s, encoding='utf-8')


# 3) index.html loads the engine before React and consumes canonical totals directly.
p = Path('index.html')
s = p.read_text(encoding='utf-8')
engine_tag = '<script id="tbr-dco-engine-runtime" src="./tbr-dco-engine.js?v=1.2.0"></script>'
if 'id="tbr-dco-engine-runtime"' in s:
    import re
    s = re.sub(r'<script id="tbr-dco-engine-runtime" src="\./tbr-dco-engine\.js\?v=[^"]+"></script>', engine_tag, s, count=1)
else:
    s = replace_once(s, '</head>', engine_tag + '\n\n</head>', 'index engine loader')

fn = s.find('  function buildAnalysis(summary,rows,installs,moisUsed){')
if fn < 0:
    raise SystemExit('buildAnalysis not found')
start = s.find('    return {\n      ...summary,\n      moisUsed:moisUsed,', fn)
if start < 0:
    raise SystemExit('buildAnalysis return not found')
close = s.find('\n  }\n\n  const parseDCO=async(file)=>{', start)
if close < 0:
    raise SystemExit('buildAnalysis end not found')
segment = s[start:close]
if not segment.rstrip().endswith('};'):
    raise SystemExit('unexpected buildAnalysis return ending')
segment = segment.replace('    return {\n', '    const legacy={\n', 1)
segment += """

    const canonical=window.TBR_DCO_ENGINE&&typeof window.TBR_DCO_ENGINE.build===\"function\"
      ?window.TBR_DCO_ENGINE.build({src:{cache:{raw:{rows:rows}},data:legacy},sales:all,month:moisUsed,formatMoney:money})
      :null;
    return {
      ...legacy,
      canonical:canonical,
      canonicalVersion:canonical?canonical.version:null,
      verseEnMoins:canonical?round2(canonical.totals.confirmed||0):legacy.verseEnMoins,
      verseEnPlus:canonical?round2(canonical.totals.overpaid||0):legacy.verseEnPlus,
      missingPotential:canonical?round2(canonical.totals.missingPotential||0):0
    };
"""
s = s[:start] + segment + s[close:]

prefix = '<button className="dco-upload-btn" style={{width:"100%",marginTop:12,padding:"14px 16px"}} onClick={()=>{'
b = s.find(prefix)
if b < 0:
    raise SystemExit('native mail button start not found')
body_start = b + len(prefix)
suffix = '}}>Préparer le mail détaillé</button>'
e = s.find(suffix, body_start)
if e < 0:
    raise SystemExit('native mail button end not found')
handler = """
          if(!dcoData){alert(\"Importe d’abord ton DCO pour préparer la réclamation.\");return;}
          const mail=(window.TBR_DCO_INTEGRITY&&typeof window.TBR_DCO_INTEGRITY.applyCanonicalMail===\"function\")
            ?window.TBR_DCO_INTEGRITY.applyCanonicalMail({reset:true})
            :window.__tbrDcoCanonical;
          if(!mail){alert(\"Le moteur DCO fiable n’est pas encore chargé. Réessaie dans un instant.\");return;}
          window.__tbrDcoMail={subject:mail.subject,body:mail.body,total:mail.total,shortageRows:mail.ledger||[],canonical:true};
          if(window.TBR_DCO_DASHBOARD_BRIDGE&&typeof window.TBR_DCO_DASHBOARD_BRIDGE.openReliableClaim===\"function\"){
            window.TBR_DCO_DASHBOARD_BRIDGE.openReliableClaim();
            return;
          }
          const old=document.getElementById(\"dco-native-mail-preview-v2\");if(old)old.remove();
          const wrap=document.createElement(\"div\");wrap.id=\"dco-native-mail-preview-v2\";wrap.style.cssText=\"position:fixed;inset:0;z-index:99999;background:rgba(2,6,23,.88);padding:18px;overflow:auto\";
          const box=document.createElement(\"div\");box.style.cssText=\"max-width:760px;margin:20px auto;background:#07111f;color:#fff;border:1px solid rgba(56,189,248,.4);border-radius:24px;padding:18px\";
          const h=document.createElement(\"h3\");h.textContent=\"✉️ Mail de réclamation prêt\";h.style.margin=\"0 0 12px\";
          const ta=document.createElement(\"textarea\");ta.value=mail.body||\"\";ta.style.cssText=\"width:100%;min-height:55vh;box-sizing:border-box;background:#020817;color:#e5eefb;border:1px solid #334155;border-radius:14px;padding:12px;font:13px/1.5 system-ui\";
          const row=document.createElement(\"div\");row.style.cssText=\"display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:10px\";
          const mk=txt=>{const btn=document.createElement(\"button\");btn.textContent=txt;btn.style.cssText=\"border:0;border-radius:13px;padding:12px;font-weight:800\";return btn;};
          const copy=mk(\"Copier\");copy.onclick=async()=>{try{await navigator.clipboard.writeText(ta.value);copy.textContent=\"✓ Copié\";}catch(_){ta.focus();ta.select();document.execCommand?.(\"copy\");}};
          const open=mk(\"Ouvrir messagerie\");open.onclick=()=>{location.href=\"mailto:?subject=\"+encodeURIComponent(mail.subject||\"Réclamation DCO\")+\"&body=\"+encodeURIComponent(ta.value);};
          const closeBtn=mk(\"Fermer\");closeBtn.onclick=()=>wrap.remove();
          row.append(copy,open,closeBtn);box.append(h,ta,row);wrap.append(box);document.body.append(wrap);
        """
s = s[:body_start] + handler + s[e:]
s = s.replace('JUMPER analyse ton PDF et croise avec tes ventes...', 'TBR analyse ton PDF et croise avec tes ventes...')
p.write_text(s, encoding='utf-8')


# 4) Regression checks: index is a consumer of the engine, not a second claim calculator.
p = Path('tests/dco-final-reliability-check.js')
s = p.read_text(encoding='utf-8')
s = s.replace("['engine runtime 1.1.0', engine && engine.VERSION==='1.1.0']", "['engine runtime 1.2.0', engine && engine.VERSION==='1.2.0']")
s = s.replace("['claim runtime 2.1.0', claim.includes(\"const VERSION='2.1.0'\")]", "['claim runtime 2.2.0', claim.includes(\"const VERSION='2.2.0'\")] ")
s = s.replace("['claim requires engine 1.1.0', claim.includes(\"const ENGINE_VERSION='1.1.0'\")", "['claim requires engine 1.2.0', claim.includes(\"const ENGINE_VERSION='1.2.0'\")")
anchor = "  ['relative dashboard loader still present', index.includes('tbr-dco-dashboard-fix-loader')]\n"
extra = """  ['relative dashboard loader still present', index.includes('tbr-dco-dashboard-fix-loader')],
  ['index loads canonical engine directly', index.includes('id=\"tbr-dco-engine-runtime\" src=\"./tbr-dco-engine.js?v=1.2.0\"')],
  ['index buildAnalysis stores canonical result', index.includes('canonical:canonical') && index.includes('canonicalVersion:canonical?canonical.version:null')],
  ['index shortage total comes from canonical engine', index.includes('verseEnMoins:canonical?round2(canonical.totals.confirmed||0):legacy.verseEnMoins')],
  ['index overpaid total stays separate', index.includes('verseEnPlus:canonical?round2(canonical.totals.overpaid||0):legacy.verseEnPlus')],
  ['native mail uses canonical runtime only', index.includes('window.TBR_DCO_INTEGRITY.applyCanonicalMail') && !index.includes('const shortageRows=[]')]
"""
s = replace_once(s, anchor, extra, 'test index checks')
s = s.replace("  ['no component netting invariant', result.invariants.noComponentNetting===true]\n", "  ['no component netting invariant', result.invariants.noComponentNetting===true],\n  ['no cross netting invariant', result.invariants.noCrossNetting===true],\n  ['normal fixture has no overpayment', Math.abs(result.totals.overpaid||0)<0.001]\n")
s = s.replace("  ['installation shortage survives overpayment', overpay.clients.find(x=>x.num==='9999999').shortage.installation===40]\n", "  ['installation shortage survives overpayment', overpay.clients.find(x=>x.num==='9999999').shortage.installation===40],\n  ['overpayment is reported separately', Math.abs(overpay.totals.overpaid-100)<0.001],\n  ['overpaid component is preserved', overpay.clients.find(x=>x.num==='9999999').overpaid.sale===100],\n  ['overpay fixture still forbids cross netting', overpay.invariants.noCrossNetting===true]\n")
p.write_text(s, encoding='utf-8')


# 5) Static validator understands the direct index -> engine wiring.
p = Path('validate-dco-build.js')
s = p.read_text(encoding='utf-8')
s = s.replace("\"const VERSION='1.1.0'\"", "\"const VERSION='1.2.0'\"")
s = s.replace("\"const VERSION='2.1.0'\"", "\"const VERSION='2.2.0'\"")
s = s.replace("\"const ENGINE_VERSION='1.1.0'\"", "\"const ENGINE_VERSION='1.2.0'\"")
idx_anchor = """    'tbr-dco-claim-mail-loader',
    'tbr-dco-dashboard-fix-loader'
"""
idx_extra = """    'tbr-dco-claim-mail-loader',
    'tbr-dco-dashboard-fix-loader',
    'tbr-dco-engine-runtime',
    'canonical:canonical',
    'verseEnMoins:canonical?round2(canonical.totals.confirmed||0):legacy.verseEnMoins',
    'verseEnPlus:canonical?round2(canonical.totals.overpaid||0):legacy.verseEnPlus',
    'window.TBR_DCO_INTEGRITY.applyCanonicalMail'
"""
s = replace_once(s, idx_anchor, idx_extra, 'validator index tokens')
s = s.replace("    'noComponentNetting'\n", "    'noComponentNetting',\n    'noCrossNetting',\n    'totals:{confirmed,missingPotential,overpaid}'\n")
guard = """
  if (index.includes('const shortageRows=[]')) {
    throw new Error('Ancien calcul de réclamation encore présent dans index.html');
  }
"""
marker = "\n  const builds = JSON.stringify(vercel.builds || []);"
s = replace_once(s, marker, guard + marker, 'validator legacy mail guard')
p.write_text(s, encoding='utf-8')


# 6) One-time patch helpers remove themselves in the patch commit.
for helper in [
    Path('.github/workflows/patch-dco-index-step4.yml'),
    Path('.github/workflows/run-patch-dco-step4-pr.yml'),
    Path('tools/patch_dco_step4.py'),
]:
    if helper.exists():
        helper.unlink()
