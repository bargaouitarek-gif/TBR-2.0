const fs = require('fs');

const SNAPSHOT = '5fd7ade1955a6024ca972d77beaf35c8c23f339c';
const RAW_ROOT = `https://raw.githubusercontent.com/bargaouitarek-gif/TBR-2.0/${SNAPSHOT}/`;

async function readRemote(path) {
  const response = await fetch(`${RAW_ROOT}${path}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${path} indisponible (${response.status})`);
  return response.text();
}

async function validate() {
  const entry = fs.readFileSync('index.html', 'utf8');
  const wrapper = fs.readFileSync('dco-audit-bootstrap.js', 'utf8');
  const worker = fs.readFileSync('sw.js', 'utf8');

  new Function(wrapper);
  new Function(worker);

  const entryTokens = [
    '2026.07.26-dco-command-v3',
    'MISE À JOUR DISPONIBLE',
    'dco-audit-bootstrap.js',
    'new URL("./",location.href)',
    'Mettre à jour maintenant'
  ];
  const wrapperTokens = [SNAPSHOT, 'raw.githubusercontent.com', 'index.html', 'source.replace(/\\$\\{/g'];
  const workerTokens = ['SCOPE_PATH', 'scoped("/index.html")', 'self.skipWaiting()'];

  const staticMissing = [
    ...entryTokens.filter(token => !entry.includes(token)),
    ...wrapperTokens.filter(token => !wrapper.includes(token)),
    ...workerTokens.filter(token => !worker.includes(token))
  ];
  if (staticMissing.length) throw new Error(`Entrée GitHub incomplète : ${staticMissing.join(', ')}`);

  const [base, originalBootstrap] = await Promise.all([
    readRemote('index.html'),
    readRemote('dco-audit-bootstrap.js')
  ]);

  const before = 'const response=await fetch("./index.html?dco-command-base=20260726",{cache:"no-store"});';
  const injected = 'const response={ok:true,text:async()=>global.__TBR_BASE__};';
  if (!originalBootstrap.includes(before)) throw new Error('Point d’entrée du moteur DCO introuvable dans le snapshot.');

  let source = originalBootstrap.replace(before, injected);
  source = source.replace(/\$\{/g, '\\${');
  new Function(source);

  let rendered = '';
  let bootError = '';
  global.__TBR_BASE__ = base;
  const previousDocument = global.document;
  global.document = {
    open() {},
    write(value) { rendered = String(value || ''); },
    close() {},
    getElementById() {
      return {
        set className(_) {},
        set textContent(value) { bootError = String(value || ''); }
      };
    }
  };

  try {
    (0, eval)(source);
    await new Promise(resolve => setTimeout(resolve, 250));
  } finally {
    global.document = previousDocument;
    delete global.__TBR_BASE__;
  }

  if (bootError) throw new Error(bootError);
  if (!rendered) throw new Error('Le moteur DCO n’a généré aucune page.');

  const required = [
    'DCO // CONTROL CENTER',
    'MISSION PRIORITAIRE',
    'dco-command-center',
    'dco-filter-dock',
    'tbr-dco-command-center',
    'matchKey:c.num',
    'Préparer la réclamation',
    'VERSÉ EN PLUS — INFORMATION UNIQUEMENT'
  ];
  const missing = required.filter(token => !rendered.includes(token));
  if (missing.length) throw new Error(`Validation DCO incomplète : ${missing.join(', ')}`);

  console.log(`Entrée GitHub Pages et DCO Command Center validés (${rendered.length} caractères).`);
}

validate().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
