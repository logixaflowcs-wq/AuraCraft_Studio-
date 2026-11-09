/**
 * AuraCraft Studio — Cloudflare Edge Telegram Bot Worker
 * 
 * Zero-cost serverless webhook receiver running on Cloudflare Global Edge.
 * Strictly scoped to Supergroup: -1003992125718, Topic: 215.
 */

const TELEGRAM_API_BASE = "https://api.telegram.org";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. Health check endpoint
    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      const backend = env.BACKEND_API_URL ? await backendRequest(env, "/health").catch(() => null) : null;
      const telegramConfigured = Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_WEBHOOK_SECRET && env.TELEGRAM_ALLOWED_USER_IDS);
      return new Response(
        JSON.stringify({
          status: backend && backend.status === "healthy" && telegramConfigured ? "healthy" : "degraded",
          service: "AuraCraft Studio Cloudflare Edge Worker",
          backend_status: backend ? backend.status : "unavailable",
          telegram_configured: telegramConfigured,
          configured_topic: env.TELEGRAM_TOPIC_ID || "215",
          configured_chat: env.TELEGRAM_GROUP_CHAT_ID || "-1003992125718",
          edge_runtime: "cloudflare-workers",
        }),
        { status: backend && telegramConfigured ? 200 : 503, headers: { "Content-Type": "application/json" } }
      );
    }

    // 2. Webhook receiver (POST /webhook or POST /)
    if (request.method === "POST") {
      try {
        // A. Validate a configured webhook secret.  A missing secret is a
        // configuration error, not permission to accept unauthenticated input.
        const providedSecret = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
        if (!env.TELEGRAM_WEBHOOK_SECRET || !env.TELEGRAM_BOT_TOKEN) {
          return new Response(JSON.stringify({ error: "Telegram bot token and webhook secret must be configured" }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (providedSecret !== env.TELEGRAM_WEBHOOK_SECRET) {
          return new Response(JSON.stringify({ error: "Unauthorized: Invalid secret token" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const update = await request.json();
        const message = update.message;
        if (!message) {
          return new Response(JSON.stringify({ ok: true, ignored: "not_a_message" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        // B. Strict Topic 215 Policy Enforcement (Fail-Closed)
        const expectedTopic = parseInt(env.TELEGRAM_TOPIC_ID || "215", 10);
        const actualTopic = message.message_thread_id;
        if (actualTopic !== expectedTopic) {
          return new Response(
            JSON.stringify({ ok: true, ignored: `unauthorized_topic_${actualTopic}` }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }

        const text = (message.text || "").trim();
        const command = text.split(/\s+/)[0].split("@")[0].toLowerCase();
        const chatId = message.chat.id;
        const topicId = actualTopic;
        const expectedChat = env.TELEGRAM_GROUP_CHAT_ID || "-1003992125718";
        if (String(chatId) !== String(expectedChat)) {
          return new Response(JSON.stringify({ ok: true, ignored: "unauthorized_chat" }), {
            status: 200, headers: { "Content-Type": "application/json" },
          });
        }
        const allowedUsers = new Set(
          String(env.TELEGRAM_ALLOWED_USER_IDS || "")
            .split(/[;,\s]+/)
            .map((value) => value.trim())
            .filter(Boolean),
        );
        const userId = message.from?.id;
        if (!allowedUsers.size || !userId || !allowedUsers.has(String(userId))) {
          return new Response(JSON.stringify({ ok: true, ignored: "unauthorized_user" }), {
            status: 200, headers: { "Content-Type": "application/json" },
          });
        }

        // C. Command Routing
        let replyText = "";

        if (command === "/start" || command === "/help" || command === "/commands") {
          replyText =
            `🎭 <b>AuraCraft Studio Bot — Topic #215 Connected</b>\n\n` +
            `Commands:\n` +
            `• <code>/status</code> — 3D Persona engine & Edge-TTS status\n` +
            `• <code>/characters</code> — View Anime, Army & Myanmar archetypes\n` +
            `• <code>/speak &lt;text&gt;</code> — Generate Nilar audio\n` +
            `• <code>/voice &lt;actor_id&gt; &lt;text&gt;</code> — Generate actor voice\n` +
            `• <code>/export &lt;actor_id&gt;</code> — Download standalone JSON pack\n\n` +
            `<i>Running on Cloudflare Zero-Cost Edge Worker.</i>`;
        } else if (command === "/status") {
          const health = await backendRequest(env, "/health");
          replyText = "AuraCraft Backend Reachable" + String.fromCharCode(10) +
            "Status: " + escapeHtml(health.status || "healthy") + String.fromCharCode(10) +
            "Edge-TTS: " + escapeHtml(health.integrations?.edge_tts || "available") + String.fromCharCode(10) +
            "Narrativ Forge: " + escapeHtml(health.integrations?.narrativ_forge || "not configured") + String.fromCharCode(10) +
            "Video: manifest only";
        } else if (command === "/characters") {
          const chars = await backendRequest(env, "/api/characters");
          if (!Array.isArray(chars)) throw new Error("Character API returned invalid data");
          replyText = "AuraCraft Characters:" + String.fromCharCode(10) + chars.slice(0, 30).map((c) =>
            "• " + escapeHtml(c.name) + " — " + escapeHtml(c.id) + " (" + escapeHtml(c.voice_id || "no voice") + ")"
          ).join(String.fromCharCode(10));
        } else if (command === "/speak" || command === "/voice") {
          let speakText = text.includes(" ") ? text.slice(text.indexOf(" ") + 1).trim() : "";
          let voiceId = "my-MM-NilarNeural";
          let actorName = "Nilar";
          if (command === "/voice") {
            const split = speakText.indexOf(" ");
            if (split < 1) replyText = "Usage: /voice character_id text to speak";
            else {
              const charId = speakText.slice(0, split);
              speakText = speakText.slice(split + 1).trim();
              const chars = await backendRequest(env, "/api/characters");
              const actor = Array.isArray(chars) ? chars.find((c) => c.id === charId) : null;
              if (!actor) replyText = "Character not found. Use /characters.";
              else { voiceId = actor.voice_id; actorName = actor.name; }
            }
          }
          if (!replyText) {
            if (!speakText || speakText.length > 4500) replyText = "Text must contain 1–4,500 characters.";
            else {
              const audioResponse = await backendFetch(env, "/api/tts/synthesize", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: speakText, voice: voiceId }),
              });
              if (!audioResponse.ok) throw new Error("TTS API returned " + audioResponse.status);
              const audio = await audioResponse.arrayBuffer();
              if (!audio.byteLength) throw new Error("TTS returned empty audio");
              await sendTelegramFile(env, "sendAudio", chatId, topicId, new Blob([audio], { type: "audio/mpeg" }), "auracraft-voice.mp3", "Voice: " + actorName + " (" + voiceId + ")");
              return new Response(JSON.stringify({ ok: true, command, audio_bytes: audio.byteLength }), { headers: { "Content-Type": "application/json" } });
            }
          }
        } else if (command === "/export") {
          const charId = text.includes(" ") ? text.slice(text.indexOf(" ") + 1).trim() : "";
          if (!charId || charId.length > 120 || !Array.from(charId).every((ch) => /[a-zA-Z0-9_-]/.test(ch))) replyText = "Usage: /export character_id";
          else {
            const packResponse = await backendFetch(env, "/api/characters/" + encodeURIComponent(charId) + "/download-pack");
            if (packResponse.status === 404) replyText = "Character not found. Use /characters.";
            else if (!packResponse.ok) throw new Error("Export API returned " + packResponse.status);
            else {
              const pack = await packResponse.blob();
              await sendTelegramFile(env, "sendDocument", chatId, topicId, pack, charId + "_auracraft_pack.json", "AuraCraft standalone JSON pack");
              return new Response(JSON.stringify({ ok: true, command, exported: charId }), { headers: { "Content-Type": "application/json" } });
            }
          }
        }

        // D. Send Telegram response via Bot API if token is configured
        if (replyText && env.TELEGRAM_BOT_TOKEN) {
          await sendTelegramMessage(
            env.TELEGRAM_BOT_TOKEN,
            chatId,
            topicId,
            replyText,
            dashboardKeyboard(env.FRONTEND_BASE_URL),
          );
        }

        return new Response(
          JSON.stringify({ ok: true, command, replied: Boolean(replyText) }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      } catch (err) {
        return new Response(JSON.stringify({ error: String(err) }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    return new Response("Method not allowed", { status: 405 });
  },
};

function dashboardKeyboard(frontendUrl) {
  if (!frontendUrl || !frontendUrl.startsWith("https://")) return undefined;
  return [[{ text: "✨ Open Flow Dashboard", url: frontendUrl }]];
}

async function sendTelegramMessage(botToken, chatId, topicId, htmlText, inlineKeyboard) {
  try {
    const url = `${TELEGRAM_API_BASE}/bot${botToken}/sendMessage`;
    const payload = {
      chat_id: chatId,
      message_thread_id: topicId,
      text: htmlText,
      parse_mode: "HTML",
    };
    if (inlineKeyboard) payload.reply_markup = { inline_keyboard: inlineKeyboard };
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.description || "Telegram sendMessage failed");
  } catch (e) {
    console.error("Failed to send telegram message:", e);
    throw e;
  }
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function backendBase(env) {
  let base = String(env.BACKEND_API_URL || "");
  while (base.endsWith("/")) base = base.slice(0, -1);
  if (!base.startsWith("https://")) throw new Error("BACKEND_API_URL must be configured as HTTPS");
  return base;
}
async function backendFetch(env, path, init = {}) {
  const base = await backendBase(env);
  return fetch(base + path, { ...init, signal: AbortSignal.timeout(25000) });
}
async function backendRequest(env, path) {
  const response = await backendFetch(env, path);
  if (!response.ok) throw new Error("Backend API returned " + response.status);
  return response.json();
}
async function sendTelegramFile(env, method, chatId, topicId, blob, filename, caption) {
  const form = new FormData();
  form.set("chat_id", String(chatId));
  form.set("message_thread_id", String(topicId));
  form.set(method === "sendAudio" ? "audio" : "document", blob, filename);
  if (caption) form.set("caption", caption);
  const url = TELEGRAM_API_BASE + "/bot" + env.TELEGRAM_BOT_TOKEN + "/" + method;
  const response = await fetch(url, { method: "POST", body: form });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.description || "Telegram file send failed");
  return result;
}
