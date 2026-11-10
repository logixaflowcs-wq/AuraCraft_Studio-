from __future__ import annotations

import hashlib
import io
import json
import zipfile
from datetime import UTC, datetime

from app import main


def _aura_archive(actor_id: str, vrm_bytes: bytes) -> bytes:
    manifest = {
        "version": "1.0",
        "characterId": actor_id,
        "characterName": "Free Tier VRM",
        "vrmChecksum": hashlib.sha256(vrm_bytes).hexdigest(),
        "identityPrompt": "A test character",
        "tags": ["test", "vrm"],
        "style": "anime",
        "exportedAt": datetime.now(UTC).isoformat(),
        "source": "AuraCraft-Studio-v1",
    }
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("manifest.json", json.dumps(manifest))
        archive.writestr("model.vrm", vrm_bytes)
    return output.getvalue()


def test_aura_vrm_import_uses_postgres_storage_on_free_host(monkeypatch):
    actor_id = "free_vrm_actor"
    vrm_bytes = b"fake-vrm-model-content"
    saved = {}

    monkeypatch.setattr(main, "database_enabled", lambda: True)
    monkeypatch.setattr(main, "save_characters", lambda _: None)
    monkeypatch.setattr(
        main,
        "write_asset",
        lambda asset_key, content: saved.update({asset_key: content}),
    )

    characters = []
    result = main._import_aura_archive(_aura_archive(actor_id, vrm_bytes), characters)

    assert result["status"] == "imported"
    assert saved[actor_id] == vrm_bytes
    assert characters[0]["vrm_model"] == f"/api/characters/vrm/{actor_id}"


def test_aura_vrm_download_reads_postgres_asset(monkeypatch):
    actor_id = "free_vrm_actor"
    vrm_bytes = b"fake-vrm-model-content"
    monkeypatch.setattr(main, "database_enabled", lambda: True)
    monkeypatch.setattr(
        main,
        "read_asset",
        lambda asset_key: (asset_key == actor_id, vrm_bytes, "model/gltf-binary"),
    )

    response = main.get_imported_vrm(actor_id)

    assert response.status_code == 200
    assert response.body == vrm_bytes
    assert response.media_type == "model/gltf-binary"
