from __future__ import annotations

import pytest
from app.main import enforce_tts_rate_limit, require_auth
from fastapi import HTTPException
from pydantic import ValidationError
from starlette.requests import Request


def test_require_auth_uses_bearer_token(monkeypatch):
    monkeypatch.setenv("API_AUTH_TOKEN", "correct-token")
    require_auth("Bearer correct-token")
    with pytest.raises(HTTPException) as error:
        require_auth("Bearer incorrect-token")
    assert error.value.status_code == 401
    assert error.value.detail == "Unauthorized"


def test_require_auth_rejects_missing_or_wrong_scheme(monkeypatch):
    monkeypatch.setenv("API_AUTH_TOKEN", "correct-token")
    for header in (None, "Basic correct-token", "Bearer"):
        with pytest.raises(HTTPException) as error:
            require_auth(header)
        assert error.value.status_code == 401


def test_require_auth_fails_closed_in_production_without_config(monkeypatch):
    monkeypatch.delenv("API_AUTH_TOKEN", raising=False)
    monkeypatch.setenv("ENVIRONMENT", "production")
    with pytest.raises(HTTPException) as error:
        require_auth(None)
    assert error.value.status_code == 401


def test_tts_rate_limit_returns_retry_after(monkeypatch):
    from app import main

    monkeypatch.setenv("API_AUTH_TOKEN", "test-token")
    main._tts_rate_events.clear()
    request = Request({"type": "http", "method": "POST", "path": "/api/tts/synthesize", "headers": [], "client": ("192.0.2.10", 1234), "server": ("test", 80), "scheme": "http", "query_string": b""})
    for _ in range(10):
        enforce_tts_rate_limit(request, "Bearer test-token")
    with pytest.raises(HTTPException) as error:
        enforce_tts_rate_limit(request, "Bearer test-token")
    assert error.value.status_code == 429
    assert "Retry-After" in error.value.headers

@pytest.mark.parametrize("actor_id", ["../evil", r"..\\evil", "/absolute/path", "bad\x00id"])
def test_persona_import_rejects_unsafe_actor_ids(actor_id):
    from app.main import ManualPersonaPack
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        ManualPersonaPack(
            actor_id=actor_id,
            actor_name="Test Actor",
            voice_binding={"voice_id": "my-MM-NilarNeural", "language": "my-MM"},
            character_meta={},
        )


def test_export_rejects_unsafe_legacy_character_id(monkeypatch, tmp_path):
    from app import main

    monkeypatch.setattr(main, "load_characters", lambda: [{
        "id": "../evil", "name": "Evil", "role": "test", "voice_id": "voice",
        "language": "en-US", "vrm_model": "/models/test.vrm", "personality": "test",
    }])
    monkeypatch.setattr(main, "DATA_DIR", tmp_path)
    with pytest.raises(HTTPException) as error:
        main.export_character_pack(main.PersonaPackExportRequest(character_id="../evil"), None)
    assert error.value.status_code == 422


def test_mutating_character_endpoint_requires_bearer_token(monkeypatch):
    from app import main
    from fastapi.testclient import TestClient

    monkeypatch.setenv("API_AUTH_TOKEN", "required-token")
    response = TestClient(main.app).post("/api/characters", json={"name": "Unauthorized"})
    assert response.status_code == 401
    assert response.json()["detail"] == "Unauthorized"


def test_telegram_speak_escapes_html_input(monkeypatch):
    from app import main
    from fastapi.testclient import TestClient

    monkeypatch.setattr(main, "TELEGRAM_WEBHOOK_SECRET", "test-webhook-secret")

    async def fake_audio(text, voice):
        return b"test-mp3"

    async def fake_send_audio(chat_id, thread_id, audio_bytes):
        return "test-audio-file-id"

    async def fake_send_reply(**kwargs):
        return True

    monkeypatch.setattr(main, "_generate_tts_audio", fake_audio)
    monkeypatch.setattr(main, "send_telegram_audio", fake_send_audio)
    monkeypatch.setattr(main, "send_telegram_reply", fake_send_reply)
    response = TestClient(main.app).post(
        "/api/telegram/webhook",
        json={"message": {
            "message_thread_id": 215,
            "chat": {"id": -1003992125718, "type": "supergroup"},
            "from": {"id": 7890},
            "text": "/speak <b>unsafe</b>",
        }},
        headers={"x-telegram-bot-api-secret-token": "test-webhook-secret"},
    )
    assert response.status_code == 200
    assert "&lt;b&gt;unsafe&lt;/b&gt;" in response.json()["reply"]
    assert response.json()["audio_file_id"] == "test-audio-file-id"


def test_character_store_corruption_is_backed_up_before_reset(monkeypatch, tmp_path):
    from app import main

    store = tmp_path / "characters.json"
    store.write_text("{not-json", encoding="utf-8")
    monkeypatch.setattr(main, "DATA_DIR", tmp_path)
    monkeypatch.setattr(main, "CHARACTERS_FILE", store)

    characters = main.load_characters()

    backups = list(tmp_path.glob("characters.corrupt.*.json"))
    assert backups and backups[0].read_text(encoding="utf-8") == "{not-json"
    assert characters == main.DEFAULT_CHARACTERS
    assert isinstance(__import__("json").loads(store.read_text(encoding="utf-8")), list)


def test_character_store_rejects_invalid_schema_and_backups(monkeypatch, tmp_path):
    from app import main

    store = tmp_path / "characters.json"
    store.write_text('[{"name":"missing-id"}]', encoding="utf-8")
    monkeypatch.setattr(main, "DATA_DIR", tmp_path)
    monkeypatch.setattr(main, "CHARACTERS_FILE", store)

    assert main.load_characters() == main.DEFAULT_CHARACTERS
    assert len(list(tmp_path.glob("characters.corrupt.*.json"))) == 1


def test_character_save_is_atomic_and_schema_validated(monkeypatch, tmp_path):
    from app import main

    store = tmp_path / "characters.json"
    monkeypatch.setattr(main, "DATA_DIR", tmp_path)
    monkeypatch.setattr(main, "CHARACTERS_FILE", store)
    main.save_characters(main.DEFAULT_CHARACTERS)
    assert store.is_file()
    assert not list(tmp_path.glob(".characters-*.tmp"))
    with pytest.raises(ValidationError):
        main.save_characters([{"name": "missing-id"}])


def test_readiness_reports_storage_and_tts(monkeypatch, tmp_path):
    import asyncio

    from app import main

    async def fake_voices():
        return [{"ShortName": "en-US-test"}]

    monkeypatch.setattr(main, "DATA_DIR", tmp_path)
    monkeypatch.setattr(main.edge_tts, "list_voices", fake_voices)
    result = asyncio.run(main.readiness_check())
    assert result["status"] == "ready"


def test_telegram_import_requires_explicit_https_host_allowlist(monkeypatch):
    import asyncio

    from app import main

    monkeypatch.delenv("TELEGRAM_IMPORT_ALLOWED_HOSTS", raising=False)
    with pytest.raises(HTTPException) as error:
        asyncio.run(main._download_persona_pack("https://untrusted.example/persona.json"))
    assert error.value.status_code == 403


def test_telegram_import_rejects_non_https_urls(monkeypatch):
    import asyncio

    from app import main

    monkeypatch.setenv("TELEGRAM_IMPORT_ALLOWED_HOSTS", "trusted.example")
    with pytest.raises(HTTPException) as error:
        asyncio.run(main._download_persona_pack("http://trusted.example/persona.json"))
    assert error.value.status_code == 422
