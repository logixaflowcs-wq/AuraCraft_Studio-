import React, { useEffect, useRef, useState } from 'react';
import { Download, Check, Layers, Upload, Clapperboard, Trash2, Plus, Sparkles, User, Tag, Tv, BookOpen, ShieldCheck, Video, Image as ImageIcon } from 'lucide-react';

export interface CharacterArchetype {
  id: string;
  name: string;
  role: string;
  style: 'anime' | 'realistic' | 'myanmar' | 'army' | 'streamer' | 'corporate' | 'custom';
  usage_target: 'narrativ_manga' | 'obs_stream' | 'cognix_research' | 'doka_enterprise' | 'general';
  avatar_type: 'vrm_3d' | 'image_2d';
  voice_id: string;
  default_emotion: string;
  badge: string;
  color: string;
  personality: string;
  avatar_url?: string;
}

type MotionPreset = { id: string; name: string; expression: string; animation: 'idle' | 'talk' | 'wave' | 'nod'; intensity: number };
const DEFAULT_MOTION_PRESETS: MotionPreset[] = [
  { id: 'calm-host', name: 'Calm host', expression: 'neutral', animation: 'talk', intensity: 45 },
  { id: 'warm-greeting', name: 'Warm greeting', expression: 'happy', animation: 'wave', intensity: 70 },
  { id: 'serious-explainer', name: 'Serious explainer', expression: 'neutral', animation: 'nod', intensity: 35 },
];

