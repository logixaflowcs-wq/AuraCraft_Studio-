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
    monkeypatch.setattr(main, "TELEGRAM_TOPIC_ID", 215)
    monkeypatch.setattr(main, "TELEGRAM_GROUP_CHAT_ID", "-1003992125718")

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


def test_telegram_get_me_proxy_returns_only_public_bot_identity(monkeypatch):
    import asyncio

    from app import main

    class FakeResponse:
        is_success = True

        @staticmethod
        def json():
            return {"ok": True, "result": {"username": "auracraft_test_bot", "first_name": "AuraCraft", "token": "must-not-leak"}}

    class FakeClient:
        def __init__(self, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def get(self, url, headers=None):
            assert url.endswith("/getMe")
            assert isinstance(headers, dict)
            return FakeResponse()

    monkeypatch.setattr(main, "TELEGRAM_BOT_TOKEN", "test-token")
    monkeypatch.setattr(main.httpx, "AsyncClient", FakeClient)
    result = asyncio.run(main.telegram_bot_test())
    assert result == {"ok": True, "username": "auracraft_test_bot", "first_name": "AuraCraft"}
    assert "token" not in result


def test_production_cors_requires_explicit_origins(monkeypatch):
    import asyncio

    from app import main

    monkeypatch.setenv("ENV", "production")
    monkeypatch.setattr(main, "_allowed_origins", [])
    with pytest.raises(RuntimeError, match="ALLOWED_ORIGINS"):
        asyncio.run(main.validate_production_configuration())


def test_unhandled_exception_response_does_not_leak_details():
    import asyncio

    from app import main
    from fastapi.responses import JSONResponse
    from starlette.requests import Request

    request = Request({"type": "http", "method": "GET", "path": "/secret", "headers": [], "client": ("127.0.0.1", 1), "server": ("test", 80), "scheme": "http", "query_string": b""})
    try:
        raise RuntimeError("database-password-must-not-leak")
    except RuntimeError as error:
        response = asyncio.run(main.unexpected_error_handler(request, error))
    assert isinstance(response, JSONResponse)
    assert response.status_code == 500
    assert b"database-password-must-not-leak" not in response.body
    assert response.body == b'{"detail":"Internal server error"}'


def _make_aura_archive(actor_id="audit_import_test", checksum_override=None, extra_manifest_key=False):
    import hashlib
    import io
    import json
    import zipfile
    from datetime import UTC, datetime

    vrm_bytes = b"test-vrm-content"
    manifest = {
        "version": "1.0",
        "characterId": actor_id,
        "characterName": "Audit Imported Persona",
        "vrmChecksum": checksum_override or hashlib.sha256(vrm_bytes).hexdigest(),
        "identityPrompt": "A test persona",
        "tags": ["audit", "test"],
        "style": "anime",
        "exportedAt": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
        "source": "AuraCraft-Studio-v1",
    }
    if extra_manifest_key:
        manifest["unexpected"] = "reject"
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("manifest.json", json.dumps(manifest))
        archive.writestr("model.vrm", vrm_bytes)
    return stream.getvalue(), vrm_bytes


def test_aura_import_validates_checksum_and_persists_vrm(monkeypatch, tmp_path):
    from app import main

    data_dir = tmp_path / "data"
    monkeypatch.setattr(main, "DATA_DIR", data_dir)
    monkeypatch.setattr(main, "CHARACTERS_FILE", data_dir / "characters.json")
    archive, vrm_bytes = _make_aura_archive()

    result = main._import_aura_archive(archive, [])

    assert result["status"] == "imported"
    assert (data_dir / "imported_vrms" / "audit_import_test.vrm").read_bytes() == vrm_bytes
    stored = main.load_characters()
    assert stored[0]["vrm_model"] == "/api/characters/vrm/audit_import_test"


def test_aura_import_rejects_checksum_mismatch(monkeypatch, tmp_path):
    from app import main

    monkeypatch.setattr(main, "DATA_DIR", tmp_path)
    monkeypatch.setattr(main, "CHARACTERS_FILE", tmp_path / "characters.json")
    archive, _ = _make_aura_archive(checksum_override="0" * 64)
    with pytest.raises(HTTPException) as error:
        main._import_aura_archive(archive, [])
    assert error.value.status_code == 422
    assert not (tmp_path / "imported_vrms").exists()


@pytest.mark.parametrize("actor_id", ["../evil", r"..\\evil", "/absolute/path", "bad\x00id"])
def test_aura_import_rejects_unsafe_character_ids(actor_id, monkeypatch, tmp_path):
    from app import main

    monkeypatch.setattr(main, "DATA_DIR", tmp_path)
    monkeypatch.setattr(main, "CHARACTERS_FILE", tmp_path / "characters.json")
    archive, _ = _make_aura_archive(actor_id=actor_id)
    with pytest.raises(HTTPException) as error:
        main._import_aura_archive(archive, [])
    assert error.value.status_code == 422


def test_aura_import_rejects_unknown_manifest_keys(monkeypatch, tmp_path):
    from app import main

    monkeypatch.setattr(main, "DATA_DIR", tmp_path)
    monkeypatch.setattr(main, "CHARACTERS_FILE", tmp_path / "characters.json")
    archive, _ = _make_aura_archive(extra_manifest_key=True)
    with pytest.raises(HTTPException) as error:
        main._import_aura_archive(archive, [])
    assert error.value.status_code == 422


def test_aura_import_rejects_unexpected_zip_paths(monkeypatch, tmp_path):
    import io
    import zipfile

    from app import main

    monkeypatch.setattr(main, "DATA_DIR", tmp_path)
    monkeypatch.setattr(main, "CHARACTERS_FILE", tmp_path / "characters.json")
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, "w") as archive:
        archive.writestr("../evil.vrm", b"bad")
    with pytest.raises(HTTPException) as error:
        main._import_aura_archive(stream.getvalue(), [])
    assert error.value.status_code == 422


def test_aura_import_rejects_oversized_manifest(monkeypatch, tmp_path):
    import io
    import zipfile

    from app import main

    monkeypatch.setattr(main, "DATA_DIR", tmp_path)
    monkeypatch.setattr(main, "CHARACTERS_FILE", tmp_path / "characters.json")
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, "w") as archive:
        archive.writestr("manifest.json", b"x" * (256 * 1024 + 1))
        archive.writestr("model.vrm", b"vrm")
    with pytest.raises(HTTPException) as error:
        main._import_aura_archive(stream.getvalue(), [])
    assert error.value.status_code == 413


def test_telegram_speech_calls_authenticated_tts_endpoint(monkeypatch):
    import asyncio

    from app import main

    class FakeResponse:
        is_success = True
        content = b"mp3-audio"
        status_code = 200

    class FakeClient:
        def __init__(self, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def post(self, url, json, headers):
            assert url == "https://backend.example.com/api/tts/synthesize"
            assert json == {"text": "hello", "voice": "en-US-JennyNeural"}
            assert headers["Authorization"] == "Bearer server-token"
            return FakeResponse()

    monkeypatch.setenv("BACKEND_PUBLIC_URL", "https://backend.example.com")
    monkeypatch.setenv("API_AUTH_TOKEN", "server-token")
    monkeypatch.setattr(main.httpx, "AsyncClient", FakeClient)
    assert asyncio.run(main._synthesize_telegram_audio("hello", "en-US-JennyNeural")) == b"mp3-audio"
