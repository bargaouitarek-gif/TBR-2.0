const TBR_AI_VERSION = "2026.08.14-brain-v2";

const TBR_INSTRUCTIONS = `
Tu es TBR IA, le copilote personnel intégré à TBR 2.0.
Tu aides Tarek à piloter son activité commerciale et à contrôler ses rémunérations à partir des DONNÉES RÉELLES transmises par TBR.

PRIORITÉ ABSOLUE
1. Données structurées TBR du message courant.
2. Mémoires explicitement confirmées dans memoiresConfirmees.
3. Historique récent de la conversation.
4. Raisonnement général uniquement quand les données TBR ne suffisent pas.

DOMAINES TBR
- ventes, clients, VD/VF, statuts et installations ;
- commissions, packs, abonnements, bonus, challenges, paliers et objectifs ;
- DCO : contrôle ligne par ligne, écarts, sommes en défaveur et réclamations ;
- documents : propositions, contrats, PV, PDF et images transmis ;
- performance : progression mensuelle, priorités et actions commerciales.

PROTOCOLE DE FIABILITÉ
- Ne jamais inventer une donnée client, un montant, un barème ou une règle Verisure.
- Distinguer explicitement : FAIT TBR / CALCUL / HYPOTHÈSE / À VÉRIFIER.
- Pour tout calcul financier important, vérifier mentalement les additions et les signes avant de répondre.
- Un écart positif et un écart négatif restent séparés : ne jamais les compenser automatiquement.
- Pour une somme supposée manquante, préciser si possible : client, n° client, rubrique, versé, attendu, différence et origine de l'écart.
- Si le contexte ne permet pas d'expliquer POURQUOI un montant diffère, dire « cause à vérifier » au lieu d'inventer une cause.
- Ne jamais transformer une estimation en somme officiellement due.
- Si deux sources TBR se contredisent, signaler la contradiction et privilégier la source la plus précise/confirmée sans masquer l'autre.

MODE COPILOTE
Quand la question est large, ne récite pas toutes les données. Identifie ce qui mérite l'attention et propose l'action la plus utile.
Quand Tarek demande « analyse », cherche en priorité : anomalies financières, incohérences, éléments manquants, opportunités et prochaine action.
Quand Tarek demande un mail, produire directement un texte professionnel prêt à copier-coller et n'inclure que les informations utiles au destinataire.
Quand Tarek demande « pourquoi », expliquer le calcul ou la donnée source avant de donner une hypothèse.
Quand Tarek demande une décision, donner une recommandation claire puis les éléments qui la justifient.

MÉMOIRE
- memoiresConfirmees contient les informations explicitement validées dans TBR et a priorité sur les suppositions.
- Ne prétends jamais mémoriser durablement une information absente de memoiresConfirmees.
- Si une règle métier doit être corrigée, explique précisément l'ancienne compréhension et la nouvelle règle proposée.

LIMITES D'ACTION
- Tu peux analyser, calculer, rédiger et recommander.
- Ne prétends jamais avoir modifié une vente, un DCO, GitHub ou l'application si aucune action TBR explicite ne t'a été fournie.
- Ne demande jamais une clé API, un jeton ou un secret.
- Ne conseille pas de supprimer localStorage, vider les données ou réinitialiser l'application.

STYLE
- Français naturel, direct et concret.
- Commencer par la réponse utile, pas par une longue introduction.
- Utiliser des listes courtes seulement quand elles améliorent la lecture.
- Afficher les euros avec deux décimales lorsque le montant est connu.
- Ne pas noyer Tarek sous du jargon technique.
`;

function setCors(req, res) {
  const allowedOrigin = process.env.TBR_ALLOWED_ORIGIN || "*";
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-TBR-Access-Code");
  res.setHeader("Access-Control-Max-Age", "86400");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-TBR-AI-Version", TBR_AI_VERSION);
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
  return history.slice(-20)
    .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.text === "string")
    .map(m => ({ role: m.role, content: m.text.slice(0, 9000) }));
}

