import React, { useState } from 'react';
import { Volume2, Play, Download, Mic, Radio, Sparkles, Sliders, RefreshCw, CheckCircle2 } from 'lucide-react';
import { lipSync } from '../audio/lipSyncAnalyzer';

export const VoiceLabPage: React.FC = () => {
  const [selectedVoice, setSelectedVoice] = useState('my-MM-NilarNeural');
  const [inputText, setInputText] = useState('မင်္ဂလာပါ! ကျွန်တော်တို့ AuraCraft Neural Voice Studio မှ ကြိုဆိုပါတယ်ခင်ဗျာ။ ဤစနစ်ဖြင့် သဘာဝကျသော အသံများကို တိုက်ရိုက် စမ်းသပ်နိုင်ပါသည်။');
  const [pitch, setPitch] = useState(0); // -50% to +50%
  const [rate, setRate] = useState(1.0); // 0.5x to 1.5x
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioBlobUrl, setAudioBlobUrl] = useState<string | null>(null);

  const VOICES = [
    {
      id: 'my-MM-NilarNeural',
      name: 'Nilar (ဒေါ်နီလာ)',
      country: '🇲🇲 Myanmar',
      gender: 'Female',
      badge: 'Natural Host',
      desc: 'Warm, elegant and articulate Burmese female narration.',
    },
    {
      id: 'my-MM-ThihaNeural',
      name: 'Thiha (ဦးသီဟ)',
      country: '🇲🇲 Myanmar',
      gender: 'Male',
      badge: 'Deep Anchor',
      desc: 'Authoritative, calm and resonant Burmese male voice.',
    },
    {
      id: 'ja-JP-NanamiNeural',
      name: 'Nanami (七海)',
      country: '🇯🇵 Japan',
      gender: 'Female',
      badge: '🌸 Anime Heroine',
      desc: 'Expressive and melodic Japanese anime heroine tone.',
    },
    {
      id: 'ja-JP-KeitaNeural',
      name: 'Keita (ケイタ)',
      country: '🇯🇵 Japan',
      gender: 'Male',
      badge: '⚔️ Mecha Hero',
      desc: 'Brave, energetic young anime protagonist cadence.',
    },
    {
      id: 'en-US-JennyNeural',
      name: 'Jenny Nova',
      country: '🇺🇸 United States',
      gender: 'Female',
      badge: '⚡ Tech Streamer',
      desc: 'Vibrant, fast-paced and natural English creator voice.',
    },
    {
      id: 'en-US-GuyNeural',
      name: 'Guy Tactical',
      country: '🇺🇸 United States',
      gender: 'Male',
      badge: '🎖️ Spec-Ops',
      desc: 'Steady, deep broadcast voice suited for military and corporate briefs.',
    },
  ];

  const PRESET_SCRIPTS = [
    {
      label: '🇲🇲 Burmese Welcome',
      text: 'မင်္ဂလာပါ! AuraCraft Studio မှ ကြိုဆိုပါတယ်။ ကျွန်တော်တို့ရဲ့ AI စနစ်က 3D Persona တွေနဲ့ တိုက်ရိုက် စကားပြောနိုင်ပါတယ်။',
    },
    {
      label: '🇲🇲 News Broadcast',
      text: 'ဒီကနေ့ သတင်းထုတ်ပြန်ချက်အရ The Nexus Hub Ecosystem အစီအစဉ်များ အောင်မြင်စွာ လည်ပတ်နေပြီဖြစ်ကြောင်း ကြေညာအပ်ပါသည်။',
    },
    {
      label: '🌸 Anime Dialogue',
      text: 'こんにちは！量子フレームの起動準備が完了しました。一緒に冒険へ出発しましょう！',
    },
    {
      label: '⚡ Tech Streamer',
      text: 'Hey everyone! Welcome back to the live stream. Today we are testing real-time 3D VTuber avatars powered by Edge-TTS!',
    },
  ];

  const handleSynthesize = async () => {
    if (!inputText.trim()) return;
    setIsLoading(true);

    try {
      const backendUrl = (import.meta.env.VITE_API_URL || 'http://localhost:8010') + '/api/tts/synthesize';
      const res = await fetch(backendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: inputText,
          voice: selectedVoice,
        }),
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        setAudioBlobUrl(url);

        const audio = new Audio(url);
        lipSync.init(audio);
        lipSync.resume();

        setIsPlaying(true);
        audio.onended = () => setIsPlaying(false);
        audio.onerror = () => setIsPlaying(false);
        await audio.play();
      } else {
        // Web Speech API fallback
        const utterance = new SpeechSynthesisUtterance(inputText);
        utterance.rate = rate;
        setIsPlaying(true);
        utterance.onend = () => setIsPlaying(false);
        utterance.onerror = () => setIsPlaying(false);
        window.speechSynthesis.speak(utterance);
      }
    } catch (err) {
      console.warn('Backend call failed, using client fallback:', err);
      const utterance = new SpeechSynthesisUtterance(inputText);
      utterance.rate = rate;
      setIsPlaying(true);
      utterance.onend = () => setIsPlaying(false);
      utterance.onerror = () => setIsPlaying(false);
      window.speechSynthesis.speak(utterance);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0a0d14] text-slate-100 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="border-b border-[#1f293d] pb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-cyan-600/20 border border-cyan-500/40 rounded-xl text-cyan-400">
            <Volume2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              Neural Voice Lab (အသံဖန်တီးခန်း)
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/40">
                Zero-Cost Cloud TTS
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              High-fidelity multilingual neural voices with Burmese, Japanese, and English viseme synchronization.
            </p>
          </div>
        </div>

        {isPlaying && (
          <div className="flex items-center gap-2 bg-emerald-950/80 border border-emerald-500/50 px-3.5 py-1.5 rounded-xl text-emerald-300 text-xs font-medium animate-pulse shadow-lg shadow-emerald-500/20">
            <Radio className="w-4 h-4" />
            Audio Output Active (Lip-Sync Streaming)
          </div>
        )}
      </div>

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Voice Selection Cards (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Mic className="w-4 h-4 text-purple-400" />
            Select Voice Persona ({VOICES.length})
          </h2>

          <div className="space-y-2">
            {VOICES.map((v) => {
              const isSelected = selectedVoice === v.id;
              return (
                <div
                  key={v.id}
                  onClick={() => setSelectedVoice(v.id)}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all duration-200 flex items-center justify-between ${
                    isSelected
                      ? 'bg-gradient-to-r from-purple-950/50 to-indigo-950/40 border-purple-500 shadow-md ring-1 ring-purple-500/40'
                      : 'bg-[#111726]/70 hover:bg-[#141b2d] border-[#1f293d]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                        isSelected
                          ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                          : 'bg-[#0a0d14] text-slate-400 border border-[#23314f]'
                      }`}
                    >
                      {v.country.split(' ')[0]}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-100 flex items-center gap-2">
                        {v.name}
                        <span className="text-[10px] text-slate-400 font-normal">({v.gender})</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">{v.desc}</p>
                    </div>
                  </div>

                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-purple-950/60 text-purple-300 border border-purple-800/40">
                    {v.badge}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Speech Input, Sliders & Audio Player (7 cols) */}
        <div className="lg:col-span-7 space-y-5 bg-[#111726]/80 backdrop-blur-md border border-[#1f293d] p-6 rounded-2xl shadow-xl flex flex-col justify-between">
          <div className="space-y-4">
            {/* Quick Presets */}
            <div>
              <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Quick Test Phrases (နမူနာစာသားများ)
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_SCRIPTS.map((ps, idx) => (
                  <button
                    key={idx}
                    onClick={() => setInputText(ps.text)}
                    className="px-2.5 py-1 rounded-lg bg-[#0a0d14] hover:bg-[#1f293d] border border-[#23314f] text-[11px] text-slate-300 transition-colors"
                  >
                    {ps.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Input Script Box */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Text to Synthesize (အသံထွက်စေမည့် စာသား)
              </label>
              <textarea
                rows={5}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type or paste Burmese, English, or Japanese text here..."
                className="w-full bg-[#0a0d14] border border-[#23314f] rounded-xl p-3 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 leading-relaxed font-sans"
              />
            </div>

            {/* Voice Sliders */}
            <div className="grid grid-cols-2 gap-4 bg-[#0a0d14] p-4 rounded-xl border border-[#23314f]">
              <div>
                <div className="flex items-center justify-between text-xs text-slate-300 font-medium mb-1">
                  <span className="flex items-center gap-1"><Sliders className="w-3.5 h-3.5 text-cyan-400" /> Speech Rate</span>
                  <span className="text-cyan-400 font-mono">{rate.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="1.8"
                  step="0.1"
                  value={rate}
                  onChange={(e) => setRate(parseFloat(e.target.value))}
                  className="w-full accent-cyan-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-xs text-slate-300 font-medium mb-1">
                  <span className="flex items-center gap-1"><Sliders className="w-3.5 h-3.5 text-purple-400" /> Pitch Variance</span>
                  <span className="text-purple-400 font-mono">{pitch > 0 ? `+${pitch}` : pitch}Hz</span>
                </div>
                <input
                  type="range"
                  min="-30"
                  max="30"
                  step="2"
                  value={pitch}
                  onChange={(e) => setPitch(parseInt(e.target.value))}
                  className="w-full accent-purple-500"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-[#1f293d] flex items-center justify-between gap-3">
            {audioBlobUrl ? (
              <a
                href={audioBlobUrl}
                download={`auracraft_${selectedVoice}_speech.mp3`}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-[#0a0d14] hover:bg-slate-800 border border-[#23314f] rounded-xl text-xs text-slate-200 transition-colors font-medium shadow-sm"
              >
                <Download className="w-3.5 h-3.5 text-cyan-400" />
                Download Audio (.mp3)
              </a>
            ) : (
              <div className="text-[11px] text-slate-500">Click Speak to synthesize real-time audio</div>
            )}

            <button
              onClick={handleSynthesize}
              disabled={isLoading || !inputText.trim()}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/25 transition-all disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Synthesizing...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-slate-950 text-slate-950" />
                  <span>Generate & Speak</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
