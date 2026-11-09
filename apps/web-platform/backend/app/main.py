from __future__ import annotations

import base64
import io
import json
import os
import hmac
from pathlib import Path
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone
from uuid import uuid4

import edge_tts
from fastapi import FastAPI, HTTPException, Query, Response, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(
    title="AuraCraft Studio Backend Service",
    description="Standalone 3D Virtual Persona, Edge-TTS Voice & Character Pipeline Service",
    version="1.0.0",
)

def _cors_origins() -> list[str]:
    configured = os.getenv("CORS_ORIGINS", "").strip()
    if configured:
        return [origin.strip().rstrip("/") for origin in configured.split(",") if origin.strip()]
    if os.getenv("APP_ENV", "development").lower() not in {"production", "prod"}:
        return ["http://localhost:5173", "http://127.0.0.1:5173"]
    return []


app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-Telegram-Bot-Api-Secret-Token", "X-AuraCraft-Admin-Key"],
)

DATA_DIR = Path(os.getenv("AURACRAFT_DATA_DIR", str(Path(__file__).resolve().parent.parent / "data"))).expanduser().resolve()
CHARACTERS_FILE = DATA_DIR / "characters.json"
RENDER_PLAN_DIR = DATA_DIR / "render_plans"
DATA_DIR.mkdir(parents=True, exist_ok=True)
RENDER_PLAN_DIR.mkdir(parents=True, exist_ok=True)

