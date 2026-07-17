const ALLOWED_ORIGINS = new Set([
  "https://bargaouitarek-gif.github.io",
  "https://tbr-2-0.vercel.app",
]);

const TBR_INSTRUCTIONS = `
Tu es l'assistant IA personnel de TBR, l'application commerciale de Tarak Bargaoui, agence 510, matricule 104137.
Tu réponds toujours en français, de façon directe, claire et opérationnelle.

TON RÔLE
- Aider dans toute l'application TBR : saisie des ventes, lecture des procès-verbaux d'installation, contrôle DCO, calculs, explication des écarts, préparation des réclamations, suivi commercial et JUMPER.
- Utiliser en priorité les données structurées fournies par l'application. Ne jamais inventer un montant, un numéro client ou une règle absente du contexte.
- Quand un document est fourni, le lire attentivement et distinguer ce qui est certain, probable ou à confirmer.

RÈGLES DE CONTRÔLE DCO
- Comparer séparément chaque élément : commission vente/kit, commission packs, installation, paliers ventes totales, paliers ventes directes, bonus Silver/Gold/Platinium, booster, annulations et régularisations.
- Ne jamais compenser un montant versé en plus avec un montant versé en moins. Présenter les deux totaux séparément, puis éventuellement le solde net à titre indicatif.
- Pour chaque anomalie, afficher : client, numéro client, élément concerné, montant attendu, montant DCO, différence, explication précise et action recommandée.
- Pour une réclamation, rédiger un mail prêt à envoyer, factuel et poli, avec objet, détail ligne par ligne, total à régulariser et demande de confirmation.
- Si le statut VD/VF, le type de client, l'engagement ou une donnée décisive manque, le dire clairement et poser la question minimale nécessaire.

LECTURE DES PV
- Rechercher : numéro client, nom, date, agence, catégorie/type de client, engagement, offre, packs, éléments, remises, installation HT, abonnement, vendeur, origine marketing, installation terminée ou non.
- Ne pas déduire VD/VF si le document ne l'indique pas clairement.
- Proposer une fiche de vente structurée à valider, sans modifier les données de l'application de façon invisible.

STYLE
- Commencer par la conclusion utile.
- Employer des montants en euros avec deux décimales quand nécessaire.
- Éviter les explications vagues. Dire exactement où se trouve l'écart.
- Quand les données ne suffisent pas, le signaler au lieu de deviner.
`;

function setCors(req, res) {
  const origin = String(req.headers.origin || "");
  const allowed = ALLOWED_ORIGINS.has(origin) || /^https:\/\/tbr-2-0-[a-z0-9-]+\.vercel\.app$/i.test(origin);
  res.setHeader("Access-Control-Allow-Origin", allowed ? origin : "https://bargaouitarek-gif.github.io");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-TBR-Access-Code");
  res.setHeader("Access-Control-Max-Age", "86400");
  res.setHeader("Vary", "Origin");
  res.setHeader("Cache-Control", "no-store");
}

function extractOutputText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) return payload.output_text.trim();
  const parts = [];
  for (const item of payload?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === "output_text" && content?.text) parts.push(content.text);
    }
  }
  return parts.join("\n").trim();
}

function safeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history.slice(-10)
    .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.text === "string")
    .map(m => ({ role: m.role, content: [{ type: "input_text", text: m.text.slice(0, 6000) }] }));
}

function makeUserContent(message, context, file) {
  const content = [{
    type: "input_text",
    text: `${String(message || "Analyse les données TBR fournies.").slice(0, 12000)}\n\nCONTEXTE STRUCTURÉ TBR\n${JSON.stringify(context || {}).slice(0, 90000)}`,
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

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method === "GET") {
    return res.status(200).json({ ok: true, service: "TBR IA", configured: Boolean(process.env.OPENAI_API_KEY && process.env.TBR_ACCESS_CODE) });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée." });

  try {
    if (!process.env.OPENAI_API_KEY || !process.env.TBR_ACCESS_CODE) {
      return res.status(503).json({ error: "Le serveur TBR IA n'est pas encore configuré." });
    }
    const accessCode = String(req.headers["x-tbr-access-code"] || "");
    if (!accessCode || accessCode !== process.env.TBR_ACCESS_CODE) {
      return res.status(401).json({ error: "Code d'accès TBR incorrect." });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const message = String(body.message || "").trim();
    if (!message && !body.file) return res.status(400).json({ error: "Question ou document manquant." });

    const input = [
      ...safeHistory(body.history),
      { role: "user", content: makeUserContent(message, body.context, body.file) },
    ];

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5",
        instructions: TBR_INSTRUCTIONS,
        input,
        max_output_tokens: 2200,
        store: false,
      }),
    });

    const payload = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: payload?.error?.message || "Erreur OpenAI inconnue." });
    const answer = extractOutputText(payload);
    if (!answer) return res.status(502).json({ error: "L'IA n'a pas renvoyé de réponse exploitable." });
    return res.status(200).json({ answer, responseId: payload.id || null });
  } catch (error) {
    console.error("TBR IA error", error);
    return res.status(500).json({ error: "Erreur technique du serveur TBR IA." });
  }
};
