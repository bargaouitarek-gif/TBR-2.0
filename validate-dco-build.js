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
  const engine = read('tbr-dco-engine.js');
  const claim = read('tbr-dco-claim-mail.js');
  const dashboard = read('tbr-dco-dashboard-fix.js');
  const vercel = JSON.parse(read('vercel.json'));

  new Function(engine);
  new Function(claim);
  new Function(dashboard);

  requireTokens('index.html', index, [
    'function parseClientRows(items)',
    'const installs=parseInstallRows(installItems);',
    'Installation incluse',
    'type:"missing_dco"',
    'const installTBR=round2(vente.installation?',
    'tbr-dco-claim-mail-loader',
    'tbr-dco-dashboard-fix-loader'
  ]);

  requireTokens('moteur DCO canonique', engine, [
    "const VERSION='1.1.0'",
    'function collectMissing(src,salesByNum)',
    'function collectLedger(src,salesByNum,missing,formatMoney)',
    'function collectClients(src,sales,activeSales,missingSales,ordinaryLedger)',
    "status:'missing_dco'",
    "status:'matched'",
    "status:'cancelled'",
    "status:'missing_tbr'",
    'missingStatusExclusive',
    'uniqueClientStatus',
    'noComponentNetting',
    'const directTotal=R(components.reduce'
  ]);

  requireTokens('runtime de réclamation DCO', claim, [
    "const VERSION='2.0.0'",
    "ENGINE_URL='./tbr-dco-engine.js?v=1.0.0'",
    'window.TBR_DCO_ENGINE.build',
    'Diagnostic uniquement',
    'if(!userEdited)setTextareaValue(textarea,mail.body);',
    'VENTES ABSENTES DU DCO — IMPACT FINANCIER À VÉRIFIER'
  ]);

  requireTokens('pont dashboard DCO', dashboard, [
    "const VERSION='1.3.0'",
    'Générer la réclamation DCO fiable',
    'mail?.result?.missingSales',
    'amount.textContent=M(mail.total||0)'
  ]);

  const builds = JSON.stringify(vercel.builds || []);
  const routes = JSON.stringify(vercel.routes || []);
  for (const active of ['index.html','index-audit.html','tbr-dco-engine.js','tbr-dco-claim-mail.js','tbr-dco-dashboard-fix.js','sentry.js']) {
    if (!builds.includes(active) && !routes.includes(active)) {
      throw new Error(`Runtime Vercel actif non déclaré : ${active}`);
    }
  }

  for (const legacy of ['dco-audit-bootstrap.js','tbr-export-controle.js','tbr-dco-expert.js','tbr-dco-expert.css','sw.js']) {
    if (builds.includes(legacy) || routes.includes(legacy)) {
      throw new Error(`Ancien runtime encore référencé dans Vercel : ${legacy}`);
    }
  }

  console.log('DCO actif validé : parseur, modèle client canonique, mail, dashboard et routes Vercel cohérents.');
}

try {
  validate();
} catch (error) {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
}
