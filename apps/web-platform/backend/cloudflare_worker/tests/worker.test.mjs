import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../index.js';

test('Telegram worker enforces access and proxies live backend operations', async () => {
  const originalFetch = globalThis.fetch;
  const telegramCalls = [];
  globalThis.fetch = async (url, init = {}) => {
    const target = String(url);
    if (target.includes('api.telegram.org')) {
      telegramCalls.push({ target, init });
      return new Response(JSON.stringify({ ok: true, result: { message_id: telegramCalls.length } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (target.endsWith('/health')) {
      return new Response(JSON.stringify({
        status: 'healthy',
        integrations: { edge_tts: 'available', narrativ_forge: 'not_configured' },
      }), { status: 200 });
    }
    if (target.endsWith('/api/characters')) {
      return new Response(JSON.stringify([
        { id: 'char_demo', name: 'Demo Actor', voice_id: 'my-MM-NilarNeural' },
      ]), { status: 200 });
    }
    if (target.endsWith('/api/tts/synthesize')) {
      return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
    }
    if (target.includes('/download-pack')) {
      return new Response(JSON.stringify({ actor_id: 'char_demo' }), { status: 200 });
    }
    return new Response('{}', { status: 404 });
  };

  const env = {
    TELEGRAM_WEBHOOK_SECRET: 'test-secret',
    TELEGRAM_BOT_TOKEN: 'test-token',
    TELEGRAM_TOPIC_ID: '215',
    TELEGRAM_GROUP_CHAT_ID: '-1003992125718',
    TELEGRAM_ALLOWED_USER_IDS: '7890',
    BACKEND_API_URL: 'https://backend.example',
  };

  async function update(text, userId = 7890, topicId = 215, secret = 'test-secret') {
    const body = {
      message: {
        message_thread_id: topicId,
        chat: { id: -1003992125718 },
        from: { id: userId },
        text,
      },
    };
    return worker.fetch(new Request('https://worker.example/webhook', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Telegram-Bot-Api-Secret-Token': secret,
      },
      body: JSON.stringify(body),
    }), env, {});
  }

  try {
    for (const command of ['/status', '/characters', '/speak မင်္ဂလာပါ', '/voice char_demo Hello', '/export char_demo', '/speak']) {
      const response = await update(command);
      assert.equal(response.status, 200, command);
      assert.equal((await response.json()).ok, true, command);
    }
    const deniedUser = await update('/status', 9999);
    assert.equal((await deniedUser.json()).ignored, 'unauthorized_user');
    const deniedTopic = await update('/status', 7890, 216);
    assert.equal((await deniedTopic.json()).ignored, 'unauthorized_topic_216');
    const deniedSecret = await update('/status', 7890, 215, 'wrong-secret');
    assert.equal(deniedSecret.status, 401);
    assert.equal(telegramCalls.length, 6);
    assert.ok(telegramCalls.some((call) => call.target.endsWith('/sendAudio')));
    assert.ok(telegramCalls.some((call) => call.target.endsWith('/sendDocument')));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
