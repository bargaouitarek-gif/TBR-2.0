const fs = require('fs');

async function validate() {
  const base = fs.readFileSync('index.html', 'utf8');
  let source = fs.readFileSync('dco-audit-bootstrap.js', 'utf8');

  source = source.replace(/\$\{/g, '\\${');
  new Function(source);

  let rendered = '';
  let bootError = '';
  const previousFetch = global.fetch;
  const previousDocument = global.document;

  global.fetch = async () => ({ ok: true, text: async () => base });
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
    global.fetch = previousFetch;
    global.document = previousDocument;
  }

  if (bootError) throw new Error(bootError);
  if (!rendered) throw new Error('Le bootstrap DCO n’a généré aucune page.');

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
  if (missing.length) {
    throw new Error(`Validation DCO incomplète : ${missing.join(', ')}`);
  }

  console.log(`DCO Command Center validé (${rendered.length} caractères générés).`);
}

validate().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
