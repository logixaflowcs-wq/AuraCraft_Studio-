import React, { useState, useRef } from 'react';
import {
  Camera, Sparkles, Upload, Globe, User, Layers, Check,
  ChevronRight, RefreshCw, Star, ShieldCheck, Heart, Trash2, RotateCcw
} from 'lucide-react';
import { translations, type Language } from '../utils/i18n';

export interface StudioCharacter {
  id: string;
  name: string;
  role: string;
  category: 'photo' | 'anime' | 'realistic' | 'myanmar' | 'army' | 'streamer';
  avatarMode: 'photo' | '3d';
  url: string;
  badge: string;
  avatarThumb: string;
  defaultVoice: string;
  defaultEmotion: string;
  isCustom?: boolean;
  blobId?: string;
}

export const ALL_STUDIO_CHARACTERS: StudioCharacter[] = [
  // 1. Photo Characters (Ultra-Realistic Talking Photo)
  {
    id: 'photo_aoi_blue',
    name: 'Aoi (Blue Hair Kimono)',
    role: 'Anime Beauty & Cosplay',
    category: 'photo',
    avatarMode: 'photo',
    url: '/avatars/blue_hair_girl.jpg',
    avatarThumb: '/avatars/blue_hair_girl.jpg',
    badge: '🌸 Real Photo',
    defaultVoice: 'ja-JP-NanamiNeural',
    defaultEmotion: 'neutral',
  },
  {
    id: 'photo_elena_blonde',
    name: 'Elena (Blonde Cosplay)',
    role: 'Cosplay Idol & Model',
    category: 'photo',
    avatarMode: 'photo',
    url: '/avatars/blonde_cosplay_girl.jpg',
    avatarThumb: '/avatars/blonde_cosplay_girl.jpg',
    badge: '🌸 Real Photo',
    defaultVoice: 'ja-JP-NanamiNeural',
    defaultEmotion: 'happy',
  },
  {
    id: 'photo_daw_khin',
    name: 'Daw Khin Than (Diplomat)',
    role: 'Executive Diplomat',
    category: 'photo',
    avatarMode: 'photo',
    url: '/avatars/blue_hair_girl.jpg',
    avatarThumb: '/avatars/blue_hair_girl.jpg',
    badge: '👤 Real Human',
    defaultVoice: 'my-MM-NilarNeural',
    defaultEmotion: 'neutral',
  },
  {
    id: 'photo_ko_phyo',
    name: 'Ko Phyo (News Anchor)',
    role: 'Broadcast Anchor',
    category: 'photo',
    avatarMode: 'photo',
    url: '/avatars/blonde_cosplay_girl.jpg',
    avatarThumb: '/avatars/blonde_cosplay_girl.jpg',
    badge: '👤 Real Human',
    defaultVoice: 'my-MM-ThihaNeural',
    defaultEmotion: 'neutral',
  },

  // 2. 3D Anime Characters
  {
    id: '3d_sakura',
    name: 'Sakura Hoshino (3D Idol)',
    role: 'Magical Anime Idol',
    category: 'anime',
    avatarMode: '3d',
    url: '/models/avatar_female_a.vrm',
    avatarThumb: '/models/avatar_female_a.vrm',
    badge: '🌸 3D VRM',
    defaultVoice: 'ja-JP-NanamiNeural',
    defaultEmotion: 'happy',
  },
  {
    id: '3d_nanami',
    name: 'Nanami (3D Heroine)',
    role: 'Cyber Heroine',
    category: 'anime',
    avatarMode: '3d',
    url: '/models/avatar_female_a.vrm',
    avatarThumb: '/models/avatar_female_a.vrm',
    badge: '💙 3D VRM',
    defaultVoice: 'ja-JP-NanamiNeural',
    defaultEmotion: 'neutral',
  },
  {
    id: '3d_shinji',
    name: 'Shinji Kazama (3D Pilot)',
    role: 'Mecha Pilot',
    category: 'anime',
    avatarMode: '3d',
    url: '/models/avatar_female_c.vrm',
    avatarThumb: '/models/avatar_female_c.vrm',
    badge: '⚡ 3D Mecha',
    defaultVoice: 'ja-JP-KeitaNeural',
    defaultEmotion: 'neutral',
  },

  // 3. 3D Realistic Humans
  {
    id: '3d_daw_khin',
    name: 'Daw Khin Than (3D Diplomat)',
    role: 'Sovereign Diplomat',
    category: 'realistic',
    avatarMode: '3d',
    url: '/avatar_human.vrm',
    avatarThumb: '/avatar_human.vrm',
    badge: '👤 3D Human',
    defaultVoice: 'my-MM-NilarNeural',
    defaultEmotion: 'neutral',
  },
  {
    id: '3d_ko_phyo',
    name: 'Ko Phyo (3D Anchor)',
    role: 'Investigative Journalist',
    category: 'realistic',
    avatarMode: '3d',
    url: '/avatar_human.vrm',
    avatarThumb: '/avatar_human.vrm',
    badge: '👤 3D Human',
    defaultVoice: 'my-MM-ThihaNeural',
    defaultEmotion: 'neutral',
  },
  {
    id: '3d_dr_hlaing',
    name: 'Dr. Hlaing Min (3D Scientist)',
    role: 'AI Researcher',
    category: 'realistic',
    avatarMode: '3d',
    url: '/avatar_human.vrm',
    avatarThumb: '/avatar_human.vrm',
    badge: '👤 3D Human',
    defaultVoice: 'my-MM-ThihaNeural',
    defaultEmotion: 'neutral',
  },

  // 4. 3D Myanmar Traditional
  {
    id: '3d_nilar',
    name: 'Daw Nilar (3D Traditional)',
    role: 'Cultural Host',
    category: 'myanmar',
    avatarMode: '3d',
    url: '/models/avatar_female_a.vrm',
    avatarThumb: '/models/avatar_female_a.vrm',
    badge: '🇲🇲 Myanmar 3D',
    defaultVoice: 'my-MM-NilarNeural',
    defaultEmotion: 'neutral',
  },
  {
    id: '3d_min_thar',
    name: 'Min Thar Thant Zin (3D)',
    role: 'Royal Court Presenter',
    category: 'myanmar',
    avatarMode: '3d',
    url: '/avatar_human.vrm',
    avatarThumb: '/avatar_human.vrm',
    badge: '🇲🇲 Myanmar 3D',
    defaultVoice: 'my-MM-ThihaNeural',
    defaultEmotion: 'neutral',
  },

  // 5. 3D Army / Tactical
  {
    id: '3d_gen_min',
    name: 'General Min Zaw (3D Army)',
    role: 'Army Commander',
    category: 'army',
    avatarMode: '3d',
    url: '/avatar_human.vrm',
    avatarThumb: '/avatar_human.vrm',
    badge: '🎖️ Army Tactical',
    defaultVoice: 'en-US-GuyNeural',
    defaultEmotion: 'neutral',
  },

  // 6. 3D Streamer
  {
    id: '3d_jenny',
    name: 'Jenny Nova (3D VTuber)',
    role: 'Cyber Streamer',
    category: 'streamer',
    avatarMode: '3d',
    url: '/models/avatar_female_a.vrm',
    avatarThumb: '/models/avatar_female_a.vrm',
    badge: '🎙️ 3D Streamer',
    defaultVoice: 'en-US-JennyNeural',
    defaultEmotion: 'happy',
  },
];

