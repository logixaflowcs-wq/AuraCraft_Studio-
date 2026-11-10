# ruff: noqa: I001
from __future__ import annotations

import asyncio
import hashlib
import hmac
import html
import io
import json
import logging
import os
import re
import shutil
import tempfile
import threading
import time
import zipfile
from collections import defaultdict, deque
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit
from uuid import uuid4

import edge_tts
import httpx

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass
from app.persistence import (
    check_database,
    database_enabled,
    delete_state,
    list_state,
    read_state,
    write_state,
)

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from filelock import FileLock
from pydantic import BaseModel, ConfigDict, Field, TypeAdapter, ValidationError

logger = logging.getLogger(__name__)

app = FastAPI(
    title="AuraCraft Studio Backend Service",
    description="Standalone 3D Virtual Persona, Edge-TTS Voice & Character Pipeline Service",
    version="1.0.0",
)

_allowed_origins = [origin.strip() for origin in os.getenv("ALLOWED_ORIGINS", "").split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=bool(_allowed_origins),
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Telegram-Bot-Api-Secret-Token"],
)

# FIX(audit-1-D): production must never start with wildcard or missing CORS origins.
@app.on_event("startup")
async def validate_production_configuration():
    environment = (os.getenv("ENV") or os.getenv("ENVIRONMENT") or os.getenv("APP_ENV") or "").lower()
    if environment in {"production", "prod"} and not _allowed_origins:
        raise RuntimeError("ALLOWED_ORIGINS must be configured in production")
    # FIX(free-tier-3): fail fast instead of silently falling back to ephemeral files on Render Free.
    if os.getenv("REQUIRE_DATABASE_URL", "").strip().lower() in {"1", "true", "yes"} and not database_enabled():
        raise RuntimeError("DATABASE_URL must be configured for durable production storage")


# FIX(audit-1-B): protect write APIs with a constant-time checked bearer token.
def require_auth(authorization: str | None = Header(default=None)) -> None:
    expected = os.getenv("API_AUTH_TOKEN", "").strip()
    if not expected:
        if _production_mode():
            raise HTTPException(status_code=401, detail="Unauthorized")
        return
    scheme, _, supplied = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not supplied or not hmac.compare_digest(supplied, expected):
        raise HTTPException(status_code=401, detail="Unauthorized")


# FIX(audit-1-E): bound TTS usage to ten requests/minute per client and credential.
_tts_rate_lock = threading.Lock()
_tts_rate_events: dict[str, deque[float]] = defaultdict(deque)
def enforce_tts_rate_limit(request: Request, authorization: str | None = Header(default=None)) -> None:
    # FIX(audit-1-E): the edge gateway overwrites this header with Cloudflare's client IP.
    client_ip = request.headers.get("X-Forwarded-For") or (request.client.host if request.client else "unknown")
    token_fingerprint = hmac.new(os.getenv("API_AUTH_TOKEN", "").encode(), (authorization or "").encode(), "sha256").hexdigest()
    key = f"{client_ip}:{token_fingerprint}"
    now = time.monotonic()
    with _tts_rate_lock:
        # FIX(audit-1-E): cap per-process key cardinality and evict expired buckets under high-cardinality traffic.
        if key not in _tts_rate_events and len(_tts_rate_events) >= 10000:
            for stale_key, stale_events in list(_tts_rate_events.items()):
                while stale_events and now - stale_events[0] >= 60:
                    stale_events.popleft()
                if not stale_events:
                    _tts_rate_events.pop(stale_key, None)
            if len(_tts_rate_events) >= 10000:
                _tts_rate_events.pop(next(iter(_tts_rate_events)))
        events = _tts_rate_events[key]
        while events and now - events[0] >= 60:
            events.popleft()
        if len(events) >= 10:
            retry_after = max(1, int(60 - (now - events[0])))
            raise HTTPException(status_code=429, detail="Rate limit exceeded", headers={"Retry-After": str(retry_after)})
        events.append(now)


# FIX(audit-1-F): centralize unexpected failures; keep tracebacks in server logs only.
@app.exception_handler(Exception)
async def unexpected_error_handler(request: Request, exc: Exception):
    logger.exception("Unhandled API exception on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


# FIX(audit-2-A): allow persistent hosting volumes to own all runtime state.
DATA_DIR = Path(os.getenv("AURACRAFT_DATA_DIR", str(Path(__file__).resolve().parent.parent / "data"))).resolve()
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

class CharacterRecord(BaseModel):
    # FIX(audit-2-A): validate required fields while retaining forward-compatible metadata.
    model_config = ConfigDict(extra="allow")
    id: str = Field(min_length=1, max_length=128)
    name: str = Field(min_length=1, max_length=200)
    role: str = "Virtual Actor"
    style: str = "custom"
    voice_id: str = "my-MM-NilarNeural"
    language: str = "my-MM"
    personality: str = "Enthusiastic and polite"
    vrm_model: str = "/models/sample_avatar_a.vrm"
    default_emotion: str = "neutral"
    avatar_color: str = "#8b5cf6"
    tags: list[str] = Field(default_factory=list)


_character_records = TypeAdapter(list[CharacterRecord])


def _atomic_write_characters(data: list[dict[str, Any]]) -> None:
    validated = [item.model_dump(mode="json") for item in _character_records.validate_python(data)]
    temp_path: str | None = None
    try:
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=DATA_DIR, prefix=".characters-", suffix=".tmp", delete=False) as handle:
            temp_path = handle.name
            json.dump(validated, handle, indent=2, ensure_ascii=False)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp_path, CHARACTERS_FILE)
    finally:
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)


