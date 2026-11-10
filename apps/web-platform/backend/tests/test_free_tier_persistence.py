from __future__ import annotations

from datetime import UTC, datetime

from app import main


def test_postgres_character_store_initializes_and_saves(monkeypatch):
    state = {}
    writes = []

    monkeypatch.setattr(main, "database_enabled", lambda: True)
    monkeypatch.setattr(
        main,
        "read_state",
        lambda key: (key in state, state.get(key)),
    )

    def write_state(key, value):
        state[key] = value
        writes.append((key, value))

    monkeypatch.setattr(main, "write_state", write_state)

    characters = main.load_characters()
    assert characters == main.DEFAULT_CHARACTERS
    assert writes[-1][0] == "characters"

    updated = [dict(characters[0], name="Persisted character")]
    main.save_characters(updated)
    assert state["characters"][0]["name"] == "Persisted character"


def test_postgres_render_plan_lifecycle(monkeypatch):
    state = {}
    monkeypatch.setattr(main, "database_enabled", lambda: True)
    monkeypatch.setattr(main, "load_characters", lambda: main.DEFAULT_CHARACTERS)
    monkeypatch.setattr(
        main,
        "write_state",
        lambda key, value: state.__setitem__(key, value),
    )
    monkeypatch.setattr(
        main,
        "read_state",
        lambda key: (key in state, state.get(key)),
    )
    monkeypatch.setattr(
        main,
        "list_state",
        lambda prefix, limit: [
            (key, value, datetime.now(UTC))
            for key, value in list(state.items())
            if key.startswith(prefix)
        ][:limit],
    )
    monkeypatch.setattr(
        main,
        "delete_state",
        lambda key: state.pop(key, None) is not None,
    )

    payload = main.AvatarVideoPlanRequest(
        character_id=main.DEFAULT_CHARACTERS[0]["id"],
        script="First scene\nSecond scene",
        aspect_ratio="9:16",
        seconds_per_scene=4,
    )
    plan = main.create_avatar_video_render_plan(payload, None)
    key = f"render_plan:{plan['plan_id']}"
    assert state[key] == plan

    listed = main.list_avatar_video_render_plans()
    assert listed["items"][0]["plan_id"] == plan["plan_id"]

    downloaded = main.download_avatar_video_render_plan(plan["plan_id"])
    assert plan["plan_id"] in downloaded.body.decode("utf-8")

    deleted = main.delete_avatar_video_render_plan(plan["plan_id"], None)
    assert deleted["status"] == "deleted"
    assert key not in state
