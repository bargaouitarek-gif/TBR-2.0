function setCors(req, res) {
  // TBR peut être ouvert depuis GitHub Pages, Vercel ou l'appli installée.
  // Le code personnel reste obligatoire côté serveur.
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
