/**
 * AuraCraft Studio — Search Bar Component
 *
 * Client-side fuzzy search using Fuse.js.
 * Searches character name, tags, and style in real-time.
 */

import React, { useCallback, useRef } from 'react';
import Fuse, { type IFuseOptions } from 'fuse.js';
import { Search, X } from 'lucide-react';
import type { Character } from '../types/character';

interface SearchBarProps {
  characters: Character[];
  onResults: (results: Character[]) => void;
  query: string;
  onQueryChange: (q: string) => void;
  placeholder?: string;
}

/** Fuse.js configuration for character search */
const FUSE_OPTIONS: IFuseOptions<Character> = {
  keys: [
    { name: 'name', weight: 0.5 },
    { name: 'tags', weight: 0.35 },
    { name: 'style', weight: 0.15 },
  ],
  threshold: 0.35,      // 0 = exact match, 1 = match anything
  includeScore: false,
  minMatchCharLength: 1,
  ignoreLocation: true,
};

export const SearchBar: React.FC<SearchBarProps> = ({
  characters,
  onResults,
  query,
  onQueryChange,
  placeholder = 'Search by name, tag, or style...',
}) => {
  const fuseRef = useRef<Fuse<Character> | null>(null);

  // Rebuild Fuse index whenever character list changes
  const getFuse = useCallback(() => {
    // Always rebuild when characters array reference changes
    fuseRef.current = new Fuse(characters, FUSE_OPTIONS);
    return fuseRef.current;
  }, [characters]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      onQueryChange(value);

      if (!value.trim()) {
        onResults(characters); // Show all when empty
        return;
      }

      const fuse = getFuse();
      const results = fuse.search(value).map((r) => r.item);
      onResults(results);
    },
    [characters, getFuse, onQueryChange, onResults]
  );

  const handleClear = useCallback(() => {
    onQueryChange('');
    onResults(characters);
  }, [characters, onQueryChange, onResults]);

  return (
    <div className="relative flex items-center w-full">
      <Search className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
      <input
        type="text"
        value={query}
        onChange={handleChange}
        placeholder={placeholder}
        className="
          w-full pl-9 pr-9 py-2
          bg-[#111827] border border-[#1f293d]
          text-slate-200 placeholder-slate-500
          rounded-xl text-sm
          focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/40
          transition-all
        "
      />
      {query && (
        <button
          onClick={handleClear}
          className="absolute right-3 text-slate-400 hover:text-slate-200 transition-colors"
          aria-label="Clear search"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
