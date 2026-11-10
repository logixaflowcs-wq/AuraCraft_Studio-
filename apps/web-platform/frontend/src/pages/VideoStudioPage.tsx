import React, { useState, useEffect } from 'react';
import { Clapperboard, Video, Plus, Trash2, Download, Check, Sparkles, Smartphone, Monitor, Clock, Play, Loader2 } from 'lucide-react';
import { API_ENDPOINTS } from '../config/api';
import { createSceneId } from './videoStudioUtils';

export const VideoStudioPage: React.FC = () => {
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9'>('9:16');
  const [characterName, setCharacterName] = useState('Shinji Kazama (シンジ)');
  const [selectedCharacterId, setSelectedCharacterId] = useState('char_anime_shinji');
  const [availableCharacters, setAvailableCharacters] = useState<Array<{ id: string; name: string; voice_id?: string }>>([]);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [voiceId, setVoiceId] = useState('my-MM-NilarNeural');
  const [durationPerScene, setDurationPerScene] = useState(6);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [scenes, setScenes] = useState<Array<{ id: string; title: string; script: string; emotion: string; camera: string }>>([
    {
      id: 'scene-1',
      title: 'Scene 1: Introduction (မိတ်ဆက်)',
      script: 'မင်္ဂလာပါ! ကျွန်တော်တို့ AuraCraft Studio ရဲ့ 3D Persona စနစ်သစ်ကို ကြည့်ရှုဖို့ ကြိုဆိုပါတယ်။',
      emotion: 'happy',
      camera: 'bust',
    },
    {
      id: 'scene-2',
      title: 'Scene 2: Core Briefing (အဓိကအချက်)',
      script: 'ဒီစနစ်က 3D VRM Humanoid အနေနဲ့ရော၊ 2D Portrait အနေနဲ့ပါ မြန်မာလို အသံထွက်ပြီး မျက်နှာ အမူအရာတွေနဲ့ စကားပြောနိုင်ပါတယ်။',
      emotion: 'neutral',
      camera: 'full',
    },
    {
      id: 'scene-3',
      title: 'Scene 3: Conclusion (နိဂုံးချုပ်)',
      script: 'Manga Script တွေ၊ OBS Live တွေအတွက် အချိန်မရွေး သွင်းယူပြီး အသုံးပြုနိုင်ပါပြီခင်ဗျာ။',
      emotion: 'surprised',
      camera: 'face',
    },
  ]);

  const [generatedPlan, setGeneratedPlan] = useState<any | null>(null);
  const [exported, setExported] = useState(false);

  useEffect(() => {
    // FIX(audit-3-D): populate casting IDs from the backend rather than hardcoding a request ID.
    fetch(API_ENDPOINTS.characters).then(async (response) => {
      if (!response.ok) throw new Error('Character list unavailable');
      const records = await response.json();
      if (Array.isArray(records) && records.length) {
        setAvailableCharacters(records);
        const selected = records.find((item) => item.id === selectedCharacterId) || records[0];
        setSelectedCharacterId(selected.id);
        setCharacterName(selected.name);
      }
    }).catch(() => setGenerationError('Character list could not be loaded; check backend availability.'));
  }, []);

  const addScene = () => {
    const newId = createSceneId();
    setScenes((current) => [
      ...current,
      {
        id: newId,
        title: 'Scene ' + (current.length + 1) + ': Custom Chapter',
        script: 'နောက်ထပ် ဇာတ်ကွက် စာသားကို ဤနေရာတွင် ရေးသားနိုင်ပါသည်။',
        emotion: 'neutral',
        camera: 'bust',
      },
    ]);
  };

  const removeScene = (id: string) => {
    if (scenes.length <= 1) return;
    setScenes((current) => current.filter((s) => s.id !== id));
  };

  const updateScene = (id: string, field: string, val: any) => {
    setScenes((current) => current.map((s) => (s.id === id ? { ...s, [field]: val } : s)));
  };

  const totalEstimatedSeconds = scenes.length * durationPerScene;

  const handleGenerateManifest = async () => {
    setIsGeneratingPlan(true);
    setGenerationError(null);
    setGeneratedPlan(null);
    const localManifest = {
      project: 'AuraCraft Studio - Video Render Plan',
      version: '1.0.0',
      aspect_ratio: aspectRatio,
      character: characterName,
      character_id: selectedCharacterId,
      voice_id: voiceId,
      total_scenes: scenes.length,
      estimated_duration_seconds: totalEstimatedSeconds,
      timeline: scenes.map((s, idx) => ({
        scene_index: idx + 1,
        title: s.title,
        script: s.script,
        emotion: s.emotion,
        camera_preset: s.camera,
        duration_seconds: durationPerScene,
      })),
      target_destinations: ['Narrativ Forge Manga Studio', 'OBS Stream Video Player'],
    };

    try {
      const scriptText = scenes.map((s) => s.script).join('\n');
      const res = await fetch(API_ENDPOINTS.renderPlan, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character_id: selectedCharacterId,
          voice_id: voiceId,
          script: scriptText,
          aspect_ratio: aspectRatio,
          seconds_per_scene: durationPerScene,
        }),
      });
      if (!res.ok) throw new Error('Backend rejected the render plan (' + res.status + ').');
      const plan = await res.json();
      setGeneratedPlan({ ...localManifest, server_plan: plan });
    } catch (error) {
      // FIX(audit-3-D): never present a local-only draft as a successful backend render plan.
      setGeneratedPlan(null);
      setGenerationError(error instanceof Error ? error.message : 'Render plan generation failed.');
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const handleDownloadManifest = () => {
    if (!generatedPlan) return;
    const blob = new Blob([JSON.stringify(generatedPlan, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `video_plan_${aspectRatio.replace(':', '_')}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExported(true);
    setTimeout(() => setExported(false), 3000);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0a0d14] text-slate-100 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="border-b border-[#1f293d] pb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-purple-600/20 border border-purple-500/40 rounded-xl text-purple-400">
            <Clapperboard className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              Video Studio & Render Planner (ဗီဒီယိုဖန်တီးခန်း)
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800/40">
                Timeline Director
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Draft script-to-avatar storyboard video manifests and multi-scene sequences for Narrativ Forge & Social Media.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-[#111726] border border-[#23314f] p-1 rounded-xl text-xs">
            <button
              onClick={() => setAspectRatio('9:16')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                aspectRatio === '9:16'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              9:16 Vertical (Shorts/Reels)
            </button>
            <button
              onClick={() => setAspectRatio('16:9')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                aspectRatio === '16:9'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              16:9 Landscape (YouTube)
            </button>
          </div>
        </div>
      </div>

      {/* Grid: Scene Timeline & Manifest Export */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Scenes List (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Video className="w-4 h-4 text-cyan-400" />
              Storyboard Timeline ({scenes.length} Scenes &bull; ~{totalEstimatedSeconds}s Total)
            </h2>

            <button
              onClick={addScene}
              className="flex items-center gap-1 px-3 py-1 bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 rounded-xl text-xs font-semibold transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Scene
            </button>
          </div>

          <div className="space-y-3">
            {scenes.map((s, idx) => (
              <div
                key={s.id}
                className="bg-[#111726]/80 backdrop-blur-md border border-[#1f293d] rounded-2xl p-4 space-y-3 shadow-lg"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-300 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-lg bg-purple-900/60 border border-purple-700/50 flex items-center justify-center text-[11px] text-white">
                      {idx + 1}
                    </span>
                    {s.title}
                  </span>

                  <div className="flex items-center gap-2">
                    <select
                      value={s.camera}
                      onChange={(e) => updateScene(s.id, 'camera', e.target.value)}
                      className="bg-[#0a0d14] border border-[#23314f] text-[11px] text-cyan-300 rounded-lg px-2 py-1"
                    >
                      <option value="bust">👔 Camera: Bust</option>
                      <option value="face">👤 Camera: Face</option>
                      <option value="full">🧍 Camera: Full Body</option>
                    </select>

                    <select
                      value={s.emotion}
                      onChange={(e) => updateScene(s.id, 'emotion', e.target.value)}
                      className="bg-[#0a0d14] border border-[#23314f] text-[11px] text-amber-300 rounded-lg px-2 py-1"
                    >
                      <option value="neutral">Neutral</option>
                      <option value="happy">Happy</option>
                      <option value="angry">Angry</option>
                      <option value="sad">Sad</option>
                      <option value="surprised">Surprised</option>
                    </select>

                    {scenes.length > 1 && (
                      <button
                        onClick={() => removeScene(s.id)}
                        className="text-slate-500 hover:text-rose-400 p-1 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <textarea
                  rows={2}
                  value={s.script}
                  onChange={(e) => updateScene(s.id, 'script', e.target.value)}
                  placeholder="Type dialogue for this scene..."
                  className="w-full bg-[#0a0d14] border border-[#23314f] rounded-xl p-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Right: Render Plan Output (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-[#111726]/80 backdrop-blur-md border border-[#1f293d] p-5 rounded-2xl shadow-xl space-y-4">
            <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-purple-400" />
              Render Plan Configuration
            </h2>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Casting Actor</label>
                <select
                  value={selectedCharacterId}
                  onChange={(e) => {
                    const selected = availableCharacters.find((item) => item.id === e.target.value);
                    setSelectedCharacterId(e.target.value);
                    if (selected) setCharacterName(selected.name);
                  }}
                  className="w-full bg-[#0a0d14] border border-[#23314f] rounded-xl px-3 py-2 text-slate-100 text-xs"
                >
                  {availableCharacters.map((character) => (
                    <option key={character.id} value={character.id}>{character.name}</option>
                  ))}
                  {!availableCharacters.length && <option value={selectedCharacterId}>{characterName}</option>}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Seconds Per Scene</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="3"
                    max="15"
                    step="1"
                    value={durationPerScene}
                    onChange={(e) => setDurationPerScene(parseInt(e.target.value))}
                    className="flex-1 accent-purple-500"
                  />
                  <span className="font-mono text-purple-300 font-bold w-12">{durationPerScene}s</span>
                </div>
              </div>
            </div>

            {generationError && <p role="alert" className="text-xs text-rose-300">{generationError}</p>}
            <div className="pt-3 border-t border-[#1f293d] flex gap-2">
              <button
                onClick={handleGenerateManifest}
                disabled={isGeneratingPlan}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-600/25 transition-all text-center flex items-center justify-center gap-1.5"
              >
                {isGeneratingPlan ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Creating Plan...</span>
                  </>
                ) : (
                  <span>Generate Plan Manifest</span>
                )}
              </button>
            </div>
          </div>

          {/* Manifest JSON Preview */}
          {generatedPlan && (
            <div className="bg-[#0a0d14] border border-[#23314f] rounded-2xl p-4 space-y-3 shadow-xl">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-emerald-400 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Manifest Ready
                </span>

                <button
                  onClick={handleDownloadManifest}
                  className="flex items-center gap-1 px-3 py-1 bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 border border-cyan-500/40 rounded-lg text-xs font-semibold transition-all"
                >
                  {exported ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Download className="w-3.5 h-3.5" />}
                  Download Manifest (.json)
                </button>
              </div>

              <pre className="text-[10px] text-slate-300 bg-[#111726]/60 p-3 rounded-xl overflow-x-auto max-h-48 border border-[#1f293d] font-mono leading-relaxed">
                {JSON.stringify(generatedPlan, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