const PRESET_CHARACTERS: CharacterArchetype[] = [
  // 1. Anime Style
  {
    id: 'char_anime_shinji',
    name: 'Shinji Kazama (シンジ)',
    role: 'Anime Protagonist / Mecha Pilot',
    style: 'anime',
    usage_target: 'narrativ_manga',
    avatar_type: 'vrm_3d',
    voice_id: 'ja-JP-KeitaNeural',
    default_emotion: 'neutral',
    badge: '🌸 Anime Hero',
    color: '#38bdf8',
    personality: 'Determined, heroic young mecha pilot',
  },
  {
    id: 'char_anime_sakura',
    name: 'Sakura Hoshino (サクラ)',
    role: 'Anime Heroine & Magical Idol',
    style: 'anime',
    usage_target: 'narrativ_manga',
    avatar_type: 'vrm_3d',
    voice_id: 'ja-JP-NanamiNeural',
    default_emotion: 'happy',
    badge: '🌸 Anime Idol',
    color: '#ec4899',
    personality: 'Cheerful, radiant magical girl',
  },

  // 2. Realistic 3D Human (လူရုပ်စစ်စစ်)
  {
    id: 'char_realistic_daw_khin',
    name: 'Daw Khin Than (ဒေါ်ခင်သန်း)',
    role: 'Sovereign Diplomat & Enterprise Leader',
    style: 'realistic',
    usage_target: 'doka_enterprise',
    avatar_type: 'vrm_3d',
    voice_id: 'my-MM-NilarNeural',
    default_emotion: 'neutral',
    badge: '👤 Realistic Diplomat',
    color: '#06b6d4',
    personality: 'Distinguished executive diplomat and enterprise strategist',
  },
  {
    id: 'char_realistic_dr_hlaing',
    name: 'Dr. Hlaing Min (ဒေါက်တာလှိုင်မင်း)',
    role: 'Chief AI & Quantum Researcher',
    style: 'realistic',
    usage_target: 'cognix_research',
    avatar_type: 'vrm_3d',
    voice_id: 'my-MM-ThihaNeural',
    default_emotion: 'neutral',
    badge: '👤 Realistic Scientist',
    color: '#8b5cf6',
    personality: 'Visionary research scientist and AI academic lecturer',
  },
  {
    id: 'char_realistic_ko_phyo',
    name: 'Ko Phyo (ကိုဖြိုး - သတင်းထောက်)',
    role: 'Senior Investigative News Anchor',
    style: 'realistic',
    usage_target: 'obs_stream',
    avatar_type: 'vrm_3d',
    voice_id: 'my-MM-ThihaNeural',
    default_emotion: 'neutral',
    badge: '👤 News Anchor',
    color: '#3b82f6',
    personality: 'Calm, authoritative broadcast journalist and field correspondent',
  },

  // 3. Myanmar Traditional Style
  {
    id: 'char_myanmar_nilar',
    name: 'Daw Nilar (ဒေါ်နီလာ - သနပ်ခါး)',
    role: 'Traditional Thanakha Cultural Host',
    style: 'myanmar',
    usage_target: 'obs_stream',
    avatar_type: 'vrm_3d',
    voice_id: 'my-MM-NilarNeural',
    default_emotion: 'happy',
    badge: '🇲🇲 Traditional Thanakha',
    color: '#f59e0b',
    personality: 'Gracious Burmese cultural ambassador',
  },
  {
    id: 'char_myanmar_min_thar',
    name: 'Min Thar Thant Zin (မင်းသားသန့်စင်)',
    role: 'Classical Royal Performing Artist',
    style: 'myanmar',
    usage_target: 'narrativ_manga',
    avatar_type: 'vrm_3d',
    voice_id: 'my-MM-ThihaNeural',
    default_emotion: 'neutral',
    badge: '🇲🇲 Royal Court',
    color: '#d97706',
    personality: 'Eloquent classical royal court artist',
  },

  // 4. Tactical & Military
  {
    id: 'char_army_general_min',
    name: 'General Min Zaw (ဗိုလ်ချုပ်မင်းဇော်)',
    role: 'Tactical Commander & Strategist',
    style: 'army',
    usage_target: 'narrativ_manga',
    avatar_type: 'vrm_3d',
    voice_id: 'my-MM-ThihaNeural',
    default_emotion: 'neutral',
    badge: '🎖️ Tactical Commander',
    color: '#84cc16',
    personality: 'Disciplined military defense strategist',
  },
  {
    id: 'char_army_sergeant_kyaw',
    name: 'Sergeant Kyaw Thu (တပ်ကြပ်ကြီးကျော်သူ)',
    role: 'Special Operations Specialist',
    style: 'army',
    usage_target: 'narrativ_manga',
    avatar_type: 'vrm_3d',
    voice_id: 'my-MM-ThihaNeural',
    default_emotion: 'angry',
    badge: '🎖️ Spec-Ops',
    color: '#eab308',
    personality: 'Frontline tactical operator',
  },

  // 5. Corporate & News
  {
    id: 'char_corp_alex',
    name: 'Alex Vance (Executive Host)',
    role: 'Global Tech & Finance Moderator',
    style: 'corporate',
    usage_target: 'doka_enterprise',
    avatar_type: 'vrm_3d',
    voice_id: 'en-US-GuyNeural',
    default_emotion: 'neutral',
    badge: '💼 Tech Moderator',
    color: '#6366f1',
    personality: 'Sharp, polished corporate moderator and pitch master',
  },

  // 6. Cyber Streamer & VTuber
  {
    id: 'char_streamer_jenny',
    name: 'Jenny Nova',
    role: 'Cyberpunk Streamer & VTuber',
    style: 'streamer',
    usage_target: 'obs_stream',
    avatar_type: 'vrm_3d',
    voice_id: 'en-US-JennyNeural',
    default_emotion: 'surprised',
    badge: '⚡ Cyber Streamer',
    color: '#a855f7',
    personality: 'Energetic gaming and tech creator',
  },
  {
    id: 'char_streamer_maya',
    name: 'Maya Cyber (မာယာ)',
    role: 'Neural Net & AI Specialist',
    style: 'streamer',
    usage_target: 'cognix_research',
    avatar_type: 'vrm_3d',
    voice_id: 'my-MM-NilarNeural',
    default_emotion: 'happy',
    badge: '⚡ Neural Specialist',
    color: '#10b981',
    personality: 'Futuristic AI researcher and digital streamer',
  },
];

interface CharacterCastingProps {
  currentVoice: string;
  currentEmotion: string;
  onSelectCharacter?: (char: CharacterArchetype) => void;
}