DEFAULT_CHARACTERS = [
    # --- Anime Style Archetypes ---
    {
        "id": "char_anime_shinji",
        "name": "Shinji Kazama (シンジ)",
        "role": "Anime Protagonist / Mecha Pilot",
        "style": "anime",
        "voice_id": "ja-JP-KeitaNeural",
        "language": "ja-JP",
        "personality": "Determined, heroic, courageous young anime mech pilot fighting for humanity",
        "vrm_model": "/models/sample_avatar_c.vrm",
        "default_emotion": "neutral",
        "avatar_color": "#38bdf8",
        "tags": ["anime", "shonen", "mecha", "hero", "japanese"]
    },
    {
        "id": "char_anime_sakura",
        "name": "Sakura Hoshino (サクラ)",
        "role": "Anime Heroine & Magical Idol",
        "style": "anime",
        "voice_id": "ja-JP-NanamiNeural",
        "language": "ja-JP",
        "personality": "Cheerful, energetic magical girl idol bringing hope and celestial light",
        "vrm_model": "/models/sample_avatar_a.vrm",
        "default_emotion": "happy",
        "avatar_color": "#ec4899",
        "tags": ["anime", "magical-girl", "idol", "vtuber", "japanese"]
    },
    {
        "id": "char_anime_ren",
        "name": "Ren Kurogane (レン)",
        "role": "Dark Fantasy Swordsman / Antihero",
        "style": "anime",
        "voice_id": "ja-JP-KeitaNeural",
        "language": "ja-JP",
        "personality": "Calm, brooding master swordsman with supernatural shadow abilities",
        "vrm_model": "/models/sample_avatar_b.vrm",
        "default_emotion": "angry",
        "avatar_color": "#a855f7",
        "tags": ["anime", "dark-fantasy", "swordsman", "antihero"]
    },

    # --- Army / Military Style Archetypes ---
    {
        "id": "char_army_general_min",
        "name": "General Min Zaw (ဗိုလ်ချုပ်မင်းဇော်)",
        "role": "Tactical Commander & Defense Strategist",
        "style": "army",
        "voice_id": "my-MM-ThihaNeural",
        "language": "my-MM",
        "personality": "Strategic, authoritative, disciplined high-ranking military commander with tactical acumen",
        "vrm_model": "/models/sample_avatar_b.vrm",
        "default_emotion": "neutral",
        "avatar_color": "#84cc16",
        "tags": ["army", "military", "tactical", "burmese", "commander"]
    },
    {
        "id": "char_army_sergeant_kyaw",
        "name": "Sergeant Kyaw Thu (တပ်ကြပ်ကြီးကျော်သူ)",
        "role": "Special Operations Field Specialist",
        "style": "army",
        "voice_id": "my-MM-ThihaNeural",
        "language": "my-MM",
        "personality": "Hardened combat veteran, fearless frontline squad leader ready for special ops missions",
        "vrm_model": "/models/sample_avatar_b.vrm",
        "default_emotion": "angry",
        "avatar_color": "#eab308",
        "tags": ["army", "military", "specops", "burmese", "infantry"]
    },
    {
        "id": "char_army_captain_vance",
        "name": "Captain John Vance",
        "role": "Airborne Tactical Recon Captain",
        "style": "army",
        "voice_id": "en-US-GuyNeural",
        "language": "en-US",
        "personality": "Decisive, tactical airborne specialist delivering battlefield briefs and recon updates",
        "vrm_model": "/models/sample_avatar_c.vrm",
        "default_emotion": "neutral",
        "avatar_color": "#10b981",
        "tags": ["army", "military", "airborne", "recon", "english"]
    },

    # --- Myanmar Traditional Style Archetypes ---
    {
        "id": "char_myanmar_nilar",
        "name": "Daw Nilar (ဒေါ်နီလာ - သနပ်ခါး)",
        "role": "Traditional Thanakha Cultural Host",
        "style": "myanmar",
        "voice_id": "my-MM-NilarNeural",
        "language": "my-MM",
        "personality": "Gracious, elegant Burmese cultural ambassador with traditional thanakha artistry",
        "vrm_model": "/models/sample_avatar_a.vrm",
        "default_emotion": "happy",
        "avatar_color": "#f59e0b",
        "tags": ["myanmar", "traditional", "burmese", "cultural", "female"]
    },
    {
        "id": "char_myanmar_min_thar",
        "name": "Min Thar Thant Zin (မင်းသားသန့်စင်)",
        "role": "Classical Royal Performing Artist / Narrator",
        "style": "myanmar",
        "voice_id": "my-MM-ThihaNeural",
        "language": "my-MM",
        "personality": "Eloquent classical royal court narrator and dramatic performing artist with rich historical wisdom",
        "vrm_model": "/models/sample_avatar_b.vrm",
        "default_emotion": "neutral",
        "avatar_color": "#d97706",
        "tags": ["myanmar", "traditional", "royal-court", "burmese", "male"]
    },
    {
        "id": "char_myanmar_may_myat",
        "name": "May Myat Noe (မေမြတ်နိုး - အညာသူ)",
        "role": "Bagan Traditional Heritage Guide",
        "style": "myanmar",
        "voice_id": "my-MM-NilarNeural",
        "language": "my-MM",
        "personality": "Warm, authentic Bagan heritage storyteller sharing ancient folklore and cultural traditions",
        "vrm_model": "/models/sample_avatar_a.vrm",
        "default_emotion": "happy",
        "avatar_color": "#fb923c",
        "tags": ["myanmar", "traditional", "bagan", "female"]
    },

    # --- VTuber & Streamer Archetypes ---
    {
        "id": "char_streamer_jenny",
        "name": "Jenny Nova",
        "role": "Global Streamer & Cyberpunk Host",
        "style": "streamer",
        "voice_id": "en-US-JennyNeural",
        "language": "en-US",
        "personality": "Energetic, witty, tech-savvy cyberpunk virtual streamer and gaming creator",
        "vrm_model": "/models/sample_avatar_c.vrm",
        "default_emotion": "surprised",
        "avatar_color": "#06b6d4",
        "tags": ["streamer", "vtuber", "cyberpunk", "english"]
    },
    {
        "id": "char_streamer_aria",
        "name": "Aria Synth",
        "role": "Lo-Fi Virtual DJ & Creative Storyteller",
        "style": "streamer",
        "voice_id": "en-US-AriaNeural",
        "language": "en-US",
        "personality": "Chill, atmospheric music host and digital artist curating creative beats and stories",
        "vrm_model": "/models/sample_avatar_a.vrm",
        "default_emotion": "happy",
        "avatar_color": "#8b5cf6",
        "tags": ["streamer", "music", "creative", "lofi"]
    }
]

