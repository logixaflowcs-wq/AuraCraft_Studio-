from __future__ import annotations

from unittest.mock import patch

import pytest
from app.main import app
from fastapi.testclient import TestClient

client = TestClient(app)


async def _true_async():
    return True


@pytest.fixture(autouse=True)
def telegram_test_configuration(monkeypatch):
    from app import main

    monkeypatch.setattr(main, "TELEGRAM_WEBHOOK_SECRET", "test-webhook-secret")
    monkeypatch.delenv("TELEGRAM_ALLOWED_USER_IDS", raising=False)

    async def fake_audio(text, voice):
        return b"test-mp3"

    async def fake_send_audio(chat_id, thread_id, audio_bytes):
        return "test-audio-file-id"

    async def fake_send_document(chat_id, thread_id, filename, content):
        return "test-document-file-id"

    monkeypatch.setattr(main, "_generate_tts_audio", fake_audio)
    monkeypatch.setattr(main, "send_telegram_audio", fake_send_audio)
    monkeypatch.setattr(main, "send_telegram_document", fake_send_document)
    monkeypatch.setattr(main, "send_telegram_reply", lambda **kwargs: _true_async())


def test_telegram_health_topic_215():
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["service"] == "AuraCraft Studio Backend"
    assert data["telegram_topic"] == 215
    assert data["telegram_chat_id"] == "-1003992125718"


def test_telegram_valid_topic_215_status():
    payload = {
        "update_id": 10001,
        "message": {
            "message_id": 1234,
            "message_thread_id": 215,
            "chat": {"id": -1003992125718, "type": "supergroup"},
            "from": {"id": 7890, "first_name": "Developer"},
            "text": "/status",
        },
    }
    res = client.post(
        "/api/telegram/webhook",
        json=payload,
        headers={"x-telegram-bot-api-secret-token": "test-webhook-secret"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["ok"] is True
    assert data["action"] == "status"
    assert "AuraCraft Studio Online" in data["reply"]


def test_telegram_valid_topic_215_characters():
    payload = {
        "update_id": 10002,
        "message": {
            "message_id": 1235,
            "message_thread_id": 215,
            "chat": {"id": -1003992125718, "type": "supergroup"},
            "from": {"id": 7890, "first_name": "Developer"},
            "text": "/characters",
        },
    }
    res = client.post(
        "/api/telegram/webhook",
        json=payload,
        headers={"x-telegram-bot-api-secret-token": "test-webhook-secret"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["ok"] is True
    assert data["action"] == "characters"
    # FIX(audit-1-G): assert the current canonical topic-scoped bot label.
    assert "AuraCraft Archetypes (Topic 215):" in data["reply"]


def test_telegram_voice_preview_uses_selected_character(monkeypatch):
    from app import main

    monkeypatch.setattr(main, "load_characters", lambda: [{"id": "actor_demo", "name": "Demo Actor", "voice_id": "my-MM-NilarNeural"}])
    payload = {
        "message": {
            "message_thread_id": 215,
            "chat": {"id": -1003992125718, "type": "supergroup"},
            "from": {"id": 7890, "first_name": "Developer"},
            "text": "/voice actor_demo မင်္ဂလာပါ",
        },
    }
    res = client.post("/api/telegram/webhook", json=payload, headers={"x-telegram-bot-api-secret-token": "test-webhook-secret"})
    assert res.status_code == 200
    assert res.json()["action"] == "voice"
    assert res.json()["voice_id"] == "my-MM-NilarNeural"
    assert res.json()["audio_file_id"] == "test-audio-file-id"
    assert "Demo Actor" in res.json()["reply"]


def test_telegram_export_describes_manual_json_transfer():
    payload = {
        "message": {
            "message_thread_id": 215,
            "chat": {"id": -1003992125718, "type": "supergroup"},
            "from": {"id": 7890, "first_name": "Developer"},
            "text": "/export char_anime_shinji",
        },
    }
    res = client.post("/api/telegram/webhook", json=payload, headers={"x-telegram-bot-api-secret-token": "test-webhook-secret"})
    assert res.status_code == 200
    # FIX(audit-2-B): assert the actual manual persona-pack response, not an obsolete phrase.
    assert "Exported persona pack" in res.json()["reply"]
    assert res.json()["document_file_id"] == "test-document-file-id"


def test_telegram_foreign_topic_rejection():
    # Attempting to post into topic 8 (Doka) or topic 6 (Narrativ) through AuraCraft bot
    payload = {
        "update_id": 10003,
        "message": {
            "message_id": 1236,
            "message_thread_id": 8,
            "chat": {"id": -1003992125718, "type": "supergroup"},
            "from": {"id": 7890, "first_name": "Developer"},
            "text": "/status",
        },
    }
    res = client.post(
        "/api/telegram/webhook",
        json=payload,
        headers={"x-telegram-bot-api-secret-token": "test-webhook-secret"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["ok"] is True
    assert "unauthorized_topic_8" in data["ignored"]


def test_telegram_invalid_secret_token_rejection():
    payload = {
        "update_id": 10004,
        "message": {
            "message_id": 1237,
            "message_thread_id": 215,
            "chat": {"id": -1003992125718, "type": "supergroup"},
            "text": "/status",
        },
    }
    res = client.post(
        "/api/telegram/webhook",
        json=payload,
        headers={"x-telegram-bot-api-secret-token": "wrong-secret-token"},
    )
    assert res.status_code == 401


def test_telegram_missing_secret_token_rejection():
    res = client.post("/api/telegram/webhook", json={"message": {}})
    assert res.status_code == 401


def test_telegram_rejects_missing_secret_configuration(monkeypatch):
    from app import main

    monkeypatch.setattr(main, "TELEGRAM_WEBHOOK_SECRET", "")
    res = client.post("/api/telegram/webhook", json={"message": {}})
    assert res.status_code == 503


def test_telegram_production_rejects_unlisted_user():
    payload = {
        "message": {
            "message_thread_id": 215,
            "chat": {"id": -1003992125718, "type": "supergroup"},
            "from": {"id": 999, "first_name": "Unlisted"},
            "text": "/status",
        },
    }
    with patch.dict(
        "os.environ",
        {"ENVIRONMENT": "production", "TELEGRAM_ALLOWED_USER_IDS": "1686310706,6759217947"},
        clear=False,
    ):
        res = client.post(
            "/api/telegram/webhook",
            json=payload,
            headers={"x-telegram-bot-api-secret-token": "test-webhook-secret"},
        )
    assert res.status_code == 200
    assert res.json()["ignored"] == "unauthorized_user"