def load_characters() -> list[dict[str, Any]]:
    # FIX(free-tier-1): use Neon Postgres when configured so Render Free restarts do not erase characters.
    if database_enabled():
        found, raw_data = read_state("characters")
        if not found:
            write_state("characters", DEFAULT_CHARACTERS)
            return DEFAULT_CHARACTERS
        try:
            return [item.model_dump(mode="json") for item in _character_records.validate_python(raw_data)]
        except (ValidationError, TypeError):
            backup_key = f"characters:corrupt:{datetime.now(UTC).strftime('%Y%m%dT%H%M%S%fZ')}"
            write_state(backup_key, raw_data)
            logger.exception("Postgres character store was invalid; preserved backup at %s", backup_key)
            write_state("characters", DEFAULT_CHARACTERS)
            return DEFAULT_CHARACTERS

    # FIX(audit-2-A): local development fallback serializes reads and recovers corrupted files.
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with FileLock(str(CHARACTERS_FILE) + ".lock"):
        if not CHARACTERS_FILE.exists():
            _atomic_write_characters(DEFAULT_CHARACTERS)
            return DEFAULT_CHARACTERS
        try:
            with CHARACTERS_FILE.open("r", encoding="utf-8") as handle:
                raw_data = json.load(handle)
            return [item.model_dump(mode="json") for item in _character_records.validate_python(raw_data)]
        except (OSError, json.JSONDecodeError, ValidationError, TypeError):
            backup = DATA_DIR / f"characters.corrupt.{datetime.now(UTC).strftime('%Y%m%dT%H%M%S%fZ')}.json"
            shutil.copy2(CHARACTERS_FILE, backup)
            logger.exception("Character store was corrupt; backup created at %s", backup)
            _atomic_write_characters(DEFAULT_CHARACTERS)
            return DEFAULT_CHARACTERS


def save_characters(data: list[dict[str, Any]]) -> None:
    # FIX(free-tier-1): persist validated character state in Postgres on ephemeral hosting.
    validated = [item.model_dump(mode="json") for item in _character_records.validate_python(data)]
    if database_enabled():
        write_state("characters", validated)
        return
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with FileLock(str(CHARACTERS_FILE) + ".lock"):
        _atomic_write_characters(validated)


# Pydantic Schemas
class SynthesizeRequest(BaseModel):
    text: str = Field(min_length=1, max_length=5000)
    voice: str = Field(default="my-MM-NilarNeural")
    rate: str = Field(default="+0%")
    pitch: str = Field(default="+0Hz")


class AvatarVideoPlanRequest(BaseModel):
    character_id: str = Field(min_length=1, max_length=120)
    # FIX(audit-3-D): optional field preserves old clients while retaining selected voice metadata.
    voice_id: str | None = Field(default=None, max_length=100)
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
    vrm_model: str = Field(default="/models/sample_avatar_a.vrm")
    default_emotion: str = Field(default="neutral")
    avatar_color: str | None = Field(default="#8b5cf6")
    tags: list[str] = Field(default_factory=list)

class PersonaPackExportRequest(BaseModel):
    character_id: str


class PersonaVoiceBinding(BaseModel):
    engine: str = Field(default="edge-tts", max_length=40)
    voice_id: str = Field(min_length=1, max_length=100)
    language: str = Field(min_length=2, max_length=20)


class PersonaCharacterMeta(BaseModel):
    personality_prompt: str = Field(default="Enthusiastic and polite", max_length=2000)
    style: str = Field(default="custom", max_length=50)
    tags: list[str] = Field(default_factory=list, max_length=30)


class ManualPersonaPack(BaseModel):
    """Standalone character file; never triggers a network integration."""

    export_version: str = Field(default="1.0.0", max_length=20)
    source_studio: str = Field(default="AuraCraft Studio", max_length=100)
    actor_id: str = Field(min_length=1, max_length=64, pattern=r"^[a-zA-Z0-9_-]{1,64}$")
    actor_name: str = Field(min_length=1, max_length=100)
    role: str = Field(default="Virtual Actor", max_length=100)
    style: str = Field(default="custom", max_length=50)
    voice_binding: PersonaVoiceBinding
    vrm_model_path: str = Field(default="/models/sample_avatar_a.vrm", max_length=500)
    avatar_color: str = Field(default="#8b5cf6", max_length=20)
    default_emotion: str = Field(default="neutral", max_length=40)
    expression_map: dict[str, str] = Field(
        default_factory=lambda: {
            "neutral": "blendshape_neutral",
            "happy": "blendshape_happy",
            "angry": "blendshape_angry",
            "sad": "blendshape_sad",
            "surprised": "blendshape_surprised",
        },
        max_length=20,
    )
    character_meta: PersonaCharacterMeta


class ManualPersonaPackBatch(BaseModel):
    packs: list[ManualPersonaPack] = Field(min_length=1, max_length=50)


@app.get("/health")
def health_check():
    # FIX(audit-2-C): this endpoint is liveness only and must not depend on downstream services.
    return {
        "status": "healthy",
        "service": "AuraCraft Studio Backend",
        "supported_voices": 8,
        "default_language": "my-MM",
        "supported_archetypes": ["anime", "army", "myanmar", "streamer"],
        "telegram_configured": bool(TELEGRAM_BOT_TOKEN and TELEGRAM_GROUP_CHAT_ID),
    }


