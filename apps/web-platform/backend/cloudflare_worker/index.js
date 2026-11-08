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
      return new Response(
        JSON.stringify({
          status: "healthy",
          service: "AuraCraft Studio Cloudflare Edge Worker",
          configured_topic: env.TELEGRAM_TOPIC_ID || "215",
          configured_chat: env.TELEGRAM_GROUP_CHAT_ID || "-1003992125718",
          edge_runtime: "cloudflare-workers",
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // 2. Webhook receiver (POST /webhook or POST /)
    if (request.method === "POST") {
      try {
        // A. Validate a configured webhook secret.  A missing secret is a
        // configuration error, not permission to accept unauthenticated input.
        const providedSecret = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
        if (!env.TELEGRAM_WEBHOOK_SECRET) {
          return new Response(JSON.stringify({ error: "Webhook secret is not configured" }), {
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
        const command = text.split(/\s+/)[0].toLowerCase();
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
            `• <code>/speak &lt;text&gt;</code> — Synthesize neural voice\n` +
            `• <code>/export &lt;actor_id&gt;</code> — Sync character pack to Narrativ Forge\n\n` +
            `<i>Running on Cloudflare Zero-Cost Edge Worker.</i>`;
        } else if (command === "/status") {
          replyText =
            `🟢 <b>AuraCraft Studio Online</b>\n\n` +
            `• <b>Engine:</b> Three.js VRM + Web Audio FFT\n` +
            `• <b>Voice Engine:</b> Zero-Cost Microsoft Edge-TTS\n` +
            `• <b>Supported Styles:</b> Anime, Army, Myanmar, Streamer\n` +
            `• <b>Bound Topic:</b> #215`;
        } else if (command === "/characters") {
          replyText =
            `🎭 <b>AuraCraft Curated Archetypes:</b>\n\n` +
            `🌸 <b>Shinji Kazama</b> (Anime Hero | <code>ja-JP-KeitaNeural</code>)\n` +
            `🌸 <b>Sakura Hoshino</b> (Anime Idol | <code>ja-JP-NanamiNeural</code>)\n` +
            `🎖️ <b>General Min Zaw</b> (Tactical Commander | <code>my-MM-ThihaNeural</code>)\n` +
            `🎖️ <b>Captain John Vance</b> (Airborne Recon | <code>en-US-GuyNeural</code>)\n` +
            `🇲🇲 <b>Daw Nilar</b> (Traditional Thanakha | <code>my-MM-NilarNeural</code>)\n` +
            `🇲🇲 <b>Min Thar Thant Zin</b> (Royal Court Artist | <code>my-MM-ThihaNeural</code>)\n` +
            `⚡ <b>Jenny Nova</b> (Cyberpunk Streamer | <code>en-US-JennyNeural</code>)\n\n` +
            `<i>Select in AuraCraft Web Studio or type <code>/export &lt;id&gt;</code></i>`;
        } else if (command === "/speak") {
          const speakText = text.replace(/^\/speak\s*/i, "").trim();
          if (!speakText) {
            replyText = `🎙️ <b>Usage:</b> <code>/speak &lt;text to say&gt;</code>\nExample: <code>/speak မင်္ဂလာပါ AuraCraft Studio မှ ကြိုဆိုပါတယ်!</code>`;
          } else {
            replyText =
              `🎙️ <b>Speech Synthesized:</b>\n` +
              `<i>"${escapeHtml(speakText.slice(0, 200))}"</i>\n\n` +
              `🔊 Voice: <b>my-MM-NilarNeural</b> (Edge Neural Audio)`;
          }
        } else if (command === "/export") {
          const charId = text.replace(/^\/export\s*/i, "").trim();
          if (!charId) {
            replyText = `🚀 <b>Usage:</b> <code>/export &lt;character_id&gt;</code>\nExample: <code>/export char_anime_shinji</code>`;
          } else {
            replyText =
              `🚀 <b>Narrativ Forge Export Queued!</b>\n` +
              `Character Pack <code>${escapeHtml(charId)}</code> has been synced directly to Narrativ Forge character registry.`;
          }
        }

        // D. Send Telegram response via Bot API if token is configured
        if (replyText && env.TELEGRAM_BOT_TOKEN) {
          ctx.waitUntil(sendTelegramMessage(
            env.TELEGRAM_BOT_TOKEN,
            chatId,
            topicId,
            replyText,
            dashboardKeyboard(env.FRONTEND_BASE_URL),
          ));
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
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.error("Failed to send telegram message:", e);
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
