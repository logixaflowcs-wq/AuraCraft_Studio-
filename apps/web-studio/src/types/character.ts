/**
 * AuraCraft Studio — Character Asset Library
 * Core TypeScript interfaces for the offline-first character management system.
 *
 * Purpose: Prevent "character drift" in AI videos by maintaining consistent
 * identity references, reference sheets, and prompt snapshots per character.
 */

// ─────────────────────────────────────────────
// Character Visual Style Categories
// ─────────────────────────────────────────────
export type CharacterStyle =
  | 'anime'
  | 'realistic'
  | 'myanmar'
  | 'army'
  | 'custom';

// ─────────────────────────────────────────────
// Export Format Options
// ─────────────────────────────────────────────
export type ExportFormat = 'aura' | 'json';

// ─────────────────────────────────────────────
// Core Character Interface
// ─────────────────────────────────────────────
export interface Character {
  /** UUID — generated via crypto.randomUUID() */
  id: string;

  /** Display name of the character */
  name: string;

  /** Visual style category for filtering */
  style: CharacterStyle;

  /** Searchable tags (e.g. ['idol', 'blue-hair', 'fantasy']) */
  tags: string[];

  /**
   * The raw VRM model file stored as a Blob in IndexedDB.
   * Optional — character may be photo-only.
   */
  vrmBlob?: Blob;

  /**
   * Front-facing 512×512 PNG thumbnail rendered via offscreen WebGL.
   * Auto-generated on import, can be manually replaced.
   */
  thumbnailBlob?: Blob;

  /**
   * 5-angle reference sheet (front, left, right, back, closeup) stitched
   * into a 2×3 PNG grid. Used for AI prompt consistency.
   */
  referenceSheetBlob?: Blob;

  /**
   * The core identity prompt text for AI image/video generation.
   * Example: "anime girl, blue hair, red kimono, gold eyes, slim build, ..."
   */
  identityPrompt: string;

  /**
   * Additional reference image URLs or base64 strings for identity locking.
   * These are face/outfit references beyond the reference sheet.
   */
  referenceSheets: string[];

  /** Azure / ElevenLabs voice ID for TTS association */
  voiceId?: string;

  /** Default emotion state (neutral, happy, sad, angry, surprised) */
  defaultEmotion?: string;

  /** ISO timestamp of when this character was first created */
  createdAt: Date;

  /** ISO timestamp of last modification */
  updatedAt: Date;

  /** Pinned to the top of the library view */
  isFavorite: boolean;

  /** Projects this character is assigned to */
  projectIds: string[];

  /**
   * Optional photo avatar URL (for photo-mode characters).
   * Stored as an object URL or data URL.
   */
  photoUrl?: string;
}

// ─────────────────────────────────────────────
// Project Interface
// Groups characters for a specific video project
// ─────────────────────────────────────────────
export interface Project {
  /** UUID */
  id: string;

  /** Project name (e.g. "Episode 3 — Festival Arc") */
  name: string;

  /** Optional longer description */
  description?: string;

  /** Characters assigned to this project */
  characterIds: string[];

  /** ISO timestamp */
  createdAt: Date;

  /** ISO timestamp */
  updatedAt: Date;
}

// ─────────────────────────────────────────────
// Snapshot Interface
// Point-in-time capture of a character's visual state
// Used to track "which exact look" was used in a scene
// ─────────────────────────────────────────────
export interface Snapshot {
  /** UUID */
  id: string;

  /** Parent character ID */
  characterId: string;

  /** Human-readable label (e.g. "Scene 3 — Post Battle") */
  label: string;

  /** Rendered thumbnail at the moment of snapshot */
  thumbnailBlob?: Blob;

  /** JSON-serialized VRM pose data */
  pose?: string;

  /** Emotion at time of snapshot */
  emotion?: string;

  /** Camera angle descriptor (e.g. "front", "closeup", "three-quarter") */
  cameraAngle?: string;

  /**
   * Frozen copy of the identity prompt at snapshot time.
   * This is the source of truth for reproducibility.
   */
  identityPromptSnapshot: string;

  /** ISO timestamp */
  createdAt: Date;
}

// ─────────────────────────────────────────────
// App-Wide Settings Interface
// ─────────────────────────────────────────────
export interface AuraSettings {
  /** Singleton ID — always 'global' */
  id: string;

  /** Default voice ID for newly added characters */
  defaultVoiceId: string;

  /** Default style for new character imports */
  defaultStyle: CharacterStyle;

  /** Preferred export format for .aura packages */
  exportFormat: ExportFormat;

  /** UI language preference ('en' | 'my') */
  language: 'en' | 'my';
}

// ─────────────────────────────────────────────
// .aura Package Manifest
// Written into the ZIP as manifest.json
// ─────────────────────────────────────────────
export interface AuraManifest {
  /** Schema version for forward compatibility */
  version: '1.0';

  /** Character ID */
  characterId: string;

  /** Character name */
  characterName: string;

  /** SHA-256 hex digest of model.vrm */
  vrmChecksum: string;

  /** Identity prompt at export time */
  identityPrompt: string;

  /** Tags */
  tags: string[];

  /** Style */
  style: CharacterStyle;

  /** ISO export timestamp */
  exportedAt: string;

  /** Source app identifier */
  source: 'AuraCraft-Studio-v1';
}
