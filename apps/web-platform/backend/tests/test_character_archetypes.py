from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app, DEFAULT_CHARACTERS

client = TestClient(app)


def test_health_check_archetypes():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "anime" in data["supported_archetypes"]
    assert "army" in data["supported_archetypes"]
    assert "myanmar" in data["supported_archetypes"]


def test_list_character_archetypes():
    response = client.get("/api/characters/archetypes")
    assert response.status_code == 200
    data = response.json()
    archetype_ids = [a["id"] for a in data]
    assert "anime" in archetype_ids
    assert "army" in archetype_ids
    assert "myanmar" in archetype_ids
    assert "streamer" in archetype_ids

    anime_meta = next(a for a in data if a["id"] == "anime")
    assert anime_meta["count"] >= 3


def test_filter_characters_by_style():
    # Test Anime style characters
    res_anime = client.get("/api/characters?style=anime")
    assert res_anime.status_code == 200
    anime_chars = res_anime.json()
    assert len(anime_chars) >= 3
    for c in anime_chars:
        assert c["style"] == "anime"

    # Test Army style characters
    res_army = client.get("/api/characters?style=army")
    assert res_army.status_code == 200
    army_chars = res_army.json()
    assert len(army_chars) >= 3
    for c in army_chars:
        assert c["style"] == "army"

    # Test Myanmar traditional style characters
    res_myanmar = client.get("/api/characters?style=myanmar")
    assert res_myanmar.status_code == 200
    myanmar_chars = res_myanmar.json()
    assert len(myanmar_chars) >= 3
    for c in myanmar_chars:
        assert c["style"] == "myanmar"


def test_create_and_export_character_pack():
    create_payload = {
        "name": "Kenshiro Unit 01",
        "role": "Cyber Combat Mecha",
        "style": "anime",
        "voice_id": "ja-JP-KeitaNeural",
        "language": "ja-JP",
        "personality": "Fearless vanguard mecha pilot",
        "avatar_color": "#06b6d4",
        "tags": ["anime", "mecha", "combat"]
    }
    create_res = client.post("/api/characters", json=create_payload)
    assert create_res.status_code == 200
    created = create_res.json()
    assert created["style"] == "anime"
    char_id = created["id"]

    # Export a standalone pack; no other project is contacted.
    export_res = client.post(
        "/api/characters/export-pack",
        json={"character_id": char_id}
    )
    assert export_res.status_code == 200
    pack = export_res.json()["persona_pack"]
    assert pack["actor_id"] == char_id
    assert pack["style"] == "anime"
    assert pack["voice_binding"]["voice_id"] == "ja-JP-KeitaNeural"


def test_manual_persona_pack_import_is_duplicate_safe(monkeypatch, tmp_path):
    import app.main as main

    monkeypatch.setattr(main, "CHARACTERS_FILE", tmp_path / "characters.json")
    pack = {
        "export_version": "1.0.0",
        "source_studio": "Offline backup",
        "actor_id": "char_imported_demo",
        "actor_name": "Imported Demo",
        "role": "Offline Presenter",
        "style": "custom",
        "voice_binding": {"engine": "edge-tts", "voice_id": "my-MM-NilarNeural", "language": "my-MM"},
        "vrm_model_path": "/models/sample_avatar_a.vrm",
        "avatar_color": "#8b5cf6",
        "default_emotion": "neutral",
        "character_meta": {"personality_prompt": "Imported without an API connection", "style": "custom", "tags": ["offline"]},
    }

    imported = client.post("/api/characters/import-pack", json=pack)
    duplicate = client.post("/api/characters/import-pack", json=pack)

    assert imported.status_code == 200
    assert imported.json()["status"] == "imported"
    assert duplicate.status_code == 200
    assert duplicate.json()["status"] == "skipped"


def test_manual_persona_pack_rejects_unsafe_vrm_path(monkeypatch, tmp_path):
    import app.main as main

    monkeypatch.setattr(main, "CHARACTERS_FILE", tmp_path / "characters.json")
    pack = {
        "actor_id": "char_unsafe",
        "actor_name": "Unsafe",
        "voice_binding": {"voice_id": "my-MM-NilarNeural", "language": "my-MM"},
        "vrm_model_path": "../outside.vrm",
        "character_meta": {},
    }

    response = client.post("/api/characters/import-pack", json=pack)
    assert response.status_code == 422


def test_avatar_video_render_plan_is_local_and_character_bound(monkeypatch, tmp_path):
    import app.main as main

    monkeypatch.setattr(main, "CHARACTERS_FILE", tmp_path / "characters.json")
    monkeypatch.setattr(main, "RENDER_PLAN_DIR", tmp_path / "render_plans")
    main.RENDER_PLAN_DIR.mkdir()
    created = client.post("/api/characters", json={"name": "Local Presenter", "voice_id": "my-MM-NilarNeural"}).json()
    response = client.post("/api/avatar-video/render-plan", json={
        "character_id": created["id"],
        "script": "Hello world\nThis is a local render plan.",
        "aspect_ratio": "9:16",
        "seconds_per_scene": 5,
    })

    assert response.status_code == 200
    plan = response.json()
    assert plan["render_mode"] == "local-manifest-only"
    assert plan["character"]["id"] == created["id"]
    assert plan["estimated_duration_seconds"] == 10
    assert len(plan["scenes"]) == 2
    listed = client.get("/api/avatar-video/render-plans")
    assert listed.status_code == 200
    assert listed.json()["items"][0]["plan_id"] == plan["plan_id"]
    downloaded = client.get(f"/api/avatar-video/render-plans/{plan['plan_id']}/download")
    assert downloaded.status_code == 200
    assert downloaded.json()["plan_id"] == plan["plan_id"]
    assert client.delete(f"/api/avatar-video/render-plans/{plan['plan_id']}").status_code == 200


def test_avatar_video_render_plan_rejects_unknown_character():
    response = client.post("/api/avatar-video/render-plan", json={"character_id": "unknown", "script": "Hello"})
    assert response.status_code == 404