interface StudioLeftPanelProps {
  stageMode: 'photo' | '3d';
  currentActorName: string;
  lang?: Language;
  customCharacters?: StudioCharacter[];
  deletedCharacterIds?: string[];
  onSelectStageMode: (mode: 'photo' | '3d') => void;
  onSelectCharacter: (char: StudioCharacter) => void;
  onUploadCustomPhoto: (file: File) => void;
  onUploadCustomVRM: (file: File) => void;
  onImportRPMUrl: (url: string) => void;
  onDeleteCharacter?: (charId: string) => void;
  onResetAllPresets?: () => void;
}

export const StudioLeftPanel: React.FC<StudioLeftPanelProps> = ({
  stageMode,
  currentActorName,
  lang = 'en',
  customCharacters = [],
  deletedCharacterIds = [],
  onSelectStageMode,
  onSelectCharacter,
  onUploadCustomPhoto,
  onUploadCustomVRM,
  onImportRPMUrl,
  onDeleteCharacter,
  onResetAllPresets,
}) => {
  const isMyanmar = lang === 'my';
  const t = translations[lang] || translations.en;
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const photoInputRef = useRef<HTMLInputElement>(null);
  const vrmInputRef = useRef<HTMLInputElement>(null);

  const CATEGORIES = [
    { id: 'all', label: isMyanmar ? 'အားလုံး' : 'All' },
    { id: 'photo', label: isMyanmar ? '📸 ဓာတ်ပုံ' : '📸 Photo' },
    { id: 'anime', label: isMyanmar ? '🌸 အန်နီမေး' : '🌸 Anime' },
    { id: 'realistic', label: isMyanmar ? '👤 လူရုပ်' : '👤 Real 3D' },
    { id: 'myanmar', label: isMyanmar ? '🇲🇲 မြန်မာ' : '🇲🇲 Myanmar' },
    { id: 'army', label: isMyanmar ? '🎖️ တပ်' : '🎖️ Army' },
  ];

  // Combine custom characters and preset characters minus deleted ones
  const activePresets = ALL_STUDIO_CHARACTERS.filter(c => !deletedCharacterIds.includes(c.id));
  const combinedList = [...customCharacters, ...activePresets];

  const filteredCharacters = combinedList.filter(c => {
    if (activeCategory === 'all') return true;
    if (activeCategory === 'photo') return c.avatarMode === 'photo';
    return c.category === activeCategory;
  });

  return (
    <aside className="w-72 border-r border-[#1f293d] bg-[#0c101c]/95 flex flex-col h-full shadow-2xl z-30 flex-shrink-0 select-none">
      {/* Hidden File Inputs */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUploadCustomPhoto(file);
        }}
      />
      <input
        ref={vrmInputRef}
        type="file"
        accept=".vrm,.glb"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUploadCustomVRM(file);
        }}
      />

      {/* 1. STAGE MODE TOGGLE SWITCHER (Option 1 vs Option 2) */}
      <div className="p-3 border-b border-[#1f293d] flex flex-col gap-2">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          {isMyanmar ? 'စင်မြင့် အင်ဂျင်ရွေးချယ်ရန်' : 'Avatar Engine Mode'}
        </span>

        <div className="grid grid-cols-2 gap-1.5 bg-[#0a0d16] p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => onSelectStageMode('photo')}
            className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition-all ${
              stageMode === 'photo'
                ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-md shadow-pink-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Photo Avatar</span>
          </button>

          <button
            onClick={() => onSelectStageMode('3d')}
            className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition-all ${
              stageMode === '3d'
                ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-md shadow-cyan-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>3D VRM</span>
          </button>
        </div>
      </div>

      {/* 2. CATEGORY PILLS */}
      <div className="px-3 pt-3 pb-1 border-b border-[#1f293d]/50 flex items-center gap-1 overflow-x-auto text-[11px]">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap transition-all ${
              activeCategory === cat.id
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-[#111726] text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-slate-800'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* 3. CHARACTER CARDS LIST */}
      <div className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-1.5">
        {/* Roster Header with Count & Reset link */}
        <div className="flex items-center justify-between px-1 pb-1 border-b border-[#1f293d]/40 mb-1">
          <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
            <Layers className="w-3 h-3 text-purple-400" />
            <span>{isMyanmar ? `ဇာတ်ကောင်စာရင်း (${filteredCharacters.length})` : `Characters (${filteredCharacters.length})`}</span>
          </span>

          {onResetAllPresets && deletedCharacterIds && deletedCharacterIds.length > 0 && (
            <button
              onClick={onResetAllPresets}
              className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium transition-colors"
              title={isMyanmar ? 'ဖျက်ထားသော မူလဇာတ်ကောင်များ ပြန်ထားမည်' : 'Restore All Preset Characters'}
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span>{isMyanmar ? 'မူလပြန်ထား' : 'Reset'}</span>
            </button>
          )}
        </div>

        {filteredCharacters.length === 0 && (
          <div className="text-center py-6 text-slate-500 text-xs flex flex-col items-center gap-2">
            <User className="w-6 h-6 text-slate-600" />
            <span>{isMyanmar ? 'ဇာတ်ကောင် မရှိပါ' : 'No characters found'}</span>
            {onResetAllPresets && (
              <button
                onClick={onResetAllPresets}
                className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1 mt-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{isMyanmar ? 'မူလဇာတ်ကောင်များ ပြန်ထားပါ' : 'Restore default presets'}</span>
              </button>
            )}
          </div>
        )}

        {filteredCharacters.map(char => {
          const isSelected = currentActorName.toLowerCase().includes(char.name.split(' ')[0].toLowerCase());
          return (
            <div
              key={char.id}
              onClick={() => onSelectCharacter(char)}
              className={`w-full p-2 rounded-xl text-left border transition-all flex items-center gap-2.5 group cursor-pointer ${
                isSelected
                  ? 'bg-gradient-to-r from-purple-950/70 to-indigo-950/70 border-cyan-500/80 shadow-lg shadow-purple-900/20 ring-1 ring-cyan-500/50'
                  : 'bg-[#111726]/80 hover:bg-[#161f33] border-slate-800/80 hover:border-slate-700'
              }`}
            >
              {/* Thumbnail */}
              <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-700/80 bg-slate-900 flex-shrink-0 relative">
                {char.avatarMode === 'photo' ? (
                  <img src={char.avatarThumb} alt={char.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-cyan-950 to-purple-950">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                  </div>
                )}
                {isSelected && (
                  <div className="absolute inset-0 bg-cyan-500/20 ring-2 ring-cyan-400 rounded-lg" />
                )}
              </div>

              {/* Character Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-100 truncate group-hover:text-cyan-300 transition-colors flex items-center gap-1">
                    {char.name}
                    {char.isCustom && (
                      <span className="text-[8px] bg-pink-900/80 text-pink-300 border border-pink-700/50 px-1 rounded uppercase">
                        {t.customTag || 'Custom'}
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] text-slate-400 truncate">{char.role}</span>
                </div>
              </div>

              {/* Badge & Delete Button */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase border ${
                  char.avatarMode === 'photo'
                    ? 'bg-pink-950/80 text-pink-300 border-pink-700/50'
                    : 'bg-cyan-950/80 text-cyan-300 border-cyan-700/50'
                }`}>
                  {char.avatarMode === 'photo' ? 'Photo' : '3D'}
                </span>

                {/* Delete / Trash Button */}
                {onDeleteCharacter && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(isMyanmar ? `"${char.name}" ကို ဖျက်မှာ သေချာပါသလား?` : `Are you sure you want to delete "${char.name}"?`)) {
                        onDeleteCharacter(char.id);
                      }
                    }}
                    className={`p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/60 border border-transparent hover:border-rose-800/50 transition-all ${
                      char.isCustom ? 'opacity-100 text-rose-400/80' : 'opacity-0 group-hover:opacity-100'
                    }`}
                    title={isMyanmar ? `"${char.name}" ကို ဖျက်မည်` : `Delete "${char.name}"`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. ASSET & AVATAR IMPORTERS (Upload photo / RPM 3D / VRM) */}
      <div className="p-3 border-t border-[#1f293d] bg-[#090d16] flex flex-col gap-1.5">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          {isMyanmar ? 'ကိုယ်ပိုင်သွင်းယူရန်' : 'Asset Importers'}
        </span>

        {/* Upload Custom Photo Button */}
        <button
          onClick={() => photoInputRef.current?.click()}
          className="w-full bg-[#111726] hover:bg-[#1a233a] border border-pink-500/40 hover:border-pink-500 text-pink-300 p-2 rounded-xl text-xs font-bold flex items-center justify-between transition-all shadow-sm"
        >
          <div className="flex items-center gap-2">
            <Camera className="w-3.5 h-3.5 text-pink-400" />
            <span>{isMyanmar ? 'ဓာတ်ပုံ အသစ်တင်ရန်' : 'Upload Any Photo'}</span>
          </div>
          <Upload className="w-3 h-3 text-pink-400" />
        </button>

        {/* Ready Player Me 3D Importer */}
        <button
          onClick={() => {
            const url = prompt(
              isMyanmar
                ? 'Ready Player Me 3D Avatar (.glb သို့မဟုတ် .vrm) URL ထည့်ပါ:'
                : 'Enter Ready Player Me 3D Avatar URL (.glb or .vrm):',
              'https://models.readyplayer.me/64d38c7f3b89b8001cb7419e.glb'
            );
            if (url && url.trim()) {
              onImportRPMUrl(url.trim());
            }
          }}
          className="w-full bg-[#111726] hover:bg-[#1a233a] border border-indigo-500/40 hover:border-indigo-500 text-indigo-300 p-2 rounded-xl text-xs font-bold flex items-center justify-between transition-all shadow-sm"
        >
          <div className="flex items-center gap-2">
            <Globe className="w-3.5 h-3.5 text-indigo-400" />
            <span>Ready Player Me 3D</span>
          </div>
          <Sparkles className="w-3 h-3 text-indigo-400" />
        </button>

        {/* Upload Custom 3D VRM Model */}
        <button
          onClick={() => vrmInputRef.current?.click()}
          className="w-full bg-[#111726] hover:bg-[#1a233a] border border-cyan-500/40 hover:border-cyan-500 text-cyan-300 p-2 rounded-xl text-xs font-bold flex items-center justify-between transition-all shadow-sm"
        >
          <div className="flex items-center gap-2">
            <Upload className="w-3.5 h-3.5 text-cyan-400" />
            <span>{isMyanmar ? '3D Model (.VRM) တင်ရန်' : 'Upload Custom 3D (.vrm)'}</span>
          </div>
          <ChevronRight className="w-3 h-3 text-cyan-400" />
        </button>
      </div>
    </aside>
  );
};
