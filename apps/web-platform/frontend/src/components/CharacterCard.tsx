/**
 * AuraCraft Studio — Character Card Component
 *
 * Displays a character in the library grid.
 * Shows: Thumbnail, Name, Style Badge, and Quick Actions.
 */

import React, { useState, useEffect } from 'react';
import { Eye, Download, Trash2, Heart, Star } from 'lucide-react';
import type { Character, CharacterStyle } from '../types/character';

// ─────────────────────────────────────────────
// Style Badge Config
// ─────────────────────────────────────────────
const STYLE_CONFIG: Record<CharacterStyle, { label: string; color: string }> = {
  anime:     { label: 'Anime',     color: 'bg-purple-900/60 text-purple-300 border-purple-700/50' },
  realistic: { label: 'Realistic', color: 'bg-blue-900/60 text-blue-300 border-blue-700/50' },
  myanmar:   { label: 'Myanmar',   color: 'bg-amber-900/60 text-amber-300 border-amber-700/50' },
  army:      { label: 'Army',      color: 'bg-green-900/60 text-green-300 border-green-700/50' },
  custom:    { label: 'Custom',    color: 'bg-slate-800/60 text-slate-300 border-slate-600/50' },
};

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────
interface CharacterCardProps {
  character: Character;
  onPreview: (character: Character) => void;
  onExport: (character: Character) => void;
  onDelete: (character: Character) => void;
  onToggleFavorite: (character: Character) => void;
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────
export const CharacterCard: React.FC<CharacterCardProps> = ({
  character,
  onPreview,
  onExport,
  onDelete,
  onToggleFavorite,
}) => {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { label: styleLabel, color: styleColor } = STYLE_CONFIG[character.style];

  // Create object URL from thumbnail blob
  useEffect(() => {
    if (!character.thumbnailBlob) return;
    const url = URL.createObjectURL(character.thumbnailBlob);
    setThumbnailUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [character.thumbnailBlob]);

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(character);
    setShowDeleteConfirm(false);
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(false);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Character ${character.name}, style ${character.style}`}
      className="
        group relative flex flex-col
        bg-[#0d121f] border border-[#1f293d]
        rounded-2xl overflow-hidden cursor-pointer
        hover:border-indigo-500/60 hover:shadow-xl hover:shadow-indigo-900/20
        focus:outline-none focus:ring-2 focus:ring-indigo-500/50
        transition-all duration-200
      "
      onClick={() => onPreview(character)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onPreview(character);
        }
      }}
    >
      {/* ── Thumbnail ── */}
      <div className="relative w-full aspect-square bg-[#111827] overflow-hidden">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={character.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-5xl opacity-30">🧍</span>
          </div>
        )}

        {/* Favorite star badge */}
        {character.isFavorite && (
          <div className="absolute top-2 left-2 bg-amber-500/90 text-white rounded-full p-1 shadow-lg">
            <Star className="w-3 h-3 fill-current" />
          </div>
        )}

        {/* Quick Actions overlay — visible on hover and focus-within */}
        <div className="
          absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent
          opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-within:opacity-100
          transition-opacity duration-200
          flex items-end justify-end gap-1.5 p-2
        ">
          <button
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(character); }}
            className={`p-1.5 rounded-lg border transition-colors ${
              character.isFavorite
                ? 'bg-amber-500/30 border-amber-500/60 text-amber-300 hover:bg-amber-500/50'
                : 'bg-black/40 border-white/20 text-white/70 hover:text-amber-300 hover:bg-amber-500/20'
            }`}
            title={character.isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
            aria-label={character.isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
          >
            <Heart className={`w-3.5 h-3.5 ${character.isFavorite ? 'fill-current' : ''}`} />
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); onExport(character); }}
            className="p-1.5 rounded-lg bg-black/40 border border-white/20 text-white/70 hover:text-indigo-300 hover:bg-indigo-500/20 hover:border-indigo-500/50 transition-colors"
            title="Export .aura"
            aria-label="Export .aura package"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleDeleteClick}
            className="p-1.5 rounded-lg bg-black/40 border border-white/20 text-white/70 hover:text-rose-300 hover:bg-rose-500/20 hover:border-rose-500/50 transition-colors"
            title="Delete"
            aria-label="Delete character"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Preview icon center */}
        <div className="
          absolute inset-0 flex items-center justify-center
          opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none
        ">
          <div className="bg-white/10 backdrop-blur-sm rounded-full p-3 border border-white/20">
            <Eye className="w-5 h-5 text-white" />
          </div>
        </div>
      </div>

      {/* ── Info ── */}
      <div className="p-3 flex flex-col gap-1.5">
        <p className="text-sm font-semibold text-slate-100 truncate">{character.name}</p>

        <div className="flex items-center justify-between">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${styleColor}`}>
            {styleLabel}
          </span>
          {character.tags.length > 0 && (
            <span className="text-[10px] text-slate-500 truncate max-w-[100px]">
              #{character.tags[0]}
              {character.tags.length > 1 ? ` +${character.tags.length - 1}` : ''}
            </span>
          )}
        </div>

        {/* Mobile-friendly quick action buttons (visible on mobile / touch viewports) */}
        <div className="flex md:hidden items-center justify-between pt-1 border-t border-[#1f293d]/50 mt-1">
          <button
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(character); }}
            className={`p-1 rounded-md text-xs flex items-center gap-1 ${
              character.isFavorite ? 'text-amber-400' : 'text-slate-400 hover:text-amber-300'
            }`}
            aria-label="Favorite"
          >
            <Heart className={`w-3.5 h-3.5 ${character.isFavorite ? 'fill-current' : ''}`} />
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); onExport(character); }}
              className="p-1 rounded-md text-slate-400 hover:text-indigo-300"
              title="Export"
              aria-label="Export"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleDeleteClick}
              className="p-1 rounded-md text-slate-400 hover:text-rose-400"
              title="Delete"
              aria-label="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Delete Confirmation Overlay ── */}
      {showDeleteConfirm && (
        <div
          className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center gap-3 p-4 z-10"
          onClick={(e) => e.stopPropagation()}
        >
          <Trash2 className="w-8 h-8 text-rose-400" />
          <p className="text-sm text-slate-200 text-center font-medium">
            Delete <span className="text-rose-300">"{character.name}"</span>?
          </p>
          <p className="text-xs text-slate-400 text-center">This cannot be undone.</p>
          <div className="flex gap-2 w-full">
            <button
              onClick={handleCancelDelete}
              className="flex-1 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmDelete}
              className="flex-1 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
