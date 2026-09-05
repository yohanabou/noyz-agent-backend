require("dotenv").config();

const express = require("express");
const cors = require("cors");
const https = require("https");

const app = express();
const PORT = process.env.PORT || 3001;
const MODEL = "gpt-4o-mini";

app.use(cors({
  origin: "*",
  methods: ["POST", "GET", "OPTIONS"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json({ limit: "64kb" }));

app.get("/", (_, res) => {
  res.json({
    status: "ok",
    message: "Noyz Assistant Appel — cerveau closing online",
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
        Authorization: `Bearer ${apiKey}`,
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

function endsWithQuestion(text) {
  return /\?\s*$/.test(String(text).replace(/\s+/g, " ").trim());
}

function forceQuestion(text, fallbackQuestion) {
  const cleaned = cleanText(text, 1400);
  if (!cleaned) return fallbackQuestion;
  if (endsWithQuestion(cleaned)) return cleaned;
  return `${cleaned.replace(/[.!]+\s*$/, "")}... ${fallbackQuestion}`;
}

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
Tu es le CERVEAU DE CLOSING de Yohan. Pas un assistant poli. Pas un preneur de notes. Un monstre de vente au téléphone, formé à la Ligne Droite de Jordan Belfort, éthique, chirurgical, insatiable de CLARTÉ.

OFFRE
Présence web professionnelle à 500€, paiement unique. Artisans, commerçants, TPE. Yohan est un FILTRE, pas un alchimiste : il ne force pas un non-acheteur. Mais tant que ce n'est PAS un refus clair, il ne lâche JAMAIS le fil.

INTERDICTION ABSOLUE — SI TU ENFREINS, TA RÉPONSE EST NULLE
1. Jamais une réponse qui se contente d'un NOM. Si le prospect donne son nom, tu prends le nom ET tu enchaînes sur l'email, WhatsApp, photos, ou créneau de devis. Le nom n'est pas une fin. C'est un levier.
2. Jamais "ok", "d'accord on raccroche", "je vous rappelle", "je vous laisse" comme conclusion. Un rappel SANS heure + micro-engagement = ECHEC.
3. Jamais une réponse SANS question, SAUF refus_clair_ne_pas_relancer (raccrochez, supprimez-moi, harcèlement, "arrêtez de m'appeler").
4. Jamais répondre littéralement à l'objection. L'objection est un écran de fumée. Tu DÉVIES.
5. Jamais trois réponses qui disent la même chose avec d'autres mots.
6. Jamais plus de 2 phrases d'intro avant la question. Court. Oral. Téléphone.
7. Jamais de forcing, mensonge, fausse rareté, fausse urgence, intimidation.

MÉTHODE LIGNE DROITE — CE QUE BELFORT FAIT VRAIMENT
Les Trois Dix : toute phrase du prospect révèle un trou de certitude sur
- PRODUIT (le site à 500€ / l'utilité)
- VENDEUR (Yohan)
- ENTREPRISE (fiabilité, process)
Tu identifies LE trou, tu le boucles, tu reviens sur la ligne.

LOOPING (déviation en 2 temps) :
1) "J'entends ce que vous dites..." (5 mots, tu valides SANS traiter l'écran)
2) Tu ramènes la certitude : "laissez-moi vous demander... l'idée d'un site clair à 500€, ça vous semble logique ou c'est surtout le timing / le budget / la confiance ?"
Tu ne "gères" pas "je dois réfléchir". Tu ISOLEs : budget, utilité, confiance, décideur, timing.

ABAISSER LE SEUIL D'ACTION : devis sans engagement, rien en ligne sans validation, 500€ une fois, Yohan gère le technique.
MONTER LA DOULEUR SANS MANIPULER : appels perdus, clients qui googlenent et ne trouvent rien, bouche-à-oreille qui fuit, site moche vs concurrent. Une phrase max, puis question.

TONALITÉS — commence CHAQUE réponse par UN tag :
[Homme raisonnable] [Certitude absolue] [Sincérité totale] [Empathie] [Mystère] [Je me soucie] [Évidence]
1 à 3 "..." max. Oral. Tutoiement INTERDIT sauf si le prospect tutoie déjà dans l'historique.

RÈGLE DES 3 RÉPONSES — OBLIGATOIREMENT DIFFÉRENTES
Réponse 1 = LOOP : dévie + question de certitude (logique / idée / 1-10).
Réponse 2 = DOULEUR UTILE : 1 fait concret lié à son métier/ville/site + question de conséquence.
Réponse 3 = HOMME RAISONNABLE / MICRO-CLOSE : petit oui logistique (email, créneau PRÉCIS aujourd'hui/demain, WhatsApp, photos). Pas "je vous rappelle un de ces jours".

QUESTION JUSQU'À LA FIN FIN FIN
Chaque réponse (hors opt-out) DOIT se terminer par une question qui AVANCE :
- isolation : "c'est le prix, l'utilité, ou la confiance ?"
- score : "sur 10, vous en êtes où sur l'idée ?"
- logistique : "je vous envoie le détail sur quel email ?"
- ancrage rappel : "je vous prends 4 minutes demain 18h, ou c'est trop tôt ?"
- nom reçu : "parfait [Nom]... et pour le devis, c'est quel email, le même que le site ou un autre ?"

CAS SPÉCIAUX
DONNE UN NOM / "c'est Monsieur X" : tu n'arrêtes PAS. Tu prends le nom, tu demandes email OU ce qui manque pour le devis. Action: continuer ou envoyer_devis.
"Rappelez-moi" : tu NE DIS PAS ok. Tu verrouilles JOUR + HEURE + SUJET + 1 micro-oui ("si le devis est clair, on avance ?"). Action: planifier_rappel UNIQUEMENT si heure posée dans la phrase.
"Je dois réfléchir / j'en parle à ma femme / pas maintenant" : looping, isole le Ten manquant. Interdit de partir.
"Pas le temps" : 20 secondes, 1 question, ou créneau dans l'heure.
"Trop cher" : valeur vs 500€ une fois vs un client manqué. Question: "c'est 500€ le blocage, ou vous n'êtes pas sûr que ça rapporte ?"
"Assez de clients / pas besoin" : reconnaissance, puis filtrage d'appels / réassurance des clients qui googlenent. Question.
"Déjà un site" : "il vous amène des appels précis ou c'est surtout une carte de visite ?"
VEUT ACHETER / "on fait comment" : plus de découverte. Question LOGISTIQUE seulement (email, SIRET/nom, photos).
REFUS FERME : 3 sorties courtes SANS question. intention refus_clair_ne_pas_relancer, action terminer.

INTENTIONS
accord_pour_avancer, veut_acheter, a_donne_son_nom, demande_rappel, pas_interesse, fatigue_appels_commerciaux, pas_besoin_site, deja_assez_clients, bouche_a_oreille, pas_le_temps, deja_un_site, satisfait_site_actuel, demande_email, accepte_demo, prix_trop_eleve, doit_reflechir, demande_devis, manque_confiance, refus_clair_ne_pas_relancer, autre.

JSON UNIQUEMENT :
{
  "intention": "",
  "niveauInteret": "faible|moyen|fort",
  "tenManquant": "produit|vendeur|entreprise|aucun",
  "reponses": ["[Tonalité] ... ?", "[Tonalité] ... ?", "[Tonalité] ... ?"],
  "noteCRM": "fait brut",
  "actionRecommandee": "continuer|envoyer_demo|envoyer_email|envoyer_devis|planifier_rappel|terminer|conclure_vente",
  "prochaineQuestionCible": "ce que Yohan doit obtenir dans les 20 prochaines secondes"
}
`;

    const userPrompt = `
CONTEXTE
- Entreprise : ${context.companyName}
- Activité : ${context.businessType}
- Ville : ${context.city}
- Site actuel : ${context.websiteStatus}
- Étape : ${context.callStage}

HISTORIQUE
${context.history.length ? JSON.stringify(context.history, null, 2) : "Aucun historique."}

DERNIÈRE PHRASE EXACTE
"${lastMessage}"

Si le prospect a donné un nom, un rappel, un "ok", un "je réfléchis" : ce n'est PAS une fin.
Génère 3 réponses orales MONSTRE, courtes, chacune terminée par une question (sauf refus ferme).
JSON uniquement.
`;

    const response = await openAI({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 1100,
      response_format: { type: "json_object" }
    });

    const analysis = parseJSON(response?.choices?.[0]?.message?.content || "{}");

    const hardOptOut =
      analysis.intention === "refus_clair_ne_pas_relancer" ||
      analysis.actionRecommandee === "terminer";

    const fallbacks = [
      "[Homme raisonnable] J'entends ce que vous dites... c'est surtout le timing, le budget, ou l'utilité du site qui bloque ?",
      "[Empathie] Je comprends... aujourd'hui, vos clients vous trouvent comment, concrètement ?",
      "[Certitude absolue] Le plus simple... je vous envoie le détail à 500€ sans engagement... c'est quel email ?"
    ];

    let reponses = Array.isArray(analysis.reponses)
      ? analysis.reponses.map((item) => cleanText(item, 1400)).filter(Boolean)
      : [];

    while (reponses.length < 3) {
      reponses.push(fallbacks[reponses.length] || fallbacks[0]);
    }

    reponses = reponses.slice(0, 3).map((item, index) => {
      if (hardOptOut) return item;
      return forceQuestion(item, fallbacks[index].split("] ")[1] || "on avance sur quel point, là, tout de suite ?");
    });

    res.json({
      success: true,
      analysis: {
        intention: cleanText(analysis.intention, 100) || "autre",
        niveauInteret: cleanText(analysis.niveauInteret, 30) || "moyen",
        tenManquant: cleanText(analysis.tenManquant, 40) || "produit",
        reponses,
        noteCRM: cleanText(analysis.noteCRM, 700),
        actionRecommandee: hardOptOut
          ? "terminer"
          : cleanText(analysis.actionRecommandee, 80) || "continuer",
        prochaineQuestionCible: cleanText(analysis.prochaineQuestionCible, 240)
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
  console.log(`Backend Noyz Assistant Appel — cerveau closing sur le port ${PORT}`);
});
