/**
 * AuraCraft Studio — Library View
 *
 * The main character grid view. Displays all characters in a responsive
 * masonry-style grid with real-time Fuse.js search and filter sidebar.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Users, Heart, FolderOpen, Plus, RefreshCw } from 'lucide-react';
import { SearchBar } from './SearchBar';
import { CharacterCard } from './CharacterCard';
import { ImportDropZone } from './ImportDropZone';
import { getAllCharacters, deleteCharacter, toggleFavorite } from '../services/characterService';
import { exportCharacterAsAura } from '../services/exportService';
import type { Character, CharacterStyle } from '../types/character';

// ─────────────────────────────────────────────
// Filter Sidebar Types
// ─────────────────────────────────────────────
type LibraryFilter = 'all' | 'favorites' | CharacterStyle;

const FILTER_ITEMS: { id: LibraryFilter; label: string; icon: React.ReactNode }[] = [
  { id: 'all',       label: 'All Characters', icon: <Users className="w-4 h-4" /> },
  { id: 'favorites', label: 'Favorites',       icon: <Heart className="w-4 h-4" /> },
  { id: 'anime',     label: 'Anime',           icon: <span className="text-sm">🎌</span> },
  { id: 'realistic', label: 'Realistic',       icon: <span className="text-sm">👤</span> },
  { id: 'myanmar',   label: 'Myanmar',         icon: <span className="text-sm">🇲🇲</span> },
  { id: 'army',      label: 'Army',            icon: <span className="text-sm">🪖</span> },
  { id: 'custom',    label: 'Custom',          icon: <span className="text-sm">✨</span> },
];

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────
interface LibraryViewProps {
  onPreviewCharacter: (character: Character) => void;
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────
export const LibraryView: React.FC<LibraryViewProps> = ({ onPreviewCharacter }) => {
  const [allCharacters, setAllCharacters] = useState<Character[]>([]);
  const [displayedCharacters, setDisplayedCharacters] = useState<Character[]>([]);
  const [activeFilter, setActiveFilter] = useState<LibraryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);

  // ── Load all characters from Dexie ──
  const loadCharacters = useCallback(async () => {
    setIsLoading(true);
    try {
      const chars = await getAllCharacters();
      setAllCharacters(chars);
      setDisplayedCharacters(chars);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCharacters();
  }, [loadCharacters]);

  // ── Apply active filter to character list ──
  const applyFilter = useCallback(
    (chars: Character[], filter: LibraryFilter): Character[] => {
      if (filter === 'all') return chars;
      if (filter === 'favorites') return chars.filter((c) => c.isFavorite);
      return chars.filter((c) => c.style === filter);
    },
    []
  );

  // When filter changes, re-apply to the full list
  useEffect(() => {
    if (!searchQuery) {
      setDisplayedCharacters(applyFilter(allCharacters, activeFilter));
    }
  }, [activeFilter, allCharacters, searchQuery, applyFilter]);

  // ── Handlers ──
  const handleSearchResults = useCallback(
    (results: Character[]) => {
      setDisplayedCharacters(applyFilter(results, activeFilter));
    },
    [activeFilter, applyFilter]
  );

  const handleDelete = useCallback(async (character: Character) => {
    await deleteCharacter(character.id);
    setAllCharacters((prev) => prev.filter((c) => c.id !== character.id));
    setDisplayedCharacters((prev) => prev.filter((c) => c.id !== character.id));
  }, []);

  const handleToggleFavorite = useCallback(async (character: Character) => {
    await toggleFavorite(character.id);
    setAllCharacters((prev) =>
      prev.map((c) => (c.id === character.id ? { ...c, isFavorite: !c.isFavorite } : c))
    );
    setDisplayedCharacters((prev) =>
      prev.map((c) => (c.id === character.id ? { ...c, isFavorite: !c.isFavorite } : c))
    );
  }, []);

  const handleExport = useCallback(async (character: Character) => {
    try {
      await exportCharacterAsAura(character);
    } catch (err) {
      console.error('[LibraryView] Export failed:', err);
      alert(err instanceof Error ? err.message : 'Export failed.');
    }
  }, []);

  const handleImported = useCallback(
    (newChar: Character) => {
      setAllCharacters((prev) => [newChar, ...prev]);
      setDisplayedCharacters((prev) => [newChar, ...applyFilter([newChar], activeFilter)]);
      setShowImport(false);
    },
    [activeFilter, applyFilter]
  );

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────
  return (
    <div className="flex h-full w-full overflow-hidden bg-[#0a0d14]">
      {/* ── LEFT SIDEBAR: Filter Navigation (Desktop) ── */}
      <aside className="hidden md:flex w-52 flex-shrink-0 border-r border-[#1f293d] bg-[#0c101c]/90 flex-col p-3 gap-1 overflow-y-auto">
        <div className="flex items-center gap-2 px-2 pt-1 pb-3">
          <FolderOpen className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Library</span>
        </div>

        {FILTER_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveFilter(item.id)}
            className={`
              flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium text-left
              transition-all duration-150
              ${activeFilter === item.id
                ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }
            `}
          >
            {item.icon}
            {item.label}
            {item.id === 'all' && (
              <span className="ml-auto text-xs text-slate-500">{allCharacters.length}</span>
            )}
            {item.id === 'favorites' && (
              <span className="ml-auto text-xs text-slate-500">
                {allCharacters.filter((c) => c.isFavorite).length}
              </span>
            )}
          </button>
        ))}

        {/* Import button in desktop sidebar */}
        <div className="mt-auto pt-4">
          <button
            onClick={() => setShowImport(!showImport)}
            className="
              w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium
              bg-indigo-600/20 border border-indigo-500/30 text-indigo-300
              hover:bg-indigo-600/30 hover:border-indigo-500/60
              transition-all
            "
          >
            <Plus className="w-4 h-4" />
            Import Character
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT AREA ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar: Search + Import Toggle + Refresh */}
        <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 border-b border-[#1f293d] bg-[#0d121f]/80">
          <div className="flex-1">
            <SearchBar
              characters={allCharacters}
              onResults={handleSearchResults}
              query={searchQuery}
              onQueryChange={setSearchQuery}
            />
          </div>
          <button
            onClick={() => setShowImport(!showImport)}
            className={`flex md:hidden p-2 rounded-xl border transition-colors ${
              showImport
                ? 'bg-indigo-600 border-indigo-500 text-white'
                : 'bg-[#111827] border-[#1f293d] text-indigo-400 hover:text-white'
            }`}
            title="Import character"
            aria-label="Import character"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={loadCharacters}
            className="p-2 rounded-xl bg-[#111827] border border-[#1f293d] text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors"
            title="Refresh library"
            aria-label="Refresh library"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Mobile Horizontal Filter Pills */}
        <div className="flex md:hidden overflow-x-auto py-2 px-3 gap-1.5 border-b border-[#1f293d]/50 bg-[#0c101c]/80 no-scrollbar">
          {FILTER_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveFilter(item.id)}
              className={`
                flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium
                transition-all
                ${activeFilter === item.id
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'bg-[#111827] text-slate-400 hover:text-slate-200 border border-[#1f293d]'
                }
              `}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {/* Import zone (collapsible) */}
        {showImport && (
          <div className="px-4 pt-3">
            <ImportDropZone onCharacterImported={handleImported} />
          </div>
        )}

        {/* Character Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-slate-500 text-sm">Loading library...</div>
            </div>
          ) : displayedCharacters.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <span className="text-6xl opacity-20">🗄️</span>
              <div>
                <p className="text-slate-400 font-medium">
                  {searchQuery ? 'No results found' : 'Your library is empty'}
                </p>
                <p className="text-slate-600 text-sm mt-1">
                  {searchQuery
                    ? 'Try a different search term'
                    : 'This is normal for a new workspace. Import a .vrm or .aura file to add items; built-in Stage Avatars and Casting Presets are listed separately.'}
                </p>
              </div>
              {!searchQuery && (
                <button
                  onClick={() => setShowImport(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Import Character
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3.5">
              {displayedCharacters.map((character) => (
                <CharacterCard
                  key={character.id}
                  character={character}
                  onPreview={onPreviewCharacter}
                  onExport={handleExport}
                  onDelete={handleDelete}
                  onToggleFavorite={handleToggleFavorite}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
