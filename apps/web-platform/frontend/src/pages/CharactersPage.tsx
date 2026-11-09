import React, { useState, useEffect, useRef } from 'react';
import { 
  Layers, Plus, Download, Upload, Search, Filter, Play, Check, Trash2, 
  User, Sparkles, Tv, ShieldCheck, Tag, ArrowRight, Video, Volume2 
} from 'lucide-react';
import { CharacterArchetype } from '../components/CharacterCasting';

interface CharactersPageProps {
  onCastToStage: (character: CharacterArchetype) => void;
  onNavigateToStage: () => void;
}

export const CharactersPage: React.FC<CharactersPageProps> = ({
  onCastToStage,
  onNavigateToStage,
}) => {
  const [characters, setCharacters] = useState<CharacterArchetype[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('all');
  const [selectedUsage, setSelectedUsage] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [bulkExported, setBulkExported] = useState(false);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);

  // New character form state
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newStyle, setNewStyle] = useState<'anime' | 'realistic' | 'myanmar' | 'army' | 'streamer' | 'corporate' | 'custom'>('realistic');
  const [newUsage, setNewUsage] = useState<'narrativ_manga' | 'obs_stream' | 'cognix_research' | 'doka_enterprise' | 'general'>('narrativ_manga');
  const [newAvatarType, setNewAvatarType] = useState<'vrm_3d' | 'image_2d'>('vrm_3d');
  const [newVoice, setNewVoice] = useState('my-MM-NilarNeural');
  const [newPersonality, setNewPersonality] = useState('');

  // Default presets
  const DEFAULT_PRESETS: CharacterArchetype[] = [
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
      personality: 'Determined, heroic young mecha pilot piloting the Quantum Frame.',
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
      personality: 'Cheerful, radiant magical girl spreading hope across galaxies.',
    },
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
      personality: 'Distinguished executive diplomat and strategic enterprise leader.',
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
      personality: 'Visionary research scientist and AI academic lecturer.',
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
      personality: 'Calm, authoritative broadcast journalist and field correspondent.',
    },
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
      personality: 'Gracious Burmese cultural ambassador in traditional ceremonial attire.',
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
      personality: 'Eloquent classical royal court artist and narrative dramatic actor.',
    },
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
      personality: 'Disciplined military defense strategist and orbital commander.',
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
      personality: 'Frontline tactical operator with specialized combat intelligence.',
    },
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
      personality: 'Sharp, polished corporate moderator and global ecosystem pitch master.',
    },
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
      personality: 'High-energy gaming and technology VTuber content creator.',
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
      personality: 'Futuristic AI researcher and digital streamer bridging human and synthetic thought.',
    },
  ];

  // Load characters with custom from localStorage
  // Key: auracraft_custom_chars (synced with App.tsx / StudioLeftPanel.tsx)
  useEffect(() => {
    try {
      const stored = localStorage.getItem('auracraft_custom_chars');
      if (stored) {
        const custom = JSON.parse(stored);
        setCharacters([...DEFAULT_PRESETS, ...custom]);
      } else {
        setCharacters(DEFAULT_PRESETS);
      }
    } catch {
      setCharacters(DEFAULT_PRESETS);
    }
  }, []);

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

    const stored = localStorage.getItem('auracraft_custom_chars');
    const existingCustom = stored ? JSON.parse(stored) : [];
    const updatedCustom = [newChar, ...existingCustom];
    localStorage.setItem('auracraft_custom_chars', JSON.stringify(updatedCustom));

    setCharacters([...DEFAULT_PRESETS, ...updatedCustom]);
    setShowAddModal(false);
    setNewName('');
    setNewRole('');
    setNewPersonality('');
  };

  const handleDeleteCharacter = (id: string) => {
    const stored = localStorage.getItem('auracraft_custom_chars');
    if (stored) {
      const existingCustom = JSON.parse(stored);
      const updated = existingCustom.filter((c: any) => c.id !== id);
      localStorage.setItem('auracraft_custom_chars', JSON.stringify(updated));
      setCharacters([...DEFAULT_PRESETS, ...updated]);
    }
  };

  const handleBulkExport = () => {
    try {
      const blob = new Blob([JSON.stringify(characters, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'all_auracraft_archetypes_pack.json';
      a.click();
      URL.revokeObjectURL(url);
      setBulkExported(true);
      setTimeout(() => setBulkExported(false), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  const handlePreviewVoice = (voiceId: string) => {
    setPlayingVoiceId(voiceId);
    const sampleText = voiceId.startsWith('my') 
      ? 'မင်္ဂလာပါ! ကျွန်တော်ကတော့ AuraCraft ရဲ့ AI အသံဖြစ်ပါတယ်ခင်ဗျာ။' 
      : voiceId.startsWith('ja') 
      ? 'こんにちは！オーラクラフトスタジオへようこそ！' 
      : 'Hello! Welcome to AuraCraft Studio Neural Engine.';

    const utterance = new SpeechSynthesisUtterance(sampleText);
    utterance.onend = () => setPlayingVoiceId(null);
    utterance.onerror = () => setPlayingVoiceId(null);
    window.speechSynthesis.speak(utterance);
  };

  const filteredCharacters = characters.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          c.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          c.personality.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStyle = selectedStyle === 'all' || c.style === selectedStyle;
    const matchesUsage = selectedUsage === 'all' || c.usage_target === selectedUsage;
    return matchesSearch && matchesStyle && matchesUsage;
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0a0d14] text-slate-100 overflow-y-auto p-6 space-y-6">
      {/* Top Banner & Action Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1f293d] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-600/20 border border-purple-500/40 rounded-xl text-purple-400">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                Character Casting & Archetypes Roster
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800/40">
                  {characters.length} Active Personas
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage, cast, and export 3D VRM & 2D personas categorized for Manga, OBS Streaming, Cognix AI, and Doka DMS.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs transition-all shadow-lg shadow-purple-600/25"
          >
            <Plus className="w-4 h-4" />
            Add New Character
          </button>

          <button
            onClick={handleBulkExport}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#111726] hover:bg-[#1a233a] border border-[#23314f] text-slate-200 font-semibold text-xs transition-all shadow-sm"
          >
            {bulkExported ? <Check className="w-4 h-4 text-emerald-400" /> : <Download className="w-4 h-4 text-cyan-400" />}
            Bulk Export Pack (.json)
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[#111726]/70 backdrop-blur-md border border-[#1f293d] p-4 rounded-2xl shadow-xl">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search characters by name, role, or story personality..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0a0d14] border border-[#23314f] rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
          />
        </div>

        {/* Style & Usage Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Style Filter */}
          <div className="flex items-center gap-1 bg-[#0a0d14] border border-[#23314f] rounded-xl p-1 text-xs">
            <span className="text-[11px] text-slate-400 px-2 font-medium">Style:</span>
            {[
              { id: 'all', label: 'All' },
              { id: 'realistic', label: '👤 Realistic' },
              { id: 'anime', label: '🌸 Anime' },
              { id: 'myanmar', label: '🇲🇲 Myanmar' },
              { id: 'army', label: '🎖️ Army' },
              { id: 'corporate', label: '💼 Corporate' },
              { id: 'streamer', label: '⚡ Streamer' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedStyle(tab.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  selectedStyle === tab.id
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Usage Target Filter */}
          <div className="flex items-center gap-1 bg-[#0a0d14] border border-[#23314f] rounded-xl p-1 text-xs">
            <span className="text-[11px] text-slate-400 px-2 font-medium">Target:</span>
            {[
              { id: 'all', label: 'All' },
              { id: 'narrativ_manga', label: '🎬 Manga' },
              { id: 'obs_stream', label: '🎙️ OBS' },
              { id: 'cognix_research', label: '📚 Cognix' },
              { id: 'doka_enterprise', label: '💼 Doka' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedUsage(tab.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  selectedUsage === tab.id
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Character Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredCharacters.map((char) => (
          <div
            key={char.id}
            className="group relative bg-[#111726]/80 hover:bg-[#141b2d] border border-[#1f293d] hover:border-purple-500/50 rounded-2xl p-4 transition-all duration-200 shadow-lg hover:shadow-purple-500/10 flex flex-col justify-between"
          >
            <div>
              {/* Card Header & Badges */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3.5 h-3.5 rounded-full ring-2 ring-white/10 flex-shrink-0"
                    style={{ backgroundColor: char.color }}
                  />
                  <div>
                    <h3 className="text-sm font-bold text-slate-100 group-hover:text-purple-300 transition-colors">
                      {char.name}
                    </h3>
                    <p className="text-[11px] text-slate-400 line-clamp-1">{char.role}</p>
                  </div>
                </div>

                <span
                  className="text-[10px] px-2 py-0.5 rounded-full font-semibold border flex-shrink-0"
                  style={{
                    color: char.color,
                    borderColor: `${char.color}50`,
                    backgroundColor: `${char.color}15`,
                  }}
                >
                  {char.badge}
                </span>
              </div>

              {/* Personality Description */}
              <p className="text-xs text-slate-300/80 leading-relaxed bg-[#0a0d14]/60 p-2.5 rounded-xl border border-[#1f293d]/80 mb-3 min-h-[48px] line-clamp-2">
                "{char.personality}"
              </p>

              {/* Meta Tags */}
              <div className="grid grid-cols-2 gap-2 text-[10px] mb-3">
                <div className="bg-[#0a0d14] px-2 py-1.5 rounded-lg border border-[#1f293d] flex items-center justify-between">
                  <span className="text-slate-400">Target</span>
                  <span className="font-semibold text-cyan-400">
                    {char.usage_target === 'narrativ_manga' ? '🎬 Manga Studio' : 
                     char.usage_target === 'obs_stream' ? '🎙️ OBS Stream' : 
                     char.usage_target === 'cognix_research' ? '📚 Cognix Nexus' : '💼 Doka DMS'}
                  </span>
                </div>

                <div className="bg-[#0a0d14] px-2 py-1.5 rounded-lg border border-[#1f293d] flex items-center justify-between">
                  <span className="text-slate-400">Avatar Format</span>
                  <span className="font-semibold text-emerald-400">
                    {char.avatar_type === 'vrm_3d' ? '3D VRM Human' : '2D Portrait'}
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-3 border-t border-[#1f293d] flex items-center justify-between gap-2">
              <button
                onClick={() => handlePreviewVoice(char.voice_id)}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-[#0a0d14] hover:bg-slate-800 border border-[#23314f] rounded-lg text-[11px] text-slate-300 transition-colors"
                title="Preview voice sample"
              >
                <Volume2 className="w-3.5 h-3.5 text-purple-400" />
                <span>{playingVoiceId === char.voice_id ? 'Speaking...' : 'Voice Sample'}</span>
              </button>

              <div className="flex items-center gap-1.5">
                {char.id.startsWith('custom_') && (
                  <button
                    onClick={() => handleDeleteCharacter(char.id)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors"
                    title="Delete custom character"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}

                <button
                  onClick={() => {
                    onCastToStage(char);
                    onNavigateToStage();
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md transition-all"
                >
                  <span>Cast to Stage</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Custom Character Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#111726] border border-[#23314f] rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#23314f] pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-bold text-white">Create New Character Archetype</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white px-2 py-1 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCustomCharacter} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Character Name (ဇာတ်ကောင်အမည်)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Captain Thant (ဗိုလ်မှူးသန့်)"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-[#0a0d14] border border-[#23314f] rounded-xl px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Role & Title (အခန်းကဏ္ဍ)</label>
                <input
                  type="text"
                  placeholder="e.g. Lead Orbital Explorer & Tactician"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full bg-[#0a0d14] border border-[#23314f] rounded-xl px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Style Category</label>
                  <select
                    value={newStyle}
                    onChange={(e) => setNewStyle(e.target.value as any)}
                    className="w-full bg-[#0a0d14] border border-[#23314f] rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-purple-500"
                  >
                    <option value="realistic">👤 Realistic Human (လူရုပ်စစ်စစ်)</option>
                    <option value="anime">🌸 Anime 3D</option>
                    <option value="myanmar">🇲🇲 Myanmar Traditional</option>
                    <option value="army">🎖️ Military / Tactical</option>
                    <option value="corporate">💼 Corporate / News</option>
                    <option value="streamer">⚡ VTuber / Streamer</option>
                    <option value="custom">✨ Custom</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Usage Destination</label>
                  <select
                    value={newUsage}
                    onChange={(e) => setNewUsage(e.target.value as any)}
                    className="w-full bg-[#0a0d14] border border-[#23314f] rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-purple-500"
                  >
                    <option value="narrativ_manga">🎬 Narrativ Forge Manga</option>
                    <option value="obs_stream">🎙️ OBS / Live Streaming</option>
                    <option value="cognix_research">📚 Cognix Nexus AI</option>
                    <option value="doka_enterprise">💼 Doka Enterprise DMS</option>
                    <option value="general">🌐 General Ecosystem</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Avatar Format</label>
                  <select
                    value={newAvatarType}
                    onChange={(e) => setNewAvatarType(e.target.value as any)}
                    className="w-full bg-[#0a0d14] border border-[#23314f] rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-purple-500"
                  >
                    <option value="vrm_3d">3D VRM Humanoid</option>
                    <option value="image_2d">2D Portrait Photo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Neural Voice</label>
                  <select
                    value={newVoice}
                    onChange={(e) => setNewVoice(e.target.value)}
                    className="w-full bg-[#0a0d14] border border-[#23314f] rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-purple-500"
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
                <label className="block text-slate-300 font-semibold mb-1">Personality / Story Bio</label>
                <textarea
                  rows={3}
                  placeholder="Describe character personality, backstory, and behavioral traits..."
                  value={newPersonality}
                  onChange={(e) => setNewPersonality(e.target.value)}
                  className="w-full bg-[#0a0d14] border border-[#23314f] rounded-xl px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#23314f]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-purple-600/30"
                >
                  Save Character to Roster
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
