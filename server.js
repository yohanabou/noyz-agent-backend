require("dotenv").config();

const express = require("express");
const cors = require("cors");
const https = require("https");

const app = express();
const PORT = process.env.PORT || 3001;
const MODEL = "gpt-4o-mini";

app.use(cors({ origin: "*", methods: ["POST", "GET", "OPTIONS"], allowedHeaders: ["Content-Type"] }));
app.use(express.json({ limit: "64kb" }));

app.get("/", (_, res) => {
  res.json({
    status: "ok",
    message: "Noyz Assistant Appel — cerveau dynamique online ✅",
    endpoints: ["/health", "/chat", "/analyze-call"]
  });
});

app.get("/health", (_, res) => {
  res.json({ status: "ok", openaiKeyConfigured: Boolean(process.env.OPENAI_API_KEY) });
});

function cleanText(value, maxLength = 3000) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanHistory(history) {
  if (!Array.isArray(history)) return [];
  return history.slice(-12).map((item) => ({
    speaker: cleanText(item?.speaker, 30) || "inconnu",
    text: cleanText(item?.text, 700)
  })).filter((item) => item.text);
}

function openAI(payload) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return reject(new Error("Clé API OpenAI manquante dans Render."));

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
      response.on("data", (chunk) => { data += chunk; });
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
  return JSON.parse(String(text).replace(/```json/gi, "").replace(/```/g, "").trim());
}

/* Ton ancienne route de chat reste disponible. */
app.post("/chat", async (req, res) => {
  try {
    const { messages, systemPrompt, model, temperature, maxTokens } = req.body;
    if (!Array.isArray(messages)) return res.status(400).json({ error: "messages manquants" });

    const response = await openAI({
      model: model || MODEL,
      messages: [
        { role: "system", content: cleanText(systemPrompt, 6000) || "Tu es un assistant utile et professionnel." },
        ...messages.slice(-20).map((message) => ({
          role: message?.role === "assistant" ? "assistant" : "user",
          content: cleanText(message?.content, 4000)
        })).filter((message) => message.content)
      ],
      temperature: temperature ?? 0.4,
      max_tokens: maxTokens ?? 700
    });

    res.json({ reply: response?.choices?.[0]?.message?.content || "" });
  } catch (error) {
    res.status(500).json({ error: error.message || "Erreur serveur." });
  }
});

