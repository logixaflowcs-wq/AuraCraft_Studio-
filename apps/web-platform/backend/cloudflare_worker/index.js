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

function allowedOrigins(env) {
  return new Set((env.ALLOWED_ORIGINS || "").split(",").map((value) => value.trim()).filter(Boolean));
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
        try {
          JSON.parse(rawBody);
        } catch {
          return Response.json({ error: "invalid_json" }, { status: 400 });
        }

        // FIX(audit-2-B): the backend owns all Telegram commands and bot credentials.
        if (!env.BACKEND_API_URL) return Response.json({ error: "backend_not_configured" }, { status: 503 });
        const backend = new URL("/api/telegram/webhook", env.BACKEND_API_URL);
        if (backend.protocol !== "https:") return Response.json({ error: "backend_not_configured" }, { status: 503 });
        const response = await fetch(backend.toString(), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Telegram-Bot-Api-Secret-Token": providedSecret,
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
    const origins = allowedOrigins(env);
    if (request.method === "OPTIONS") {
      if (!origin || !origins.has(origin)) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (!origin || !origins.has(origin)) return Response.json({ error: "origin_not_allowed" }, { status: 403 });
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
