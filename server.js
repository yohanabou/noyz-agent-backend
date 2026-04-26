// =============================================================
//  BACKEND/SERVER.JS — Proxy sécurisé pour l'API OpenAI
//  Installation : npm install express cors dotenv
//  Démarrage : node server.js
// =============================================================

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const https = require("https");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || "*",
  methods: ["POST"],
}));
app.use(express.json({ limit: "16kb" }));

// ── Route principale : reçoit les messages et interroge OpenAI ──
app.post("/chat", async (req, res) => {
  const { messages, systemPrompt, model, temperature, maxTokens } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "messages manquants" });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Clé API non configurée sur le serveur." });
  }

  const payload = JSON.stringify({
    model: model || "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt || "Tu es un assistant utile." },
      ...messages,
    ],
    temperature: temperature || 0.4,
    max_tokens: maxTokens || 600,
  });

  const options = {
    hostname: "api.openai.com",
    path: "/v1/chat/completions",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "Content-Length": Buffer.byteLength(payload),
    },
  };

  const apiReq = https.request(options, (apiRes) => {
    let data = "";
    apiRes.on("data", (chunk) => data += chunk);
    apiRes.on("end", () => {
      try {
        const parsed = JSON.parse(data);
        if (parsed.error) {
          return res.status(502).json({ error: parsed.error.message });
        }
        const content = parsed.choices?.[0]?.message?.content || "";
        res.json({ reply: content });
      } catch (e) {
        res.status(500).json({ error: "Erreur parsing réponse OpenAI" });
      }
    });
  });

  apiReq.on("error", (err) => {
    res.status(500).json({ error: err.message });
  });

  apiReq.write(payload);
  apiReq.end();
});

// ── Health check ──
app.get("/health", (_, res) => res.json({ status: "ok" }));

app.listen(PORT, () => {
  console.log(`✅ Serveur chat démarré sur http://localhost:${PORT}`);
});