def load_characters() -> List[Dict[str, Any]]:
    if not CHARACTERS_FILE.exists():
        with open(CHARACTERS_FILE, "w", encoding="utf-8") as f:
            json.dump(DEFAULT_CHARACTERS, f, indent=2, ensure_ascii=False)
        return DEFAULT_CHARACTERS
    try:
        with open(CHARACTERS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return DEFAULT_CHARACTERS

def save_characters(data: List[Dict[str, Any]]) -> None:
    CHARACTERS_FILE.parent.mkdir(parents=True, exist_ok=True)
    temporary = CHARACTERS_FILE.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    temporary.replace(CHARACTERS_FILE)


# Pydantic Schemas
class SynthesizeRequest(BaseModel):
    text: str = Field(min_length=1, max_length=5000)
    voice: str = Field(default="my-MM-NilarNeural")
    rate: str = Field(default="+0%")
    pitch: str = Field(default="+0Hz")


class AvatarVideoPlanRequest(BaseModel):
    character_id: str = Field(min_length=1, max_length=120)
    script: str = Field(min_length=1, max_length=10000)
    aspect_ratio: str = Field(default="9:16", pattern=r"^(9:16|16:9|1:1)$")
    seconds_per_scene: int = Field(default=6, ge=2, le=30)

class CharacterCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    role: str = Field(default="Virtual Actor", max_length=100)
    style: str = Field(default="custom", description="Style archetype (anime, army, myanmar, streamer, custom)")
    voice_id: str = Field(default="my-MM-NilarNeural")
    language: str = Field(default="my-MM")
    personality: str = Field(default="Enthusiastic and polite")
    vrm_model: str = Field(default="/models/avatar_female_a.vrm", max_length=500)
    default_emotion: str = Field(default="neutral")
    avatar_color: Optional[str] = Field(default="#8b5cf6")
    tags: List[str] = Field(default_factory=list)

class PersonaPackExportRequest(BaseModel):
    character_id: str


class PersonaVoiceBinding(BaseModel):
    engine: str = Field(default="edge-tts", max_length=40)
    voice_id: str = Field(min_length=1, max_length=100)
    language: str = Field(min_length=2, max_length=20)


class PersonaCharacterMeta(BaseModel):
    personality_prompt: str = Field(default="Enthusiastic and polite", max_length=2000)
    style: str = Field(default="custom", max_length=50)
    tags: List[str] = Field(default_factory=list, max_length=30)


class ManualPersonaPack(BaseModel):
    """Standalone character file; never triggers a network integration."""

    export_version: str = Field(default="1.0.0", max_length=20)
    source_studio: str = Field(default="AuraCraft Studio", max_length=100)
    actor_id: str = Field(min_length=1, max_length=120)
    actor_name: str = Field(min_length=1, max_length=100)
    role: str = Field(default="Virtual Actor", max_length=100)
    style: str = Field(default="custom", max_length=50)
    voice_binding: PersonaVoiceBinding
    vrm_model_path: str = Field(default="/models/avatar_female_a.vrm", max_length=500)
    avatar_color: str = Field(default="#8b5cf6", max_length=20)
    default_emotion: str = Field(default="neutral", max_length=40)
    character_meta: PersonaCharacterMeta


class ManualPersonaPackBatch(BaseModel):
    packs: List[ManualPersonaPack] = Field(min_length=1, max_length=50)


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "AuraCraft Studio Backend",
        "supported_voices": 9,
        "default_language": "my-MM",
        "supported_archetypes": ["anime", "army", "myanmar", "streamer"],
        "telegram_topic": TELEGRAM_TOPIC_ID,
        "telegram_chat_id": TELEGRAM_GROUP_CHAT_ID,
        "integrations": {
            "telegram_webhook_configured": bool(TELEGRAM_WEBHOOK_SECRET),
            "telegram_bot_configured": bool(TELEGRAM_BOT_TOKEN),
            "edge_tts": "available",
            "narrativ_forge": "not_configured",
            "video_rendering": "manifest_only",
        },
    }


# Telegram Webhook & Topic 215 Policy
TELEGRAM_TOPIC_ID = int(os.getenv("TELEGRAM_TOPIC_ID", "215"))
TELEGRAM_GROUP_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "-1003992125718")
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_WEBHOOK_SECRET = os.getenv("TELEGRAM_WEBHOOK_SECRET", "").strip()