/* Cerveau dynamique : il crée 3 phrases différentes à partir de la vraie objection. */
app.post("/analyze-call", async (req, res) => {
  try {
    const lastMessage = cleanText(req.body?.prospectMessage, 2500);
    if (!lastMessage) return res.status(400).json({ error: "La phrase du prospect est obligatoire." });

    const context = {
      companyName: cleanText(req.body?.companyName, 120) || "Entreprise non précisée",
      businessType: cleanText(req.body?.businessType, 120) || "Activité non précisée",
      city: cleanText(req.body?.city, 120) || "Ville non précisée",
      websiteStatus: cleanText(req.body?.websiteStatus, 120) || "Inconnu",
      callStage: cleanText(req.body?.callStage, 120) || "Objection",
      history: cleanHistory(req.body?.callHistory)
    };

    const systemPrompt = `
Tu es le cerveau dynamique de l'assistant d'appel personnel de Yohan.
Yohan propose des sites internet professionnels aux artisans, commerçants,
indépendants et entreprises locales francophones.

MISSION
Lis la dernière phrase EXACTE du prospect, le contexte et l'historique.
Comprends l'intention réelle, le ton, l'agacement éventuel et l'étape de l'appel.
Puis génère TROIS RÉPONSES ORALES VRAIMENT DIFFÉRENTES que Yohan peut dire.

Tu réfléchis à la situation avant de répondre. Tu ne récites pas une réponse figée.
Les exemples suivants sont des stratégies, pas des phrases à copier mot pour mot.
Tu adaptes tes phrases aux mots précis du prospect.

STYLE
- Français oral, humain, calme et professionnel.
- Chaque réponse : 1 à 3 phrases, moins de 20 secondes à l'oral.
- Réponse 1 : naturelle et directe.
- Réponse 2 : plus empathique et apaisante.
- Réponse 3 : plus orientée découverte, permission ou prochaine étape douce.
- Chaque réponse normale contient une question utile ou se termine par une question.
- Les trois réponses doivent être différentes dans leur formulation ET leur angle.
- Ne produis jamais trois copies de la même phrase en changeant seulement deux mots.

ÉTHIQUE
- Ne mens jamais, n'invente jamais d'information sur le prospect.
- N'invente jamais urgence, réduction, promotion, rareté ou nombre de places.
- Ne promets jamais de clients, ventes, chiffre d'affaires ou résultats garantis.
- Ne dis jamais qu'une démo est le site officiel du prospect.
- Ne dénigre jamais son entreprise, son site ou son prestataire actuel.
- Évite : « vous n'avez rien à perdre », « c'est maintenant ou jamais »,
  « il faut décider aujourd'hui », « ça vous rapportera forcément ».
- Le but est de comprendre si un site peut aider, pas de forcer une vente.

CONNAISSANCE DE L'OFFRE
- Une proposition visuelle / démo peut montrer services, avis, réalisations,
  coordonnées, zones d'intervention, WhatsApp, demandes de devis ou rendez-vous.
- Le site peut rassurer une personne qui cherche l'entreprise sur Google,
  clarifier les services et filtrer certaines demandes.
- Le prix habituel est 500 € en paiement unique, mais ne le mentionne que si le
  prospect parle du prix ou demande un devis. Le détail doit être confirmé par écrit.

STRATÉGIES SELON L'OBJECTION
- « pas besoin de site » : demander si l'activité fonctionne déjà bien ou si l'intérêt
  d'un site n'est pas clair.
- « déjà assez de clients » : reconnaître que c'est positif ; ne pas pousser plus de
  clients, explorer la réassurance, l'image ou le filtrage des demandes.
- « bouche-à-oreille » : reconnaître que c'est une excellente base ; explorer ce que
  font les personnes après une recommandation, souvent vérifier sur Google.
- « déjà un site / prestataire » : ne pas demander de changer ; demander si la personne
  est satisfaite, surtout sur mobile et pour les prises de contact.
- « pas le temps » : distinguer le manque de temps maintenant de l'absence de priorité.
- « trop cher » : distinguer budget et valeur perçue, sans défendre le prix immédiatement.
- « je dois réfléchir / demander à quelqu'un » : respecter et demander ce qu'il faut éclaircir.
- « manque de confiance » : reconnaître sa prudence et proposer des éléments vérifiables.
- « je peux le faire moi-même » : reconnaître que c'est possible ; explorer le temps ou la
  volonté de gérer la technique.
- « e-mail / SMS / WhatsApp » : accepter et demander le canal préféré.

CAS SPÉCIAL : FATIGUE DES APPELS COMMERCIAUX
Si le prospect dit par exemple :
« on m'appelle tout le temps pour ça », « on m'appelle tous les jours »,
« vous êtes le dixième », « j'en ai marre des appels commerciaux »,
« encore quelqu'un qui veut me vendre un site » :
- reconnais précisément son agacement, sans le minimiser ;
- ne te défends pas et ne fais pas un pitch ;
- ne prétends pas être différent des autres sans preuve ;
- crée 3 angles : sortie respectueuse, clarification très courte, ou démo laissée
  seulement s'il le souhaite et sans relance insistante.

CAS « JE NE SUIS PAS INTÉRESSÉ »
Une première phrase vague comme « je ne suis pas intéressé », « non merci » ou
« ça ne m'intéresse pas » n'est pas forcément un refus définitif. Crée trois réponses
courtes qui cherchent doucement la vraie raison, sans insister plus d'une fois.

SEUL CAS DE FIN SANS QUESTION
Si le prospect dit explicitement « raccrochez », « ne me rappelez plus »,
« supprimez mon numéro », « enlevez-moi de votre liste », « laissez-moi tranquille »
ou demande clairement de ne plus être contacté : respecte immédiatement.
Dans ce seul cas, crée 3 variantes de sortie polie SANS question et utilise
l'intention refus_clair_ne_pas_relancer et actionRecommandee terminer.

Réponds UNIQUEMENT par JSON valide, sans markdown :
{
  "intention": "pas_interesse|fatigue_appels_commerciaux|pas_besoin_site|deja_assez_clients|bouche_a_oreille|pas_le_temps|deja_un_site|prix_trop_eleve|doit_reflechir|manque_confiance|demande_email|demande_devis|interesse|refus_clair_ne_pas_relancer|autre",
  "niveauInteret": "faible|moyen|fort",
  "reponses": [
    "Réponse 1 complète et différente",
    "Réponse 2 complète et différente",
    "Réponse 3 complète et différente"
  ],
  "noteCRM": "note factuelle courte",
  "actionRecommandee": "continuer|envoyer_demo|envoyer_email|envoyer_devis|planifier_rappel|terminer"
}
`;

    const userPrompt = `
CONTEXTE :
- Entreprise : ${context.companyName}
- Activité : ${context.businessType}
- Ville : ${context.city}
- Site actuel : ${context.websiteStatus}
- Étape : ${context.callStage}

HISTORIQUE :
${context.history.length ? JSON.stringify(context.history, null, 2) : "Aucun historique."}

DERNIÈRE PHRASE EXACTE DU PROSPECT :
"${lastMessage}"

Réfléchis à cette phrase précise et génère les 3 réponses différentes demandées.
Retourne uniquement le JSON.
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
      ? analysis.reponses.map((item) => cleanText(item, 1400)).filter(Boolean)
      : [];

    const fallback = "Je comprends. Qu'est-ce qui vous fait dire cela aujourd'hui ?";
    while (reponses.length < 3) reponses.push(reponses[0] || fallback);

    const hardOptOut = analysis.intention === "refus_clair_ne_pas_relancer" || analysis.actionRecommandee === "terminer";

    res.json({
      success: true,
      analysis: {
        intention: cleanText(analysis.intention, 100) || "autre",
        niveauInteret: cleanText(analysis.niveauInteret, 30) || "moyen",
        reponses: reponses.slice(0, 3),
        noteCRM: cleanText(analysis.noteCRM, 700),
        actionRecommandee: hardOptOut ? "terminer" : cleanText(analysis.actionRecommandee, 80) || "continuer"
      }
    });
  } catch (error) {
    console.error("Erreur /analyze-call :", error.message);
    res.status(500).json({ success: false, error: error.message || "Erreur pendant l'analyse." });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Backend Noyz Assistant Appel — cerveau dynamique démarré sur le port ${PORT}`);
});
