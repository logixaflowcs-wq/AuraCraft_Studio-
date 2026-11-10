/**
 * AuraCraft Studio — Cloudflare Telegram webhook edge gateway.
 * The FastAPI webhook is the single canonical command implementation because
 * character storage and Edge-TTS are owned by the backend service.
 */

// FIX(audit-1-H): constant-time comparison for webhook credentials and user IDs.
export function constantTimeEqual(left, right) {
  if (typeof left !== "string" || typeof right !== "string") return false;
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  let diff = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i += 1) diff |= (a[i] || 0) ^ (b[i] || 0);
  return diff === 0;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      return Response.json({ status: "healthy", service: "AuraCraft Studio Telegram Edge Gateway" });
    }
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

    try {
      const providedSecret = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
      if (!env.TELEGRAM_WEBHOOK_SECRET) {
        return Response.json({ error: "webhook_not_configured" }, { status: 503 });
      }
      if (!constantTimeEqual(providedSecret, env.TELEGRAM_WEBHOOK_SECRET)) {
        return Response.json({ error: "unauthorized" }, { status: 401 });
      }

      // FIX(audit-1-H): cap both declared and actual request body sizes before parsing.
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

      // FIX(audit-2-B): forward updates to the one canonical FastAPI command handler.
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
  },
};