@app.get("/api/telegram/test")
async def telegram_bot_test():
    # FIX(audit-3-G): proxy Telegram getMe server-side without exposing the bot token to the browser.
    token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip() or TELEGRAM_BOT_TOKEN
    if not token:
        raise HTTPException(status_code=503, detail="Telegram bot is not configured")
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(f"https://api.telegram.org/bot{token}/getMe")
        payload = response.json()
        if not response.is_success or not payload.get("ok"):
            raise HTTPException(status_code=502, detail="Telegram bot check failed")
        bot = payload.get("result", {})
        return {"ok": True, "username": bot.get("username"), "first_name": bot.get("first_name")}
    except HTTPException:
        raise
    except (httpx.HTTPError, ValueError):
        logger.exception("Telegram getMe check failed")
        raise HTTPException(status_code=502, detail="Telegram bot check failed")


@app.get("/ready")
async def readiness_check():
    # FIX(audit-2-C): readiness checks durable storage access and an actual Edge-TTS voice-list call.
    try:
        if database_enabled():
            check_database()
        else:
            DATA_DIR.mkdir(parents=True, exist_ok=True)
            if not os.access(DATA_DIR, os.R_OK | os.W_OK):
                raise OSError("data directory is not accessible")
            if CHARACTERS_FILE.exists() and not os.access(CHARACTERS_FILE, os.R_OK | os.W_OK):
                raise OSError("character store is not accessible")
        await asyncio.wait_for(edge_tts.list_voices(), timeout=5)
    except Exception:
        logger.exception("Readiness check failed")
        raise HTTPException(status_code=503, detail="Service not ready")
    return {"status": "ready", "storage": "available", "tts": "available"}


# Telegram Webhook & Topic 215 Policy
# FIX(free-tier-2): keep private Telegram group/topic identifiers out of the public repository.
TELEGRAM_TOPIC_ID = int(os.getenv("TELEGRAM_TOPIC_ID", "0"))
TELEGRAM_GROUP_CHAT_ID = os.getenv("TELEGRAM_GROUP_CHAT_ID", os.getenv("TELEGRAM_CHAT_ID", "")).strip()
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_WEBHOOK_SECRET = os.getenv("TELEGRAM_WEBHOOK_SECRET", "").strip()


def _production_mode() -> bool:
    environment = os.getenv("ENV", "").strip() or os.getenv("ENVIRONMENT", "").strip() or os.getenv("APP_ENV", "development").strip()
    return environment.lower() in {"production", "prod"}


async def send_telegram_reply(chat_id: Any, thread_id: Any, text: str) -> bool:
    """Send real message back to Telegram group topic #215 using Bot API."""
    token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip() or TELEGRAM_BOT_TOKEN
    if not token:
        return False


    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "message_thread_id": thread_id,
        "text": text,
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, json=payload)
            if not resp.is_success:
                logger.error("Telegram sendMessage returned HTTP %s", resp.status_code)
                return False
            return bool(resp.json().get("ok"))
    except httpx.HTTPError:
        logger.exception("Telegram webhook delivery failed")
        return False


async def send_telegram_audio(chat_id: Any, thread_id: Any, audio_bytes: bytes) -> str | None:
    # FIX(audit-2-B): deliver generated Edge-TTS bytes through Telegram sendAudio and return its file_id.
    token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip() or TELEGRAM_BOT_TOKEN
    if not token:
        return None
    url = f"https://api.telegram.org/bot{token}/sendAudio"
    data = {"chat_id": str(chat_id), "message_thread_id": str(thread_id)}
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                url,
                data=data,
                files={"audio": ("auracraft-speech.mp3", audio_bytes, "audio/mpeg")},
            )
        payload = response.json()
        if not response.is_success or not payload.get("ok"):
            logger.error("Telegram sendAudio failed with HTTP %s", response.status_code)
            return None
        return payload.get("result", {}).get("audio", {}).get("file_id")
    except (httpx.HTTPError, ValueError):
        logger.exception("Telegram audio delivery failed")
        return None


async def send_telegram_document(chat_id: Any, thread_id: Any, filename: str, content: bytes) -> str | None:
    # FIX(audit-2-B): export the actual backend persona pack as a Telegram document.
    token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip() or TELEGRAM_BOT_TOKEN
    if not token:
        return None
    url = f"https://api.telegram.org/bot{token}/sendDocument"
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                url,
                data={"chat_id": str(chat_id), "message_thread_id": str(thread_id)},
                files={"document": (filename, content, "application/json")},
            )
        payload = response.json()
        if not response.is_success or not payload.get("ok"):
            logger.error("Telegram sendDocument failed with HTTP %s", response.status_code)
            return None
        return payload.get("result", {}).get("document", {}).get("file_id")
    except (httpx.HTTPError, ValueError):
        logger.exception("Telegram document delivery failed")
        return None


async def _generate_tts_audio(text: str, voice: str) -> bytes:
    # FIX(audit-2-B): share the real Edge-TTS generation path between HTTP and Telegram callers.
    communicate = edge_tts.Communicate(text=text, voice=voice)
    stream = io.BytesIO()
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            stream.write(chunk["data"])
    audio = stream.getvalue()
    if not audio:
        raise HTTPException(status_code=502, detail="TTS synthesis failed")
    return audio


