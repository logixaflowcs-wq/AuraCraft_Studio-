import React, { useState, useEffect } from 'react';
import { Viewport3D } from './components/Viewport3D';
import { LivePhotoStage } from './components/LivePhotoStage';
import { StudioLeftPanel, type StudioCharacter } from './components/StudioLeftPanel';
import { EmotionPalette } from './components/EmotionPalette';
import { VoiceSelector } from './components/VoiceSelector';
import { CharacterCasting, type CharacterArchetype } from './components/CharacterCasting';
import { OBSStreamOverlay } from './components/OBSStreamOverlay';
import { AuraCraftLogo } from './components/AuraCraftLogo';
import { ApiUsageCard } from './components/ApiUsageCard';
import { CharactersPage } from './pages/CharactersPage';
import { VoiceLabPage } from './pages/VoiceLabPage';
import { VideoStudioPage } from './pages/VideoStudioPage';
import { BroadcastPage } from './pages/BroadcastPage';
import { SettingsPage } from './pages/SettingsPage';
import { PhotoAvatarPage } from './pages/PhotoAvatarPage';
import { ImageToCharPage } from './pages/ImageToCharPage';
import { 
  Radio, Sparkles, Layers, Volume2, Clapperboard, Tv, Settings, 
  UserCheck, ShieldCheck, ExternalLink, RefreshCw, Camera, Wand2, Globe, Mic, MicOff
} from 'lucide-react';
import { lipSync } from './audio/lipSyncAnalyzer';
import { translations, type Language } from './utils/i18n';

type NavTab = 'studio' | 'characters' | 'voices' | 'video' | 'broadcast' | 'photo' | 'img2char' | 'settings';

