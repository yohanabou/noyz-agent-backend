require("dotenv").config();

const express = require("express");
const cors = require("cors");
const https = require("https");

const app = express();
const PORT = process.env.PORT || 3001;
const MODEL = "gpt-4o-mini"; // Tu pourras passer à "gpt-4o" si tu veux des réponses encore plus fines

app.use(cors({
  origin: "*",
  methods: ["POST", "GET", "OPTIONS"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json({ limit: "64kb" }));

app.get("/", (_, res) => {
  res.json({
    status: "ok",
    message: "Noyz Assistant Appel — cerveau dynamique online ✅",
    endpoints: ["/health", "/chat", "/analyze-call"]
  });
});

app.get("/health", (_, res) => {
  res.json({
    status: "ok",
    openaiKeyConfigured: Boolean(process.env.OPENAI_API_KEY)
  });
});

function cleanText(value, maxLength = 3000) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanHistory(history) {
  if (!Array.isArray(history)) return [];

  return history
    .slice(-12)
    .map((item) => ({
      speaker: cleanText(item?.speaker, 30) || "inconnu",
      text: cleanText(item?.text, 700)
    }))
    .filter((item) => item.text);
}

function openAI(payload) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return reject(new Error("Clé API OpenAI manquante dans Render."));
    }

    const body = JSON.stringify(payload);

    const request = https.request({
      hostname: "api.openai.com",
      path: "/v1/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "Content-Length": Buffer.byteLength(body)
      }
    }, (response) => {
      let data = "";

      response.on("data", (chunk) => {
        data += chunk;
      });

      response.on("end", () => {
        try {
          const parsed = JSON.parse(data);

          if (response.statusCode < 200 || response.statusCode >= 300 || parsed.error) {
            return reject(new Error(parsed?.error?.message || `Erreur OpenAI : ${response.statusCode}`));
          }

          resolve(parsed);
        } catch (_) {
          reject(new Error("Réponse OpenAI impossible à lire."));
        }
      });
    });

    request.on("error", reject);
    request.write(body);
    request.end();
  });
}

function parseJSON(text) {
  return JSON.parse(
    String(text)
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim()
  );
}

/* -------------------------------------------------------------------------
   Ancienne route de chat : conservée pour ton ancien agent Noyz.
------------------------------------------------------------------------- */
app.post("/chat", async (req, res) => {
  try {
    const { messages, systemPrompt, model, temperature, maxTokens } = req.body;

    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: "messages manquants" });
    }

    const cleanMessages = messages
      .slice(-20)
      .map((message) => ({
        role: message?.role === "assistant" ? "assistant" : "user",
        content: cleanText(message?.content, 4000)
      }))
      .filter((message) => message.content);

    const response = await openAI({
      model: model || MODEL,
      messages: [
        {
          role: "system",
          content: cleanText(systemPrompt, 6000) || "Tu es un assistant utile et professionnel."
        },
        ...cleanMessages
      ],
      temperature: temperature ?? 0.4,
      max_tokens: maxTokens ?? 700
    });

    res.json({
      reply: response?.choices?.[0]?.message?.content || ""
    });
  } catch (error) {
    console.error("Erreur /chat :", error.message);
    res.status(500).json({
      error: error.message || "Erreur serveur."
    });
  }
});