async def _synthesize_telegram_audio(text: str, voice: str) -> bytes:
    # FIX(audit-2-B): production Telegram speech uses the authenticated POST /api/tts/synthesize endpoint.
    base_url = os.getenv("BACKEND_PUBLIC_URL", "").rstrip("/")
    api_token = os.getenv("API_AUTH_TOKEN", "").strip()
    if base_url and api_token:
        try:
            async with httpx.AsyncClient(timeout=45.0) as client:
                response = await client.post(
                    f"{base_url}/api/tts/synthesize",
                    json={"text": text, "voice": voice},
                    headers={"Authorization": f"Bearer {api_token}"},
                )
            if not response.is_success or not response.content:
                logger.error("Telegram TTS endpoint returned HTTP %s", response.status_code)
                raise HTTPException(status_code=502, detail="TTS synthesis failed")
            return response.content
        except httpx.HTTPError:
            logger.exception("Telegram TTS endpoint request failed")
            raise HTTPException(status_code=502, detail="TTS synthesis failed")
    if _production_mode():
        raise HTTPException(status_code=503, detail="TTS endpoint configuration is missing")
    return await _generate_tts_audio(text, voice)


async def _download_persona_pack(url: str) -> bytes:
    # FIX(audit-2-B): HTTPS allowlisting, no redirects, and a compressed download cap prevent SSRF and oversized imports.
    parsed = urlsplit(url)
    allowed_hosts = {host.strip().lower() for host in os.getenv("TELEGRAM_IMPORT_ALLOWED_HOSTS", "").split(",") if host.strip()}
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password or parsed.port not in (None, 443):
        raise HTTPException(status_code=422, detail="Import URL must be a valid HTTPS URL")
    if parsed.hostname.lower() not in allowed_hosts:
        raise HTTPException(status_code=403, detail="Import host is not allowed")
    max_download_bytes = 120 * 1024 * 1024
    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=False) as client, client.stream("GET", url) as response:
            if not response.is_success:
                raise HTTPException(status_code=502, detail="Persona pack download failed")
            length = int(response.headers.get("Content-Length", "0") or 0)
            if length > max_download_bytes:
                raise HTTPException(status_code=413, detail="Persona package exceeds download limit")
            chunks = bytearray()
            async for chunk in response.aiter_bytes():
                chunks.extend(chunk)
                if len(chunks) > max_download_bytes:
                    raise HTTPException(status_code=413, detail="Persona package exceeds download limit")
            return bytes(chunks)
    except HTTPException:
        raise
    except httpx.HTTPError:
        logger.exception("Persona package download failed")
        raise HTTPException(status_code=502, detail="Persona pack download failed")


def _import_aura_archive(archive_bytes: bytes, chars: list[dict[str, Any]]) -> dict[str, Any]:
    # FIX(audit-1-I): validate ZIP expansion, strict manifest fields, and VRM checksum before writing any asset.
    if len(archive_bytes) > 120 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Aura package exceeds compressed size limit")
    try:
        with zipfile.ZipFile(io.BytesIO(archive_bytes)) as archive:
            infos = archive.infolist()
            names = [info.filename for info in infos if not info.is_dir()]
            allowed_names = {"manifest.json", "model.vrm", "thumbnail.png", "reference-sheet.png"}
            if len(names) != len(set(names)) or any(name not in allowed_names for name in names):
                raise HTTPException(status_code=422, detail="Aura package contains unsupported entries")
            if "manifest.json" not in names or "model.vrm" not in names:
                raise HTTPException(status_code=422, detail="Aura package is missing required files")
            sizes = {info.filename: info.file_size for info in infos if not info.is_dir()}
            if sum(sizes.values()) > 200 * 1024 * 1024:
                raise HTTPException(status_code=413, detail="Aura package exceeds expanded size limit")
            if sizes["manifest.json"] > 256 * 1024:
                raise HTTPException(status_code=413, detail="Aura manifest exceeds 256KB")
            if sizes["model.vrm"] <= 0 or sizes["model.vrm"] > 100 * 1024 * 1024:
                raise HTTPException(status_code=413, detail="VRM file exceeds 100MB limit")
            for image_name in ("thumbnail.png", "reference-sheet.png"):
                if sizes.get(image_name, 0) > 5 * 1024 * 1024:
                    raise HTTPException(status_code=413, detail="Image asset exceeds 5MB limit")
            manifest = json.loads(archive.read("manifest.json"))
            required_keys = {"version", "characterId", "characterName", "vrmChecksum", "identityPrompt", "tags", "style", "exportedAt", "source"}
            if not isinstance(manifest, dict) or set(manifest) != required_keys:
                raise HTTPException(status_code=422, detail="Aura manifest schema is invalid")
            if manifest["version"] != "1.0" or manifest["source"] != "AuraCraft-Studio-v1":
                raise HTTPException(status_code=422, detail="Unsupported Aura package version")
            actor_id = manifest["characterId"]
            actor_name = manifest["characterName"]
            if not isinstance(actor_id, str) or not re.fullmatch(r"[a-zA-Z0-9_-]{1,64}", actor_id):
                raise HTTPException(status_code=422, detail="Invalid actor_id")
            if not isinstance(actor_name, str) or not actor_name.strip() or len(actor_name) > 200:
                raise HTTPException(status_code=422, detail="Invalid character name")
            checksum = manifest["vrmChecksum"]
            if not isinstance(checksum, str) or not re.fullmatch(r"[a-fA-F0-9]{64}", checksum):
                raise HTTPException(status_code=422, detail="Aura VRM checksum is required")
            if not isinstance(manifest["identityPrompt"], str) or len(manifest["identityPrompt"]) > 10000:
                raise HTTPException(status_code=422, detail="Aura identity prompt is invalid")
            if not isinstance(manifest["tags"], list) or len(manifest["tags"]) > 100 or any(not isinstance(tag, str) or len(tag) > 100 for tag in manifest["tags"]):
                raise HTTPException(status_code=422, detail="Aura tags are invalid")
            if not isinstance(manifest["style"], str) or manifest["style"] not in {"anime", "realistic", "myanmar", "army", "custom"}:
                raise HTTPException(status_code=422, detail="Aura style is invalid")
            if not isinstance(manifest["exportedAt"], str):
                raise HTTPException(status_code=422, detail="Aura export timestamp is invalid")
            try:
                datetime.fromisoformat(manifest["exportedAt"])
            except ValueError:
                raise HTTPException(status_code=422, detail="Aura export timestamp is invalid")
            vrm_bytes = archive.read("model.vrm")
            actual_checksum = hashlib.sha256(vrm_bytes).hexdigest()
            if not hmac.compare_digest(actual_checksum.lower(), checksum.lower()):
                raise HTTPException(status_code=422, detail="Aura VRM checksum mismatch")
            if any(str(item.get("id")) == actor_id for item in chars):
                return {"status": "exists", "actor_id": actor_id, "actor_name": actor_name}
            asset_dir = DATA_DIR / "imported_vrms"
            asset_dir.mkdir(parents=True, exist_ok=True)
            target = (asset_dir / f"{actor_id}.vrm").resolve()
            if os.path.commonpath((str(asset_dir.resolve()), str(target))) != str(asset_dir.resolve()):
                raise HTTPException(status_code=400, detail="Invalid VRM storage path")
            temp_path = None
            try:
                with tempfile.NamedTemporaryFile("wb", dir=asset_dir, prefix=".vrm-", suffix=".tmp", delete=False) as handle:
                    temp_path = handle.name
                    handle.write(vrm_bytes)
                    handle.flush()
                    os.fsync(handle.fileno())
                os.replace(temp_path, target)
            finally:
                if temp_path and os.path.exists(temp_path):
                    os.unlink(temp_path)
            character = {
                "id": actor_id,
                "name": actor_name.strip(),
                "role": "Imported Aura Character",
                "style": manifest["style"],
                "voice_id": "my-MM-NilarNeural",
                "language": "my-MM",
                "personality": manifest["identityPrompt"],
                "vrm_model": f"/api/characters/vrm/{actor_id}",
                "default_emotion": "neutral",
                "avatar_color": "#8b5cf6",
                "tags": manifest["tags"],
            }
            chars.append(character)
            save_characters(chars)
            return {"status": "imported", "actor_id": actor_id, "actor_name": actor_name}
    except HTTPException:
        raise
    except (zipfile.BadZipFile, json.JSONDecodeError, KeyError, OSError):
        logger.exception("Aura archive validation failed")
        raise HTTPException(status_code=422, detail="Aura package is invalid")


