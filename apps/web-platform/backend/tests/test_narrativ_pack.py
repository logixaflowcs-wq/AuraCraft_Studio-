from __future__ import annotations

import json

from app import main


def test_narrativ_expression_map_survives_persona_pack_round_trip(monkeypatch):
    expression_map = {
        "neutral": "custom_neutral",
        "happy": "custom_happy",
        "angry": "custom_angry",
    }
    pack = main.ManualPersonaPack(
        actor_id="narrativ_actor_01",
        actor_name="Narrativ Actor",
        voice_binding={
            "engine": "edge-tts",
            "voice_id": "my-MM-NilarNeural",
            "language": "my-MM",
        },
        expression_map=expression_map,
        character_meta={
            "personality_prompt": "A friendly Narrativ Forge actor",
            "style": "anime",
            "tags": ["narrativ", "anime"],
        },
    )
    characters = []
    result = main._import_persona_pack(pack, characters)
    assert result["status"] == "imported"
    assert characters[0]["expression_map"] == expression_map

    monkeypatch.setattr(main, "load_characters", lambda: characters)
    response = main.download_persona_pack("narrativ_actor_01")
    exported = json.loads(response.body.decode("utf-8"))
    assert exported["expression_map"] == expression_map