/* -------------------------------------------------------------------------
   CERVEAU DYNAMIQUE : MÉTHODE LIGNE DROITE + 3 RÉPONSES
------------------------------------------------------------------------- */
app.post("/analyze-call", async (req, res) => {
  try {
    const lastMessage = cleanText(req.body?.prospectMessage, 2500);

    if (!lastMessage) {
      return res.status(400).json({
        error: "La phrase du prospect est obligatoire."
      });
    }

    const context = {
      companyName: cleanText(req.body?.companyName, 120) || "Entreprise non précisée",
      businessType: cleanText(req.body?.businessType, 120) || "Activité non précisée",
      city: cleanText(req.body?.city, 120) || "Ville non précisée",
      websiteStatus: cleanText(req.body?.websiteStatus, 120) || "Inconnu",
      callStage: cleanText(req.body?.callStage, 120) || "Objection",
      history: cleanHistory(req.body?.callHistory)
    };

    const systemPrompt = `
Tu es le cerveau dynamique de l'assistant d'appel personnel de Yohan, expert en closing d'élite et formé à la méthode de la Ligne Droite de Jordan Belfort.

CONTEXTE
Yohan appelle des artisans, commerçants et petites entreprises. Il propose une présence web professionnelle à 500€ (paiement unique), sans forcing, avec une approche conseil et éthique.

MISSION
À partir de la dernière phrase EXACTE du prospect, du contexte et de l'historique :
1. Comprends l'intention réelle derrière ses mots. Les objections sont souvent des écrans de fumée masquant une incertitude.
2. Identifie son ton.
3. Génère TROIS RÉPONSES ORALES VRAIMENT DIFFÉRENTES que Yohan peut dire immédiatement.

MÉTHODE DE LA LIGNE DROITE & POSTURE DE YOHAN
- Ne jamais forcer. L'objectif est l'utilité réelle pour le prospect. Yohan est un filtre, pas un alchimiste.
- Objectif "Les Trois Dix" : Aligner la certitude absolue envers le Produit (le site à 500€), le Vendeur (Yohan), et l'Entreprise.
- Le Looping (Déviation) : Ne réponds pas toujours littéralement à l'objection. Contourne et ramène la certitude (ex: "J'entends ce que vous dites, mais laissez-moi vous demander : l'idée vous semble-t-elle logique ?").
- TONALITÉS OBLIGATOIRES : Le ton compte pour 45% de la vente. Tu dois OBLIGATOIREMENT commencer chaque réponse par la tonalité à adopter entre crochets. Exemples : [Ton de l'homme raisonnable], [Certitude absolue], [Empathie / Je ressens votre douleur], [Sincérité totale], [Mystère].
- Utilise des pauses naturelles avec "..." (ex: "Je comprends... est-ce que..."). 1 à 3 pauses max par réponse.

STRATÉGIES À ADAPTER (Basées sur le script de Yohan)
- "Pas besoin / Assez de clients" : Reconnaître que c'est super. Parler de réassurance des clients recommandés ou du filtrage des appels inutiles.
- "C'est trop cher" : Distinguer budget et valeur perçue. Proposer d'envoyer le détail pour comparer à tête reposée.
- "Je dois réfléchir" : Demander doucement ce qu'il faut éclaircir (budget, utilité, confiance).

🔴 CAS "LE CLIENT VEUT AVANCER / ACHETER" (Étape 7 du script)
Si le client dit "Je veux acheter", "On fait comment ?", "Allons-y", "Combien je vous dois ?" :
- NE CHERCHE PLUS À CONVAINCRE NI À POSER DES QUESTIONS DE DÉCOUVERTE.
- Réponse 1 (Directe) : Remercie pour la confiance, annonce l'envoi du devis et demande une info logistique (email ou nom de l'entreprise).
- Réponse 2 (Rassurante) : Valide son choix, explique qu'aucune mise en ligne ne se fait sans sa validation, et demande par quoi il veut commencer (photos, textes).
- Réponse 3 (Processus) : Explique les 3 étapes (devis, récupération infos, création) et demande son email.

CAS "JE NE SUIS PAS INTÉRESSÉ" / FATIGUE DES APPELS
- Reconnaître la fatigue sans se défendre. Proposer de laisser le lien en silence, ou une sortie très respectueuse.
- Si le refus est ferme ("raccrochez", "supprimez-moi") : 3 variantes très courtes de sortie polie, SANS question. (Intention: refus_clair_ne_pas_relancer, Action: terminer).

RÈGLE SUR LES QUESTIONS
- Pour les objections et la découverte : finis par une question douce et utile.
- Pour le closing (quand il veut acheter) : finis par une question LOGISTIQUE.
- Pour un refus ferme : AUCUNE question.

INTENTIONS AUTORISÉES
accord_pour_avancer, veut_acheter, pas_interesse, fatigue_appels_commerciaux, pas_besoin_site, deja_assez_clients, bouche_a_oreille, pas_le_temps, deja_un_site, satisfait_site_actuel, demande_email, accepte_demo, prix_trop_eleve, doit_reflechir, demande_devis, manque_confiance, refus_clair_ne_pas_relancer, autre.

RÉPONDS UNIQUEMENT PAR UN OBJET JSON VALIDE.
FORMAT OBLIGATOIRE :
{
  "intention": "une intention autorisée",
  "niveauInteret": "faible|moyen|fort",
  "reponses": [
    "[Tonalité] Réponse 1...",
    "[Tonalité] Réponse 2...",
    "[Tonalité] Réponse 3..."
  ],
  "noteCRM": "note factuelle courte",
  "actionRecommandee": "continuer|envoyer_demo|envoyer_email|envoyer_devis|planifier_rappel|terminer|conclure_vente"
}
`;

    const userPrompt = `
CONTEXTE DU PROSPECT
- Entreprise : ${context.companyName}
- Activité : ${context.businessType}
- Ville : ${context.city}
- Site actuel : ${context.websiteStatus}
- Étape de l'appel : ${context.callStage}

HISTORIQUE RÉCENT
${context.history.length ? JSON.stringify(context.history, null, 2) : "Aucun historique fourni."}

DERNIÈRE PHRASE EXACTE DU PROSPECT
"${lastMessage}"

Réfléchis à cette phrase précise. Génère trois réponses orales différentes,
adaptées au ton et à la vraie objection. N'oublie pas la [Tonalité] au début et mets des « ... » naturels pour guider les pauses de Yohan. Retourne uniquement le JSON demandé.
`;

    const response = await openAI({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.85,
      max_tokens: 1000,
      response_format: { type: "json_object" }
    });

    const analysis = parseJSON(response?.choices?.[0]?.message?.content || "{}");

    let reponses = Array.isArray(analysis.reponses)
      ? analysis.reponses
        .map((item) => cleanText(item, 1400))
        .filter(Boolean)
      : [];

    const fallback = "[Sincérité totale] Je comprends... qu'est-ce qui vous fait dire cela aujourd'hui ?";

    while (reponses.length < 3) {
      reponses.push(reponses[0] || fallback);
    }

    const hardOptOut =
      analysis.intention === "refus_clair_ne_pas_relancer" ||
      analysis.actionRecommandee === "terminer";

    res.json({
      success: true,
      analysis: {
        intention: cleanText(analysis.intention, 100) || "autre",
        niveauInteret: cleanText(analysis.niveauInteret, 30) || "moyen",
        reponses: reponses.slice(0, 3),
        noteCRM: cleanText(analysis.noteCRM, 700),
        actionRecommandee: hardOptOut
          ? "terminer"
          : cleanText(analysis.actionRecommandee, 80) || "continuer"
      }
    });
  } catch (error) {
    console.error("Erreur /analyze-call :", error.message);
    res.status(500).json({
      success: false,
      error: error.message || "Erreur pendant l'analyse."
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Backend Noyz Assistant Appel — cerveau dynamique démarré sur le port ${PORT}`);
});