export const CharacterCasting: React.FC<CharacterCastingProps> = ({
  currentVoice,
  currentEmotion,
  onSelectCharacter,
}) => {
  const [selectedStyle, setSelectedStyle] = useState<string>('all');
  const [selectedUsage, setSelectedUsage] = useState<string>('all');
  const [characterName, setCharacterName] = useState('Shinji Kazama (シンジ)');
  const [role, setRole] = useState('Anime Protagonist / Mecha Pilot');
  const [activeProp, setActiveProp] = useState<string | null>('prop_katana');
  const [exported, setExported] = useState(false);
  const [bulkExported, setBulkExported] = useState(false);
  const [transferStatus, setTransferStatus] = useState('');
  const [customCharacters, setCustomCharacters] = useState<CharacterArchetype[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [motionPresets, setMotionPresets] = useState<MotionPreset[]>(DEFAULT_MOTION_PRESETS);
  const [newPresetName, setNewPresetName] = useState('');
  const [presetExpression, setPresetExpression] = useState('neutral');
  const [presetAnimation, setPresetAnimation] = useState<MotionPreset['animation']>('talk');
  const [presetIntensity, setPresetIntensity] = useState(50);
  const presetImportRef = useRef<HTMLInputElement>(null);

  // New character form state
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newStyle, setNewStyle] = useState<'anime' | 'realistic' | 'myanmar' | 'army' | 'streamer' | 'corporate' | 'custom'>('realistic');
  const [newUsage, setNewUsage] = useState<'narrativ_manga' | 'obs_stream' | 'cognix_research' | 'doka_enterprise' | 'general'>('narrativ_manga');
  const [newAvatarType, setNewAvatarType] = useState<'vrm_3d' | 'image_2d'>('vrm_3d');
  const [newVoice, setNewVoice] = useState('my-MM-NilarNeural');
  const [newPersonality, setNewPersonality] = useState('');

  // Load custom characters from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('auracraft_custom_characters');
      if (stored) {
        setCustomCharacters(JSON.parse(stored));
      }
    } catch {
      // Ignored
    }
  }, []);

  useEffect(() => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem('auracraft_motion_presets') || '[]');
      if (Array.isArray(stored)) setMotionPresets([...DEFAULT_MOTION_PRESETS, ...stored.filter((preset): preset is MotionPreset => Boolean(preset && typeof preset.id === 'string' && typeof preset.name === 'string'))]);
    } catch { /* use the built-in local presets */ }
  }, []);

  const addMotionPreset = () => {
    if (!newPresetName.trim()) return;
    const preset: MotionPreset = { id: `custom-motion-${Date.now()}`, name: newPresetName.trim(), expression: presetExpression, animation: presetAnimation, intensity: presetIntensity };
    const next = [...motionPresets, preset];
    setMotionPresets(next);
    localStorage.setItem('auracraft_motion_presets', JSON.stringify(next.filter((item) => item.id.startsWith('custom-motion-'))));
    setNewPresetName('');
  };

  const saveCustomMotionPresets = (next: MotionPreset[]) => {
    setMotionPresets(next);
    localStorage.setItem('auracraft_motion_presets', JSON.stringify(next.filter((item) => item.id.startsWith('custom-motion-'))));
  };

  const exportMotionPresets = () => {
    const blob = new Blob([JSON.stringify({ format: 'auracraft-motion-presets', version: 1, presets: motionPresets.filter((preset) => preset.id.startsWith('custom-motion-')) }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'auracraft-motion-presets.json'; anchor.click(); URL.revokeObjectURL(url);
    setTransferStatus('Custom local motion presets exported.');
  };

  const importMotionPresets = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    try {
      const value: unknown = JSON.parse(await file.text());
      const incoming = value && typeof value === 'object' && (value as { format?: string }).format === 'auracraft-motion-presets' && Array.isArray((value as { presets?: unknown[] }).presets) ? (value as { presets: unknown[] }).presets.filter((item): item is MotionPreset => Boolean(item && typeof (item as MotionPreset).name === 'string' && typeof (item as MotionPreset).expression === 'string' && typeof (item as MotionPreset).animation === 'string' && typeof (item as MotionPreset).intensity === 'number')).map((preset) => ({ ...preset, id: `custom-motion-${Date.now()}-${preset.name.replace(/[^a-z0-9]/gi, '').toLowerCase()}` })) : [];
      if (!incoming.length) throw new Error('Invalid');
      const next = [...motionPresets, ...incoming.filter((candidate) => !motionPresets.some((preset) => preset.name.toLowerCase() === candidate.name.toLowerCase()))];
      saveCustomMotionPresets(next); setTransferStatus(`Imported ${next.length - motionPresets.length} preset(s); duplicates skipped.`);
    } catch { setTransferStatus('Preset import failed: choose an AuraCraft motion preset JSON file.'); }
  };

  const allCharacters = [...PRESET_CHARACTERS, ...customCharacters];

  const filtered = allCharacters.filter((c) => {
    const matchStyle = selectedStyle === 'all' || c.style === selectedStyle;
    const matchUsage = selectedUsage === 'all' || c.usage_target === selectedUsage;
    return matchStyle && matchUsage;
  });

  const handleApplyPreset = (char: CharacterArchetype) => {
    setCharacterName(char.name);
    setRole(char.role);
    if (onSelectCharacter) {
      onSelectCharacter(char);
    }
  };

  const handleCreateCustomCharacter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const newChar: CharacterArchetype = {
      id: `custom_${Date.now()}`,
      name: newName.trim(),
      role: newRole.trim() || 'Custom Persona',
      style: newStyle,
      usage_target: newUsage,
      avatar_type: newAvatarType,
      voice_id: newVoice,
      default_emotion: 'neutral',
      badge: newStyle === 'realistic' ? '👤 Realistic' : newStyle === 'anime' ? '🌸 Anime' : '✨ Custom',
      color: newStyle === 'realistic' ? '#06b6d4' : '#a855f7',
      personality: newPersonality.trim() || `${newName} - Custom configured character`,
    };

    const updated = [newChar, ...customCharacters];
    setCustomCharacters(updated);
    try {
      localStorage.setItem('auracraft_custom_characters', JSON.stringify(updated));
    } catch {
      // Ignored
    }

    handleApplyPreset(newChar);
    setShowAddModal(false);
    setNewName('');
    setNewRole('');
    setNewPersonality('');
  };

  const handleDeleteCustom = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = customCharacters.filter((c) => c.id !== id);
    setCustomCharacters(updated);
    try {
      localStorage.setItem('auracraft_custom_characters', JSON.stringify(updated));
    } catch {
      // Ignored
    }
  };

  const handleExportPack = () => {
    try {
      const selectedChar = allCharacters.find((c) => c.name === characterName);
      const payload = {
        export_version: "1.0.0",
        source_studio: "AuraCraft Studio",
        actor_id: selectedChar?.id || `actor_${characterName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        actor_name: characterName,
        role,
        category: selectedChar?.style || 'general',
        usage_target: selectedChar?.usage_target || 'general',
        avatar_type: selectedChar?.avatar_type || 'vrm_3d',
        voice_binding: {
          engine: 'edge-tts',
          voice_id: currentVoice,
          language: currentVoice.startsWith('my') ? 'my-MM' : currentVoice.startsWith('ja') ? 'ja-JP' : 'en-US',
        },
        default_emotion: currentEmotion,
        vrm_model_path: '/avatar_human.vrm',
        character_meta: {
          role,
          personality_prompt: selectedChar?.personality || `${characterName} - ${role}`,
          style: selectedChar?.style || 'general',
          tags: ['auracraft-studio', selectedChar?.style || 'general', selectedChar?.usage_target || 'general']
        }
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${payload.actor_id}_auracraft_pack.json`;
      a.click();
      URL.revokeObjectURL(url);

      setExported(true);
      setTimeout(() => setExported(false), 3500);
    } catch (err) {
      console.error('Export download failed:', err);
    }
  };

  const handleBulkExportAll = () => {
    try {
      const allPacks = allCharacters.map((c) => ({
        export_version: "1.0.0",
        source_studio: "AuraCraft Studio",
        actor_id: c.id,
        actor_name: c.name,
        role: c.role,
        style: c.style,
        category: c.style,
        usage_target: c.usage_target,
        avatar_type: c.avatar_type,
        voice_binding: {
          engine: 'edge-tts',
          voice_id: c.voice_id,
          language: c.voice_id.startsWith('my') ? 'my-MM' : c.voice_id.startsWith('ja') ? 'ja-JP' : 'en-US',
        },
        default_emotion: c.default_emotion,
        vrm_model_path: '/avatar_human.vrm',
        avatar_color: c.color,
        character_meta: {
          personality_prompt: c.personality,
          style: c.style,
          usage_target: c.usage_target,
          tags: ['auracraft-studio', c.style, c.usage_target]
        }
      }));

      const blob = new Blob([JSON.stringify(allPacks, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'all_auracraft_archetypes_pack.json';
      a.click();
      URL.revokeObjectURL(url);

      setBulkExported(true);
      setTimeout(() => setBulkExported(false), 3500);
    } catch (err) {
      console.error('Bulk export failed:', err);
    }
  };

  return (
    <div className="bg-[#111726]/80 backdrop-blur-md border border-[#1f293d] rounded-xl p-3 flex flex-col gap-2.5">
      {/* Header & Add Button */}
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-purple-400" />
          <span>Character Library ({allCharacters.length})</span>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 border border-purple-500/40 text-[10px] font-medium transition-all shadow-sm"
        >
          <Plus className="w-3 h-3" />
          New Character
        </button>
      </div>

      {/* Style & Category Tabs */}
      <div>
        <div className="text-[10px] text-slate-400 mb-1 flex items-center justify-between">
          <span className="flex items-center gap-1"><Tag className="w-2.5 h-2.5 text-cyan-400" /> Style Category</span>
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1 text-[10px] no-scrollbar">
          {[
            { id: 'all', label: 'All' },
            { id: 'realistic', label: '👤 Realistic Human' },
            { id: 'anime', label: '🌸 Anime 3D' },
            { id: 'myanmar', label: '🇲🇲 Myanmar' },
            { id: 'army', label: '🎖️ Military' },
            { id: 'corporate', label: '💼 Corporate' },
            { id: 'streamer', label: '⚡ Streamer' },
            { id: 'custom', label: '✨ Custom' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedStyle(tab.id)}
              className={`px-2 py-0.5 rounded font-medium whitespace-nowrap transition-colors ${
                selectedStyle === tab.id
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-[#0a0d14] text-slate-400 hover:text-slate-200 border border-[#1f293d]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Usage Destination Filter Tabs */}
      <div>
        <div className="text-[10px] text-slate-400 mb-1 flex items-center justify-between">
          <span className="flex items-center gap-1"><Tv className="w-2.5 h-2.5 text-emerald-400" /> Usage Target</span>
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1 text-[9px] no-scrollbar">
          {[
            { id: 'all', label: 'All Targets' },
            { id: 'narrativ_manga', label: '🎬 Narrativ Manga' },
            { id: 'obs_stream', label: '🎙️ OBS / Live' },
            { id: 'cognix_research', label: '📚 Cognix AI' },
            { id: 'doka_enterprise', label: '💼 Doka DMS' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedUsage(tab.id)}
              className={`px-1.5 py-0.5 rounded font-medium whitespace-nowrap transition-colors ${
                selectedUsage === tab.id
                  ? 'bg-cyan-600 text-white'
                  : 'bg-[#0a0d14] text-slate-400 hover:text-slate-200 border border-[#1f293d]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Character Card List */}
      <div className="rounded-lg border border-[#1f293d] bg-[#0a0d14]/60 p-2 space-y-2">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-300"><Sparkles className="w-3 h-3 text-amber-300" /> Expression &amp; animation presets <span className="text-slate-500 font-normal">(local)</span></div>
        <div className="flex flex-wrap gap-1">{motionPresets.map((preset) => <span key={preset.id} className="inline-flex items-center rounded border border-slate-700 bg-slate-900 text-[9px] text-slate-300"><button type="button" onClick={() => setTransferStatus(`Preset selected: ${preset.name} · ${preset.expression} ${preset.animation} at ${preset.intensity}%`)} className="px-1.5 py-1">{preset.name}</button>{preset.id.startsWith('custom-motion-') && <button type="button" onClick={() => saveCustomMotionPresets(motionPresets.filter((item) => item.id !== preset.id))} aria-label={`Delete ${preset.name} preset`} className="border-l border-slate-700 px-1 text-rose-300">×</button>}</span>)}</div>
        <div className="grid grid-cols-4 gap-1"><input value={newPresetName} onChange={(event) => setNewPresetName(event.target.value)} placeholder="New preset" aria-label="New motion preset name" className="col-span-2 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] text-slate-200" /><select value={presetExpression} onChange={(event) => setPresetExpression(event.target.value)} className="rounded border border-slate-700 bg-slate-950 px-1 text-[10px] text-slate-200"><option>neutral</option><option>happy</option><option>sad</option><option>angry</option><option>surprised</option></select><button type="button" onClick={addMotionPreset} className="rounded bg-purple-600/50 px-1 text-[10px] text-white">Save</button></div>
        <div className="flex items-center gap-2 text-[9px] text-slate-400"><select value={presetAnimation} onChange={(event) => setPresetAnimation(event.target.value as MotionPreset['animation'])} className="rounded border border-slate-700 bg-slate-950 px-1 py-1 text-[10px] text-slate-200"><option value="idle">idle</option><option value="talk">talk</option><option value="wave">wave</option><option value="nod">nod</option></select><input type="range" min="0" max="100" value={presetIntensity} onChange={(event) => setPresetIntensity(Number(event.target.value))} aria-label="Motion intensity" className="flex-1" /><span>{presetIntensity}%</span><button type="button" onClick={exportMotionPresets} className="rounded border border-slate-700 px-1 py-1">Export</button><button type="button" onClick={() => presetImportRef.current?.click()} className="rounded border border-slate-700 px-1 py-1">Import</button><input ref={presetImportRef} type="file" accept="application/json,.json" className="hidden" onChange={importMotionPresets} /></div>
      </div>

      {transferStatus && <p className="rounded border border-cyan-500/30 bg-cyan-950/30 px-2 py-1 text-[10px] text-cyan-200" role="status">{transferStatus}</p>}

      {/* Character Card List */}
      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
        {filtered.map((char) => {
          const isCurrent = characterName === char.name;
          return (
            <div
              key={char.id}
              onClick={() => handleApplyPreset(char)}
              className={`p-2 rounded-lg border text-left cursor-pointer transition-all flex items-center justify-between ${
                isCurrent
                  ? 'bg-purple-950/50 border-purple-500/80 shadow-md ring-1 ring-purple-500/30'
                  : 'bg-[#0a0d14]/70 border-[#1f293d] hover:border-slate-700'
              }`}
            >
              <div className="min-w-0 pr-2">
                <div className="text-xs font-medium text-slate-200 truncate flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full inline-block flex-shrink-0"
                    style={{ backgroundColor: char.color }}
                  />
                  {char.name}
                </div>
                <div className="text-[10px] text-slate-400 truncate mt-0.5">{char.role}</div>

                {/* Badges for Category and Usage */}
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-[8px] bg-slate-800 text-slate-300 px-1 py-0.2 rounded border border-slate-700/60">
                    {char.style.toUpperCase()}
                  </span>
                  <span className="text-[8px] bg-cyan-950/60 text-cyan-400 px-1 py-0.2 rounded border border-cyan-800/40">
                    {char.usage_target === 'narrativ_manga' ? '🎬 Manga' : char.usage_target === 'obs_stream' ? '🎙️ OBS' : char.usage_target === 'cognix_research' ? '📚 Cognix' : '💼 Doka'}
                  </span>
                  <span className="text-[8px] bg-emerald-950/60 text-emerald-400 px-1 py-0.2 rounded border border-emerald-800/40">
                    {char.avatar_type === 'vrm_3d' ? '3D' : '2D'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span
                  className="text-[9px] px-1.5 py-0.5 rounded font-medium border"
                  style={{
                    color: char.color,
                    borderColor: `${char.color}40`,
                    backgroundColor: `${char.color}15`,
                  }}
                >
                  {char.badge}
                </span>

                {/* Delete button if custom */}
                {char.id.startsWith('custom_') && (
                  <button
                    onClick={(e) => handleDeleteCustom(char.id, e)}
                    className="p-1 text-slate-500 hover:text-rose-400 rounded transition-colors"
                    title="Delete character"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Export Action Buttons */}
      <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-[#1f293d]">
        <button
          onClick={handleExportPack}
          className="flex items-center justify-center gap-1 py-1.5 bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 rounded-lg text-[10px] font-medium transition-all"
        >
          {exported ? <Check className="w-3 h-3 text-emerald-400" /> : <Download className="w-3 h-3" />}
          Export Current (.json)
        </button>

        <button
          onClick={handleBulkExportAll}
          className="flex items-center justify-center gap-1 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg text-[10px] font-semibold transition-all shadow-md shadow-purple-600/20"
        >
          {bulkExported ? <Check className="w-3 h-3 text-emerald-300" /> : <Download className="w-3 h-3" />}
          Bulk Export All ({allCharacters.length})
        </button>
      </div>

      {/* Add Custom Character Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111726] border border-[#23314f] rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#23314f] pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-bold text-slate-100">Create New Character Archetype</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-200 text-xs px-2 py-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCustomCharacter} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Character Name (ဇာတ်ကောင်အမည်)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Commander Aung (ဗိုလ်မှူးအောင်)"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-[#0a0d14] border border-[#23314f] rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Role & Function (အခန်းကဏ္ဍ)</label>
                <input
                  type="text"
                  placeholder="e.g. Senior Cyber Analyst / Tactical Lead"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full bg-[#0a0d14] border border-[#23314f] rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Category Style</label>
                  <select
                    value={newStyle}
                    onChange={(e) => setNewStyle(e.target.value as any)}
                    className="w-full bg-[#0a0d14] border border-[#23314f] rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-purple-500"
                  >
                    <option value="realistic">👤 Realistic Human (လူရုပ်)</option>
                    <option value="anime">🌸 Anime 3D</option>
                    <option value="myanmar">🇲🇲 Myanmar Traditional</option>
                    <option value="army">🎖️ Military / Tactical</option>
                    <option value="corporate">💼 Corporate / News</option>
                    <option value="streamer">⚡ VTuber / Streamer</option>
                    <option value="custom">✨ Custom</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Usage Destination</label>
                  <select
                    value={newUsage}
                    onChange={(e) => setNewUsage(e.target.value as any)}
                    className="w-full bg-[#0a0d14] border border-[#23314f] rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-purple-500"
                  >
                    <option value="narrativ_manga">🎬 Narrativ Forge Manga</option>
                    <option value="obs_stream">🎙️ OBS / Live Streaming</option>
                    <option value="cognix_research">📚 Cognix Nexus AI</option>
                    <option value="doka_enterprise">💼 Doka Enterprise DMS</option>
                    <option value="general">🌐 General Ecosystem</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Avatar Format</label>
                  <select
                    value={newAvatarType}
                    onChange={(e) => setNewAvatarType(e.target.value as any)}
                    className="w-full bg-[#0a0d14] border border-[#23314f] rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-purple-500"
                  >
                    <option value="vrm_3d">3D VRM Model</option>
                    <option value="image_2d">2D Portrait Photo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Neural Voice</label>
                  <select
                    value={newVoice}
                    onChange={(e) => setNewVoice(e.target.value)}
                    className="w-full bg-[#0a0d14] border border-[#23314f] rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-purple-500"
                  >
                    <option value="my-MM-NilarNeural">🇲🇲 Nilar (Burmese Female)</option>
                    <option value="my-MM-ThihaNeural">🇲🇲 Thiha (Burmese Male)</option>
                    <option value="en-US-JennyNeural">🇺🇸 Jenny (English US)</option>
                    <option value="en-US-GuyNeural">🇺🇸 Guy (English US Male)</option>
                    <option value="ja-JP-NanamiNeural">🇯🇵 Nanami (Japanese)</option>
                    <option value="ja-JP-KeitaNeural">🇯🇵 Keita (Japanese Male)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Personality / Prompt Notes</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Calm and disciplined tone, speaks with authority."
                  value={newPersonality}
                  onChange={(e) => setNewPersonality(e.target.value)}
                  className="w-full bg-[#0a0d14] border border-[#23314f] rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#23314f]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium shadow-md shadow-purple-600/30"
                >
                  Save Character
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
