import test from "node:test";
import assert from "node:assert/strict";
import { constantTimeEqual } from "./index.js";

test("constantTimeEqual accepts identical credentials", () => {
  assert.equal(constantTimeEqual("secret", "secret"), true);
});

test("constantTimeEqual rejects different values and lengths", () => {
  assert.equal(constantTimeEqual("secret", "secreT"), false);
  assert.equal(constantTimeEqual("short", "longer"), false);
});

test("constantTimeEqual rejects non-string inputs", () => {
  assert.equal(constantTimeEqual(undefined, "secret"), false);
});

import worker from "./index.js";

test("worker rejects malformed JSON without leaking parser details", async () => {
  const response = await worker.fetch(new Request("https://worker.example/webhook", {
    method: "POST",
    headers: { "X-Telegram-Bot-Api-Secret-Token": "test-secret" },
    body: "{",
  }), { TELEGRAM_WEBHOOK_SECRET: "test-secret" }, { waitUntil() {} });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "invalid_json" });
});

test("worker rejects declared and actual oversized bodies", async () => {
  const declared = await worker.fetch(new Request("https://worker.example/webhook", {
    method: "POST",
    headers: { "X-Telegram-Bot-Api-Secret-Token": "test-secret", "Content-Length": "70000" },
    body: "{}",
  }), { TELEGRAM_WEBHOOK_SECRET: "test-secret" }, { waitUntil() {} });
  assert.equal(declared.status, 413);

  const actual = await worker.fetch(new Request("https://worker.example/webhook", {
    method: "POST",
    headers: { "X-Telegram-Bot-Api-Secret-Token": "test-secret" },
    body: "x".repeat(65 * 1024),
  }), { TELEGRAM_WEBHOOK_SECRET: "test-secret" }, { waitUntil() {} });
  assert.equal(actual.status, 413);
});

