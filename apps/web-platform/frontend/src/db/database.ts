/**
 * AuraCraft Studio — Dexie IndexedDB Database
 *
 * Offline-first, zero-cost character storage.
 * All blobs (VRM, thumbnails, reference sheets) are stored natively in IndexedDB.
 * No backend required for the character library.
 */

import Dexie, { type Table } from 'dexie';
import type { Character, Project, Snapshot, AuraSettings } from '../types/character';

// ─────────────────────────────────────────────
// Database Class
// ─────────────────────────────────────────────
class AuraDatabase extends Dexie {
  /**
   * Characters table.
   * Index: id (PK), name, style, createdAt, isFavorite, tags (multi-entry), projectIds (multi-entry)
   */
  characters!: Table<Character, string>;

  /**
   * Projects table.
   * Index: id (PK), name, createdAt
   */
  projects!: Table<Project, string>;

  /**
   * Snapshots table.
   * Index: id (PK), characterId (FK), createdAt
   */
  snapshots!: Table<Snapshot, string>;

  /**
   * App settings table (single row with id='global').
   * Index: id (PK)
   */
  settings!: Table<AuraSettings, string>;

  constructor() {
    super('AuraDatabase');

    /**
     * Schema v1
     *
     * Multi-entry indexes (prefixed with *) allow querying by individual
     * array elements — e.g. db.characters.where('tags').equals('idol')
     *
     * Note: Blobs (vrmBlob, thumbnailBlob, referenceSheetBlob) are stored
     * as part of the object — not indexed. Dexie handles Blob storage natively.
     */
    this.version(1).stores({
      characters: 'id, name, style, createdAt, isFavorite, *tags, *projectIds',
      projects: 'id, name, createdAt',
      snapshots: 'id, characterId, createdAt',
      settings: 'id',
    });
  }
}

// ─────────────────────────────────────────────
// Singleton Export
// Import `db` throughout the app — Dexie handles
// lazy open and connection pooling automatically.
// ─────────────────────────────────────────────
export const db = new AuraDatabase();

// ─────────────────────────────────────────────
// Default Settings Initializer
// Call once on app startup to seed settings if absent.
// ─────────────────────────────────────────────
export async function initDefaultSettings(): Promise<void> {
  const existing = await db.settings.get('global');
  if (!existing) {
    await db.settings.add({
      id: 'global',
      defaultVoiceId: 'ja-JP-NanamiNeural',
      defaultStyle: 'anime',
      exportFormat: 'aura',
      language: 'en',
    });
  }
}