def _production_mode() -> bool:
    environment = os.getenv("ENVIRONMENT", "").strip() or os.getenv("APP_ENV", "development").strip()
    return environment.lower() in {"production", "prod"}


def _require_admin(api_key: Optional[str]) -> None:
    """Protect character-library mutation endpoints in production deployments."""
    if not _production_mode():
        return
    expected = os.getenv("API_ADMIN_KEY", "").strip()
    if not expected:
        raise HTTPException(status_code=503, detail="API_ADMIN_KEY is not configured")
    if not api_key or not hmac.compare_digest(api_key, expected):
        raise HTTPException(status_code=401, detail="Invalid admin API key")


def _allowed_telegram_user_ids() -> set[str]:
    return {item.strip() for item in os.getenv("TELEGRAM_ALLOWED_USER_IDS", "").replace(";", ",").split(",") if item.strip()}


@app.post("/api/telegram/webhook")
async def telegram_webhook(
    request: Request,
    x_telegram_bot_api_secret_token: Optional[str] = Header(None)
):
    """AuraCraft Telegram Webhook (Strictly Topic 215 Scoped)."""
    # 1. Require Telegram's webhook secret; missing secrets must never be accepted.
    if not TELEGRAM_WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="Telegram webhook is not configured")
    if not x_telegram_bot_api_secret_token or not hmac.compare_digest(x_telegram_bot_api_secret_token, TELEGRAM_WEBHOOK_SECRET):
        raise HTTPException(status_code=401, detail="Invalid Telegram secret token")

    body = await request.json()
    message = body.get("message", {})
    if not message:
        return {"ok": True, "ignored": "not_a_message"}

    # 2. Strict Topic 215 Enforcement (Fail-Closed)
    topic_id = message.get("message_thread_id")
    if topic_id != TELEGRAM_TOPIC_ID:
        return {"ok": True, "ignored": f"unauthorized_topic_{topic_id}"}

    if str(message.get("chat", {}).get("id")) != TELEGRAM_GROUP_CHAT_ID:
        return {"ok": True, "ignored": "unauthorized_chat"}

    allowed_users = _allowed_telegram_user_ids()
    user_id = message.get("from", {}).get("id")
    if not allowed_users:
        raise HTTPException(status_code=503, detail="Telegram user allowlist is not configured")
    if not user_id or str(user_id) not in allowed_users:
        return {"ok": True, "ignored": "unauthorized_user"}

    text = message.get("text", "").strip()
    command = text.split()[0].lower() if text else ""

    if command in {"/start", "/help", "/commands"}:
        return {
            "ok": True,
            "action": "help",
            "reply": (
                "🎭 <b>AuraCraft Studio Bot — Topic #215 Connected</b>\n\n"
                "Commands:\n"
                "/status — 3D engine & Edge-TTS status\n"
                "/characters — View Anime, Army & Myanmar archetypes\n"
                "/speak <text> — Synthesize voice audio with current actor\n"
                "/voice <char_id> <text> — Prepare a selected actor voice preview\n"
                "/export <char_id> — Prepare a standalone JSON persona pack\n"
            )
        }
    elif command == "/status":
        chars = load_characters()
        return {
            "ok": True,
            "action": "status",
            "reply": f"🟢 <b>AuraCraft Studio Online</b>\nActors Loaded: {len(chars)}\nTopic: 215"
        }
    elif command == "/characters":
        chars = load_characters()
        c_lines = [f"• <b>{c['name']}</b> ({c.get('style', 'custom')} | {c['voice_id']})" for c in chars[:8]]
        return {
            "ok": True,
            "action": "characters",
            "reply": "🎭 <b>AuraCraft Archetypes:</b>\n" + "\n".join(c_lines)
        }
    elif command == "/speak":
        speak_text = text.partition(" ")[2].strip()
        if not speak_text:
            return {"ok": True, "action": "speak", "reply": "Usage: /speak <text to say>"}
        return {
            "ok": True,
            "action": "speak",
            "reply": f"🎙️ <b>Speech Queued:</b> {speak_text[:100]}...\nVoice: my-MM-NilarNeural"
        }
    elif command == "/voice":
        _, _, voice_request = text.partition(" ")
        character_id, _, speak_text = voice_request.strip().partition(" ")
        if not character_id or not speak_text.strip():
            return {"ok": True, "action": "voice", "reply": "Usage: /voice <character_id> <text to say>"}
        character = next((item for item in load_characters() if item.get("id") == character_id), None)
        if not character:
            return {"ok": True, "action": "voice", "reply": "Character not found. Use /characters to see available actors."}
        return {
            "ok": True,
            "action": "voice",
            "character_id": character_id,
            "voice_id": character["voice_id"],
            "text": speak_text.strip()[:500],
            "reply": f"🎙️ <b>{character['name']}</b> voice preview prepared.\nVoice: <code>{character['voice_id']}</code>\nText: {speak_text.strip()[:100]}",
        }
    elif command == "/export":
        char_id = text.partition(" ")[2].strip()
        if not char_id:
            return {"ok": True, "action": "export", "reply": "Usage: /export <character_id>"}
        return {
            "ok": True,
            "action": "export",
            "reply": f"📦 Preparing standalone JSON pack for <code>{char_id}</code>. Download it from AuraCraft, then manually import it where you choose."
        }

    return {"ok": True, "ignored": "unhandled_command"}


