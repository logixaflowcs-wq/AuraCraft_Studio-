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
