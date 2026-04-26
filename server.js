require("dotenv").config();
const express = require("express");
const cors = require("cors");
const https = require("https");

const app = express();
// Railway injecte automatiquement la variable PORT — ne pas mettre 3001 en dur
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: "*",  // On accepte tout pour simplifier, tu pourras restreindre plus tard
  methods: ["POST", "GET"],
}));
app.use(express.json({ limit: "16kb" }));

// Health check — pour vérifier que le serveur tourne
app.get("/", (_, res) => res.json({ status: "ok", message: "Noyz Agent backend online ✅" }));
app.get("/health", (_, res) => res.json({ status: "ok" }));

// Route principale chat
app.post("/chat", async (req, res) => {
  const { messages, systemPrompt, model, temperature, maxTokens } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "messages manquants" });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Clé API non configurée." });
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
        if (parsed.error) return res.status(502).json({ error: parsed.error.message });
        const content = parsed.choices?.[0]?.message?.content || "";
        res.json({ reply: content });
      } catch (e) {
        res.status(500).json({ error: "Erreur parsing OpenAI" });
      }
    });
  });

  apiReq.on("error", (err) => res.status(500).json({ error: err.message }));
  apiReq.write(payload);
  apiReq.end();
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Noyz Agent backend démarré sur port ${PORT}`);
});
