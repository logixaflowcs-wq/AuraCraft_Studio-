/**
 * AuraCraft Studio — Export Service
 *
 * Packages a character into a `.aura` file format — a ZIP archive containing:
 *   - manifest.json   (metadata + SHA-256 checksum)
 *   - model.vrm       (the original VRM file)
 *   - thumbnail.png   (512×512 front-facing render)
 *   - reference-sheet.png (5-angle identity reference sheet)
 *
 * Usage:
 *   await exportCharacterAsAura(character);
 */

import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { Character, AuraManifest } from '../types/character';

// ─────────────────────────────────────────────
// SHA-256 Checksum
// ─────────────────────────────────────────────

/**
 * Compute a SHA-256 hex digest of a Blob using the Web Crypto API.
 * Zero external dependencies — runs in any modern browser.
 */
async function sha256Hex(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ─────────────────────────────────────────────
// .aura Package Builder
// ─────────────────────────────────────────────

/**
 * Export a character to a `.aura` ZIP package and trigger browser download.
 *
 * @param character - Full Character object (must have vrmBlob populated)
 * @throws Error if vrmBlob is missing
 */
export async function exportCharacterAsAura(character: Character): Promise<void> {
  if (!character.vrmBlob) {
    throw new Error(`Character "${character.name}" has no VRM file to export.`);
  }

  const zip = new JSZip();

  // 1. Compute SHA-256 of VRM for manifest integrity check
  const vrmChecksum = await sha256Hex(character.vrmBlob);

  // 2. Build manifest.json
  const manifest: AuraManifest = {
    version: '1.0',
    characterId: character.id,
    characterName: character.name,
    vrmChecksum,
    identityPrompt: character.identityPrompt,
    tags: character.tags,
    style: character.style,
    exportedAt: new Date().toISOString(),
    source: 'AuraCraft-Studio-v1',
  };

  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  // 3. Add VRM model
  zip.file('model.vrm', character.vrmBlob);

  // 4. Add thumbnail (if present)
  if (character.thumbnailBlob) {
    zip.file('thumbnail.png', character.thumbnailBlob);
  }

  // 5. Add reference sheet (if present)
  if (character.referenceSheetBlob) {
    zip.file('reference-sheet.png', character.referenceSheetBlob);
  }

  // 6. Generate ZIP and trigger download
  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  // Sanitize filename
  const safeName = character.name.replace(/[^a-zA-Z0-9_\- ]/g, '').trim() || 'character';
  saveAs(zipBlob, `${safeName}.aura`);
}

// ─────────────────────────────────────────────
// .aura Package Importer
// ─────────────────────────────────────────────

export interface ImportedAuraPackage {
  manifest: AuraManifest;
  vrmBlob: Blob;
  thumbnailBlob?: Blob;
  referenceSheetBlob?: Blob;
}

/**
 * Parse and validate an imported `.aura` ZIP file.
 * Verifies VRM SHA-256 checksum against the manifest.
 *
 * @param auraFile - The .aura file as a File or Blob
 * @returns Parsed package contents
 * @throws Error if manifest is missing or checksum fails
 */
export async function importAuraPackage(auraFile: File | Blob): Promise<ImportedAuraPackage> {
  const zip = await JSZip.loadAsync(auraFile);

  // Load manifest
  const manifestFile = zip.file('manifest.json');
  if (!manifestFile) {
    throw new Error('Invalid .aura file: manifest.json is missing');
  }
  const manifest: AuraManifest = JSON.parse(await manifestFile.async('string'));

  // Load VRM
  const vrmFile = zip.file('model.vrm');
  if (!vrmFile) {
    throw new Error('Invalid .aura file: model.vrm is missing');
  }
  const vrmBlob = new Blob([await vrmFile.async('arraybuffer')], {
    type: 'application/octet-stream',
  });

  // Verify checksum
  if (manifest.vrmChecksum) {
    const actualChecksum = await sha256Hex(vrmBlob);
    if (actualChecksum !== manifest.vrmChecksum) {
      throw new Error(
        `Checksum mismatch for "${manifest.characterName}". File may be corrupted.`
      );
    }
  }

  // Load optional assets
  let thumbnailBlob: Blob | undefined;
  const thumbFile = zip.file('thumbnail.png');
  if (thumbFile) {
    thumbnailBlob = new Blob([await thumbFile.async('arraybuffer')], { type: 'image/png' });
  }

  let referenceSheetBlob: Blob | undefined;
  const refFile = zip.file('reference-sheet.png');
  if (refFile) {
    referenceSheetBlob = new Blob([await refFile.async('arraybuffer')], { type: 'image/png' });
  }

  return { manifest, vrmBlob, thumbnailBlob, referenceSheetBlob };
}

// ─────────────────────────────────────────────
// JSON Export (lightweight alternative)
// ─────────────────────────────────────────────

/**
 * Export character metadata only (no blobs) as a JSON file.
 * Useful for sharing identity prompts and tags without the VRM model.
 */
export function exportCharacterAsJson(character: Character): void {
  const data = {
    id: character.id,
    name: character.name,
    style: character.style,
    tags: character.tags,
    identityPrompt: character.identityPrompt,
    referenceSheets: character.referenceSheets,
    voiceId: character.voiceId,
    defaultEmotion: character.defaultEmotion,
    createdAt: character.createdAt,
    exportedAt: new Date().toISOString(),
    source: 'AuraCraft-Studio-v1',
  };

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const safeName = character.name.replace(/[^a-zA-Z0-9_\- ]/g, '').trim() || 'character';
  saveAs(blob, `${safeName}-identity.json`);
}
