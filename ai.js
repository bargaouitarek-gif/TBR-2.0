const crypto = require("crypto");

const DEFAULT_MODEL = "gpt-5";
const FALLBACK_MODELS = ["gpt-5", "gpt-4.1"];
const MAX_HISTORY_MESSAGES = 16;
const MAX_MESSAGE_CHARS = 16000;
const MAX_CONTEXT_CHARS = 145000;
const MAX_FILE_DATA_CHARS = 3_200_000;
const OPENAI_TIMEOUT_MS = 75000;

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

function normalizeOrigin(value) {
  try {
    return new URL(String(value || "")).origin;
  } catch {
    return "";
  }
}

function isAllowedOrigin(origin) {
  const normalized = normalizeOrigin(origin);
  if (!normalized) return false;
  if (normalized === "https://bargaouitarek-gif.github.io") return true;
  if (normalized === "https://tbr-2-0.vercel.app") return true;
  if (/^https:\/\/tbr-2-0-[a-z0-9-]+-bargaouitarek-gifs-projects\.vercel\.app$/i.test(normalized)) return true;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(normalized)) return true;
  return false;
}

function setCors(req, res) {
  const origin = String(req.headers.origin || "");
  if (isAllowedOrigin(origin)) res.setHeader("Access-Control-Allow-Origin", normalizeOrigin(origin));
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-TBR-Access-Code");
  res.setHeader("Access-Control-Max-Age", "86400");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
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
  return history
    .slice(-MAX_HISTORY_MESSAGES)
    .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.text === "string")
    .map(m => ({ role: m.role, content: m.text.slice(0, 8000) }));
}

function safeContext(context) {
  if (!context || typeof context !== "object") return {};
  let clone;
  try {
    clone = JSON.parse(JSON.stringify(context));
  } catch {
    return {};
  }
  if (Array.isArray(clone.memoiresConfirmees)) clone.memoiresConfirmees = clone.memoiresConfirmees.slice(-60);
  if (Array.isArray(clone.ventes)) clone.ventes = clone.ventes.slice(-250);
  return clone;
}

function validateFile(file) {
  if (!file) return null;
  if (typeof file !== "object" || typeof file.data !== "string" || !file.data) {
    throw new Error("Document joint invalide.");
  }
  if (file.data.length > MAX_FILE_DATA_CHARS) {
    throw new Error("Le document est trop volumineux pour l'analyse directe. Limite conseillée : environ 2 Mo.");
  }
  return {
    name: String(file.name || "document").slice(0, 180),
    mimeType: String(file.mimeType || "application/octet-stream").slice(0, 120),
    data: file.data,
  };
}

function makeUserContent(message, context, file) {
  const contextText = JSON.stringify(safeContext(context)).slice(0, MAX_CONTEXT_CHARS);
  const content = [{
    type: "input_text",
    text: `${String(message || "Analyse les données TBR fournies.").slice(0, MAX_MESSAGE_CHARS)}\n\nCONTEXTE STRUCTURÉ TBR\n${contextText}`,
  }];

  const safeFile = validateFile(file);
  if (safeFile) {
    const raw = safeFile.data.includes(",") ? safeFile.data.split(",").pop() : safeFile.data;
    if (safeFile.mimeType.startsWith("image/")) {
      content.push({
        type: "input_image",
        image_url: safeFile.data.startsWith("data:") ? safeFile.data : `data:${safeFile.mimeType};base64,${raw}`,
        detail: "high",
      });
    } else {
      content.push({ type: "input_file", filename: safeFile.name, file_data: raw });
    }
  }
  return content;
}

function usesReasoning(model) {
  return /^(gpt-5|o\d)/i.test(String(model || ""));
}

function modelCandidates() {
  return [...new Set([process.env.OPENAI_MODEL, ...FALLBACK_MODELS].filter(Boolean))];
}