export default function App() {
  const [lang, setLang] = useState<Language>('en');
  const t = translations[lang] || translations.en;

  const [activeTab, setActiveTab] = useState<NavTab>('studio');
  const [stageMode, setStageMode] = useState<'photo' | '3d'>('photo');
  const [photoAvatarUrl, setPhotoAvatarUrl] = useState<string>('/avatars/blue_hair_girl.jpg');
  const [photoAvatarName, setPhotoAvatarName] = useState<string>('Aoi (Blue Hair Kimono)');
  const [currentEmotion, setCurrentEmotion] = useState('neutral');
  const [currentVoice, setCurrentVoice] = useState('ja-JP-NanamiNeural');
  const [currentActorName, setCurrentActorName] = useState('Aoi (Blue Hair Kimono)');
  const [currentModelUrl, setCurrentModelUrl] = useState<string>('/models/avatar_female_a.vrm');
  const [currentModelName, setCurrentModelName] = useState<string>('Sakura Hoshino (3D Idol)');
  const [bgMode, setBgMode] = useState<'cyber' | 'greenscreen' | 'transparent'>('cyber');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isOBSMode, setIsOBSMode] = useState(false);
  const [isMicActive, setIsMicActive] = useState(false);

  const toggleMic = async () => {
    if (isMicActive) {
      lipSync.stopMic();
      setIsMicActive(false);
    } else {
      const ok = await lipSync.initMic();
      if (ok) {
        setIsMicActive(true);
      }
    }
  };

  useEffect(() => {
    return () => {
      lipSync.stopMic();
    };
  }, []);

  // Custom Characters and Deleted Preset Character Tracking
  const [customCharacters, setCustomCharacters] = useState<StudioCharacter[]>(() => {
    try {
      const saved = localStorage.getItem('auracraft_custom_chars');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [deletedCharacterIds, setDeletedCharacterIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('auracraft_deleted_chars');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const handleUploadCustomPhoto = (file: File) => {
    const url = URL.createObjectURL(file);
    const cleanName = file.name.replace(/\.[^/.]+$/, '');
    const newChar: StudioCharacter = {
      id: `custom_photo_${Date.now()}`,
      name: cleanName,
      role: 'Custom Uploaded Photo',
      category: 'photo',
      avatarMode: 'photo',
      url,
      avatarThumb: url,
      badge: '📸 Custom',
      defaultVoice: currentVoice,
      defaultEmotion: 'neutral',
      isCustom: true,
    };
    const updated = [newChar, ...customCharacters];
    setCustomCharacters(updated);
    try {
      localStorage.setItem('auracraft_custom_chars', JSON.stringify(updated.slice(0, 10)));
    } catch {}

    setStageMode('photo');
    setPhotoAvatarUrl(url);
    setPhotoAvatarName(cleanName);
    setCurrentActorName(cleanName);
  };

  const handleUploadCustomVRM = (file: File) => {
    const url = URL.createObjectURL(file);
    const cleanName = file.name.replace(/\.[^/.]+$/, '');
    const newChar: StudioCharacter = {
      id: `custom_vrm_${Date.now()}`,
      name: cleanName,
      role: 'Custom 3D Model',
      category: 'realistic',
      avatarMode: '3d',
      url,
      avatarThumb: url,
      badge: '🌐 Custom 3D',
      defaultVoice: currentVoice,
      defaultEmotion: 'neutral',
      isCustom: true,
    };
    const updated = [newChar, ...customCharacters];
    setCustomCharacters(updated);
    setStageMode('3d');
    setCurrentModelUrl(url);
    setCurrentModelName(cleanName);
    setCurrentActorName(cleanName);
  };

  const handleImportRPMUrl = (url: string) => {
    const newChar: StudioCharacter = {
      id: `custom_rpm_${Date.now()}`,
      name: 'Ready Player Me 3D',
      role: 'RPM 3D Avatar',
      category: 'realistic',
      avatarMode: '3d',
      url,
      avatarThumb: url,
      badge: '🌐 RPM 3D',
      defaultVoice: currentVoice,
      defaultEmotion: 'neutral',
      isCustom: true,
    };
    const updated = [newChar, ...customCharacters];
    setCustomCharacters(updated);
    setStageMode('3d');
    setCurrentModelUrl(url);
    setCurrentModelName('Ready Player Me 3D');
    setCurrentActorName('Ready Player Me 3D');
  };

  const handleDeleteCharacter = (id: string) => {
    const isCustom = customCharacters.some(c => c.id === id);
    if (isCustom) {
      const nextCustom = customCharacters.filter(c => c.id !== id);
      setCustomCharacters(nextCustom);
      try {
        localStorage.setItem('auracraft_custom_chars', JSON.stringify(nextCustom));
      } catch {}
    } else {
      const nextDeleted = [...deletedCharacterIds, id];
      setDeletedCharacterIds(nextDeleted);
      try {
        localStorage.setItem('auracraft_deleted_chars', JSON.stringify(nextDeleted));
      } catch {}
    }

    // Reset to high quality defaults
    if (stageMode === 'photo') {
      setPhotoAvatarUrl('/avatars/blue_hair_girl.jpg');
      setPhotoAvatarName('Aoi (Blue Hair Kimono)');
      setCurrentActorName('Aoi (Blue Hair Kimono)');
      setCurrentVoice('ja-JP-NanamiNeural');
    } else {
      setCurrentModelUrl('/models/avatar_female_a.vrm');
      setCurrentModelName('Sakura Hoshino (3D Idol)');
      setCurrentActorName('Sakura Hoshino (3D Idol)');
    }
  };

  const handleResetAllPresets = () => {
    setDeletedCharacterIds([]);
    try {
      localStorage.removeItem('auracraft_deleted_chars');
    } catch {}
  };

  const handleResetPhoto = () => {
    setPhotoAvatarUrl('/avatars/blue_hair_girl.jpg');
    setPhotoAvatarName('Aoi (Blue Hair Kimono)');
    setCurrentActorName('Aoi (Blue Hair Kimono)');
    setCurrentVoice('ja-JP-NanamiNeural');
    setCurrentEmotion('neutral');
  };

  // Check URL query param ?obs=true for clean streaming overlay
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('obs') === 'true') {
      setIsOBSMode(true);
      setBgMode('transparent');
    }
  }, []);

  if (isOBSMode) {
    // Ultra-clean OBS Studio Viewport with floating exit button
    return (
      <div className="relative w-screen h-screen overflow-hidden bg-transparent">
        <button
          onClick={() => {
            setIsOBSMode(false);
            setBgMode('cyber');
          }}
          className="absolute top-3 right-3 z-50 bg-[#111726]/90 hover:bg-[#1f293d] border border-cyan-500/50 text-cyan-300 px-3 py-1.5 rounded-xl text-xs font-bold shadow-2xl flex items-center gap-1.5 transition-all"
        >
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>Exit OBS Clean View</span>
        </button>

        {stageMode === 'photo' ? (
          <LivePhotoStage
            currentEmotion={currentEmotion}
            bgMode={bgMode}
            isSpeaking={isSpeaking}
            activeCharacterUrl={photoAvatarUrl}
            activeCharacterName={photoAvatarName}
            lang={lang}
          />
        ) : (
          <Viewport3D
            currentEmotion={currentEmotion}
            bgMode={bgMode}
            isSpeaking={isSpeaking}
            currentModelUrl={currentModelUrl}
            currentModelName={currentModelName}
            lang={lang}
          />
        )}
      </div>
    );
  }

  const handleCastCharacter = (char: CharacterArchetype) => {
    setCurrentActorName(char.name);
    setCurrentVoice(char.voice_id);
    setCurrentEmotion(char.default_emotion);

    if (char.id.includes('photo') || char.id.includes('blue_kimono') || char.id.includes('blonde')) {
      setStageMode('photo');
      if (char.id.includes('blonde')) {
        setPhotoAvatarUrl('/avatars/blonde_cosplay_girl.jpg');
        setPhotoAvatarName('Elena (Blonde Cosplay)');
      } else {
        setPhotoAvatarUrl('/avatars/blue_hair_girl.jpg');
        setPhotoAvatarName(char.name);
      }
    } else {
      setStageMode('3d');
      if (char.id.includes('sakura') || (char.style === 'anime' && (char.name.includes('サクラ') || char.name.includes('Sakura')))) {
        setCurrentModelUrl('/models/avatar_female_a.vrm');
        setCurrentModelName('🌸 Sakura (Anime Idol)');
      } else if (char.id.includes('shinji')) {
        setCurrentModelUrl('/models/avatar_female_c.vrm');
        setCurrentModelName('⚡ Shinji Kazama (Mecha Pilot)');
      } else {
        setCurrentModelUrl('/avatar_human.vrm');
        setCurrentModelName(char.name);
      }
    }
  };

  const navItems = [
    { id: 'studio', label: t.studio, icon: Sparkles },
    { id: 'characters', label: t.characters, icon: Layers },
    { id: 'voices', label: t.voices, icon: Volume2 },
    { id: 'video', label: t.video, icon: Clapperboard },
    { id: 'broadcast', label: t.broadcast, icon: Tv },
    { id: 'photo', label: t.photoAvatar, icon: Camera },
    { id: 'img2char', label: t.img2char, icon: Wand2 },
    { id: 'settings', label: t.settings, icon: Settings },
  ];

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0a0d14] text-slate-100 overflow-hidden font-sans">
      {/* Top Global Navigation Bar */}
      <header className="h-14 bg-[#0d121f]/95 backdrop-blur-md border-b border-[#1f293d] px-4 flex items-center justify-between z-40 flex-shrink-0 shadow-lg">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-3">
          <div 
            onClick={() => setActiveTab('studio')}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <AuraCraftLogo size={28} />
            <div>
              <div className="text-xs font-bold text-slate-100 tracking-wide flex items-center gap-1.5 group-hover:text-purple-300 transition-colors">
                AuraCraft Studio
                <span className="text-[9px] bg-gradient-to-r from-purple-900 to-indigo-900 text-purple-300 border border-purple-700/50 px-1.5 py-0.2 rounded uppercase font-semibold">
                  AI Persona Suite
                </span>
              </div>
              <div className="text-[10px] text-slate-400">The Nexus Hub Ecosystem</div>
            </div>
          </div>
        </div>

        {/* Center Page Nav Tabs */}
        <nav className="flex items-center gap-1 bg-[#0a0d14] border border-[#23314f] p-1 rounded-xl shadow-inner text-xs">
          {navItems.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as NavTab)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold shadow-md shadow-purple-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right Controls: Language Switcher, Speaking badge, Port badge */}
        <div className="flex items-center gap-2.5">
          {/* EN / MM Language Toggle Button */}
          <button
            onClick={() => setLang(lang === 'en' ? 'my' : 'en')}
            className="flex items-center gap-1.5 bg-[#111726] hover:bg-[#1c263d] border border-[#23314f] hover:border-cyan-500/50 px-2.5 py-1 rounded-xl text-xs font-bold text-cyan-300 transition-all shadow-sm"
            title="Switch Language / ဘာသာစကားပြောင်းရန်"
          >
            <Globe className="w-3.5 h-3.5 text-cyan-400" />
            <span>{lang === 'en' ? '🇬🇧 EN' : '🇲🇲 MM'}</span>
          </button>

          {/* Real-time Microphone Input for Live Streamers & VTubers */}
          <button
            onClick={toggleMic}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold transition-all shadow-sm ${
              isMicActive
                ? 'bg-rose-600/30 border border-rose-500 text-rose-300 animate-pulse shadow-[0_0_12px_rgba(244,63,94,0.3)]'
                : 'bg-[#111726] hover:bg-[#1c263d] border border-[#23314f] text-slate-300 hover:text-white'
            }`}
            title={isMicActive ? t.micActive : t.liveMic}
          >
            {isMicActive ? <Mic className="w-3.5 h-3.5 text-rose-400" /> : <MicOff className="w-3.5 h-3.5 text-slate-400" />}
            <span>{isMicActive ? (lang === 'en' ? 'Mic Active' : 'မိုက် ဖွင့်ထား') : (lang === 'en' ? 'Live Mic' : 'မိုက်ဖွင့်')}</span>
          </button>

          {isSpeaking && (
            <div className="flex items-center gap-1.5 bg-rose-500/20 border border-rose-500/60 px-2.5 py-1 rounded-full text-rose-300 text-xs font-semibold animate-pulse shadow-[0_0_12px_rgba(244,63,94,0.3)]">
              <Radio className="w-3.5 h-3.5" />
              <span>{t.speaking}</span>
            </div>
          )}

          <div className="flex items-center gap-1.5 bg-[#111726] border border-[#23314f] px-2.5 py-1 rounded-xl text-xs text-slate-300 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-[11px] font-medium text-emerald-400">{t.online}</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative flex">
        {/* TAB 1: PRODUCTION 3-PANEL STUDIO STAGE */}
        {activeTab === 'studio' && (
          <div className="flex-1 flex h-full w-full overflow-hidden">
            {/* 1. LEFT PANEL: Tool Shelf & Character Presets Roster */}
            <StudioLeftPanel
              stageMode={stageMode}
              currentActorName={currentActorName}
              lang={lang}
              customCharacters={customCharacters}
              deletedCharacterIds={deletedCharacterIds}
              onSelectStageMode={(mode) => setStageMode(mode)}
              onSelectCharacter={(char) => {
                setCurrentActorName(char.name);
                setCurrentVoice(char.defaultVoice);
                setCurrentEmotion(char.defaultEmotion);
                if (char.avatarMode === 'photo') {
                  setStageMode('photo');
                  setPhotoAvatarUrl(char.url);
                  setPhotoAvatarName(char.name);
                } else {
                  setStageMode('3d');
                  setCurrentModelUrl(char.url);
                  setCurrentModelName(char.name);
                }
              }}
              onUploadCustomPhoto={handleUploadCustomPhoto}
              onUploadCustomVRM={handleUploadCustomVRM}
              onImportRPMUrl={handleImportRPMUrl}
              onDeleteCharacter={handleDeleteCharacter}
              onResetAllPresets={handleResetAllPresets}
            />

            {/* 2. CENTER STAGE: The Hero Viewport (Photo or 3D) */}
            <div className="flex-1 flex flex-col relative h-full bg-[#0a0d14] overflow-hidden">
              <div className="w-full h-full">
                {stageMode === 'photo' ? (
                  <LivePhotoStage
                    currentEmotion={currentEmotion}
                    bgMode={bgMode}
                    isSpeaking={isSpeaking}
                    activeCharacterUrl={photoAvatarUrl}
                    activeCharacterName={photoAvatarName}
                    lang={lang}
                    onSelectCharacter={(char) => {
                      setPhotoAvatarUrl(char.url);
                      setPhotoAvatarName(char.name);
                      setCurrentActorName(char.name);
                      setCurrentVoice(char.defaultVoice);
                      setCurrentEmotion(char.defaultEmotion);
                    }}
                    onUploadCustomPhoto={handleUploadCustomPhoto}
                    onResetPhoto={handleResetPhoto}
                  />
                ) : (
                  <Viewport3D
                    currentEmotion={currentEmotion}
                    bgMode={bgMode}
                    isSpeaking={isSpeaking}
                    currentModelUrl={currentModelUrl}
                    currentModelName={currentModelName}
                    lang={lang}
                    onModelChange={(url, name) => {
                      setCurrentModelUrl(url);
                      setCurrentModelName(name);
                      setCurrentActorName(name);
                    }}
                  />
                )}
              </div>

              {/* Bottom Stage Status Badge */}
              <footer className="absolute bottom-3 left-4 right-4 z-20 flex items-center justify-between text-[11px] text-slate-400 pointer-events-none">
                <div className="bg-[#111726]/90 backdrop-blur-md border border-[#1f293d] px-3.5 py-1.5 rounded-xl pointer-events-auto shadow-lg flex items-center gap-2">
                  <span>{t.actor}: </span>
                  <span className="text-cyan-400 font-semibold">{currentActorName}</span>
                  <span className="text-slate-600">|</span>
                  <span>{t.voice}: </span>
                  <span className="text-purple-400 font-medium">{currentVoice}</span>
                  <span className="text-slate-600">|</span>
                  <span>{t.emotion}: </span>
                  <span className="text-amber-400 font-medium uppercase">{currentEmotion}</span>
                </div>

                <div className="bg-[#111726]/90 backdrop-blur-md border border-[#1f293d] px-3.5 py-1.5 rounded-xl pointer-events-auto text-[10px] text-slate-400 shadow-lg">
                  {stageMode === 'photo' ? t.photoBadge : t.threeDBadge}
                </div>
              </footer>
            </div>

            {/* 3. RIGHT SIDEBAR: Speech Synthesis Engine, Emotions, API Monitor, Stream Settings */}
            <aside className="w-84 border-l border-[#1f293d] bg-[#0c101c]/95 flex flex-col p-3 gap-3 overflow-y-auto z-30 shadow-2xl flex-shrink-0">
              <VoiceSelector
                currentVoice={currentVoice}
                lang={lang}
                onSelectVoice={setCurrentVoice}
                onSpeakingStateChange={setIsSpeaking}
              />

              <EmotionPalette
                currentEmotion={currentEmotion}
                onSelectEmotion={setCurrentEmotion}
              />

              <ApiUsageCard
                isSpeaking={isSpeaking}
                stageMode={stageMode}
                lang={lang}
              />

              <OBSStreamOverlay
                bgMode={bgMode}
                onSelectBgMode={setBgMode}
                isOBSMode={isOBSMode}
                onToggleOBSMode={() => setIsOBSMode(!isOBSMode)}
              />
            </aside>
          </div>
        )}

        {/* TAB 2: CHARACTERS PAGE */}
        {activeTab === 'characters' && (
          <CharactersPage
            onCastToStage={handleCastCharacter}
            onNavigateToStage={() => setActiveTab('studio')}
          />
        )}

        {/* TAB 3: VOICE LAB PAGE */}
        {activeTab === 'voices' && <VoiceLabPage />}

        {/* TAB 4: VIDEO STUDIO PAGE */}
        {activeTab === 'video' && <VideoStudioPage />}

        {/* TAB 5: OBS BROADCAST PAGE */}
        {activeTab === 'broadcast' && <BroadcastPage />}

        {/* TAB 6: PHOTO AVATAR PAGE */}
        {activeTab === 'photo' && <PhotoAvatarPage />}

        {/* TAB 7: IMAGE → CHARACTER PAGE */}
        {activeTab === 'img2char' && (
          <ImageToCharPage
            onCastTo3DStage={(modelUrl, modelName, actorName, voice) => {
              setCurrentModelUrl(modelUrl);
              setCurrentModelName(modelName);
              if (actorName) setCurrentActorName(actorName);
              if (voice) setCurrentVoice(voice);
              setStageMode('3d');
              setActiveTab('studio');
            }}
            onSetExactPhotoAsStageAvatar={(url, name) => {
              setPhotoAvatarUrl(url);
              setPhotoAvatarName(name);
              setCurrentActorName(name);
              setStageMode('photo');
              setActiveTab('studio');
            }}
          />
        )}

        {/* TAB 8: SETTINGS PAGE */}
        {activeTab === 'settings' && <SettingsPage />}
      </main>
    </div>
  );
}
