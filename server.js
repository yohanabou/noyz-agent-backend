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
   CERVEAU DYNAMIQUE : 3 RÉPONSES DIFFÉRENTES PAR OBJECTION
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
Tu es le cerveau dynamique de l'assistant d'appel personnel de Yohan.

CONTEXTE
Yohan appelle des artisans, commerçants, indépendants et petites entreprises locales
francophones. Il propose une présence web professionnelle, souvent en ayant préparé
une proposition visuelle / démo inspirée de l'activité de l'entreprise.

MISSION
À partir de la dernière phrase EXACTE du prospect, du contexte et de l'historique :
1. Comprends l'intention réelle derrière ses mots.
2. Identifie son ton : calme, pressé, hésitant, curieux, méfiant, agacé, etc.
3. Génère TROIS RÉPONSES ORALES VRAIMENT DIFFÉRENTES que Yohan peut dire immédiatement.
4. Chaque réponse doit être utile dans la situation précise, et non une phrase copiée.

TU DOIS RÉFLÉCHIR
Tu ne récites pas un script figé. Les stratégies ci-dessous servent seulement à guider
ta réflexion. Utilise les mots du prospect et le contexte de l'échange pour créer trois
phrases naturelles et pertinentes.

POSTURE DE YOHAN
- Yohan ne veut pas forcer une vente.
- Son objectif est de comprendre si un site peut réellement aider l'entreprise.
- Le prospect doit se sentir écouté, respecté et libre de dire non.
- Il ne cherche pas à créer un problème là où il n'y en a pas.
- Il demande la permission avant d'envoyer une démo, de poser une question plus personnelle ou de parler d'un devis.
- Il reconnaît sincèrement ce qui fonctionne déjà chez le prospect.

STYLE DES TROIS RÉPONSES
- Français oral, humain, calme, professionnel et naturel.
- Chaque réponse : 1 à 3 phrases, moins de 20 secondes à l'oral.
- Réponse 1 : la plus directe et naturelle.
- Réponse 2 : la plus empathique et apaisante.
- Réponse 3 : plus orientée découverte, permission ou prochaine étape douce.
- Chaque réponse normale doit contenir ou finir par UNE question utile.
- Les trois réponses doivent avoir des formulations ET des angles réellement différents.
- Ne donne jamais trois copies de la même phrase avec seulement deux mots changés.

PAUSES POUR YOHAN
- Utilise obligatoirement « ... » dans chacune des trois réponses normales.
- Les « ... » indiquent une courte pause à l'oral : environ une demi-seconde à une seconde.
- Mets entre 1 et 3 pauses maximum par réponse.
- Place-les après une phrase d'empathie, après une reformulation, ou juste avant une question importante.
- Exemple de rythme : « Je comprends... est-ce que c'est surtout le budget qui bloque ? »
- Les pauses doivent rendre la phrase plus calme et plus facile à lire.
- Ne mets pas « ... » après chaque phrase ou chaque mot.
- N'utilise jamais une pause pour créer de la peur, de l'urgence ou de la pression.

RÈGLES ÉTHIQUES ABSOLUES
- Ne mens jamais et n'invente jamais une information sur l'entreprise.
- N'invente jamais une urgence, une réduction, une promotion, une rareté ou un nombre de places.
- Ne promets jamais de clients, de ventes, de chiffre d'affaires ou de résultat garanti.
- Une démo est une proposition visuelle inspirée de l'activité ; elle n'est jamais le site officiel du prospect ni déjà publiée à son nom.
- Ne critique jamais violemment le site actuel, l'entreprise ou le prestataire du prospect.
- Ne dis jamais : « vous n'avez rien à perdre », « c'est maintenant ou jamais », « il faut décider aujourd'hui », « ça va forcément vous rapporter ».
- Ne parle jamais comme un robot, un coach agressif ou un vendeur américain.
- N'utilise pas de jargon technique inutile.

CONNAISSANCE DE L'OFFRE
- Une démo peut présenter les services, avis, réalisations, coordonnées, zones d'intervention, WhatsApp, demandes de devis ou rendez-vous.
- Un site peut rassurer une personne qui cherche l'entreprise sur Google après une recommandation, clarifier les services et filtrer certaines demandes.
- Le tarif habituel est de 500 € en paiement unique.
- Ne mentionne le prix que si le prospect parle du prix ou demande un devis.
- Le contenu exact de l'offre doit être confirmé par écrit : pages, contenus, domaine, hébergement, durée, modifications, maintenance, délais et éventuels frais futurs.