async function requestOpenAI({ model, input }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);
  const body = {
    model,
    instructions: TBR_INSTRUCTIONS,
    input,
    max_output_tokens: 4200,
    store: false,
  };
  if (usesReasoning(model)) body.reasoning = { effort: process.env.OPENAI_REASONING_EFFORT || "high" };

  try {
    return await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  if (a.length !== b.length || a.length === 0) return false;
  return crypto.timingSafeEqual(a, b);
}

function healthPayload() {
  const missing = [];
  if (!process.env.OPENAI_API_KEY) missing.push("OPENAI_API_KEY");
  if (!process.env.TBR_ACCESS_CODE) missing.push("TBR_ACCESS_CODE");
  return {
    ok: true,
    service: "TBR IA",
    configured: missing.length === 0,
    model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
    fallbacks: FALLBACK_MODELS,
    missing,
  };
}

module.exports = async function handler(req, res) {
  setCors(req, res);

  if (req.method === "OPTIONS") {
    if (req.headers.origin && !isAllowedOrigin(req.headers.origin)) return res.status(403).end();
    return res.status(204).end();
  }

  if (req.method === "GET") return res.status(200).json(healthPayload());
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée." });

  try {
    const health = healthPayload();
    if (!health.configured) {
      return res.status(503).json({
        error: "Le serveur TBR IA n'est pas encore configuré.",
        missing: health.missing,
      });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const accessCode = String(req.headers["x-tbr-access-code"] || body.accessCode || "");
    if (!safeEqual(accessCode, process.env.TBR_ACCESS_CODE)) {
      return res.status(401).json({ error: "Code d'accès TBR incorrect." });
    }

    const message = String(body.message || "").trim();
    if (!message && !body.file) return res.status(400).json({ error: "Question ou document manquant." });
    if (message.length > MAX_MESSAGE_CHARS) return res.status(413).json({ error: "Question trop longue." });

    const input = [
      ...safeHistory(body.history),
      { role: "user", content: makeUserContent(message, body.context, body.file) },
    ];

    let lastStatus = 502;
    let lastDetail = "Erreur OpenAI inconnue.";
    let lastModel = process.env.OPENAI_MODEL || DEFAULT_MODEL;

    for (const model of modelCandidates()) {
      lastModel = model;
      let response;
      let payload;
      try {
        response = await requestOpenAI({ model, input });
        payload = await response.json();
      } catch (error) {
        if (error && error.name === "AbortError") {
          lastStatus = 504;
          lastDetail = "Le modèle a dépassé le délai de réponse.";
          break;
        }
        throw error;
      }

      if (response.ok) {
        const answer = extractOutputText(payload);
        if (!answer) return res.status(502).json({ error: "L'IA n'a pas renvoyé de réponse exploitable." });
        return res.status(200).json({ answer, responseId: payload.id || null, model: payload.model || model });
      }

      lastStatus = response.status;
      lastDetail = payload?.error?.message || "Erreur OpenAI inconnue.";
      const canTryAnotherModel = [400, 403, 404].includes(response.status);
      if (!canTryAnotherModel) break;
    }

    console.error("TBR IA OpenAI error", lastStatus, lastModel, lastDetail);
    return res.status(lastStatus).json({
      error: lastStatus === 429
        ? "Limite d'utilisation OpenAI atteinte. Réessaie dans quelques instants."
        : lastStatus === 401
          ? "La connexion OpenAI du serveur TBR doit être vérifiée."
          : `Le modèle IA n'a pas pu répondre : ${lastDetail}`,
    });
  } catch (error) {
    console.error("TBR IA error", error);
    if (error instanceof SyntaxError) return res.status(400).json({ error: "Requête IA invalide." });
    if (/trop volumineux|trop longue/i.test(String(error && error.message))) {
      return res.status(413).json({ error: error.message });
    }
    return res.status(500).json({ error: "Erreur technique du serveur TBR IA." });
  }
};