@app.get("/api/tts/voices")
def get_voices():
    """Return the supported Burmese, Japanese, English, Chinese and Korean Edge-TTS voices."""
    return [
        {"id": "my-MM-NilarNeural", "name": "Nilar (Burmese Female Cultural Host)", "gender": "Female", "locale": "my-MM", "archetype": "myanmar"},
        {"id": "my-MM-ThihaNeural", "name": "Thiha (Burmese Male Anchor/Officer)", "gender": "Male", "locale": "my-MM", "archetype": "army_myanmar"},
        {"id": "ja-JP-NanamiNeural", "name": "Nanami (Japanese Anime Heroine/Idol)", "gender": "Female", "locale": "ja-JP", "archetype": "anime"},
        {"id": "ja-JP-KeitaNeural", "name": "Keita (Japanese Anime Protagonist/Hero)", "gender": "Male", "locale": "ja-JP", "archetype": "anime"},
        {"id": "en-US-JennyNeural", "name": "Jenny (US English Streamer/Cyberpunk)", "gender": "Female", "locale": "en-US", "archetype": "streamer"},
        {"id": "en-US-GuyNeural", "name": "Guy (US English Tactical Commander)", "gender": "Male", "locale": "en-US", "archetype": "army"},
        {"id": "en-US-AriaNeural", "name": "Aria (US English Expressive/Narrator)", "gender": "Female", "locale": "en-US", "archetype": "streamer"},
        {"id": "zh-CN-XiaoxiaoNeural", "name": "Xiaoxiao (Mandarin Chinese Female)", "gender": "Female", "locale": "zh-CN", "archetype": "general"},
        {"id": "ko-KR-SunHiNeural", "name": "SunHi (Korean Female)", "gender": "Female", "locale": "ko-KR", "archetype": "general"},
    ]


@app.post("/api/tts/synthesize")
async def synthesize_speech(payload: SynthesizeRequest):
    """Zero-cost Neural Speech generation via Microsoft Edge-TTS."""
    try:
        communicate = edge_tts.Communicate(
            text=payload.text,
            voice=payload.voice,
            rate=payload.rate,
            pitch=payload.pitch,
        )
        audio_stream = io.BytesIO()
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_stream.write(chunk["data"])
        
        audio_bytes = audio_stream.getvalue()
        if not audio_bytes:
            raise HTTPException(status_code=500, detail="TTS generation produced empty audio")
            
        return Response(
            content=audio_bytes,
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": "inline; filename=speech.mp3",
                "X-Audio-Length": str(len(audio_bytes)),
                "X-Voice-Used": payload.voice,
            }
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"TTS synthesis failed: {type(exc).__name__}")