@app.on_event("startup")
async def register_telegram_commands_on_startup():
    """Register Topic #215 commands into Telegram's Bot menu using setMyCommands."""
    token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip() or TELEGRAM_BOT_TOKEN
    chat_id = os.getenv("TELEGRAM_CHAT_ID", "").strip() or TELEGRAM_GROUP_CHAT_ID
    if not token:
        return
    commands = [
        {"command": "start", "description": "Connect to AuraCraft Studio (Topic 215)"},
        {"command": "help", "description": "Show available studio commands"},
        {"command": "status", "description": "Check 3D engine & Edge-TTS status"},
        {"command": "characters", "description": "View Anime, Army & Myanmar archetypes"},
        {"command": "speak", "description": "Synthesize voice speech: /speak <text>"},
        {"command": "voice", "description": "Preview actor voice: /voice <char_id> <text>"},
        {"command": "render", "description": "Generate multi-scene video plan: /render <script>"},
        {"command": "export", "description": "Export persona pack: /export <char_id>"},
        {"command": "import", "description": "Import an allowed-host JSON persona pack: /import <url>"},
    ]
    payload: dict[str, Any] = {"commands": commands}
    if chat_id:
        try:
            payload["scope"] = {"type": "chat", "chat_id": int(chat_id)}
        except ValueError:
            pass
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(f"https://api.telegram.org/bot{token}/setMyCommands", json=payload)
            if resp.status_code == 200:
                print("[Telegram Startup] Successfully registered AuraCraft bot commands via setMyCommands")
    except httpx.HTTPError:
        logger.exception("Telegram command registration failed")


def _allowed_telegram_user_ids() -> set[str]:
    return {item.strip() for item in os.getenv("TELEGRAM_ALLOWED_USER_IDS", "").split(",") if item.strip()}


