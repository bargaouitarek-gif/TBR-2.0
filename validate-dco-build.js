const fs = require('fs');

function read(path) {
  if (!fs.existsSync(path)) throw new Error(`Fichier actif manquant : ${path}`);
  return fs.readFileSync(path, 'utf8');
}

function requireTokens(label, source, tokens) {
  const missing = tokens.filter(token => !source.includes(token));
  if (missing.length) throw new Error(`${label} incomplet : ${missing.join(', ')}`);
}

function validate() {
  const index = read('index.html');
  const parser = read('tbr-dco-parser.js');
  const engine = read('tbr-dco-engine.js');
  const claim = read('tbr-dco-claim-mail.js');
  const dashboard = read('tbr-dco-dashboard-fix.js');
  const vercel = JSON.parse(read('vercel.json'));

  new Function(parser);
  new Function(engine);
  new Function(claim);
  new Function(dashboard);

  requireTokens('index.html', index, [
    'tbr-dco-parser-runtime',
    'TBR_DCO_PARSER.parseDocument',
    'Installation incluse',
    'type:"missing_dco"',
    'const installTBR=round2(vente.installation?',
    'tbr-dco-claim-mail-loader',
    'tbr-dco-dashboard-fix-loader',
    'tbr-dco-engine-runtime',
    'canonical:canonical',
    'verseEnMoins:canonical?round2(canonical.totals.confirmed||0):0',
    'verseEnPlus:canonical?round2(canonical.totals.overpaid||0):0',
    'window.TBR_DCO_INTEGRITY.applyCanonicalMail'
  ]);

  requireTokens('parseur DCO multi-format', parser, [
    "const VERSION='1.0.0'",
    "format:'compact'",
    "format:'detailed'",
    'claimSafe'
  ]);

  requireTokens('moteur DCO canonique', engine, [
    "const VERSION='1.4.0'",
    'function collectMissing(src,salesByNum)',
    'function collectLedger(src,salesByNum,missing,formatMoney)',
    'function collectClients(src,sales,activeSales,missingSales,ordinaryLedger)',
    'function collectOverpaid(src,clients)',
    "status:'missing_dco'",
    "status:'matched'",
    "status:'cancelled'",
    "status:'missing_tbr'",
    'missingStatusExclusive',
    'uniqueClientStatus',
    'noComponentNetting',
    'noCrossNetting',
    'overpaidEqualsLedger',
    'overpaidLedger',
    'totals:{confirmed,missingPotential,overpaid}'
  ]);

  requireTokens('runtime de réclamation DCO', claim, [
    "const VERSION='2.4.0'",
    "const ENGINE_VERSION='1.4.0'",
    "const CANONICAL_EVENT='tbr:dco-canonical'",
    'window.TBR_DCO_ENGINE.build',
    'window.__tbrDcoCanonical=mail',
    'new CustomEvent(CANONICAL_EVENT',
    'Diagnostic uniquement',
    "if(textarea.dataset.tbrUserEdited!=='1')setTextareaValue(textarea,mail.body);",
    'VENTES ABSENTES DU DCO — IMPACT FINANCIER À VÉRIFIER'
  ]);

  requireTokens('pont dashboard DCO', dashboard, [
    "const VERSION='1.4.0'",
    "const CANONICAL_EVENT='tbr:dco-canonical'",
    'if(window.__tbrDcoCanonical)return window.__tbrDcoCanonical;',
    'window.addEventListener(CANONICAL_EVENT,sync)',
    'Générer la réclamation DCO fiable',
    'mail?.result?.missingSales',
    'confirmedFrom(mail)'
  ]);
  if (dashboard.includes('TBR_DCO_INTEGRITY.buildMail')) throw new Error('Le dashboard ne doit plus recalculer le mail DCO à chaque synchronisation.');

  if (index.includes('const shortageRows=[]')) {
    throw new Error('Ancien calcul de réclamation encore présent dans index.html');
  }

  for (const legacyToken of ['sousPayeCalculable:','clientVerseEnMoinsAControler:','clientVerseEnPlusAControler:','const ecartsAControler=','const plusDCOAControler=']) {
    if (index.includes(legacyToken)) throw new Error(`Ancien total DCO encore présent dans index.html : ${legacyToken}`);
  }
  if (!index.includes('const result=data&&data.canonical;') || !index.includes('(result.overpaidLedger||[])')) {
    throw new Error('Les alertes natives DCO ne consomment pas uniquement le résultat canonique.');
  }

  const builds = JSON.stringify(vercel.builds || []);
  const routes = JSON.stringify(vercel.routes || []);
  for (const active of ['index.html','index-audit.html','tbr-dco-parser.js','tbr-dco-engine.js','tbr-dco-claim-mail.js','tbr-dco-dashboard-fix.js','sentry.js']) {
    if (!builds.includes(active) && !routes.includes(active)) {
      throw new Error(`Runtime Vercel actif non déclaré : ${active}`);
    }
  }

  for (const legacy of ['dco-audit-bootstrap.js','tbr-export-controle.js','tbr-dco-expert.js','tbr-dco-expert.css','sw.js']) {
    if (builds.includes(legacy) || routes.includes(legacy)) {
      throw new Error(`Ancien runtime encore référencé dans Vercel : ${legacy}`);
    }
  }

  console.log('DCO actif validé : moteur canonique, snapshot publié, mail, dashboard et routes Vercel cohérents.');
}

try {
  validate();
} catch (error) {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
}
