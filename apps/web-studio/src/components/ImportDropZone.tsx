/**
 * AuraCraft Studio — Import Drop Zone
 *
 * Drag & drop (or click) to import .vrm or .aura files.
 * On drop:
 *   1. VRM file → generate thumbnail + reference sheet → save to Dexie
 *   2. .aura file → verify checksum → restore character → save to Dexie
 */

import React, { useCallback, useState } from 'react';
import { Upload, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { generateThumbnail } from '../services/thumbnailService';
import { generateReferenceSheet } from '../services/referenceSheetService';
import { importAuraPackage } from '../services/exportService';
import { addCharacter } from '../services/characterService';
import type { Character } from '../types/character';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────
interface ImportDropZoneProps {
  onCharacterImported?: (character: Character) => void;
}

// ─────────────────────────────────────────────
// Status Types
// ─────────────────────────────────────────────
type ImportStatus =
  | { type: 'idle' }
  | { type: 'loading'; step: string }
  | { type: 'success'; name: string }
  | { type: 'error'; message: string };

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────
export const ImportDropZone: React.FC<ImportDropZoneProps> = ({ onCharacterImported }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [status, setStatus] = useState<ImportStatus>({ type: 'idle' });

  // ── Import .vrm file ──
  const importVRM = useCallback(
    async (file: File) => {
      setStatus({ type: 'loading', step: 'Rendering thumbnail...' });
      const vrmBlob = new Blob([await file.arrayBuffer()], { type: 'application/octet-stream' });

      let thumbnailBlob: Blob | undefined;
      let referenceSheetBlob: Blob | undefined;

      try {
        thumbnailBlob = await generateThumbnail(vrmBlob);
      } catch {
        // Non-fatal: thumbnail is optional
        console.warn('[ImportDropZone] Thumbnail generation failed');
      }

      setStatus({ type: 'loading', step: 'Generating reference sheet...' });
      try {
        referenceSheetBlob = await generateReferenceSheet(vrmBlob);
      } catch {
        console.warn('[ImportDropZone] Reference sheet generation failed');
      }

      setStatus({ type: 'loading', step: 'Saving to library...' });

      const cleanName = file.name.replace(/\.vrm$/i, '').replace(/[_-]/g, ' ');
      const character: Character = {
        id: crypto.randomUUID(),
        name: cleanName,
        style: 'custom',
        tags: ['vrm', 'imported'],
        vrmBlob,
        thumbnailBlob,
        referenceSheetBlob,
        identityPrompt: '',
        referenceSheets: [],
        isFavorite: false,
        projectIds: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await addCharacter(character);
      setStatus({ type: 'success', name: character.name });
      onCharacterImported?.(character);

      setTimeout(() => setStatus({ type: 'idle' }), 3000);
    },
    [onCharacterImported]
  );

  // ── Import .aura file ──
  const importAura = useCallback(
    async (file: File) => {
      setStatus({ type: 'loading', step: 'Verifying .aura package...' });

      const pkg = await importAuraPackage(file);

      setStatus({ type: 'loading', step: 'Saving to library...' });

      const character: Character = {
        id: crypto.randomUUID(), // New ID on import (avoid collisions)
        name: pkg.manifest.characterName,
        style: pkg.manifest.style,
        tags: pkg.manifest.tags,
        vrmBlob: pkg.vrmBlob,
        thumbnailBlob: pkg.thumbnailBlob,
        referenceSheetBlob: pkg.referenceSheetBlob,
        identityPrompt: pkg.manifest.identityPrompt,
        referenceSheets: [],
        isFavorite: false,
        projectIds: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await addCharacter(character);
      setStatus({ type: 'success', name: character.name });
      onCharacterImported?.(character);

      setTimeout(() => setStatus({ type: 'idle' }), 3000);
    },
    [onCharacterImported]
  );

  // ── Core handler ──
  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const file = Array.from(files)[0];
      if (!file) return;

      try {
        if (file.name.endsWith('.vrm')) {
          await importVRM(file);
        } else if (file.name.endsWith('.aura')) {
          await importAura(file);
        } else {
          setStatus({ type: 'error', message: 'Only .vrm or .aura files are supported.' });
          setTimeout(() => setStatus({ type: 'idle' }), 4000);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Import failed.';
        setStatus({ type: 'error', message });
        setTimeout(() => setStatus({ type: 'idle' }), 5000);
      }
    },
    [importVRM, importAura]
  );

  // ── Drag events ──
  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); };
  const onDragLeave = () => setIsDragOver(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  // ── File input click ──
  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(e.target.files);
    e.target.value = ''; // Reset so same file can be dropped again
  };

  const isLoading = status.type === 'loading';

  return (
    <label
      className={`
        relative flex flex-col items-center justify-center gap-3
        min-h-[140px] w-full rounded-2xl border-2 border-dashed
        cursor-pointer transition-all duration-200 select-none
        ${isDragOver
          ? 'border-indigo-500 bg-indigo-500/10 scale-[1.01]'
          : 'border-[#1f293d] bg-[#0d121f] hover:border-indigo-500/50 hover:bg-indigo-500/5'
        }
        ${isLoading ? 'pointer-events-none opacity-70' : ''}
      `}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <input
        type="file"
        accept=".vrm,.aura"
        className="sr-only"
        onChange={onInputChange}
        disabled={isLoading}
      />

      {/* ── Idle State ── */}
      {status.type === 'idle' && (
        <>
          <div className={`p-3 rounded-full border transition-colors ${
            isDragOver
              ? 'bg-indigo-500/20 border-indigo-500/60'
              : 'bg-[#111827] border-[#1f293d]'
          }`}>
            <Upload className={`w-6 h-6 ${isDragOver ? 'text-indigo-400' : 'text-slate-400'}`} />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-slate-300">
              Drop <span className="text-indigo-400">.vrm</span> or{' '}
              <span className="text-indigo-400">.aura</span> here
            </p>
            <p className="text-xs text-slate-500 mt-0.5">or click to browse</p>
          </div>
        </>
      )}

      {/* ── Loading State ── */}
      {status.type === 'loading' && (
        <>
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
          <p className="text-sm text-indigo-300 font-medium">{status.step}</p>
        </>
      )}

      {/* ── Success State ── */}
      {status.type === 'success' && (
        <>
          <CheckCircle className="w-8 h-8 text-emerald-400" />
          <p className="text-sm text-emerald-300 font-medium">
            "{status.name}" imported successfully!
          </p>
        </>
      )}

      {/* ── Error State ── */}
      {status.type === 'error' && (
        <>
          <AlertCircle className="w-8 h-8 text-rose-400" />
          <p className="text-sm text-rose-300 font-medium text-center px-4">{status.message}</p>
        </>
      )}
    </label>
  );
};