@app.post("/api/telegram/webhook")
async def telegram_webhook(
    request: Request,
    x_telegram_bot_api_secret_token: str | None = Header(None)
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
    if _production_mode() and not allowed_users:
        raise HTTPException(status_code=503, detail="Telegram user allowlist is not configured")
    # FIX(audit-1-H): compare Telegram allowlisted user IDs without early-exit string equality.
    user_id_text = str(user_id)
    if allowed_users and not any(hmac.compare_digest(user_id_text, allowed_id) for allowed_id in allowed_users):
        return {"ok": True, "ignored": "unauthorized_user"}

    text = message.get("text", "").strip()
    command = text.split()[0].lower() if text else ""

    reply_text = ""
    action_type = ""
    extra: dict[str, Any] = {}
    audio_request: tuple[str, str] | None = None
    document_request: tuple[str, bytes] | None = None

    if command in {"/start", "/help", "/commands"}:
        action_type = "help"
        reply_text = (
            "🎭 <b>AuraCraft Studio Bot — Topic #215 Connected</b>\n\n"
            "Commands:\n"
            "/status — 3D engine & Edge-TTS status\n"
            "/characters — View Anime, Army & Myanmar archetypes\n"
            "/speak <text> — Synthesize voice audio with current actor\n"
            "/voice <char_id> <text> — Prepare a selected actor voice preview\n"
            "/render <script> — Generate a multi-scene video render plan\n"
            "/export <char_id> — Prepare a standalone JSON persona pack\n"
        )
    elif command == "/status":
        action_type = "status"
        chars = load_characters()
        reply_text = f"🟢 <b>AuraCraft Studio Online</b>\nActors Loaded: {len(chars)}\nTopic: 215\nEdge-TTS: Ready (Burmese, Japanese, English)"
    elif command == "/characters":
        action_type = "characters"
        chars = load_characters()
        c_lines = [f"• <b>{html.escape(str(c['name']))}</b> ({html.escape(str(c.get('style', 'custom')))} | <code>{html.escape(str(c['voice_id']))}</code>)" for c in chars[:8]]
        reply_text = "🎭 <b>AuraCraft Archetypes (Topic 215):</b>\n" + "\n".join(c_lines)
    elif command == "/speak":
        action_type = "speak"
        speak_text = text.partition(" ")[2].strip()
        if not speak_text:
            reply_text = "⚠️ Usage: /speak <text to say>"
        else:
            audio_request = (speak_text, "my-MM-NilarNeural")
            reply_text = f"🎙️ <b>Generating speech:</b> {html.escape(speak_text[:120])}\nVoice: <code>my-MM-NilarNeural</code>"
    elif command == "/voice":
        action_type = "voice"
        _, _, voice_request = text.partition(" ")
        character_id, _, speak_text = voice_request.strip().partition(" ")
        if not character_id or not speak_text.strip():
            reply_text = "⚠️ Usage: /voice <character_id> <text to say>"
        else:
            character = next((item for item in load_characters() if item.get("id") == character_id), None)
            if not character:
                reply_text = "❌ Character not found. Use /characters to see available actors."
            else:
                extra["character_id"] = character_id
                extra["voice_id"] = character["voice_id"]
                audio_request = (speak_text.strip(), character["voice_id"])
                reply_text = f"🎙️ <b>{html.escape(str(character['name']))}</b>\nVoice: <code>{html.escape(str(character['voice_id']))}</code>\nText: {html.escape(speak_text.strip()[:100])}"
    elif command == "/render":
        action_type = "render"
        render_script = text.partition(" ")[2].strip()
        if not render_script:
            reply_text = "🎬 <b>Usage:</b> /render <script text>\nExample: <code>/render အစီအစဉ်သစ် စတင်ပါပြီခင်ဗျာ</code>"
        else:
            scene_count = max(1, len([s for s in render_script.split("\n") if s.strip()]))
            duration = scene_count * 6
            reply_text = (
                f"🎬 <b>AuraCraft Video Render Plan Generated!</b>\n\n"
                f"📝 Script Preview: <i>\"{html.escape(render_script[:120])}\"</i>\n"
                f"🎞️ Total Scenes: <b>{scene_count}</b>\n"
                f"⏱️ Estimated Duration: <b>~{duration}s</b>\n"
                f"📐 Aspect Ratio: <b>9:16 Vertical (Shorts/Reels)</b>\n"
                f"🎭 Actor: <b>Sakura Hoshino (3D Anime)</b>\n\n"
                f"🎨 <i>Open AuraCraft Video Studio or Narrativ Forge to export full video.</i>"
            )
    elif command == "/export":
        action_type = "export"
        char_id = text.partition(" ")[2].strip()
        if not char_id:
            reply_text = "⚠️ Usage: /export <character_id>"
        else:
            try:
                export_result = export_character_pack(PersonaPackExportRequest(character_id=char_id), None)
                document_request = (
                    f"{char_id}_auracraft_pack.json",
                    json.dumps(export_result["persona_pack"], ensure_ascii=False, indent=2).encode("utf-8"),
                )
                reply_text = f"📦 Exported persona pack for <code>{html.escape(char_id)}</code>."
            except HTTPException as error:
                reply_text = f"❌ {html.escape(str(error.detail))}"
    elif command == "/import":
        action_type = "import"
        import_url = text.partition(" ")[2].strip()
        if not import_url:
            reply_text = "⚠️ Usage: /import <https://allowed-host/path/persona.json>"
        else:
            try:
                package_bytes = await _download_persona_pack(import_url)
                chars = load_characters()
                if package_bytes.startswith(b"PK\x03\x04"):
                    imported = _import_aura_archive(package_bytes, chars)
                else:
                    if len(package_bytes) > 2 * 1024 * 1024:
                        raise HTTPException(status_code=413, detail="JSON persona pack exceeds 2MB")
                    try:
                        pack = ManualPersonaPack.model_validate(json.loads(package_bytes))
                    except (json.JSONDecodeError, ValidationError):
                        raise HTTPException(status_code=422, detail="Downloaded file is not a valid persona pack")
                    imported = _import_persona_pack(pack, chars)
                    if imported["status"] == "imported":
                        save_characters(chars)
                if imported["status"] == "imported":
                    reply_text = f"✅ Imported <b>{html.escape(str(imported.get('actor_name', imported.get('actor_id'))))}</b>."
                else:
                    reply_text = f"ℹ️ Character <code>{html.escape(str(imported.get('actor_id', 'unknown')))}</code> already exists."
            except HTTPException as error:
                reply_text = f"❌ {html.escape(str(error.detail))}"

    if reply_text:
        target_chat = message.get("chat", {}).get("id") or TELEGRAM_GROUP_CHAT_ID
        audio_file_id = None
        document_file_id = None
        if audio_request:
            audio_file_id = await send_telegram_audio(target_chat, topic_id, await _synthesize_telegram_audio(*audio_request))
            if not audio_file_id:
                raise HTTPException(status_code=502, detail="Telegram audio delivery failed")
        if document_request:
            document_file_id = await send_telegram_document(target_chat, topic_id, *document_request)
            if not document_file_id:
                raise HTTPException(status_code=502, detail="Telegram export delivery failed")
        delivered = await send_telegram_reply(chat_id=target_chat, thread_id=topic_id, text=reply_text)
        return {"ok": True, "action": action_type, "reply": reply_text, "delivered": delivered,
                "audio_file_id": audio_file_id, "document_file_id": document_file_id, **extra}

    return {"ok": True, "ignored": "unhandled_command"}


@app.get("/api/tts/voices")
def get_voices():
    """Return catalog of zero-cost Edge-TTS voices covering Burmese, Japanese Anime, and English."""
    return [
        {"id": "my-MM-NilarNeural", "name": "Nilar (Burmese Female Cultural Host)", "gender": "Female", "locale": "my-MM", "archetype": "myanmar"},
        {"id": "my-MM-ThihaNeural", "name": "Thiha (Burmese Male Anchor/Officer)", "gender": "Male", "locale": "my-MM", "archetype": "army_myanmar"},
        {"id": "ja-JP-NanamiNeural", "name": "Nanami (Japanese Anime Heroine/Idol)", "gender": "Female", "locale": "ja-JP", "archetype": "anime"},
        {"id": "ja-JP-KeitaNeural", "name": "Keita (Japanese Anime Protagonist/Hero)", "gender": "Male", "locale": "ja-JP", "archetype": "anime"},
        {"id": "en-US-JennyNeural", "name": "Jenny (US English Streamer/Cyberpunk)", "gender": "Female", "locale": "en-US", "archetype": "streamer"},
        {"id": "en-US-GuyNeural", "name": "Guy (US English Tactical Commander)", "gender": "Male", "locale": "en-US", "archetype": "army"},
        {"id": "en-US-AriaNeural", "name": "Aria (US English Expressive/Narrator)", "gender": "Female", "locale": "en-US", "archetype": "streamer"},
    ]


@app.post("/api/tts/synthesize")
async def synthesize_speech(payload: SynthesizeRequest, request: Request, _: None = Depends(require_auth), __: None = Depends(enforce_tts_rate_limit)):
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
            raise HTTPException(status_code=502, detail="TTS synthesis failed")
            
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
    except Exception:
        logger.exception("TTS synthesis failed")
        raise HTTPException(status_code=500, detail="TTS synthesis failed")


@app.post("/api/avatar-video/render-plan")
def create_avatar_video_render_plan(payload: AvatarVideoPlanRequest, _: None = Depends(require_auth)):
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
            "voice_id": payload.voice_id or character["voice_id"],
            "vrm_model": character["vrm_model"],
        }
        for index, line in enumerate(lines, start=1)
    ]
    plan_id = f"plan_{uuid4().hex}"
    plan = {
        "plan_id": plan_id,
        "created_at": datetime.now(UTC).isoformat(),
        "status": "planned",
        "render_mode": "local-manifest-only",
        "character": {"id": character["id"], "name": character["name"], "voice_id": payload.voice_id or character["voice_id"]},
        "aspect_ratio": payload.aspect_ratio,
        "estimated_duration_seconds": len(scenes) * payload.seconds_per_scene,
        "scenes": scenes,
        "next_step": "Review this manifest, synthesize voice locally, then render with your chosen local video tool.",
    }
    # FIX(free-tier-1): render manifests live in Postgres on ephemeral hosting.
    if database_enabled():
        write_state(f"render_plan:{plan_id}", plan)
    else:
        (RENDER_PLAN_DIR / f"{plan_id}.json").write_text(json.dumps(plan, ensure_ascii=False, indent=2), encoding="utf-8")
    return plan