function safeContext(context) {
  if (!context || typeof context !== "object") return {};
  let clone;
  try { clone = JSON.parse(JSON.stringify(context)); } catch { return {}; }
  if (Array.isArray(clone.memoiresConfirmees)) clone.memoiresConfirmees = clone.memoiresConfirmees.slice(-80);
  if (Array.isArray(clone.ventes)) clone.ventes = clone.ventes.slice(-350);
  if (Array.isArray(clone.dcoRows)) clone.dcoRows = clone.dcoRows.slice(-500);
  if (Array.isArray(clone.documents)) clone.documents = clone.documents.slice(-80);
  return clone;
}

function contextManifest(context) {
  const c = safeContext(context);
  const count = key => Array.isArray(c[key]) ? c[key].length : 0;
  return {
    page: c.page || c.currentPage || null,
    mois: c.mois || c.month || c.currentMonth || null,
    ventes: count("ventes"),
    lignesDco: count("dcoRows"),
    documents: count("documents"),
    memoiresConfirmees: count("memoiresConfirmees"),
    clientActif: c.clientActif?.numClient || c.clientActif?.numeroClient || c.clientActif?.nomClient || null,
  };
}

function makeUserContent(message, context, file) {
  const safe = safeContext(context);
  const manifest = contextManifest(safe);
  const content = [{
    type: "input_text",
    text: `${String(message || "Analyse les données TBR fournies.").slice(0, 18000)}\n\nMANIFESTE DU CONTEXTE TBR\n${JSON.stringify(manifest)}\n\nCONTEXTE STRUCTURÉ TBR\n${JSON.stringify(safe).slice(0, 180000)}`,
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
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      instructions: TBR_INSTRUCTIONS,
      input,
      reasoning: { effort: process.env.OPENAI_REASONING_EFFORT || "high" },
      max_output_tokens: Number(process.env.OPENAI_MAX_OUTPUT_TOKENS || 5200),
      store: false,
    }),
  });
}

async function callWithFallback(input) {
  const preferred = process.env.OPENAI_MODEL || "gpt-5.6";
  const fallback = process.env.OPENAI_FALLBACK_MODEL || "gpt-5.5";
  const models = [...new Set([preferred, fallback].filter(Boolean))];
  let last = null;
  for (const model of models) {
    const response = await requestOpenAI({ model, input });
    const payload = await response.json().catch(() => ({}));
    last = { response, payload, model };
    if (response.ok) return last;
    if (![400, 403, 404].includes(response.status)) break;
  }
  return last;
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      service: "TBR IA",
      version: TBR_AI_VERSION,
      model: process.env.OPENAI_MODEL || "gpt-5.6",
      configured: Boolean(process.env.OPENAI_API_KEY && process.env.TBR_ACCESS_CODE),
      capabilities: ["chat", "contexte-tbr", "historique", "images", "fichiers", "dco", "commissions", "analyse-commerciale"],
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

    const result = await callWithFallback(input);
    if (!result) return res.status(502).json({ error: "Aucun modèle IA disponible." });
    const { response, payload, model } = result;

    if (!response.ok) {
      const detail = payload?.error?.message || "Erreur OpenAI inconnue.";
      console.error("TBR IA OpenAI error", response.status, detail);
      return res.status(response.status).json({ error: detail });
    }

    const answer = extractOutputText(payload);
    if (!answer) return res.status(502).json({ error: "L'IA n'a pas renvoyé de réponse exploitable." });

    return res.status(200).json({
      answer,
      responseId: payload.id || null,
      model: payload.model || model,
      version: TBR_AI_VERSION,
      context: contextManifest(body.context),
    });
  } catch (error) {
    console.error("TBR IA error", error);
    return res.status(500).json({ error: "Erreur technique du serveur TBR IA." });
  }
};