@app.post("/api/avatar-video/render-plan")
def create_avatar_video_render_plan(payload: AvatarVideoPlanRequest):
    """Create a local, reviewable avatar-video manifest without rendering or cloud calls."""
    character = next((item for item in load_characters() if item.get("id") == payload.character_id), None)
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    lines = [line.strip() for line in payload.script.replace("\r", "").split("\n") if line.strip()]
    if not lines:
        raise HTTPException(status_code=422, detail="Script must contain at least one non-empty line")
    scenes = [
        {
            "scene_number": index,
            "duration_seconds": payload.seconds_per_scene,
            "dialogue": line,
            "emotion": character.get("default_emotion", "neutral"),
            "voice_id": character["voice_id"],
            "vrm_model": character["vrm_model"],
        }
        for index, line in enumerate(lines, start=1)
    ]
    plan_id = f"plan_{uuid4().hex}"
    plan = {
        "plan_id": plan_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "planned",
        "render_mode": "local-manifest-only",
        "character": {"id": character["id"], "name": character["name"], "voice_id": character["voice_id"]},
        "aspect_ratio": payload.aspect_ratio,
        "estimated_duration_seconds": len(scenes) * payload.seconds_per_scene,
        "scenes": scenes,
        "next_step": "Review this manifest, synthesize voice locally, then render with your chosen local video tool.",
    }
    (RENDER_PLAN_DIR / f"{plan_id}.json").write_text(json.dumps(plan, ensure_ascii=False, indent=2), encoding="utf-8")
    return plan


def _render_plan_path(plan_id: str) -> Path:
    if not plan_id.startswith("plan_") or any(char not in "abcdefghijklmnopqrstuvwxyz0123456789_" for char in plan_id):
        raise HTTPException(status_code=404, detail="Render plan not found")
    return RENDER_PLAN_DIR / f"{plan_id}.json"


@app.get("/api/avatar-video/render-plans")
def list_avatar_video_render_plans():
    """List local plan metadata only; no render provider is contacted."""
    plans = []
    for path in sorted(RENDER_PLAN_DIR.glob("plan_*.json"), key=lambda item: item.stat().st_mtime, reverse=True)[:50]:
        try:
            plan = json.loads(path.read_text(encoding="utf-8"))
            plans.append({key: plan.get(key) for key in ("plan_id", "created_at", "status", "character", "aspect_ratio", "estimated_duration_seconds")})
        except (OSError, json.JSONDecodeError):
            continue
    return {"items": plans}


@app.get("/api/avatar-video/render-plans/{plan_id}/download")
def download_avatar_video_render_plan(plan_id: str):
    path = _render_plan_path(plan_id)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Render plan not found")
    return Response(content=path.read_text(encoding="utf-8"), media_type="application/json", headers={"Content-Disposition": f'attachment; filename="{plan_id}.json"'})


@app.delete("/api/avatar-video/render-plans/{plan_id}")
def delete_avatar_video_render_plan(plan_id: str):
    path = _render_plan_path(plan_id)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Render plan not found")
    path.unlink()
    return {"status": "deleted", "plan_id": plan_id}


@app.get("/api/characters/archetypes")
def get_archetypes():
    """Return catalog of curated character style archetypes and counts."""
    chars = load_characters()
    styles = [
        {
            "id": "anime",
            "name": "Anime & Manga Style",
            "badge": "🌸 Anime",
            "icon": "Sparkles",
            "color": "#ec4899",
            "description": "Japanese Anime protagonists, heroic mecha pilots, and magical idols with Japanese/Burmese voice bindings."
        },
        {
            "id": "army",
            "name": "Army & Military Tactical",
            "badge": "🎖️ Army / Tactical",
            "icon": "Shield",
            "color": "#84cc16",
            "description": "Tactical commanders, defense strategists, and special operations frontline operators."
        },
        {
            "id": "myanmar",
            "name": "Myanmar Traditional & Cultural",
            "badge": "🇲🇲 Traditional Myanmar",
            "icon": "Crown",
            "color": "#f59e0b",
            "description": "Burmese royal court narrators, Thanakha cultural ambassadors, and Bagan heritage guides."
        },
        {
            "id": "streamer",
            "name": "VTuber & Cyberpunk Streamer",
            "badge": "⚡ VTuber / Streamer",
            "icon": "Radio",
            "color": "#06b6d4",
            "description": "Dynamic tech streamers, digital gaming creators, and lo-fi virtual hosts."
        }
    ]
    for s in styles:
        s["count"] = sum(1 for c in chars if c.get("style") == s["id"])
    return styles


