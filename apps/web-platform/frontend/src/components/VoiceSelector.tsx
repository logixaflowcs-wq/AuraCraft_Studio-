import React, { useState } from 'react';
import { Volume2, Mic, Play, Loader2, Download, Sliders, Sparkles, MessageSquare } from 'lucide-react';
import { lipSync } from '../audio/lipSyncAnalyzer';
import { API_ENDPOINTS } from '../config/api';
import { translations, type Language } from '../utils/i18n';

interface VoiceSelectorProps {
  currentVoice: string;
  lang?: Language;
  onSelectVoice: (voiceId: string) => void;
  onSpeakingStateChange: (isSpeaking: boolean) => void;
}

export const VoiceSelector: React.FC<VoiceSelectorProps> = ({
  currentVoice,
  lang = 'en',
  onSelectVoice,
  onSpeakingStateChange,
}) => {
  const isMyanmar = lang === 'my';
  const [testText, setTestText] = useState('မင်္ဂလာပါ! AuraCraft AI Studio မှ ကြိုဆိုပါတယ်ခင်ဗျာ။');
  const [rate, setRate] = useState<number>(1.0);
  const [pitch, setPitch] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [lastAudioUrl, setLastAudioUrl] = useState<string | null>(null);

  const voices = [
    { id: 'my-MM-NilarNeural', name: 'Nilar (နီလာ)', lang: 'Myanmar ♀', flag: '🇲🇲', desc: 'Natural Female' },
    { id: 'my-MM-ThihaNeural', name: 'Thiha (သီဟ)', lang: 'Myanmar ♂', flag: '🇲🇲', desc: 'News Anchor' },
    { id: 'ja-JP-NanamiNeural', name: 'Nanami (七海)', lang: 'Japanese ♀', flag: '🇯🇵', desc: 'Anime Heroine' },
    { id: 'ja-JP-KeitaNeural', name: 'Keita (ケイタ)', lang: 'Japanese ♂', flag: '🇯🇵', desc: 'Anime Pilot' },
    { id: 'en-US-JennyNeural', name: 'Jenny Nova', lang: 'English ♀', flag: '🇺🇸', desc: 'Streamer / Host' },
    { id: 'en-US-GuyNeural', name: 'Guy Tactical', lang: 'English ♂', flag: '🇺🇸', desc: 'Recon Officer' },
    { id: 'zh-CN-XiaoxiaoNeural', name: 'Xiaoxiao (晓晓)', lang: 'Chinese ♀', flag: '🇨🇳', desc: 'Expressive' },
    { id: 'ko-KR-SunHiNeural', name: 'SunHi (선희)', lang: 'Korean ♀', flag: '🇰🇷', desc: 'K-Drama Heroine' },
  ];

  const SAMPLE_SCRIPTS = [
    { label: isMyanmar ? '🇲🇲 နှုတ်ခွန်းဆက်' : '🇲🇲 Myanmar Greeting', text: 'မင်္ဂလာပါရှင်! AuraCraft Studio မှ နွေးထွေးစွာ ကြိုဆိုပါတယ်ရှင်။' },
    { label: isMyanmar ? '🌸 ဂျပန်အန်နီမေး' : '🌸 Anime Line', text: 'こんにちは！オーラク​​ラフトスタジオへようこそ！一緒に頑張りましょうね！' },
    { label: isMyanmar ? '🇺🇸 အင်္ဂလိပ်စတူဒီယို' : '🇺🇸 English Studio', text: 'Hello and welcome to AuraCraft Studio! Your next-generation AI persona platform is live.' },
    { label: isMyanmar ? '📺 သတင်းကြေညာ' : '📺 News Anchor', text: 'ယနေ့ ညနေခင်း သတင်းစဉ်များကို AuraCraft Studio မှ တင်ဆက်ပေးနေပါပြီ ခင်ဗျာ။' },
  ];

  const handleSpeak = async () => {
    if (!testText.trim()) return;
    setLoading(true);

    try {
      const backendUrl = API_ENDPOINTS.tts;
      const rateStr = rate >= 1.0 ? `+${Math.round((rate - 1.0) * 100)}%` : `-${Math.round((1.0 - rate) * 100)}%`;
      const pitchStr = pitch >= 0 ? `+${pitch}Hz` : `${pitch}Hz`;

      const res = await fetch(backendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: testText,
          voice: currentVoice,
          rate: rateStr,
          pitch: pitchStr,
        }),
      });

      if (res.ok) {
        const blob = await res.blob();
        const audioUrl = URL.createObjectURL(blob);
        setLastAudioUrl(audioUrl);
        const audio = new Audio(audioUrl);

        lipSync.init(audio);
        lipSync.resume();

        onSpeakingStateChange(true);
        audio.onended = () => onSpeakingStateChange(false);
        audio.onerror = () => onSpeakingStateChange(false);
        await audio.play();
      } else {
        // Fallback
        const utterance = new SpeechSynthesisUtterance(testText);
        utterance.rate = rate;
        onSpeakingStateChange(true);
        utterance.onend = () => onSpeakingStateChange(false);
        utterance.onerror = () => onSpeakingStateChange(false);
        window.speechSynthesis.speak(utterance);
      }
    } catch (err) {
      console.warn('Backend call failed, using client fallback:', err);
      const utterance = new SpeechSynthesisUtterance(testText);
      utterance.rate = rate;
      onSpeakingStateChange(true);
      utterance.onend = () => onSpeakingStateChange(false);
      utterance.onerror = () => onSpeakingStateChange(false);
      window.speechSynthesis.speak(utterance);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#111726]/95 border border-[#1f293d] rounded-2xl p-3.5 shadow-xl flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between pb-1.5 border-b border-slate-700/50 text-xs">
        <span className="flex items-center gap-1.5 font-bold text-slate-200">
          <Volume2 className="w-4 h-4 text-cyan-400" />
          <span>{isMyanmar ? 'အသံစနစ် (Neural Voice)' : 'Neural Voice Engine'}</span>
        </span>
        <span className="text-[10px] bg-cyan-950/80 text-cyan-400 px-2 py-0.5 rounded-full border border-cyan-800/40 font-semibold font-mono">
          Edge-TTS
        </span>
      </div>

      {/* Voice Selection Grid */}
      <div className="grid grid-cols-2 gap-1.5 max-h-44 overflow-y-auto pr-0.5">
        {voices.map((v) => {
          const isSelected = currentVoice === v.id;
          return (
            <button
              key={v.id}
              onClick={() => onSelectVoice(v.id)}
              className={`p-2 rounded-xl text-left border transition-all flex flex-col gap-0.5 ${
                isSelected
                  ? 'bg-gradient-to-r from-purple-900/60 to-cyan-950/60 border-cyan-500/80 shadow-md shadow-cyan-900/20 ring-1 ring-cyan-500'
                  : 'bg-[#0b0f19] border-slate-800/80 hover:bg-slate-800/50 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-100 flex items-center gap-1 truncate">
                  <span>{v.flag}</span>
                  <span className="truncate">{v.name}</span>
                </span>
              </div>
              <span className="text-[9px] text-slate-400 truncate">{v.desc}</span>
            </button>
          );
        })}
      </div>

      {/* Speech Script Input Area */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-300 font-semibold flex items-center gap-1">
            <MessageSquare className="w-3.5 h-3.5 text-purple-400" />
            <span>{isMyanmar ? 'ပြောကြားမည့် စာသား' : 'Speech Script'}</span>
          </span>
          <span className="text-[10px] text-slate-500 font-mono">
            {testText.length} chars
          </span>
        </div>

        {/* Quick Sample Script Chips */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-[10px]">
          {SAMPLE_SCRIPTS.map((s, i) => (
            <button
              key={i}
              onClick={() => setTestText(s.text)}
              className="bg-[#0b0f19] hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 px-2 py-0.5 rounded-lg whitespace-nowrap transition-all"
            >
              {s.label}
            </button>
          ))}
        </div>

        <textarea
          rows={3}
          value={testText}
          onChange={(e) => setTestText(e.target.value)}
          placeholder={isMyanmar ? 'ပြောကြားမည့် စာသားကို ဤနေရာတွင် ရိုက်ထည့်ပါ...' : 'Type script for avatar to speak with real-time lip sync...'}
          className="w-full bg-[#090d16] border border-slate-800 focus:border-cyan-500 rounded-xl p-2.5 text-xs text-slate-100 placeholder-slate-600 outline-none resize-none transition-colors"
        />
      </div>

      {/* Speed & Pitch Controls */}
      <div className="grid grid-cols-2 gap-2 bg-[#090d16] p-2 rounded-xl border border-slate-800/80 text-[11px]">
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-slate-400 text-[10px]">
            <span>{isMyanmar ? 'အမြန်နှုန်း' : 'Speed'}</span>
            <span className="text-cyan-400 font-mono font-bold">{rate.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="1.8"
            step="0.1"
            value={rate}
            onChange={(e) => setRate(parseFloat(e.target.value))}
            className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-slate-400 text-[10px]">
            <span>{isMyanmar ? 'အမြင့်အနိမ့်' : 'Pitch'}</span>
            <span className="text-purple-400 font-mono font-bold">{pitch > 0 ? `+${pitch}` : pitch}Hz</span>
          </div>
          <input
            type="range"
            min="-20"
            max="20"
            step="2"
            value={pitch}
            onChange={(e) => setPitch(parseInt(e.target.value))}
            className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-400"
          />
        </div>
      </div>

      {/* Primary Action Button: Generate & Speak */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleSpeak}
          disabled={loading || !testText.trim()}
          className="flex-1 bg-gradient-to-r from-cyan-600 via-indigo-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 disabled:opacity-50 text-white font-bold py-2.5 px-3 rounded-xl transition-all shadow-lg shadow-cyan-600/25 flex items-center justify-center gap-2 text-xs"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-cyan-200" />
              <span>{isMyanmar ? 'အသံထုတ်လုပ်နေသည်...' : 'Synthesizing...'}</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-cyan-200" />
              <span>{isMyanmar ? 'အသံထုတ်ပြီး စကားပြောပါ' : 'Generate & Speak'}</span>
            </>
          )}
        </button>

        {lastAudioUrl && (
          <a
            href={lastAudioUrl}
            download="auracraft_speech.mp3"
            title="Download MP3 Audio"
            className="p-2.5 bg-[#0b0f19] hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-cyan-300 rounded-xl transition-all shadow-sm flex items-center justify-center"
          >
            <Download className="w-4 h-4" />
          </a>
        )}
      </div>
    </div>
  );
};