test("worker validates Telegram access policy before forwarding verified updates", async () => {
  const originalFetch = globalThis.fetch;
  let forwarded;
  globalThis.fetch = async (url, init) => {
    forwarded = { url: String(url), init };
    return Response.json({ ok: true, action: "status" });
  };
  try {
    const body = JSON.stringify({ message: {
      text: "/status",
      chat: { id: -1003992125718 },
      message_thread_id: 215,
      from: { id: 123456 },
    } });
    const response = await worker.fetch(new Request("https://worker.example/webhook", {
      method: "POST",
      headers: { "X-Telegram-Bot-Api-Secret-Token": "test-secret" },
      body,
    }), {
      TELEGRAM_WEBHOOK_SECRET: "test-secret",
      TELEGRAM_GROUP_CHAT_ID: "-1003992125718",
      TELEGRAM_TOPIC_ID: "215",
      TELEGRAM_ALLOWED_USER_IDS: "123456,654321",
      BACKEND_API_URL: "https://api.example.com",
      API_AUTH_TOKEN: "server-only-token",
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, action: "status" });
    assert.equal(forwarded.url, "https://api.example.com/api/telegram/webhook");
    assert.equal(forwarded.init.headers.Authorization, "Bearer server-only-token");
    assert.equal(forwarded.init.headers["X-AuraCraft-Worker-Verified"], "true");
    assert.equal(forwarded.init.headers["X-Telegram-Bot-Api-Secret-Token"], undefined);
    assert.equal(forwarded.init.body, body);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("worker ignores Telegram updates from users outside the allowlist", async () => {
  const response = await worker.fetch(new Request("https://worker.example/webhook", {
    method: "POST",
    headers: { "X-Telegram-Bot-Api-Secret-Token": "test-secret" },
    body: JSON.stringify({ message: {
      text: "/status",
      chat: { id: -1003992125718 },
      message_thread_id: 215,
      from: { id: 999999 },
    } }),
  }), {
    TELEGRAM_WEBHOOK_SECRET: "test-secret",
    TELEGRAM_GROUP_CHAT_ID: "-1003992125718",
    TELEGRAM_TOPIC_ID: "215",
    TELEGRAM_ALLOWED_USER_IDS: "123456",
    BACKEND_API_URL: "https://api.example.com",
    API_AUTH_TOKEN: "server-only-token",
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, ignored: "unauthorized_user" });
});

test("backend-only Telegram API proxy authenticates and injects the bot token", async () => {
  const originalFetch = globalThis.fetch;
  let forwarded;
  globalThis.fetch = async (url, init) => {
    forwarded = { url: String(url), init };
    return Response.json({ ok: true, result: { message_id: 7 } });
  };
  try {
    const response = await worker.fetch(new Request("https://worker.example/telegram-api/sendMessage", {
      method: "POST",
      headers: {
        Authorization: "Bearer server-only-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ chat_id: 1, text: "hello" }),
    }), {
      API_AUTH_TOKEN: "server-only-token",
      TELEGRAM_BOT_TOKEN: "private-bot-token",
    });
    assert.equal(response.status, 200);
    assert.equal(forwarded.url, "https://api.telegram.org/botprivate-bot-token/sendMessage");
    assert.equal(forwarded.init.headers.get("Authorization"), null);
    assert.deepEqual(await response.json(), { ok: true, result: { message_id: 7 } });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Telegram API proxy injects the Worker-held webhook secret", async () => {
  const originalFetch = globalThis.fetch;
  let forwarded;
  globalThis.fetch = async (url, init) => {
    forwarded = { url: String(url), init };
    return Response.json({ ok: true });
  };
  try {
    const response = await worker.fetch(new Request("https://worker.example/telegram-api/setWebhook", {
      method: "POST",
      headers: {
        Authorization: "Bearer server-only-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: "https://worker.example/webhook" }),
    }), {
      API_AUTH_TOKEN: "server-only-token",
      TELEGRAM_BOT_TOKEN: "private-bot-token",
      TELEGRAM_WEBHOOK_SECRET: "private-webhook-secret",
    });
    assert.equal(response.status, 200);
    assert.deepEqual(JSON.parse(forwarded.init.body), {
      url: "https://worker.example/webhook",
      secret_token: "private-webhook-secret",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test("browser API proxy injects the server-side bearer token and forwards client IP", async () => {
  const originalFetch = globalThis.fetch;
  let forwarded;
  globalThis.fetch = async (url, init) => {
    forwarded = { url: String(url), init };
    return Response.json({ ok: true });
  };
  try {
    const response = await worker.fetch(new Request("https://worker.example/api/tts/synthesize?mode=test", {
      method: "POST",
      headers: {
        Origin: "https://studio.example.com",
        "CF-Connecting-IP": "198.51.100.42",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: "hello" }),
    }), {
      BACKEND_API_URL: "https://api.example.com",
      API_AUTH_TOKEN: "server-only-token",
      ALLOWED_ORIGINS: "https://studio.example.com",
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), "https://studio.example.com");
    assert.equal(forwarded.url, "https://api.example.com/api/tts/synthesize?mode=test");
    assert.equal(forwarded.init.headers.get("Authorization"), "Bearer server-only-token");
    assert.equal(forwarded.init.headers.get("X-Forwarded-For"), "198.51.100.42");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("browser API proxy rejects origins outside the explicit allowlist", async () => {
  const response = await worker.fetch(new Request("https://worker.example/api/characters", {
    method: "GET",
    headers: { Origin: "https://attacker.example" },
  }), { ALLOWED_ORIGINS: "https://studio.example.com" });
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "origin_not_allowed" });
});

test("browser API proxy answers allowed CORS preflight requests", async () => {
  const response = await worker.fetch(new Request("https://worker.example/api/characters", {
    method: "OPTIONS",
    headers: { Origin: "https://studio.example.com" },
  }), { ALLOWED_ORIGINS: "https://studio.example.com" });
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "https://studio.example.com");
});
