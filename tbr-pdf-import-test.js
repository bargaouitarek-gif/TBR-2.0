(() => {
  "use strict";

  let current = null;
  let selectedType = "";

  const clean = (value) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "'").replace(/\s+/g, " ").trim();
  const upper = (value) => clean(value).toUpperCase();
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[c]);
  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const exactText = (selector, text) => [...document.querySelectorAll(selector)].find((el) => clean(el.textContent) === clean(text));
  const containsText = (selector, text) => [...document.querySelectorAll(selector)].find((el) => clean(el.textContent).includes(clean(text)));
  const dateIso = (value) => {
    const m = String(value ?? "").match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})/);
    return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : "";
  };

  function installShell() {
    if (document.getElementById("tbr-pdf-file")) return;
    document.head.insertAdjacentHTML("beforeend", `<style id="tbr-pdf-test-style">
      #tbr-test-badge{position:fixed;left:10px;top:max(10px,env(safe-area-inset-top));z-index:100000;background:#f59e0b;color:#111827;border-radius:999px;padding:6px 10px;font:900 11px/1 Arial,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.3);pointer-events:none}
      #tbr-pdf-file{display:none}
      #tbr-modal{position:fixed;inset:0;z-index:100001;display:none;align-items:flex-end;justify-content:center;background:rgba(2,6,23,.72);backdrop-filter:blur(5px);padding:12px;box-sizing:border-box}
      #tbr-modal.open{display:flex}.tbr-sheet{width:min(520px,100%);max-height:88vh;overflow:auto;background:linear-gradient(160deg,#07111f,#0f172a);border:1px solid rgba(56,189,248,.35);border-radius:24px;padding:18px;color:#e5eefb;font-family:Arial,sans-serif;box-shadow:0 28px 80px rgba(0,0,0,.55)}
      .tbr-sheet h2{margin:0 0 5px;font-size:20px}.tbr-sheet p{margin:0 0 14px;color:#94a3b8;font-size:12px;line-height:1.45}.tbr-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.tbr-field{background:rgba(15,23,42,.75);border:1px solid rgba(148,163,184,.15);border-radius:14px;padding:10px;min-width:0}.tbr-field span{display:block;color:#94a3b8;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.08em}.tbr-field b{display:block;margin-top:5px;color:#f8fafc;font-size:13px;word-break:break-word}.tbr-full{grid-column:1/-1}.tbr-choice{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:14px 0}.tbr-choice button,.tbr-actions button{border:1px solid rgba(148,163,184,.22);background:rgba(15,23,42,.8);color:#cbd5e1;border-radius:14px;padding:12px;font-weight:1000}.tbr-choice button.active{border-color:#38bdf8;background:rgba(56,189,248,.18);color:#bae6fd}.tbr-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}.tbr-actions .go{border:0;background:linear-gradient(135deg,#10b981,#0f766e);color:#fff}.tbr-warn{margin-top:10px;padding:10px;border-radius:12px;background:rgba(245,158,11,.10);border:1px solid rgba(245,158,11,.25);color:#fde68a;font-size:11px;line-height:1.45}.tbr-status{margin:10px 0;padding:10px;border-radius:12px;background:rgba(56,189,248,.10);border:1px solid rgba(56,189,248,.25);color:#bae6fd;font-size:12px;font-weight:900}.tbr-status.err{background:rgba(239,68,68,.12);border-color:rgba(248,113,113,.3);color:#fecaca}
    </style>`);
    document.body.insertAdjacentHTML("beforeend", `<div id="tbr-test-badge">COPIE TEST</div><input id="tbr-pdf-file" type="file" accept="application/pdf,.pdf"><div id="tbr-modal" role="dialog" aria-modal="true"><div class="tbr-sheet" id="tbr-sheet"></div></div>`);
  }

  function showStatus(message, error = false) {
    const modal = document.getElementById("tbr-modal");
    const sheet = document.getElementById("tbr-sheet");
    sheet.innerHTML = `<h2>${error ? "Lecture impossible" : "Analyse du PDF"}</h2><div class="tbr-status${error ? " err" : ""}">${esc(message)}</div><div class="tbr-actions"><button id="tbr-close-status">Fermer</button></div>`;
    modal.classList.add("open");
    document.getElementById("tbr-close-status").onclick = () => modal.classList.remove("open");
  }

  async function readPdf(file) {
    if (!window.pdfjsLib) throw new Error("Le lecteur PDF de TBR n'est pas encore prêt. Attends deux secondes puis réessaie.");
    const data = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({data}).promise;
    let text = "";
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      text += `\n--- PAGE ${p} ---\n${content.items.map((item) => item.str).join(" ")}`;
    }
    if (clean(text).length < 80) throw new Error("Le PDF ne contient pas assez de texte lisible.");
    return text;
  }

  function detectPack(text, ref, label, price) {
    const explicit = new RegExp(`(?:PACK[^]{0,180}?(?:-|–|—)\\s*${ref}\\b|\\b${ref}\\b\\s*(?:-|–|—)\\s*${price}(?:[,.]00)?\\s*€?)`, "i");
    if (!explicit.test(text)) return null;
    let status = "Normal";
    const fifty = new RegExp(`(?:REMISE\\s+DE\\s+50\\s*%[^]{0,240}?\\b${ref}\\b|\\b${ref}\\b[^]{0,240}?REMISE\\s+DE\\s+50\\s*%)`, "i");
    const full = new RegExp(`(?:REMISE\\s+DE\\s+100\\s*%[^]{0,240}?\\b${ref}\\b|\\b${ref}\\b[^]{0,240}?REMISE\\s+DE\\s+100\\s*%)`, "i");
    const quarter = new RegExp(`(?:REMISE\\s+DE\\s+25\\s*%[^]{0,240}?\\b${ref}\\b|\\b${ref}\\b[^]{0,240}?REMISE\\s+DE\\s+25\\s*%)`, "i");
    if (full.test(text) || new RegExp(`${price}[,.]00\\s*€?[^]{0,80}0[,.]00`, "i").test(text)) status = "Offert";
    else if (fifty.test(text) || new RegExp(`${price}[,.]00\\s*€?[^]{0,80}${(price / 2).toFixed(2).replace(".", "[,.]")}`, "i").test(text)) status = "Remise -50%";
    else if (quarter.test(text)) status = "Remise -25%";
    return {ref, label, price, status};
  }

  function parseDocument(raw) {
    const text = clean(raw);
    const u = upper(text);
    const result = {warnings: [], packs: [], codesAbo: []};
    result.documentType = /PROCES VERBAL D'INSTALLATION|PV D'INSTALLATION/.test(u) ? "PV" : /PROPOSITION COMMERCIALE/.test(u) ? "PROPOSITION" : /\bCONTRAT\b/.test(u) ? "CONTRAT" : "DOCUMENT";

    let m = u.match(/(?:N[°Oº]?\s*CLIENT|NUMERO\s+CLIENT)\s*[:#-]?\s*(\d{6,9})/);
    if (!m && result.documentType === "PV") m = u.match(/\b(2\d{6})\b/);
    result.numClient = m?.[1] || "";

    m = u.match(/(?:REFERENCE\s+DOCUMENT|REF\s+DOCUMENT)\s*[:#-]?\s*([A-Z]\d{7,})/);
    result.refDocument = m?.[1] || "";

    const namePatterns = [
      /(?:NOM\s*PRENOM|NOM\s+DU\s+CLIENT)\s*:\s*(?:MONSIEUR|MADAME|M\.?|MME\.?)?\s*([A-Z][A-Z' -]{2,70}?)(?=\s+(?:DENOMINATION|STATUT|DATE|ADRESSE|SIRET|ENGAGEMENT|TVA|CODE)|$)/,
      /DONNEES\s+DE\s+FACTURATION[^]{0,300}?NOM\s*PRENOM\s*:\s*(?:MONSIEUR|MADAME|M\.?|MME\.?)?\s*([A-Z][A-Z' -]{2,70}?)(?=\s+(?:DENOMINATION|STATUT|DATE|ADRESSE|SIRET|TVA|CODE)|$)/
    ];
    for (const rx of namePatterns) { const hit = u.match(rx); if (hit) { result.nomClient = clean(hit[1]); break; } }
    result.nomClient ||= "";

    m = text.match(/(?:PROCES\s+VERBAL\s+D['’]?INSTALLATION|CONTRAT|PROPOSITION\s+COMMERCIALE)[\s:.-]*(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{4})/i)
      || text.match(/DATE\s+D['’]?(?:INSTALLATION|CONTRAT|OFFRE)\s*[:\-]?\s*(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{4})/i)
      || text.match(/\b(\d{1,2}[\/.\-]\d{1,2}[\/.\-]20\d{2})\b/);
    result.dateVente = m ? dateIso(m[1]) : "";

    m = u.match(/ENGAGEMENT\s*(?:JURIDIQUE\s*)?[:\-]?\s*(12|24|36)\s*MOIS/) || u.match(/\b(12|24|36)\s*MOIS\b/);
    result.engagement = m ? Number(m[1]) : 36;
    result.typeClient = /SECURITE\s+START\s+PRO|\bPROFESSIONNEL\b|SIRET\s*[:\/]\s*\d{9,}/.test(u) ? "PRO" : "RESI";
    result.fi200start = /200\s*€?\s*HT\s+DE\s+REMISE\s+SUR\s+L['’]?INSTALLATION/i.test(text) || /399[,.]00\s*€?[^]{0,70}199[,.]00\s*€?/i.test(text);
    result.codePromo = /6\s*MOIS[^]{0,140}50\s*%/i.test(text) ? "6MO5POSTART" : /3\s*MOIS[^]{0,140}50\s*%/i.test(text) ? "3MO5POSTART" : "";
    result.statut = result.documentType === "PV" ? "Installe" : result.documentType === "CONTRAT" ? "Vendu" : "En attente";

    const catalog = [
      ["I1", "I1 — Intégrale 1", 199], ["I2", "I2 — Intégrale 2", 199], ["I3", "I3 — Intégrale 3", 199], ["I4", "I4 — Intégrale 4", 199],
      ["P1", "P1 — Bouclier", 399], ["P2", "P2 — 5 Contacts", 199], ["P3", "P3 — 3 Contacts", 149], ["P4", "P4 — 1 Contact", 59],
      ["V1", "V1", 299], ["V2", "V2", 299], ["V3", "V3", 199], ["V4", "V4", 119],
      ["A1", "A1 — Arlo Pro 3", 199], ["A2", "A2 — Arlo Pro 4", 199], ["A3", "A3 — Arlo Pro 5", 199], ["A4", "A4 — Arlo Doorbell", 39], ["A5", "A5 — Arlo Ultra", 199]
    ];
    result.packs = catalog.map(([ref, label, price]) => detectPack(text, ref, label, price)).filter(Boolean);

    const aboCodes = ["ABO3ES","ABO5ES","ABO1CA","ABO2CA","ABO3CA","ABO4CA","ABO5CA","ABO6CA","ABO7CA","ABO10CA","ABO15CA"];
    result.codesAbo = aboCodes.filter((code) => new RegExp(`\\b${code}\\b`, "i").test(u));

    if (!result.nomClient) result.warnings.push("Nom à vérifier");
    if (result.documentType === "PV" && !result.numClient) result.warnings.push("Numéro client introuvable");
    if (!result.dateVente) result.warnings.push("Date à vérifier");
    if (!result.packs.length) result.warnings.push("Aucun pack reconnu");
    return result;
  }

  function renderReview(data) {
    current = data;
    selectedType = "";
    const modal = document.getElementById("tbr-modal");
    const sheet = document.getElementById("tbr-sheet");
    const packText = data.packs.length ? data.packs.map((p) => `${p.ref} · ${p.status}`).join(" / ") : "Aucun reconnu";
    const warnings = data.warnings.length ? `<div class="tbr-warn">${data.warnings.map((w) => `• ${esc(w)}`).join("<br>")}</div>` : "";
    sheet.innerHTML = `<h2>Fiche comprise par TBR</h2><p>Vérifie les informations. Rien n'est enregistré à cette étape.</p><div class="tbr-grid">
      <div class="tbr-field"><span>Document</span><b>${esc(data.documentType)}</b></div><div class="tbr-field"><span>N° client</span><b>${esc(data.numClient || "À compléter")}</b></div>
      <div class="tbr-field tbr-full"><span>Client</span><b>${esc(data.nomClient || "À vérifier")}</b></div><div class="tbr-field"><span>Date</span><b>${esc(data.dateVente || "À vérifier")}</b></div>
      <div class="tbr-field"><span>Client</span><b>${data.typeClient === "PRO" ? "Professionnel" : "Résidentiel"}</b></div><div class="tbr-field"><span>Engagement</span><b>${esc(data.engagement)} mois</b></div>
      <div class="tbr-field"><span>FI200 Start</span><b>${data.fi200start ? "Oui" : "Non"}</b></div><div class="tbr-field"><span>Code promo</span><b>${esc(data.codePromo || "Aucun")}</b></div>
      <div class="tbr-field tbr-full"><span>Packs</span><b>${esc(packText)}</b></div><div class="tbr-field tbr-full"><span>Codes ABO</span><b>${esc(data.codesAbo.join(", ") || "Aucun")}</b></div></div>${warnings}
      <div class="tbr-choice"><button id="tbr-vd">VD</button><button id="tbr-vf">VF</button></div><div class="tbr-actions"><button id="tbr-cancel">Annuler</button><button class="go" id="tbr-prefill">Préremplir la fiche</button></div>`;
    modal.classList.add("open");
    const choose = (type) => { selectedType = type; document.getElementById("tbr-vd").classList.toggle("active", type === "VD"); document.getElementById("tbr-vf").classList.toggle("active", type === "VF"); };
    document.getElementById("tbr-vd").onclick = () => choose("VD");
    document.getElementById("tbr-vf").onclick = () => choose("VF");
    document.getElementById("tbr-cancel").onclick = () => modal.classList.remove("open");
    document.getElementById("tbr-prefill").onclick = async () => {
      if (!selectedType) { alert("Choisis VD ou VF."); return; }
      try { await prefillForm(current, selectedType); modal.classList.remove("open"); }
      catch (error) { showStatus(error.message || "Préremplissage impossible.", true); }
    };
  }

  function setNativeValue(input, value) {
    const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : input instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
    descriptor?.set?.call(input, value);
    input.dispatchEvent(new Event("input", {bubbles: true}));
    input.dispatchEvent(new Event("change", {bubbles: true}));
  }

  async function waitFor(predicate, timeout = 7000) {
    const start = Date.now();
    while (Date.now() - start < timeout) { const result = predicate(); if (result) return result; await pause(80); }
    throw new Error("Le formulaire TBR n'a pas répondu assez vite.");
  }

  function findLabeledInput(label, type = null) {
    const labels = [...document.querySelectorAll("div,span,label")].filter((el) => el.children.length === 0 && clean(el.textContent) === clean(label));
    for (const labelEl of labels) {
      let row = labelEl.parentElement;
      for (let i = 0; row && i < 3; i++, row = row.parentElement) { const input = row.querySelector(type ? `input[type='${type}']` : "input,textarea,select"); if (input) return input; }
    }
    return null;
  }

  function clickButton(text) {
    const button = exactText("button", text) || [...document.querySelectorAll("button")].find((b) => clean(b.textContent).startsWith(clean(text)));
    if (!button) throw new Error(`Bouton introuvable : ${text}`);
    button.click();
    return button;
  }

  async function setToggleByLabel(label, desired) {
    const labelEl = [...document.querySelectorAll("div,span,label")].find((el) => el.children.length === 0 && clean(el.textContent) === clean(label));
    if (!labelEl) return false;
    let row = labelEl.parentElement;
    for (let i = 0; row && i < 4; i++, row = row.parentElement) {
      const button = row.querySelector("button");
      if (!button) continue;
      const pressed = button.getAttribute("aria-pressed");
      if (pressed !== null) { if ((pressed === "true") !== desired) button.click(); return true; }
      const txt = upper(button.textContent);
      if (["OUI","NON"].includes(txt)) { if ((txt === "OUI") !== desired) button.click(); return true; }
    }
    return false;
  }

  async function prefillForm(data, typeVente) {
    const manual = containsText("button", "Saisir à la main");
    if (!manual) throw new Error("Ouvre d'abord l'onglet Saisie dans TBR.");
    manual.click();
    await waitFor(() => document.getElementById("tbr-sale-form-top"));
    const nameInput = findLabeledInput("Nom");
    const clientInput = findLabeledInput("N° client");
    const dateInput = findLabeledInput("Date", "date");
    if (!nameInput || !clientInput || !dateInput) throw new Error("Les champs client n'ont pas été retrouvés.");
    setNativeValue(nameInput, data.nomClient || ""); setNativeValue(clientInput, data.numClient || ""); setNativeValue(dateInput, data.dateVente || new Date().toISOString().slice(0, 10));
    clickButton(typeVente === "VD" ? "VD — Directe" : "VF — Fournie");
    clickButton(data.typeClient === "PRO" ? "Professionnel" : "Résidentiel");
    clickButton(`${data.engagement} mois`);
    const promo = findLabeledInput("Code promo abonnement");
    if (promo) setNativeValue(promo, data.codePromo || "");
    if (data.fi200start) await setToggleByLabel("FI200 Start", true);
    for (const pack of data.packs) {
      clickButton(`${pack.ref} — ${pack.price}€`); await pause(100);
      const statusSelect = [...document.querySelectorAll("select")].find((select) => [...select.options].some((o) => o.textContent === "Remise -50%") && select.offsetParent !== null);
      if (statusSelect) setNativeValue(statusSelect, pack.status);
      const validate = [...document.querySelectorAll("button")].find((b) => clean(b.textContent) === "✓ Valider" && b.offsetParent !== null);
      validate?.click(); await pause(80);
    }
    for (const code of data.codesAbo) exactText("button", code)?.click();
    const statusText = data.statut === "Installe" ? "Installé" : data.statut === "En attente" ? "En attente" : "Vendu";
    exactText("button", statusText)?.click();
    document.getElementById("tbr-test-badge").textContent = "FICHE PRÉREMPLIE — NE PAS ENREGISTRER";
    document.getElementById("tbr-sale-form-top")?.scrollIntoView({behavior: "smooth", block: "start"});
  }

  function installImportButton() {
    const button = [...document.querySelectorAll("button")].find((b) => /Ajouter(?: d’autres)? captures du PV/i.test(clean(b.textContent)) || clean(b.textContent) === "Importer un PDF");
    if (!button || button.dataset.tbrPdfTest === "1") return;
    button.dataset.tbrPdfTest = "1";
    button.textContent = "📄 Importer un PDF";
    button.addEventListener("click", (event) => {
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
      const input = document.getElementById("tbr-pdf-file"); input.value = ""; input.click();
    }, true);
    const help = button.parentElement?.nextElementSibling;
    if (help && /Ajoute 4, 5, 6 captures/i.test(clean(help.textContent))) help.textContent = "Importe le PDF complet. TBR lit le document puis préremplit la saisie. Rien n'est enregistré sans ta validation.";
  }

  function start() {
    installShell();
    installImportButton();
    new MutationObserver(installImportButton).observe(document.body, {childList: true, subtree: true});
    document.getElementById("tbr-pdf-file").addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") { showStatus("Sélectionne un fichier PDF.", true); return; }
      showStatus(`Lecture de ${file.name}…`);
      try { renderReview(parseDocument(await readPdf(file))); }
      catch (error) { showStatus(error.message || "Le document n'a pas pu être lu.", true); }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();