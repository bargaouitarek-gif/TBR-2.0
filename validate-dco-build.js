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
  const claim = read('tbr-dco-claim-mail.js');
  const dashboard = read('tbr-dco-dashboard-fix.js');
  const aiUi = read('tbr-ai-ui-v2.js');
  const vercel = JSON.parse(read('vercel.json'));

  // Vérifie que les scripts actifs sont au moins syntaxiquement valides.
  new Function(claim);
  new Function(dashboard);
  new Function(aiUi);

  requireTokens('index.html', index, [
    'function parseClientRows(items)',
    'const installs=parseInstallRows(installItems);',
    'Installation incluse',
    'type:"missing_dco"',
    'const installTBR=round2(vente.installation?',
    'tbr-dco-claim-mail-loader',
    'tbr-dco-dashboard-fix-loader'
  ]);

  requireTokens('moteur de réclamation DCO', claim, [
    "const VERSION='1.7.1'",
    'sale.installation===true',
    'function collectCurrentMissing(src)',
    'const missingNums=new Set((collectCurrentMissing(src).missing||[])',
    "if(item?.scope==='client'&&missingNums.has(normNum(item?.num)))return;",
    'VENTES ABSENTES DU DCO — IMPACT FINANCIER À VÉRIFIER'
  ]);

  requireTokens('pont dashboard DCO', dashboard, [
    'Générer la réclamation DCO fiable',
    'amount.textContent=M(mail.total||0)'
  ]);

  const builds = JSON.stringify(vercel.builds || []);
  const routes = JSON.stringify(vercel.routes || []);
  for (const active of ['index.html','index-audit.html','tbr-dco-claim-mail.js','tbr-dco-dashboard-fix.js','tbr-ai-ui-v2.js','ai.js','sentry.js']) {
    if (!builds.includes(active) && !routes.includes(active)) {
      throw new Error(`Runtime Vercel actif non déclaré : ${active}`);
    }
  }

  for (const legacy of ['dco-audit-bootstrap.js','tbr-export-controle.js','tbr-dco-expert.js','tbr-dco-expert.css','sw.js']) {
    if (builds.includes(legacy) || routes.includes(legacy)) {
      throw new Error(`Ancien runtime encore référencé dans Vercel : ${legacy}`);
    }
  }

  console.log('DCO actif validé : parseur, règles installation, dédoublonnage, mail, dashboard et routes Vercel cohérents.');
}

try {
  validate();
} catch (error) {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
}
