const fs = require('fs');

const SNAPSHOT = '5fd7ade1955a6024ca972d77beaf35c8c23f339c';
const APP_VERSION = '2026.07.26-dco-command-v4';
const RAW_ROOT = `https://raw.githubusercontent.com/bargaouitarek-gif/TBR-2.0/${SNAPSHOT}/`;

async function readRemote(path) {
  const response = await fetch(`${RAW_ROOT}${path}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${path} indisponible (${response.status})`);
  return response.text();
}

async function validate() {
  const entry = fs.readFileSync('index.html', 'utf8');
  const auditEntry = fs.readFileSync('index-audit.html', 'utf8');
  const wrapper = fs.readFileSync('dco-audit-bootstrap.js', 'utf8');
  const worker = fs.readFileSync('sw.js', 'utf8');

  new Function(wrapper);
  new Function(worker);

  const entryTokens = [
    APP_VERSION,
    'MISE À JOUR DISPONIBLE',
    'dco-audit-bootstrap.js',
    'new URL("./",location.href)',
    'LEGACY_VERSION_KEY="cc_version"',
    'rememberVersion()',
    'Mettre à jour maintenant'
  ];
  const wrapperTokens = [
    SNAPSHOT,
    APP_VERSION,
    'EMBEDDED_VERSION',
    'localStorage.setItem("cc_version",tbrEmbeddedVersion)',
    'html=html.replace(/const\\\\s+APP_VERSION',
    'raw.githubusercontent.com'
  ];
  const workerTokens = ['dco-command-v4', 'SCOPE_PATH', 'scoped("/index.html")', 'self.skipWaiting()'];

  const staticMissing = [
    ...entryTokens.filter(token => !entry.includes(token)),
    ...entryTokens.filter(token => !auditEntry.includes(token)),
    ...wrapperTokens.filter(token => !wrapper.includes(token)),
    ...workerTokens.filter(token => !worker.includes(token))
  ];
  if (staticMissing.length) throw new Error(`Entrée ou correctif de mise à jour incomplet : ${staticMissing.join(', ')}`);

  const [base, originalBootstrap] = await Promise.all([
    readRemote('index.html'),
    readRemote('dco-audit-bootstrap.js')
  ]);

  const before = 'const response=await fetch("./index.html?dco-command-base=20260726",{cache:"no-store"});';
  const injected = 'const response={ok:true,text:async()=>global.__TBR_BASE__};';
  if (!originalBootstrap.includes(before)) throw new Error('Point d’entrée du moteur DCO introuvable dans le snapshot.');

  let source = originalBootstrap.replace(before, injected);
  const htmlAnchor = '  let html=await response.text();';
  const htmlPatch = `  let html=await response.text();
  const tbrEmbeddedVersion="${APP_VERSION}";
  try{localStorage.setItem("cc_version",tbrEmbeddedVersion);}catch(e){}
  html=html.replace(/const\\s+APP_VERSION\\s*=\\s*"[^"]+"/,'const APP_VERSION = "'+tbrEmbeddedVersion+'"');`;
  if (!source.includes(htmlAnchor)) throw new Error('Point de synchronisation de la version embarquée introuvable.');
  source = source.replace(htmlAnchor, htmlPatch);
  source = source.replace(/\$\{/g, '\\${');
  new Function(source);

  let rendered = '';
  let bootError = '';
  const storage = new Map([['cc_version', '8.30.1-aimt-rules']]);
  global.__TBR_BASE__ = base;
  const previousDocument = global.document;
  const previousLocalStorage = global.localStorage;
  global.localStorage = {
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, String(value)); },
    removeItem(key) { storage.delete(key); },
    key(index) { return [...storage.keys()][index] || null; },
    get length() { return storage.size; }
  };
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
    global.localStorage = previousLocalStorage;
    delete global.__TBR_BASE__;
  }

  if (bootError) throw new Error(bootError);
  if (!rendered) throw new Error('Le moteur DCO n’a généré aucune page.');
  if (storage.get('cc_version') !== APP_VERSION) throw new Error('La version historique cc_version n’est pas synchronisée.');
  if (!rendered.includes(`const APP_VERSION = "${APP_VERSION}"`)) throw new Error('Le moteur embarqué conserve une ancienne version.');
  if (rendered.includes('const APP_VERSION = "8.30.1-aimt-rules"')) throw new Error('La version 8.30.1 peut encore déclencher une boucle.');

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

  console.log(`Boucle de mise à jour neutralisée et DCO Command Center validé (${rendered.length} caractères).`);
}

validate().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
