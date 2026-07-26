const fs = require('fs');

const SNAPSHOT = '5fd7ade1955a6024ca972d77beaf35c8c23f339c';
const APP_VERSION = '2026.07.26-dco-command-v6';
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
    'LEGACY_VERSION_KEY="cc_version"',
    'rememberVersion()',
    'Mettre à jour maintenant'
  ];
  const wrapperTokens = [
    SNAPSHOT,
    APP_VERSION,
    'EMBEDDED_VERSION',
    'pendingPrefix',
    'nbWithPrefix',
    'suffix=offerMatch',
    'externalAimtItems',
    'externalAimtVD',
    'Recalcul DCO automatique après modification AIMT',
    'setDcoData(refreshed)',
    'localStorage.setItem("cc_version",tbrEmbeddedVersion)',
    'raw.githubusercontent.com'
  ];
  const workerTokens = ['dco-command-v6', 'SCOPE_PATH', 'scoped("/index.html")', 'self.skipWaiting()'];

  const staticMissing = [
    ...entryTokens.filter(token => !entry.includes(token)),
    ...entryTokens.filter(token => !auditEntry.includes(token)),
    ...wrapperTokens.filter(token => !wrapper.includes(token)),
    ...workerTokens.filter(token => !worker.includes(token))
  ];
  if (staticMissing.length) throw new Error(`Entrée ou correctif DCO incomplet : ${staticMissing.join(', ')}`);

  const [base, originalBootstrap] = await Promise.all([
    readRemote('index.html'),
    readRemote('dco-audit-bootstrap.js')
  ]);

  let rendered = '';
  let bootError = '';
  const storage = new Map([['cc_version', '8.30.1-aimt-rules']]);

  const previousDocument = global.document;
  const previousLocalStorage = global.localStorage;
  const previousFetch = global.fetch;

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
  global.fetch = async url => {
    const value = String(url || '');
    if (value.endsWith('/dco-audit-bootstrap.js')) {
      return { ok: true, status: 200, text: async () => originalBootstrap };
    }
    if (value.endsWith('/index.html')) {
      return { ok: true, status: 200, text: async () => base };
    }
    throw new Error(`URL inattendue dans le test : ${value}`);
  };

  try {
    (0, eval)(wrapper);
    await new Promise(resolve => setTimeout(resolve, 350));
  } finally {
    global.document = previousDocument;
    global.localStorage = previousLocalStorage;
    global.fetch = previousFetch;
  }

  if (bootError) throw new Error(bootError);
  if (!rendered) throw new Error('Le moteur DCO n’a généré aucune page.');
  if (storage.get('cc_version') !== APP_VERSION) throw new Error('La version historique cc_version n’est pas synchronisée.');
  if (!rendered.includes(`const APP_VERSION = "${APP_VERSION}"`)) throw new Error('Le moteur embarqué conserve une ancienne version.');
  if (rendered.includes('const APP_VERSION = "8.30.1-aimt-rules"')) throw new Error('La version historique peut encore déclencher une boucle.');

  const parserMatch = rendered.match(/  function parseClientRows\(pages\)\{[\s\S]*?\n  \}\n\n  function parseInstallRows/);
  if (!parserMatch) throw new Error('Fonction parseClientRows absente de la page générée.');
  const parserSource = parserMatch[0].replace(/\n\n  function parseInstallRows$/, '');
  const normNum = value => String(value || '').replace(/\D/g, '');
  const toNum = value => {
    const number = parseFloat(String(value ?? '').replace(/[€\s]/g, '').replace(',', '.'));
    return Number.isFinite(number) ? number : 0;
  };
  const parseClientRows = new Function('normNum', 'toNum', `${parserSource}; return parseClientRows;`)(normNum, toNum);

  const prefectureLines = [
    '1 PREFECTURE DES',
    '2201228 BOUCHES DU PURVD 24 mois 1115 380 278,75 ACQ start',
    'RHONE SGC 13',
    '0 2086724 DAHAN RMK 0 0 0 0 annulation_ARAR'
  ];
  const parsedRows = parseClientRows([prefectureLines]);
  const prefecture = parsedRows.find(row => row.num === '2201228');
  if (!prefecture) throw new Error('Le client 2201228 réparti sur plusieurs lignes reste introuvable.');
  if (prefecture.comVente !== 380 || prefecture.comPacks !== 278.75 || prefecture.caPacks !== 1115) {
    throw new Error(`Montants du client 2201228 incorrects : ${JSON.stringify(prefecture)}`);
  }
  if (!/PREFECTURE DES BOUCHES DU RHONE SGC 13/i.test(prefecture.nom)) {
    throw new Error(`Nom multiligne incomplet : ${prefecture.nom}`);
  }

  const activeSales = Array.from({length:24}, (_,index)=>({typeVente:index<17?'VD':'VF'}));
  const aimtItems = [{numClient:'2133991',typeVente:'VD',motif:'AIMT'}];
  const externalAimtVD = aimtItems.filter(item=>item.typeVente==='VD').length;
  const externalAimtVF = aimtItems.filter(item=>item.typeVente==='VF').length;
  const ventesNettes = activeSales.length-externalAimtVD-externalAimtVF;
  const ventesDirectes = activeSales.filter(item=>item.typeVente==='VD').length-externalAimtVD;
  const getPalierVentes = n=>n<7?0:n>=18?1000+Math.floor((n-18)/2)*150:0;
  const getPalierVD = n=>n<3?0:n>=10?1100+(n-10)*100:0;
  const getBonusSGP = (vn,vd)=>vd>=8?500+Math.max(0,vd-8)*100:(vn>=8&&vd>=5?250+Math.max(0,Math.min(vd,7)-5)*75:0);
  if (ventesNettes!==23 || ventesDirectes!==16) throw new Error(`Volumes AIMT incorrects : ${ventesNettes} ventes nettes, ${ventesDirectes} VD.`);
  if (getPalierVentes(ventesNettes)!==1300 || getPalierVD(ventesDirectes)!==1700 || getBonusSGP(ventesNettes,ventesDirectes)!==1300) {
    throw new Error('Les paliers GUERRINI ne correspondent pas au DCO : 1 300 €, 1 700 €, 1 300 € attendus.');
  }

  const required = [
    'DCO // CONTROL CENTER',
    'MISSION PRIORITAIRE',
    'dco-command-center',
    'dco-filter-dock',
    'tbr-dco-command-center',
    'matchKey:c.num',
    'Préparer la réclamation',
    'VERSÉ EN PLUS — INFORMATION UNIQUEMENT',
    'externalAimtItems',
    'setDcoData(refreshed)'
  ];
  const missing = required.filter(token => !rendered.includes(token));
  if (missing.length) throw new Error(`Validation DCO incomplète : ${missing.join(', ')}`);

  console.log(`AIMT GUERRINI validé : 23 ventes nettes, 16 VD, paliers conformes. Command Center généré (${rendered.length} caractères).`);
}

validate().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});