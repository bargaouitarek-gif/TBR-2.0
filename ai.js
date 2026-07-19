const TBR_INSTRUCTIONS = `
Tu es l'assistant personnel intégré à TBR 2.0, le cockpit commercial de Tarek, expert sécurité Verisure.

MISSION
- Aider Tarek à comprendre ses ventes, commissions, installations, paliers, VD/VF, AIMT, DCO, PV et documents.
- Répondre en français, de façon directe, claire, concrète et structurée.
- Utiliser en priorité le CONTEXTE STRUCTURÉ TBR reçu avec chaque question.
- Tenir compte des memoiresConfirmees : ce sont des informations explicitement validées par Tarek dans TBR.
- Lorsque les données sont insuffisantes, le dire franchement et demander l'information manquante au lieu d'inventer.

RÈGLES ABSOLUES
- Ne jamais prétendre avoir modifié une vente, une commission, un document, GitHub ou l'application. Tu analyses et tu proposes seulement.
- Ne jamais conseiller de vider le cache, supprimer les données du navigateur, désinstaller la PWA ou réinitialiser localStorage.
- Ne jamais révéler ou demander une clé OpenAI, un jeton GitHub ou un secret serveur.
- Ne jamais présenter une interprétation comme une règle officielle Verisure. Distinguer clairement : fait confirmé, calcul TBR, hypothèse, point à vérifier.
- Pour le DCO, ne jamais compenser un montant versé en moins avec un montant versé en plus. Afficher les deux séparément, client par client et avec leur origine.
- Respecter les données existantes et les règles métier fournies dans le contexte.

MÉMOIRE ET APPRENTISSAGE
- Les éléments dans memoiresConfirmees sont prioritaires sauf contradiction évidente avec une donnée actuelle.
- Si Tarek dit « ce n'est pas correct », demande la règle exacte à retenir et indique la commande : Corrige cette règle : ancienne règle => nouvelle règle.
- Si une nouvelle information paraît importante mais n'est pas explicitement confirmée, propose à Tarek de l'enregistrer avec : Retiens cela : ...
- N'affirme jamais avoir appris durablement une information qui n'apparaît pas dans memoiresConfirmees.

STYLE
- Va au résultat utile sans longues introductions.
- Donne les montants exacts lorsqu'ils sont disponibles.
- Pour une anomalie, explique : ce qui est observé, l'impact en euros, la cause probable, puis l'action concrète.
- Pour une réclamation, prépare un texte professionnel prêt à envoyer, sans inventer de référence.
- Pour un document joint, cite les éléments visibles et signale ce qui reste incertain.
`;

function setCors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-TBR-Access-Code");
  res.setHeader("Access-Control-Max-Age", "86400");
  res.setHeader("Cache-Control", "no-store");
}

function extractOutputText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) return payload.output_text.trim();
  const parts = [];
  for (const item of payload?.output || []) {
    for (const content of item?.content || []) {
      if ((content?.type === "output_text" || content?.type === "text") && content?.text) parts.push(content.text);
    }
  }
  return parts.join("\n").trim();
}

function safeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history.slice(-16)
    .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.text === "string")
    .map(m => ({ role: m.role, content: m.text.slice(0, 8000) }));
}

function safeContext(context) {
  if (!context || typeof context !== "object") return {};
  const clone = JSON.parse(JSON.stringify(context));
  if (Array.isArray(clone.memoiresConfirmees)) clone.memoiresConfirmees = clone.memoiresConfirmees.slice(-60);
  if (Array.isArray(clone.ventes)) clone.ventes = clone.ventes.slice(-250);
  return clone;
}

function makeUserContent(message, context, file) {
  const content = [{
    type: "input_text",
    text: `${String(message || "Analyse les données TBR fournies.").slice(0, 16000)}\n\nCONTEXTE STRUCTURÉ TBR\n${JSON.stringify(safeContext(context)).slice(0, 150000)}`,
  }];
  if (file && typeof file.data === "string" && file.data.length > 0) {
    const name = String(file.name || "document").slice(0, 180);
    const mime = String(file.mimeType || "application/octet-stream");
    const raw = file.data.includes(",") ? file.data.split(",").pop() : file.data;
    if (mime.startsWith("image/")) {
      content.push({ type: "input_image", image_url: file.data.startsWith("data:") ? file.data : `data:${mime};base64,${raw}`, detail: "high" });
    } else {
      content.push({ type: "input_file", filename: name, file_data: raw });
    }
  }
  return content;
}

async function requestOpenAI({ model, input }) {
  return fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      instructions: TBR_INSTRUCTIONS,
      input,
      reasoning: { effort: process.env.OPENAI_REASONING_EFFORT || "high" },
      max_output_tokens: 4200,
      store: false,
    }),
  });
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      service: "TBR IA",
      model: process.env.OPENAI_MODEL || "gpt-5.6",
      configured: Boolean(process.env.OPENAI_API_KEY && process.env.TBR_ACCESS_CODE),
    });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée." });

  try {
    if (!process.env.OPENAI_API_KEY || !process.env.TBR_ACCESS_CODE) {
      return res.status(503).json({ error: "Le serveur TBR IA n'est pas encore configuré." });
    }
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const accessCode = String(req.headers["x-tbr-access-code"] || body.accessCode || "");
    if (!accessCode || accessCode !== process.env.TBR_ACCESS_CODE) {
      return res.status(401).json({ error: "Code d'accès TBR incorrect." });
    }
    const message = String(body.message || "").trim();
    if (!message && !body.file) return res.status(400).json({ error: "Question ou document manquant." });

    const input = [
      ...safeHistory(body.history),
      { role: "user", content: makeUserContent(message, body.context, body.file) },
    ];

    const preferredModel = process.env.OPENAI_MODEL || "gpt-5.6";
    let response = await requestOpenAI({ model: preferredModel, input });
    let payload = await response.json();

    if (!response.ok && preferredModel === "gpt-5.6" && (response.status === 400 || response.status === 403 || response.status === 404)) {
      response = await requestOpenAI({ model: "gpt-5.5", input });
      payload = await response.json();
    }

    if (!response.ok) {
      const detail = payload?.error?.message || "Erreur OpenAI inconnue.";
      console.error("TBR IA OpenAI error", response.status, detail);
      return res.status(response.status).json({ error: detail });
    }
    const answer = extractOutputText(payload);
    if (!answer) return res.status(502).json({ error: "L'IA n'a pas renvoyé de réponse exploitable." });
    return res.status(200).json({ answer, responseId: payload.id || null, model: payload.model || preferredModel });
  } catch (error) {
    console.error("TBR IA error", error);
    return res.status(500).json({ error: "Erreur technique du serveur TBR IA." });
  }
};
