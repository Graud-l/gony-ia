// 📦 Dépendances principales
const axios = require("axios");
const qrcode = require("qrcode-terminal");
const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");

// 🔐 Clé API GPT
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "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";

// 👤 Propriétaire
const OWNER_NUMBER = "242067274660@s.whatsapp.net";

// 📇 Profils enregistrés
const userProfiles = {
    [OWNER_NUMBER]: {
        name: "gon-freecss",
        description: "Créateur du bot, passionné d'informatique et de ses applications."
    }
};

// 💡 Mots-clés liés à l'informatique
const motsInformatique = [
    "informatique", "ordinateur", "programme", "code", "algorithme", "intelligence", "IA", "machine",
    "logiciel", "app", "application", "réseau", "serveur", "processeur", "disque", "mémoire", "html",
    "css", "javascript", "python", "java", "linux", "windows", "technologie", "cybersécurité", "web",
    "cloud", "donnée", "base de données", "API", "robot", "gpt", "machine learning", "deep learning",
    "openai", "yolo", "opencv"
];

// 🧠 Prompt système humanisé
const SYSTEM_PROMPT = `
Tu es un assistant personnel expert en informatique. Tu agis comme un ami bienveillant, curieux et pédagogue.
Tu accueilles chaleureusement chaque utilisateur et engages la discussion de manière fluide, claire et logique.
Si le message concerne l'informatique, tu réponds avec simplicité et humanité, sans jargon inutile.
Tu poses parfois des questions pour approfondir ou éveiller la curiosité de l'utilisateur.
Tu t'exprimes toujours en français avec respect, structure et chaleur humaine.
`;

// 🔄 Fonction : réponse textuelle depuis GPT
async function getChatGPTResponse(prompt) {
    try {
        const res = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
            model: "gpt-4o",
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: prompt }
            ],
            max_tokens: 1000
        }, {
            headers: {
                "Authorization": `Bearer ${OPENAI_API_KEY}`,
                "Content-Type": "application/json"
            }
        });
        return res.data.choices[0].message.content.trim();
    } catch (err) {
        console.error("❌ Erreur API :", err.response?.data || err.message);
        return "Désolé, j’ai eu un souci pour répondre 😔";
    }
}

// 📍 Vérifie si c'est un groupe
function isGroup(jid) {
    return jid.endsWith("@g.us");
}

// 📎 Vérifie si le bot est mentionné
function isMentionedMe(msg, myJid) {
    const context = msg.message?.extendedTextMessage?.contextInfo;
    return context?.mentionedJid?.includes(myJid);
}

// 🔍 Détecte la présence de mots informatiques
function contientMotInformatique(text) {
    return motsInformatique.some(mot => new RegExp(`\\b${mot}\\b`, 'i').test(text));
}

// 🚀 Démarrage du bot
async function startBot() {
    const { version } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState("auth_info");
    const sock = makeWASocket({ version, auth: state });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const sender = msg.key.remoteJid;
        const myJid = sock.user.id;

        let text = "";
        if (msg.message.conversation) text = msg.message.conversation;
        else if (msg.message.extendedTextMessage?.text) text = msg.message.extendedTextMessage.text;
        else if (msg.message.imageMessage?.caption) text = msg.message.imageMessage.caption;

        console.log("🔍 Message reçu :", text);

        if (/qui suis[- ]?je\??/i.test(text)) {
            const profile = userProfiles[sender];
            if (profile) {
                await sock.sendMessage(sender, {
                    text: `Enchanté ${profile.name} 👋 : ${profile.description}`
                }, { quoted: msg });
            } else {
                await sock.sendMessage(sender, {
                    text: "Je ne te connais pas encore, mais j’ai hâte d’en apprendre plus sur toi 😊"
                }, { quoted: msg });
            }
            return;
        }

        // 📢 Commande pour mentionner tout le groupe
        if (/mentionne (tout|tout le monde)/i.test(text) && isGroup(sender)) {
            try {
                const metadata = await sock.groupMetadata(sender);
                const mentions = metadata.participants.map(p => p.id);
                const noms = metadata.participants.map(p => `@${p.id.split("@")[0]}`).join(" ");

                await sock.sendMessage(sender, {
                    text: `📢 Voici un petit coucou à tout le groupe :\n\n${noms}`,
                    mentions
                }, { quoted: msg });
            } catch (e) {
                console.error("Erreur mention groupe:", e);
                await sock.sendMessage(sender, {
                    text: "❌ Je n'ai pas réussi à mentionner tout le monde. Assure-toi que je suis admin."
                }, { quoted: msg });
            }
            return;
        }

        // ℹ️ Commande d'aide simple
        if (/^(aide|\/help)$/i.test(text)) {
            const aide = `🛠️ *Commandes utiles disponibles* :

👉 *mentionne tout le monde* : Mentionne tous les membres du groupe
👉 *qui suis-je ?* : Le bot vous décrit si vous êtes enregistré
👉 *sas* ou *gony* : Le bot répond à une invocation dans le groupe
👉 *mot informatique* : Le bot détecte et engage une discussion technique
👉 *aide* ou */help* : Affiche cette aide
`;
            await sock.sendMessage(sender, { text: aide }, { quoted: msg });
            return;
        }

        if (isGroup(sender)) {
            const mention = isMentionedMe(msg, myJid);
            const motInfo = contientMotInformatique(text);
            const invocation = /\b(sas|gony)\b/i.test(text);

            if (mention || motInfo || invocation) {
                console.log("⚡ Déclencheur détecté dans le groupe !");
                const prompt = text.replace(/\b(sas|gony)\b/gi, "").trim() || "Salut à tous ! 😊";
                const response = await getChatGPTResponse(prompt);
                await sock.sendMessage(sender, { text: response }, { quoted: msg });
            }
        } else {
            const prompt = text.trim().toLowerCase();
            const ignorés = ["", "ok", "d'accord", "salut", "bonjour", "merci", "ça va", "cc", "yo"];
            if (ignorés.includes(prompt)) {
                console.log("🔕 Message ignoré en privé :", prompt);
                return;
            }
            const response = await getChatGPTResponse(prompt);
            await sock.sendMessage(sender, { text: response }, { quoted: msg });
        }
    });

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) qrcode.generate(qr, { small: true });
        if (connection === "open") console.log("✅ Bot connecté à WhatsApp !");
        if (connection === "close") {
            console.log("❌ Déconnecté !");
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
            if (shouldReconnect) startBot();
        }
    });
}

startBot();