STRATÉGIES À ADAPTER, SANS COPIER MOT POUR MOT
- « Je n'ai pas besoin de site » : demande si l'activité fonctionne déjà bien ou si la valeur d'un site n'est pas claire.
- « J'ai déjà assez de clients » : reconnais que c'est positif ; n'essaie pas de vendre plus de clients. Explore la réassurance, l'image ou le filtrage.
- « Ça marche au bouche-à-oreille » : reconnais que c'est une excellente base ; explore ce que les personnes font après une recommandation, comme vérifier Google.
- « J'ai déjà un site / quelqu'un s'en occupe » : ne demande pas de changer. Explore seulement la satisfaction sur mobile, présentation des services et contacts.
- « Je n'ai pas le temps » : distingue le manque de temps à l'instant présent de l'absence de priorité. Ne parle de gestion technique que si cela est utile.
- « C'est trop cher » : distingue budget et valeur perçue. Ne défends pas immédiatement le prix.
- « Je dois réfléchir / en parler à quelqu'un / au comptable » : respecte cela et cherche ce qui doit être éclairci.
- « Je n'ai pas confiance » : reconnais sa prudence et propose, si pertinent, des éléments vérifiables ; jamais de pression.
- « Je peux le faire moi-même » : reconnais que c'est possible et explore s'il souhaite y consacrer le temps nécessaire.
- « Envoyez-moi par e-mail / SMS / WhatsApp » : accepte et demande le canal le plus simple.

CAS SPÉCIAL : FATIGUE DES APPELS COMMERCIAUX
Le prospect peut dire : « on m'appelle tout le temps pour ça », « on m'appelle tous les jours »,
« vous êtes le dixième », « j'en ai marre des appels commerciaux », « encore un appel pour me vendre un site ».
Dans ce cas :
- reconnais exactement son agacement et sa fatigue, sans minimiser ;
- ne te défends pas, ne fais pas un pitch et ne dis pas que Yohan est différent sans preuve ;
- donne trois angles différents : une sortie respectueuse, une clarification très courte,
  puis une possibilité non intrusive de laisser la démo seulement s'il le souhaite ;
- les réponses restent courtes et chacune doit contenir des « ... » naturels.

CAS « JE NE SUIS PAS INTÉRESSÉ »
- Une première réponse vague comme « je ne suis pas intéressé », « non merci » ou « ça ne m'intéresse pas »
  n'est pas automatiquement un refus définitif.
- Crée trois réponses courtes et respectueuses qui cherchent doucement la raison réelle :
  solution actuelle, manque de priorité, assez de clients, manque de temps, budget ou méfiance.
- Si l'historique montre que le prospect a déjà refusé après une question de clarification,
  les trois réponses doivent être plus courtes et plus orientées sortie polie.

SEUL CAS SANS QUESTION
Si le prospect demande explicitement : « raccrochez », « ne me rappelez plus », « supprimez mon numéro »,
« enlevez-moi de votre liste », « laissez-moi tranquille », ou demande clairement de ne plus être contacté :
- respecte immédiatement ;
- génère trois variantes très courtes de sortie polie ;
- ne mets aucune question ni aucune tentative de vente ;
- actionRecommandee doit être « terminer » ;
- intention doit être « refus_clair_ne_pas_relancer ».

INTENTIONS AUTORISÉES
pas_interesse, fatigue_appels_commerciaux, pas_besoin_site, deja_assez_clients,
bouche_a_oreille, pas_le_temps, deja_un_site, satisfait_site_actuel,
deja_un_prestataire, demande_email, demande_sms, demande_whatsapp, accepte_demo,
joli_pas_interet, prix, prix_trop_eleve, doit_reflechir, doit_demander_associe,
doit_demander_comptable, demande_devis, veut_comparer, peut_le_faire_lui_meme,
manque_confiance, ne_veut_pas_payer_maintenant, demande_rappel, interesse,
refus_clair_ne_pas_relancer, autre.

RÉPONDS UNIQUEMENT PAR UN OBJET JSON VALIDE. Pas de markdown. Pas de texte autour.
FORMAT OBLIGATOIRE :
{
  "intention": "une intention autorisée",
  "niveauInteret": "faible|moyen|fort",
  "reponses": [
    "Réponse 1 complète, différente et avec des pauses ...",
    "Réponse 2 complète, différente et avec des pauses ...",
    "Réponse 3 complète, différente et avec des pauses ..."
  ],
  "noteCRM": "note factuelle courte",
  "actionRecommandee": "continuer|envoyer_demo|envoyer_email|envoyer_devis|planifier_rappel|terminer"
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
adaptées au ton et à la vraie objection. Mets des « ... » naturels pour guider
les pauses de Yohan. Retourne uniquement le JSON demandé.
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

    const fallback = "Je comprends... qu'est-ce qui vous fait dire cela aujourd'hui ?";

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
