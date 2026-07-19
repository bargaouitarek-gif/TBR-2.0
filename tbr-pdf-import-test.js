(() => {
  "use strict";

  const iframe = document.getElementById("tbr-app");
  const fileInput = document.getElementById("tbr-pdf-file");
  const modal = document.getElementById("tbr-modal");
  const sheet = document.getElementById("tbr-sheet");
  let current = null;
  let selectedType = "";

  const clean = (value) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "'").replace(/\s+/g, " ").trim();
  const upper = (value) => clean(value).toUpperCase();
  const dateIso = (value) => {
    const m = String(value ?? "").match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})/);
    return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : "";
  };

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[c]);
  const exactText = (doc, selector, text) => [...doc.querySelectorAll(selector)].find((el) => clean(el.textContent) === clean(text));
  const containsText = (doc, selector, text) => [...doc.querySelectorAll(selector)].find((el) => clean(el.textContent).includes(clean(text)));
  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function showStatus(message, error = false) {
    sheet.innerHTML = `<h2>${error ? "Lecture impossible" : "Analyse du PDF"}</h2><div class="tbr-status${error ? " err" : ""}">${esc(message)}</div><div class="tbr-actions"><button onclick="document.getElementById('tbr-modal').classList.remove('open')">Fermer</button></div>`;
    modal.classList.add("open");
  }

  async function readPdf(file) {
    const win = iframe.contentWindow;
    if (!win || !win.pdfjsLib) throw new Error("Le lecteur PDF de TBR n'est pas encore prêt. Attends deux secondes puis réessaie.");
    const data = await file.arrayBuffer();
    const pdf = await win.pdfjsLib.getDocument({data}).promise;
    let text = "";
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      text += `\n--- PAGE ${p} ---\n${content.items.map((item) => item.str).join(" ")}`;
    }
    if (clean(text).length < 80) throw new Error("Le PDF ne contient pas assez de texte lisible.");
    return text;
  }

  function detectPack(text, ref, label, price, hints = []) {
    const u = upper(text);
    const reference = new RegExp(`(?:PACK[^]{0,150}?[-–—]\\s*${ref}\\b|\\b${ref}\\b)`, "i");
    const hinted = hints.some((hint) => u.includes(upper(hint)));
    if (!reference.test(text) && !hinted) return null;
    let status = "Normal";
    const escapedHints = hints.map((h) => clean(h).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
    const around = new RegExp(`REMISE\\s+DE\\s+(25|50|100)\\s*%[^]{0,260}?(?:\\b${ref}\\b|${escapedHints || ref})`, "i");
    const hit = text.match(around);
    if (hit?.[1] === "100") status = "Offert";
    else if (hit?.[1] === "50") status = "Remise -50%";
    else if (hit?.[1] === "25") status = "Remise -25%";
    else if (new RegExp(`${price}[,.]00\\s*€?[^]{0,70}0[,.]00`, "i").test(text)) status = "Offert";
    else if (new RegExp(`${price}[,.]00\\s*€?[^]{0,70}${(price / 2).toFixed(2).replace(".", "[,.]")}`, "i").test(text)) status = "Remise -50%";
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
      /(?:Nom\s*Prenom|Nom\s+du\s+client)\s*:\s*(?:Monsieur|Madame|M\.?|Mme\.?)?\s*([A-ZÀ-ÖØ-Ý][A-ZÀ-ÖØ-Ý' -]{2,70}?)(?=\s+(?:Denomination|Statut|Date|Adresse|SIRET|Engagement|TVA|Code)|$)/i,
      /Donnees\s+de\s+facturation[^]{0,300}?Nom\s*Prenom\s*:\s*(?:Monsieur|Madame|M\.?|Mme\.?)?\s*([A-ZÀ-ÖØ-Ý][A-ZÀ-ÖØ-Ý' -]{2,70}?)(?=\s+(?:Denomination|Statut|Date|Adresse|SIRET|TVA|Code)|$)/i
    ];
    for (const rx of namePatterns) { const hit = text.match(rx); if (hit) { result.nomClient = clean(hit[1]); break; } }
    result.nomClient ||= "";

    m = text.match(/(?:PROCES\s+VERBAL\s+D['’]?INSTALLATION|CONTRAT|PROPOSITION\s+COMMERCIALE)[\s:.-]*(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{4})/i)
      || text.match(/Date\s+d['’]?(?:installation|contrat|offre)\s*[:\-]?\s*(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{4})/i)
      || text.match(/\b(\d{1,2}[\/.\-]\d{1,2}[\/.\-]20\d{2})\b/);
    result.dateVente = m ? dateIso(m[1]) : "";

    m = u.match(/ENGAGEMENT\s*(?:JURIDIQUE\s*)?[:\-]?\s*(12|24|36)\s*MOIS/) || u.match(/\b(12|24|36)\s*MOIS\b/);
    result.engagement = m ? Number(m[1]) : 36;

    result.typeClient = /SECURITE\s+START\s+PRO|\bPROFESSIONNEL\b|SIRET\s*[:\/]\s*\d{9,}/.test(u) ? "PRO" : "RESI";
    result.fi200start = /200\s*€?\s*HT\s+DE\s+REMISE\s+SUR\s+L['’]?INSTALLATION/i.test(text) || /399[,.]00\s*€?[^]{0,70}199[,.]00\s*€?/i.test(text);
    result.codePromo = /6\s*MOIS[^]{0,120}50\s*%/i.test(text) ? "6MO5POSTART" : /3\s*MOIS[^]{0,120}50\s*%/i.test(text) ? "3MO5POSTART" : "";
    result.statut = result.documentType === "PV" ? "Installe" : result.documentType === "CONTRAT" ? "Vendu" : "En attente";

    const catalog = [
      ["I1", "I1 — Intégrale 1", 199, ["MISE EN FUITE", "BROUILLARD"]],
      ["I2", "I2 — Intégrale 2", 199, []], ["I3", "I3 — Intégrale 3", 199, []], ["I4", "I4 — Intégrale 4", 199, []],
      ["P1", "P1 — Bouclier", 399, ["BOUCLIER"]], ["P2", "P2 — 5 Contacts", 199, ["5 DETECTEURS DE CHOC"]],
      ["P3", "P3 — 3 Contacts", 149, ["3 DETECTEURS DE CHOC"]], ["P4", "P4 — 1 Contact", 59, ["1 DETECTEUR DE CHOC"]],
      ["V1", "V1", 299, []], ["V2", "V2", 299, []], ["V3", "V3", 199, []], ["V4", "V4", 119, []],
      ["A1", "A1 — Arlo Pro 3", 199, []], ["A2", "A2 — Arlo Pro 4", 199, []], ["A3", "A3 — Arlo Pro 5", 199, []],
      ["A4", "A4 — Arlo Doorbell", 39, []], ["A5", "A5 — Arlo Ultra", 199, []]
    ];
    result.packs = catalog.map(([ref, label, price, hints]) => detectPack(text, ref, label, price, hints)).filter(Boolean);

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
    const packText = data.packs.length ? data.packs.map((p) => `${p.ref} · ${p.status}`).join(" / ") : "Aucun reconnu";
    const warnings = data.warnings.length ? `<div class="tbr-warn">${data.warnings.map((w) => `• ${esc(w)}`).join("<br>")}</div>` : "";
    sheet.innerHTML = `
      <h2>Fiche comprise par TBR</h2>
      <p>Vérifie les informations. Rien n'est enregistré à cette étape.</p>
      <div class="tbr-grid">
        <div class="tbr-field"><span>Document</span><b>${esc(data.documentType)}</b></div>
        <div class="tbr-field"><span>N° client</span><b>${esc(data.numClient || "À compléter")}</b></div>
        <div class="tbr-field tbr-full"><span>Client</span><b>${esc(data.nomClient || "À vérifier")}</b></div>
        <div class="tbr-field"><span>Date</span><b>${esc(data.dateVente || "À vérifier")}</b></div>
        <div class="tbr-field"><span>Client</span><b>${data.typeClient === "PRO" ? "Professionnel" : "Résidentiel"}</b></div>
        <div class="tbr-field"><span>Engagement</span><b>${esc(data.engagement)} mois</b></div>
        <div class="tbr-field"><span>FI200 Start</span><b>${data.fi200start ? "Oui" : "Non"}</b></div>
        <div class="tbr-field"><span>Code promo</span><b>${esc(data.codePromo || "Aucun")}</b></div>
        <div class="tbr-field tbr-full"><span>Packs</span><b>${esc(packText)}</b></div>
        <div class="tbr-field tbr-full"><span>Codes ABO</span><b>${esc(data.codesAbo.join(", ") || "Aucun")}</b></div>
      </div>
      ${warnings}
      <div class="tbr-choice"><button id="tbr-vd">VD</button><button id="tbr-vf">VF</button></div>
      <div class="tbr-actions"><button id="tbr-cancel">Annuler</button><button class="go" id="tbr-prefill">Préremplir la fiche</button></div>`;
    modal.classList.add("open");
    const choose = (type) => {
      selectedType = type;
      document.getElementById("tbr-vd").classList.toggle("active", type === "VD");
      document.getElementById("tbr-vf").classList.toggle("active", type === "VF");
    };
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
    const win = iframe.contentWindow;
    const proto = input instanceof win.HTMLTextAreaElement ? win.HTMLTextAreaElement.prototype : input instanceof win.HTMLSelectElement ? win.HTMLSelectElement.prototype : win.HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
    descriptor?.set?.call(input, value);
    input.dispatchEvent(new win.Event("input", {bubbles: true}));
    input.dispatchEvent(new win.Event("change", {bubbles: true}));
  }

  async function waitFor(predicate, timeout = 6000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const result = predicate();
      if (result) return result;
      await pause(80);
    }
    throw new Error("Le formulaire TBR n'a pas répondu assez vite.");
  }

  function findLabeledInput(doc, label, type = null) {
    const labels = [...doc.querySelectorAll("div,span,label")].filter((el) => el.children.length === 0 && clean(el.textContent) === clean(label));
    for (const labelEl of labels) {
      let row = labelEl.parentElement;
      for (let i = 0; row && i < 3; i++, row = row.parentElement) {
        const input = row.querySelector(type ? `input[type='${type}']` : "input,textarea,select");
        if (input) return input;
      }
    }
    return null;
  }

  function clickButton(doc, text) {
    const button = exactText(doc, "button", text) || [...doc.querySelectorAll("button")].find((b) => clean(b.textContent).startsWith(clean(text)));
    if (!button) throw new Error(`Bouton introuvable : ${text}`);
    button.click();
    return button;
  }

  async function setToggleByLabel(doc, label, desired) {
    const labelEl = [...doc.querySelectorAll("div,span,label")].find((el) => el.children.length === 0 && clean(el.textContent) === clean(label));
    if (!labelEl) return false;
    let row = labelEl.parentElement;
    for (let i = 0; row && i < 4; i++, row = row.parentElement) {
      const button = row.querySelector("button");
      if (!button) continue;
      const pressed = button.getAttribute("aria-pressed");
      if (pressed !== null) {
        if ((pressed === "true") !== desired) button.click();
        return true;
      }
      const txt = upper(button.textContent);
      if (["OUI","NON"].includes(txt)) {
        if ((txt === "OUI") !== desired) button.click();
        return true;
      }
    }
    return false;
  }

  async function prefillForm(data, typeVente) {
    const doc = iframe.contentDocument;
    if (!doc) throw new Error("TBR n'est pas prêt.");
    const manual = containsText(doc, "button", "Saisir à la main");
    if (!manual) throw new Error("Ouvre d'abord l'onglet Saisie dans TBR.");
    manual.click();
    await waitFor(() => doc.getElementById("tbr-sale-form-top"));

    const nameInput = findLabeledInput(doc, "Nom");
    const clientInput = findLabeledInput(doc, "N° client");
    const dateInput = findLabeledInput(doc, "Date", "date");
    if (!nameInput || !clientInput || !dateInput) throw new Error("Les champs client n'ont pas été retrouvés.");
    setNativeValue(nameInput, data.nomClient || "");
    setNativeValue(clientInput, data.numClient || "");
    setNativeValue(dateInput, data.dateVente || new Date().toISOString().slice(0, 10));

    clickButton(doc, typeVente === "VD" ? "VD — Directe" : "VF — Fournie");
    clickButton(doc, data.typeClient === "PRO" ? "Professionnel" : "Résidentiel");
    clickButton(doc, `${data.engagement} mois`);

    const promo = findLabeledInput(doc, "Code promo abonnement");
    if (promo) setNativeValue(promo, data.codePromo || "");

    if (data.fi200start) await setToggleByLabel(doc, "FI200 Start", true);

    for (const pack of data.packs) {
      clickButton(doc, `${pack.ref} — ${pack.price}€`);
      await pause(80);
      const statusSelect = [...doc.querySelectorAll("select")].find((select) => [...select.options].some((o) => o.textContent === "Remise -50%") && select.offsetParent !== null);
      if (statusSelect) setNativeValue(statusSelect, pack.status);
      const validate = [...doc.querySelectorAll("button")].find((b) => clean(b.textContent) === "✓ Valider" && b.offsetParent !== null);
      validate?.click();
      await pause(60);
    }

    for (const code of data.codesAbo) {
      const btn = exactText(doc, "button", code);
      btn?.click();
    }

    const statusText = data.statut === "Installe" ? "Installé" : data.statut === "En attente" ? "En attente" : "Vendu";
    const statusButton = exactText(doc, "button", statusText);
    statusButton?.click();

    document.getElementById("tbr-test-badge").textContent = "FICHE PRÉREMPLIE — NE PAS ENREGISTRER";
    doc.getElementById("tbr-sale-form-top")?.scrollIntoView({behavior: "smooth", block: "start"});
  }

  function installImportButton() {
    const doc = iframe.contentDocument;
    if (!doc) return;
    const button = [...doc.querySelectorAll("button")].find((b) => /Ajouter(?: d’autres)? captures du PV/i.test(clean(b.textContent)) || clean(b.textContent) === "Importer un PDF");
    if (!button || button.dataset.tbrPdfTest === "1") return;
    button.dataset.tbrPdfTest = "1";
    button.textContent = "📄 Importer un PDF";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      fileInput.value = "";
      fileInput.click();
    }, true);
    const help = button.parentElement?.nextElementSibling;
    if (help && /Ajoute 4, 5, 6 captures/i.test(clean(help.textContent))) help.textContent = "Importe le PDF complet. TBR lit le document puis préremplit la saisie. Rien n'est enregistré sans ta validation.";
  }

  iframe.addEventListener("load", () => {
    installImportButton();
    const doc = iframe.contentDocument;
    if (doc?.body) new MutationObserver(installImportButton).observe(doc.body, {childList: true, subtree: true});
  });

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") { showStatus("Sélectionne un fichier PDF.", true); return; }
    showStatus(`Lecture de ${file.name}…`);
    try { renderReview(parseDocument(await readPdf(file))); }
    catch (error) { showStatus(error.message || "Le document n'a pas pu être lu.", true); }
  });
})();