def _render_plan_path(plan_id: str) -> Path:
    if not plan_id.startswith("plan_") or any(char not in "abcdefghijklmnopqrstuvwxyz0123456789_" for char in plan_id):
        raise HTTPException(status_code=404, detail="Render plan not found")
    return RENDER_PLAN_DIR / f"{plan_id}.json"


@app.get("/api/avatar-video/render-plans")
def list_avatar_video_render_plans():
    """List saved render manifests; no render provider is contacted."""
    summary_keys = ("plan_id", "created_at", "status", "character", "aspect_ratio", "estimated_duration_seconds")
    if database_enabled():
        return {"items": [{key: plan.get(key) for key in summary_keys} for _, plan, _ in list_state("render_plan:", 50)]}
    plans = []
    for path in sorted(RENDER_PLAN_DIR.glob("plan_*.json"), key=lambda item: item.stat().st_mtime, reverse=True)[:50]:
        try:
            plan = json.loads(path.read_text(encoding="utf-8"))
            plans.append({key: plan.get(key) for key in summary_keys})
        except (OSError, json.JSONDecodeError):
            continue
    return {"items": plans}


@app.get("/api/avatar-video/render-plans/{plan_id}/download")
def download_avatar_video_render_plan(plan_id: str):
    if database_enabled():
        found, plan = read_state(f"render_plan:{plan_id}")
        if not found:
            raise HTTPException(status_code=404, detail="Render plan not found")
        content = json.dumps(plan, ensure_ascii=False, indent=2)
    else:
        path = _render_plan_path(plan_id)
        if not path.is_file():
            raise HTTPException(status_code=404, detail="Render plan not found")
        content = path.read_text(encoding="utf-8")
    return Response(content=content, media_type="application/json", headers={"Content-Disposition": f'attachment; filename="{plan_id}.json"'})


