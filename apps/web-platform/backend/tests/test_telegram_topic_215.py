from __future__ import annotations

import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def telegram_test_configuration(monkeypatch):
    import app.main as main

    monkeypatch.setattr(main, "TELEGRAM_WEBHOOK_SECRET", "test-webhook-secret")
    monkeypatch.setenv("TELEGRAM_ALLOWED_USER_IDS", "7890")


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
    assert "AuraCraft Archetypes:" in data["reply"]


def test_telegram_voice_preview_uses_selected_character(monkeypatch):
    import app.main as main

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
    assert "Demo Actor" in res.json()["reply"]


def test_telegram_export_describes_manual_json_transfer():
    payload = {
        "message": {
            "message_thread_id": 215,
            "chat": {"id": -1003992125718, "type": "supergroup"},
            "from": {"id": 7890, "first_name": "Developer"},
            "text": "/export actor_demo",
        },
    }
    res = client.post("/api/telegram/webhook", json=payload, headers={"x-telegram-bot-api-secret-token": "test-webhook-secret"})
    assert res.status_code == 200
    assert "standalone JSON pack" in res.json()["reply"]


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
    import app.main as main

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


def test_telegram_missing_user_allowlist_fails_closed(monkeypatch):
    import app.main as main

    monkeypatch.delenv("TELEGRAM_ALLOWED_USER_IDS", raising=False)
    payload = {
        "message": {
            "message_thread_id": 215,
            "chat": {"id": -1003992125718, "type": "supergroup"},
            "from": {"id": 7890},
            "text": "/status",
        },
    }
    response = client.post(
        "/api/telegram/webhook",
        json=payload,
        headers={"x-telegram-bot-api-secret-token": "test-webhook-secret"},
    )
    assert response.status_code == 503
    assert "allowlist" in response.json()["detail"]


def test_health_reports_unconfigured_external_integrations():
    response = client.get("/health")
    assert response.status_code == 200
    integrations = response.json()["integrations"]
    assert response.json()["supported_voices"] == len(client.get("/api/tts/voices").json())
    assert integrations["narrativ_forge"] == "not_configured"
    assert integrations["video_rendering"] == "manifest_only"


def test_character_write_endpoints_require_admin_key_in_production(monkeypatch, tmp_path):
    import app.main as main

    original_characters = main.CHARACTERS_FILE.read_text(encoding="utf-8")
    monkeypatch.setattr(main, "CHARACTERS_FILE", tmp_path / "characters.json")
    main.CHARACTERS_FILE.write_text(original_characters, encoding="utf-8")
    payload = {"name": "Protected Character"}
    with patch.dict("os.environ", {"APP_ENV": "production"}, clear=False):
        missing_key = client.post("/api/characters", json=payload)
        assert missing_key.status_code == 503
        monkeypatch.setenv("API_ADMIN_KEY", "expected-admin-key")
        invalid_key = client.post(
            "/api/characters",
            json=payload,
            headers={"X-AuraCraft-Admin-Key": "wrong-key"},
        )
        assert invalid_key.status_code == 401
        valid_key = client.post(
            "/api/characters",
            json=payload,
            headers={"X-AuraCraft-Admin-Key": "expected-admin-key"},
        )
        assert valid_key.status_code == 200
