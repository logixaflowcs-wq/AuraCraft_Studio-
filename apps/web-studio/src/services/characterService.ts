/**
 * AuraCraft Studio — Character Service
 *
 * CRUD operations for the Characters table in AuraDatabase.
 * All operations are async and return typed results.
 */

import { db } from '../db/database';
import type { Character, CharacterStyle } from '../types/character';

// ─────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────

/**
 * Add a new character to the library.
 * Caller is responsible for pre-generating thumbnail/reference sheet blobs.
 */
export async function addCharacter(character: Character): Promise<string> {
  await db.characters.add(character);
  return character.id;
}

// ─────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────

/**
 * Get all characters, sorted by newest first.
 */
export async function getAllCharacters(): Promise<Character[]> {
  return db.characters.orderBy('createdAt').reverse().toArray();
}

/**
 * Get a single character by its UUID.
 * Returns undefined if not found.
 */
export async function getCharacterById(id: string): Promise<Character | undefined> {
  return db.characters.get(id);
}

/**
 * Get all favorite characters, sorted by newest first.
 */
export async function getFavoriteCharacters(): Promise<Character[]> {
  return db.characters
    .where('isFavorite')
    .equals(1) // Dexie stores booleans as 0/1 in indexes
    .reverse()
    .sortBy('createdAt');
}

/**
 * Get all characters belonging to a specific project.
 */
export async function getCharactersByProject(projectId: string): Promise<Character[]> {
  return db.characters
    .where('projectIds')
    .equals(projectId)
    .reverse()
    .sortBy('createdAt');
}

/**
 * Get all characters matching a given style.
 */
export async function getCharactersByStyle(style: CharacterStyle): Promise<Character[]> {
  return db.characters
    .where('style')
    .equals(style)
    .reverse()
    .sortBy('createdAt');
}

/**
 * Search characters by a single tag value.
 */
export async function getCharactersByTag(tag: string): Promise<Character[]> {
  return db.characters
    .where('tags')
    .equals(tag)
    .reverse()
    .sortBy('createdAt');
}

// ─────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────

/**
 * Partially update a character by ID.
 * Always updates `updatedAt` automatically.
 */
export async function updateCharacter(
  id: string,
  changes: Partial<Omit<Character, 'id' | 'createdAt'>>
): Promise<void> {
  await db.characters.update(id, {
    ...changes,
    updatedAt: new Date(),
  });
}

/**
 * Toggle the favorite status of a character.
 */
export async function toggleFavorite(id: string): Promise<void> {
  const character = await db.characters.get(id);
  if (character) {
    await db.characters.update(id, {
      isFavorite: !character.isFavorite,
      updatedAt: new Date(),
    });
  }
}

/**
 * Update the identity prompt for a character and stamp updatedAt.
 */
export async function updateIdentityPrompt(id: string, prompt: string): Promise<void> {
  await db.characters.update(id, {
    identityPrompt: prompt,
    updatedAt: new Date(),
  });
}

/**
 * Assign a character to a project (adds projectId if not already present).
 */
export async function assignToProject(characterId: string, projectId: string): Promise<void> {
  const character = await db.characters.get(characterId);
  if (character && !character.projectIds.includes(projectId)) {
    await db.characters.update(characterId, {
      projectIds: [...character.projectIds, projectId],
      updatedAt: new Date(),
    });
  }
}

/**
 * Remove a character from a project.
 */
export async function removeFromProject(characterId: string, projectId: string): Promise<void> {
  const character = await db.characters.get(characterId);
  if (character) {
    await db.characters.update(characterId, {
      projectIds: character.projectIds.filter((id) => id !== projectId),
      updatedAt: new Date(),
    });
  }
}

// ─────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────

/**
 * Permanently delete a character and all its snapshots from the database.
 */
export async function deleteCharacter(id: string): Promise<void> {
  await db.transaction('rw', db.characters, db.snapshots, async () => {
    await db.characters.delete(id);
    // Also delete all associated snapshots
    await db.snapshots.where('characterId').equals(id).delete();
  });
}

/**
 * Delete all characters in the library (use with caution).
 */
export async function clearAllCharacters(): Promise<void> {
  await db.transaction('rw', db.characters, db.snapshots, async () => {
    await db.characters.clear();
    await db.snapshots.clear();
  });
}

// ─────────────────────────────────────────────
// COUNT / STATS
// ─────────────────────────────────────────────

/**
 * Get the total number of characters in the library.
 */
export async function getCharacterCount(): Promise<number> {
  return db.characters.count();
}