@app.delete("/api/avatar-video/render-plans/{plan_id}")
def delete_avatar_video_render_plan(plan_id: str, _: None = Depends(require_auth)):
    if database_enabled():
        if not delete_state(f"render_plan:{plan_id}"):
            raise HTTPException(status_code=404, detail="Render plan not found")
    else:
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


@app.get("/api/characters/vrm/{actor_id}")
def get_imported_vrm(actor_id: str):
    # FIX(audit-2-B): serve imported VRM assets only from the validated persistent asset directory.
    if not re.fullmatch(r"[a-zA-Z0-9_-]{1,64}", actor_id):
        raise HTTPException(status_code=404, detail="VRM asset not found")
    asset_dir = (DATA_DIR / "imported_vrms").resolve()
    asset_path = (asset_dir / f"{actor_id}.vrm").resolve()
    if os.path.commonpath((str(asset_dir), str(asset_path))) != str(asset_dir) or not asset_path.is_file():
        raise HTTPException(status_code=404, detail="VRM asset not found")
    return FileResponse(asset_path, media_type="model/gltf-binary", filename=f"{actor_id}.vrm")


@app.get("/api/characters")
def list_characters(style: str | None = Query(None, description="Filter by style archetype")):
    chars = load_characters()
    if style:
        return [c for c in chars if c.get("style") == style]
    return chars


@app.post("/api/characters")
def create_character(payload: CharacterCreate, _: None = Depends(require_auth)):
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


def _import_persona_pack(pack: ManualPersonaPack, chars: list[dict[str, Any]]) -> dict[str, Any]:
    """Import an explicit local pack without overwriting an existing actor."""
    # FIX(audit-1-C): reject traversal, separators, absolute paths, and null bytes at the trust boundary.
    actor_id = pack.actor_id.strip()
    if not re.fullmatch(r"[a-zA-Z0-9_-]{1,64}", actor_id):
        raise HTTPException(status_code=422, detail="Invalid actor_id")
    if ".." in pack.vrm_model_path or not pack.vrm_model_path.startswith("/models/"):
        raise HTTPException(status_code=422, detail="VRM model path must stay inside /models/")
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
        "expression_map": pack.expression_map,
        "tags": [tag.strip() for tag in pack.character_meta.tags if tag.strip()],
    }
    chars.append(imported)
    return {"status": "imported", "character": imported}


@app.post("/api/characters/import-pack")
def import_persona_pack(pack: ManualPersonaPack, _: None = Depends(require_auth)):
    """Import one user-selected JSON persona pack into AuraCraft only."""
    chars = load_characters()
    result = _import_persona_pack(pack, chars)
    if result["status"] == "imported":
        save_characters(chars)
    return result


@app.post("/api/characters/import-packs")
def import_persona_packs(batch: ManualPersonaPackBatch, _: None = Depends(require_auth)):
    """Import selected JSON packs atomically; conflicts are reported, never replaced."""
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
def export_character_pack(payload: PersonaPackExportRequest, _: None = Depends(require_auth)):
    """Package a character from AuraCraft Studio into a standalone downloadable JSON asset pack."""
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
        "expression_map": target.get("expression_map", {
            "neutral": "blendshape_neutral",
            "happy": "blendshape_happy",
            "angry": "blendshape_angry",
            "sad": "blendshape_sad",
            "surprised": "blendshape_surprised"
        }),
        "character_meta": {
            "personality_prompt": target["personality"],
            "style": target.get("style", "general"),
            "tags": target.get("tags", [])
        }
    }
    
    # Save standalone downloadable file in AuraCraft's own export folder
    export_dir = DATA_DIR / "exported_packs"
    export_dir.mkdir(parents=True, exist_ok=True)
    actor_id = str(target["id"])
    if not re.fullmatch(r"[a-zA-Z0-9_-]{1,64}", actor_id):
        raise HTTPException(status_code=422, detail="Invalid actor_id")
    name = f"{actor_id}_auracraft_pack.json"
    resolved = (export_dir / name).resolve()
    if os.path.commonpath((str(export_dir.resolve()), str(resolved))) != str(export_dir.resolve()):
        raise HTTPException(status_code=400, detail="Invalid export path")
    export_file = resolved
    temp_name = None
    try:
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=export_dir, prefix=".export-", suffix=".tmp", delete=False) as f:
            temp_name = f.name
            json.dump(auracraft_asset_pack, f, indent=2, ensure_ascii=False)
            f.flush()
            os.fsync(f.fileno())
        os.replace(temp_name, export_file)
    finally:
        if temp_name and os.path.exists(temp_name):
            os.unlink(temp_name)
        
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
        "expression_map": target.get("expression_map", {
            "neutral": "blendshape_neutral",
            "happy": "blendshape_happy",
            "angry": "blendshape_angry",
            "sad": "blendshape_sad",
            "surprised": "blendshape_surprised"
        }),
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