@app.get("/api/characters")
def list_characters(style: Optional[str] = Query(None, description="Filter by style archetype")):
    chars = load_characters()
    if style:
        return [c for c in chars if c.get("style") == style]
    return chars


@app.post("/api/characters")
def create_character(
    payload: CharacterCreate,
    x_auracraft_admin_key: Optional[str] = Header(None),
):
    _require_admin(x_auracraft_admin_key)
    chars = load_characters()
    char_id = f"char_{payload.style}_{payload.name.lower().replace(' ', '_')}_{len(chars)+1}"
    new_char = {
        "id": char_id,
        "name": payload.name,
        "role": payload.role,
        "style": payload.style,
        "voice_id": payload.voice_id,
        "language": payload.language,
        "personality": payload.personality,
        "vrm_model": payload.vrm_model,
        "default_emotion": payload.default_emotion,
        "avatar_color": payload.avatar_color or "#8b5cf6",
        "tags": payload.tags or [payload.style, "avatar-studio"]
    }
    chars.append(new_char)
    save_characters(chars)
    return new_char


def _import_persona_pack(pack: ManualPersonaPack, chars: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Import an explicit local pack without overwriting an existing actor."""
    actor_id = pack.actor_id.strip()
    allowed_root_models = {"/sample_avatar.vrm", "/avatar_human.vrm"}
    if ".." in pack.vrm_model_path or not (
        pack.vrm_model_path.startswith("/models/") or pack.vrm_model_path in allowed_root_models
    ):
        raise HTTPException(status_code=422, detail="VRM model path must reference a bundled public model")
    if any(character.get("id") == actor_id for character in chars):
        return {"status": "skipped", "actor_id": actor_id, "reason": "actor_id already exists"}

    imported = {
        "id": actor_id,
        "name": pack.actor_name.strip(),
        "role": pack.role.strip(),
        "style": pack.style.strip(),
        "voice_id": pack.voice_binding.voice_id.strip(),
        "language": pack.voice_binding.language.strip(),
        "personality": pack.character_meta.personality_prompt.strip(),
        "vrm_model": pack.vrm_model_path,
        "default_emotion": pack.default_emotion.strip(),
        "avatar_color": pack.avatar_color.strip(),
        "tags": [tag.strip() for tag in pack.character_meta.tags if tag.strip()],
    }
    chars.append(imported)
    return {"status": "imported", "character": imported}


@app.post("/api/characters/import-pack")
def import_persona_pack(
    pack: ManualPersonaPack,
    x_auracraft_admin_key: Optional[str] = Header(None),
):
    """Import one user-selected JSON persona pack into AuraCraft only."""
    _require_admin(x_auracraft_admin_key)
    chars = load_characters()
    result = _import_persona_pack(pack, chars)
    if result["status"] == "imported":
        save_characters(chars)
    return result


@app.post("/api/characters/import-packs")
def import_persona_packs(
    batch: ManualPersonaPackBatch,
    x_auracraft_admin_key: Optional[str] = Header(None),
):
    """Import selected JSON packs atomically; conflicts are reported, never replaced."""
    _require_admin(x_auracraft_admin_key)
    chars = load_characters()
    results = [_import_persona_pack(pack, chars) for pack in batch.packs]
    if any(result["status"] == "imported" for result in results):
        save_characters(chars)
    return {
        "imported": sum(result["status"] == "imported" for result in results),
        "skipped": sum(result["status"] == "skipped" for result in results),
        "results": results,
    }


@app.post("/api/characters/export-pack")
def export_character_pack(
    payload: PersonaPackExportRequest,
    x_auracraft_admin_key: Optional[str] = Header(None),
):
    """Package a character from AuraCraft Studio into a standalone downloadable JSON asset pack."""
    _require_admin(x_auracraft_admin_key)
    chars = load_characters()
    target = next((c for c in chars if c["id"] == payload.character_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Character not found")
        
    auracraft_asset_pack = {
        "export_version": "1.0.0",
        "source_studio": "AuraCraft Studio",
        "actor_id": target["id"],
        "actor_name": target["name"],
        "role": target["role"],
        "style": target.get("style", "general"),
        "voice_binding": {
            "engine": "edge-tts",
            "voice_id": target["voice_id"],
            "language": target["language"]
        },
        "vrm_model_path": target["vrm_model"],
        "avatar_color": target.get("avatar_color", "#8b5cf6"),
        "expression_map": {
            "neutral": "blendshape_neutral",
            "happy": "blendshape_happy",
            "angry": "blendshape_angry",
            "sad": "blendshape_sad",
            "surprised": "blendshape_surprised"
        },
        "character_meta": {
            "personality_prompt": target["personality"],
            "style": target.get("style", "general"),
            "tags": target.get("tags", [])
        }
    }
    
    # Save standalone downloadable file in AuraCraft's own export folder
    export_dir = DATA_DIR / "exported_packs"
    export_dir.mkdir(parents=True, exist_ok=True)
    export_file = export_dir / f"{target['id']}_auracraft_pack.json"
    with open(export_file, "w", encoding="utf-8") as f:
        json.dump(auracraft_asset_pack, f, indent=2, ensure_ascii=False)
        
    return {
        "status": "success",
        "message": "Standalone persona pack prepared for download",
        "filename": f"{target['id']}_auracraft_pack.json",
        "exported_file": str(export_file),
        "persona_pack": auracraft_asset_pack
    }


@app.get("/api/characters/{character_id}/download-pack")
def download_persona_pack(character_id: str):
    """Directly download the exported character asset pack as a JSON file."""
    chars = load_characters()
    target = next((c for c in chars if c["id"] == character_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Character not found")
        
    auracraft_asset_pack = {
        "export_version": "1.0.0",
        "source_studio": "AuraCraft Studio",
        "actor_id": target["id"],
        "actor_name": target["name"],
        "role": target["role"],
        "style": target.get("style", "general"),
        "voice_binding": {
            "engine": "edge-tts",
            "voice_id": target["voice_id"],
            "language": target["language"]
        },
        "vrm_model_path": target["vrm_model"],
        "avatar_color": target.get("avatar_color", "#8b5cf6"),
        "expression_map": {
            "neutral": "blendshape_neutral",
            "happy": "blendshape_happy",
            "angry": "blendshape_angry",
            "sad": "blendshape_sad",
            "surprised": "blendshape_surprised"
        },
        "character_meta": {
            "personality_prompt": target["personality"],
            "style": target.get("style", "general"),
            "tags": target.get("tags", [])
        }
    }
    
    content = json.dumps(auracraft_asset_pack, indent=2, ensure_ascii=False)
    filename = f"{character_id}_auracraft_pack.json"
    return Response(
        content=content,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@app.get("/api/characters/download-all-packs")
def download_all_persona_packs():
    """Bulk download all character asset packs as a single bundled JSON array."""
    chars = load_characters()
    all_packs = []
    for target in chars:
        pack = {
            "export_version": "1.0.0",
            "source_studio": "AuraCraft Studio",
            "actor_id": target["id"],
            "actor_name": target["name"],
            "role": target["role"],
            "style": target.get("style", "general"),
            "voice_binding": {
                "engine": "edge-tts",
                "voice_id": target["voice_id"],
                "language": target["language"]
            },
            "vrm_model_path": target["vrm_model"],
            "avatar_color": target.get("avatar_color", "#8b5cf6"),
            "expression_map": {
                "neutral": "blendshape_neutral",
                "happy": "blendshape_happy",
                "angry": "blendshape_angry",
                "sad": "blendshape_sad",
                "surprised": "blendshape_surprised"
            },
            "character_meta": {
                "personality_prompt": target["personality"],
                "style": target.get("style", "general"),
                "tags": target.get("tags", [])
            }
        }
        all_packs.append(pack)
        
    content = json.dumps(all_packs, indent=2, ensure_ascii=False)
    filename = "all_auracraft_archetypes_pack.json"
    return Response(
        content=content,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8010, reload=True)
