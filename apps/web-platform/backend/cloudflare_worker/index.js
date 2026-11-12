/**
 * AuraCraft Studio — Cloudflare edge gateway.
 * Telegram updates are forwarded to one FastAPI command handler. Browser API
 * calls are proxied with a server-side bearer token; no API secret reaches Vite.
 */

// FIX(audit-1-H): constant-time comparison for webhook credentials.
export function constantTimeEqual(left, right) {
  if (typeof left !== "string" || typeof right !== "string") return false;
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  let diff = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i += 1) diff |= (a[i] || 0) ^ (b[i] || 0);
  return diff === 0;
}

function normalizeOrigin(value) {
  if (typeof value !== "string" || !value || value === "null") return "";
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

function allowedOrigins(env) {
  return new Set(
    (env.ALLOWED_ORIGINS || "")
      .split(",")
      .map((value) => normalizeOrigin(value.trim()))
      .filter(Boolean),
  );
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      return Response.json({ status: "healthy", service: "AuraCraft Studio Edge Gateway" });
    }

    // Backend-only Telegram Bot API proxy: the bot token stays in this Worker secret store.
    if (url.pathname.startsWith("/telegram-api/")) {
      if (!["GET", "POST"].includes(request.method)) return new Response("Method not allowed", { status: 405 });
      if (!env.API_AUTH_TOKEN || !constantTimeEqual(request.headers.get("Authorization"), `Bearer ${env.API_AUTH_TOKEN}`)) {
        return Response.json({ error: "unauthorized" }, { status: 401 });
      }
      if (!env.TELEGRAM_BOT_TOKEN) return Response.json({ error: "telegram_bot_not_configured" }, { status: 503 });
      const method = url.pathname.slice("/telegram-api/".length);
      const allowedMethods = new Set(["getMe", "getWebhookInfo", "setMyCommands", "setWebhook", "sendMessage", "sendAudio", "sendDocument"]);
      if (!allowedMethods.has(method)) return Response.json({ error: "telegram_method_not_allowed" }, { status: 404 });

      const headers = new Headers(request.headers);
      headers.delete("Authorization");
      headers.delete("Origin");
      headers.delete("Host");
      headers.delete("Content-Length");
      let body = ["GET", "HEAD"].includes(request.method) ? undefined : request.body;
      if (method === "setWebhook") {
        if (!env.TELEGRAM_WEBHOOK_SECRET) return Response.json({ error: "webhook_not_configured" }, { status: 503 });
        try {
          const payload = await request.json();
          payload.secret_token = env.TELEGRAM_WEBHOOK_SECRET;
          body = JSON.stringify(payload);
          headers.set("Content-Type", "application/json");
        } catch {
          return Response.json({ error: "invalid_json" }, { status: 400 });
        }
      }
      try {
        const target = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`;
        const response = await fetch(target, { method: request.method, headers, body, redirect: "manual" });
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: { "Content-Type": response.headers.get("Content-Type") || "application/json" },
        });
      } catch (error) {
        console.error("Telegram Bot API proxy failed", error);
        return Response.json({ error: "telegram_proxy_failed" }, { status: 502 });
      }
    }

    if (url.pathname === "/webhook") {
      if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
      try {
        const providedSecret = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
        if (!env.TELEGRAM_WEBHOOK_SECRET) {
          return Response.json({ error: "webhook_not_configured" }, { status: 503 });
        }
        if (!constantTimeEqual(providedSecret, env.TELEGRAM_WEBHOOK_SECRET)) {
          return Response.json({ error: "unauthorized" }, { status: 401 });
        }

        // FIX(audit-1-H): enforce the 64KB limit before buffering or parsing Telegram updates.
        const contentLength = Number(request.headers.get("Content-Length") || 0);
        if (contentLength > 64 * 1024) return Response.json({ error: "payload_too_large" }, { status: 413 });
        const rawBody = await request.text();
        if (new TextEncoder().encode(rawBody).byteLength > 64 * 1024) {
          return Response.json({ error: "payload_too_large" }, { status: 413 });
        }
        let update;
        try {
          update = JSON.parse(rawBody);
        } catch {
          return Response.json({ error: "invalid_json" }, { status: 400 });
        }

        const message = update?.message;
        if (!message) return Response.json({ ok: true, ignored: "not_a_message" });
        const allowedUsers = (env.TELEGRAM_ALLOWED_USER_IDS || "").split(",").map((value) => value.trim()).filter(Boolean);
        const expectedChat = (env.TELEGRAM_GROUP_CHAT_ID || "").trim();
        const expectedTopic = Number(env.TELEGRAM_TOPIC_ID || 0);
        if (!expectedChat || !expectedTopic || !allowedUsers.length) {
          return Response.json({ error: "telegram_access_policy_not_configured" }, { status: 503 });
        }
        if (String(message.chat?.id ?? "") !== expectedChat) {
          return Response.json({ ok: true, ignored: "unauthorized_chat" });
        }
        if (Number(message.message_thread_id || 0) !== expectedTopic) {
          return Response.json({ ok: true, ignored: "unauthorized_topic" });
        }
        const userId = String(message.from?.id ?? "");
        if (!allowedUsers.some((allowedId) => constantTimeEqual(userId, allowedId))) {
          return Response.json({ ok: true, ignored: "unauthorized_user" });
        }

        // Only this Worker can attest that the Telegram secret, chat, topic and user checks passed.
        if (!env.BACKEND_API_URL || !env.API_AUTH_TOKEN) return Response.json({ error: "backend_not_configured" }, { status: 503 });
        const backend = new URL("/api/telegram/webhook", env.BACKEND_API_URL);
        if (backend.protocol !== "https:") return Response.json({ error: "backend_not_configured" }, { status: 503 });
        const response = await fetch(backend.toString(), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${env.API_AUTH_TOKEN}`,
            "X-AuraCraft-Worker-Verified": "true",
          },
          body: rawBody,
        });
        if (!response.ok) {
          console.error("Canonical Telegram backend rejected webhook", response.status);
          return Response.json({ error: "backend_request_failed" }, { status: 502 });
        }
        return new Response(await response.text(), {
          status: response.status,
          headers: { "Content-Type": response.headers.get("Content-Type") || "application/json" },
        });
      } catch (error) {
        console.error("Telegram edge gateway failed", error);
        return Response.json({ error: "internal_error" }, { status: 500 });
      }
    }

    // FIX(audit-1-D): browser API requests must originate from an explicit CORS allowlist.
    const origin = request.headers.get("Origin") || "";
    const normalizedOrigin = normalizeOrigin(origin);
    const origins = allowedOrigins(env);
    if (request.method === "OPTIONS") {
      if (!normalizedOrigin || !origins.has(normalizedOrigin)) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (!normalizedOrigin || !origins.has(normalizedOrigin)) return Response.json({ error: "origin_not_allowed" }, { status: 403 });
    if (!env.BACKEND_API_URL || !env.API_AUTH_TOKEN) {
      return Response.json({ error: "api_gateway_not_configured" }, { status: 503, headers: corsHeaders(origin) });
    }

    try {
      // FIX(audit-3-G): keep API_AUTH_TOKEN at the edge; it is never exposed in browser bundles.
      const backend = new URL(url.pathname + url.search, env.BACKEND_API_URL);
      if (backend.protocol !== "https:") return Response.json({ error: "backend_not_configured" }, { status: 503 });
      const headers = new Headers(request.headers);
      headers.set("Authorization", `Bearer ${env.API_AUTH_TOKEN}`);
      headers.set("X-Forwarded-For", request.headers.get("CF-Connecting-IP") || "unknown");
      headers.delete("Origin");
      const response = await fetch(backend.toString(), {
        method: request.method,
        headers,
        body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
        redirect: "manual",
      });
      const responseHeaders = new Headers(response.headers);
      for (const [key, value] of Object.entries(corsHeaders(origin))) responseHeaders.set(key, value);
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers: responseHeaders });
    } catch (error) {
      console.error("API edge proxy failed", error);
      return Response.json({ error: "api_proxy_failed" }, { status: 502, headers: corsHeaders(origin) });
    }
  },
};
