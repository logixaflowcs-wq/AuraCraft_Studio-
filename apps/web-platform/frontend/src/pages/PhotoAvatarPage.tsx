import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Upload, Camera, RefreshCw, Volume2, Zap, Heart, Star,
  MessageSquare, Sparkles, Square, Download, Smile,
  Wand2, Image, ChevronRight, Loader2, Play, User, Trash2
} from 'lucide-react';
import { API_ENDPOINTS } from '../config/api';

// ─── Types ────────────────────────────────────────────────────────────────────
type TabMode = 'photo' | 'prompt';
type ExpressionId = 'neutral' | 'happy' | 'sad' | 'surprised' | 'angry';

const EXPRESSIONS: { id: ExpressionId; icon: string; label: string }[] = [
  { id: 'neutral',   icon: '😐', label: 'Neutral'   },
  { id: 'happy',     icon: '😊', label: 'Happy'     },
  { id: 'sad',       icon: '😢', label: 'Sad'       },
  { id: 'surprised', icon: '😲', label: 'Surprised' },
  { id: 'angry',     icon: '😠', label: 'Angry'     },
];

const VOICES = [
  { id: 'my-MM-NilarNeural',    label: 'Nilar (နီလာ)',    lang: 'Myanmar ♀', flag: '🇲🇲' },
  { id: 'my-MM-ThihaNeural',    label: 'Thiha (သိဟ)',     lang: 'Myanmar ♂', flag: '🇲🇲' },
  { id: 'ja-JP-NanamiNeural',   label: 'Nanami (ナナミ)',  lang: 'Japanese ♀',flag: '🇯🇵' },
  { id: 'ja-JP-KeitaNeural',    label: 'Keita (ケイタ)',   lang: 'Japanese ♂',flag: '🇯🇵' },
  { id: 'en-US-JennyNeural',    label: 'Jenny',            lang: 'English ♀', flag: '🇺🇸' },
  { id: 'en-US-GuyNeural',      label: 'Guy',              lang: 'English ♂', flag: '🇺🇸' },
  { id: 'zh-CN-XiaoxiaoNeural', label: 'Xiaoxiao (晓晓)', lang: 'Chinese ♀', flag: '🇨🇳' },
  { id: 'ko-KR-SunHiNeural',    label: 'SunHi (선희)',    lang: 'Korean ♀',  flag: '🇰🇷' },
];

const PROMPT_STYLES = [
  { id: 'anime',      label: 'Anime',           example: 'anime girl, big eyes, colorful hair, portrait' },
  { id: 'realistic',  label: 'Realistic',       example: 'realistic portrait, professional photo, studio lighting' },
  { id: 'myanmar',    label: 'Myanmar',         example: 'myanmar woman in traditional longyi, thanakha, portrait' },
  { id: 'fantasy',    label: 'Fantasy',         example: 'fantasy elf character, glowing eyes, magical aura, portrait' },
  { id: 'cyberpunk',  label: 'Cyberpunk',       example: 'cyberpunk girl, neon lights, futuristic city, portrait' },
  { id: 'chibi',      label: 'Chibi / Cute',    example: 'chibi character, cute, big head, colorful, portrait' },
];

// ─── Canvas Talking-Face Renderer ─────────────────────────────────────────────
// Uses face-region warp: top 60% drawn normal, bottom 40% (jaw/mouth) stretched 
// vertically based on speech amplitude. This creates convincing lip-sync without AI.
function renderTalkingFace(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  mouthOpen: number,   // 0–1
  blinkAmt: number,    // 0–1
  tilt: number,        // degrees
  expression: ExpressionId
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate((tilt * Math.PI) / 180);

  // ─── Draw face with mouth-warp technique ───────────────────────────────────
  // Split image: upper 65% (forehead→nose) drawn normally
  // Lower 35% (mouth→chin) stretched slightly open
  const splitY = H * 0.63; // pivot line just above mouth
  const stretch = mouthOpen * H * 0.06; // max ~6% height stretch

  // Upper portion (normal)
  ctx.drawImage(img, 0, 0, W, splitY, -W / 2, -H / 2, W, splitY);

  // Lower portion (stretched downward = jaw drops open)
  ctx.drawImage(img, 0, splitY, W, H - splitY, -W / 2, -H / 2 + splitY + stretch * 0.5, W, H - splitY + stretch);

  // ─── Fill the gap between upper & lower (mouth-open gap) ──────────────────
  if (mouthOpen > 0.05) {
    const gapY = -H / 2 + splitY;
    const gapH = stretch * 0.5;
    // Sample color from just above split to fill naturally
    ctx.drawImage(img, 0, splitY - 4, W, 4, -W / 2, gapY, W, gapH);

    // Dark mouth cavity
    const mouthX = -W * 0.12;
    const mouthW = W * 0.24;
    const cavityY = gapY + gapH * 0.1;
    const cavityH = Math.max(gapH * 0.8, 2);
    const mouthGrad = ctx.createRadialGradient(0, cavityY + cavityH / 2, 0, 0, cavityY + cavityH / 2, mouthW * 0.5);
    mouthGrad.addColorStop(0, `rgba(5,2,10,${0.65 + mouthOpen * 0.3})`);
    mouthGrad.addColorStop(0.6, `rgba(10,4,18,${0.5 + mouthOpen * 0.2})`);
    mouthGrad.addColorStop(1, 'transparent');
    ctx.beginPath();
    ctx.ellipse(0, cavityY + cavityH / 2, mouthW * 0.5, cavityH, 0, 0, Math.PI * 2);
    ctx.fillStyle = mouthGrad;
    ctx.fill();

    // Teeth hint
    if (mouthOpen > 0.25) {
      ctx.beginPath();
      ctx.ellipse(0, cavityY + cavityH * 0.3, mouthW * 0.3, cavityH * 0.3, 0, 0, Math.PI);
      ctx.fillStyle = `rgba(240,235,228,${(mouthOpen - 0.25) * 0.9})`;
      ctx.fill();
    }
  }

  ctx.restore();

  // ─── Blink overlay ────────────────────────────────────────────────────────
  if (blinkAmt > 0.05) {
    const eyeY = H * 0.37;
    const eyeSpacing = W * 0.145;
    const eyeRW = W * 0.09;
    const eyeRH = H * 0.028 * blinkAmt;
    ctx.save();
    for (const ex of [-eyeSpacing, eyeSpacing]) {
      // Sample eyelid color from photo
      ctx.beginPath();
      ctx.ellipse(W / 2 + ex, eyeY, eyeRW, eyeRH, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(10,5,15,${0.85 * blinkAmt})`;
      ctx.fill();
    }
    ctx.restore();
  }

  // ─── Expression tint ──────────────────────────────────────────────────────
  const tints: Record<ExpressionId, string> = {
    neutral:   'transparent',
    happy:     'rgba(250,220,100,0.07)',
    sad:       'rgba(80,140,220,0.09)',
    surprised: 'rgba(240,160,40,0.07)',
    angry:     'rgba(220,50,50,0.09)',
  };
  if (tints[expression] !== 'transparent') {
    ctx.fillStyle = tints[expression];
    ctx.fillRect(0, 0, W, H);
  }

  // ─── Speaking glow ring ───────────────────────────────────────────────────
  if (mouthOpen > 0.08) {
    const glowAlpha = mouthOpen * 0.35;
    const gradient = ctx.createRadialGradient(W / 2, H * 0.75, 0, W / 2, H * 0.75, W * 0.45);
    gradient.addColorStop(0, `rgba(168,85,247,${glowAlpha * 0.5})`);
    gradient.addColorStop(0.5, `rgba(168,85,247,${glowAlpha * 0.2})`);
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────
export const PhotoAvatarPage: React.FC = () => {
  const [tab, setTab] = useState<TabMode>('photo');

  // ── Photo Mode State ──
  const [photoUrl, setPhotoUrl]       = useState<string | null>(null);
  const [photoName, setPhotoName]     = useState('');
  const [isDragging, setIsDragging]   = useState(false);
  const [expression, setExpression]   = useState<ExpressionId>('neutral');
  const [isSpeaking, setIsSpeaking]   = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioUrl, setAudioUrl]       = useState<string | null>(null);
  const [statusMsg, setStatusMsg]     = useState('');
  const [selectedVoice, setSelectedVoice] = useState('my-MM-NilarNeural');
  const [rate, setRate]               = useState(1.0);
  const [pitch, setPitch]             = useState(1.0);
  const [text, setText]               = useState('မင်္ဂလာပါ! ကျွန်မနာမည်က AuraCraft AI Photo Avatar ပါ။ ကြိုဆိုပါတယ်!');

  // ── Prompt Mode State ──
  const [promptText, setPromptText]       = useState('');
  const [promptStyle, setPromptStyle]     = useState('anime');
  const [promptNegative, setPromptNegative] = useState('blur, watermark, low quality, deformed');
  const [generatedImgUrl, setGeneratedImgUrl] = useState<string | null>(null);
  const [isPromptLoading, setIsPromptLoading] = useState(false);
  const [promptSpeaking, setPromptSpeaking]   = useState(false);
  const [promptText2, setPromptText2]     = useState('');

  // ── Refs ──
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const imgRef       = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef     = useRef<HTMLAudioElement | null>(null);
  const analyserRef  = useRef<AnalyserNode | null>(null);
  const audioCtxRef  = useRef<AudioContext | null>(null);
  const animRef      = useRef<number>(0);
  const nextBlinkRef = useRef(3.0);
  const nextTiltRef  = useRef(5.0);

  // ─── Animation Loop ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!photoUrl || !canvasRef.current) return;

    let lastTime = performance.now();
    let mouth = 0, blink = 0, tilt = 0, targetTilt = 0;
    let blinkTimer = 0, tiltTimer = 0;

    const loop = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      // Mouth from analyser
      if (analyserRef.current) {
        const buf = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(buf);
        const avg = buf.slice(0, 24).reduce((a, b) => a + b, 0) / 24;
        mouth += (Math.min(avg / 85, 1) - mouth) * Math.min(dt * 18, 1);
      } else {
        mouth = Math.max(mouth - dt * 8, 0);
      }

      // Blink
      blinkTimer += dt;
      if (blinkTimer >= nextBlinkRef.current) {
        blinkTimer = 0;
        nextBlinkRef.current = 2 + Math.random() * 4.5;
      }
      const bp = blinkTimer / 0.14;
      blink = bp < 1 ? Math.sin(bp * Math.PI) : 0;

      // Head tilt drift
      tiltTimer += dt;
      if (tiltTimer >= nextTiltRef.current) {
        tiltTimer = 0;
        nextTiltRef.current = 4 + Math.random() * 7;
        targetTilt = (Math.random() - 0.5) * 2.5;
      }
      tilt += (targetTilt - tilt) * dt * 1.2;

      const canvas = canvasRef.current;
      const img = imgRef.current;
      if (canvas && img) {
        renderTalkingFace(canvas, img, mouth, blink, tilt, expression);
      }

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [photoUrl, expression]);

  // ─── Load Photo ──────────────────────────────────────────────────────────
  const loadPhoto = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      imgRef.current = img;
      setPhotoUrl(url);
      setPhotoName(file.name);
      setStatusMsg('✅ ပုံ load ပြီး — Generate & Speak နှိပ်ပါ');
    };
    img.src = url;
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) loadPhoto(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f?.type.startsWith('image/')) loadPhoto(f);
  };

  // ─── TTS + Lip-Sync ──────────────────────────────────────────────────────
  const playSpeech = async (url: string, onEnd: () => void) => {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    const actx = audioCtxRef.current;
    if (actx.state === 'suspended') await actx.resume();

    const analyser = actx.createAnalyser();
    analyser.fftSize = 64;
    analyserRef.current = analyser;
    analyser.connect(actx.destination);

    const audio = new Audio(url);
    audioRef.current = audio;
    const src = actx.createMediaElementSource(audio);
    src.connect(analyser);
    audio.play();
    audio.onended = () => { analyserRef.current = null; onEnd(); };
  };

  const handleGenerate = async (speakUrl?: string | null, forPhoto = true) => {
    const speakText = forPhoto ? text : promptText2;
    if (!speakText.trim()) { setStatusMsg('⚠️ စာသားရိုက်ပါ'); return; }

    if (forPhoto) setIsGenerating(true); else setPromptSpeaking(true);
    setStatusMsg('🎙️ TTS generating...');

    try {
      const res = await fetch(API_ENDPOINTS.tts, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: speakText,
          voice: selectedVoice,
          rate: `+${Math.round((rate - 1) * 100)}%`,
          pitch: `+${Math.round((pitch - 1) * 50)}Hz`,
        }),
      });
      if (!res.ok) throw new Error('TTS error');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      if (forPhoto) {
        setIsSpeaking(true);
        await playSpeech(url, () => { setIsSpeaking(false); setIsGenerating(false); setStatusMsg('✅ ပြီးပါပြီ'); });
      } else {
        setPromptSpeaking(true);
        await playSpeech(url, () => { setPromptSpeaking(false); setStatusMsg('✅ ပြီးပါပြီ'); });
      }
    } catch {
      // Fallback Web Speech
      setStatusMsg('⚡ Browser TTS fallback...');
      const utt = new SpeechSynthesisUtterance(speakText);
      utt.rate = rate; utt.pitch = pitch;
      if (forPhoto) setIsSpeaking(true); else setPromptSpeaking(true);
      let interval: ReturnType<typeof setInterval> | null = null;

      if (forPhoto && canvasRef.current) {
        interval = setInterval(() => {
          if (canvasRef.current && imgRef.current) {
            renderTalkingFace(canvasRef.current, imgRef.current, 0.3 + Math.random() * 0.5, 0, 0, expression);
          }
        }, 110);
      }

      utt.onend = () => {
        if (interval) clearInterval(interval);
        if (forPhoto) { setIsSpeaking(false); setIsGenerating(false); }
        else setPromptSpeaking(false);
        setStatusMsg('✅ ပြီး');
      };
      speechSynthesis.speak(utt);
    }
  };

  const handleStop = () => {
    audioRef.current?.pause();
    speechSynthesis.cancel();
    analyserRef.current = null;
    setIsSpeaking(false);
    setPromptSpeaking(false);
    setIsGenerating(false);
    setStatusMsg('⏹️ ရပ်ပြီ');
  };

  // ─── Prompt Image Generation (Pollinations.ai — Free) ───────────────────
  const handlePromptGenerate = async () => {
    const style = PROMPT_STYLES.find(s => s.id === promptStyle);
    const fullPrompt = `${promptText}, ${style?.example ?? ''}, high quality, detailed face, portrait`;
    if (!promptText.trim()) { setStatusMsg('⚠️ Prompt ရိုက်ပါ'); return; }

    setIsPromptLoading(true);
    setGeneratedImgUrl(null);
    setStatusMsg('🎨 AI image generating (Pollinations.ai)...');

    const encoded = encodeURIComponent(fullPrompt);
    const neg = encodeURIComponent(promptNegative);
    const seed = Math.floor(Math.random() * 999999);
    const url = `https://image.pollinations.ai/prompt/${encoded}?width=512&height=680&negative=${neg}&seed=${seed}&nologo=true&enhance=true`;

    try {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        imgRef.current = img;        // Also set for lip-sync if user switches to photo mode
        setGeneratedImgUrl(url);
        setIsPromptLoading(false);
        setStatusMsg('✅ AI Avatar ထွက်ပါပြီ — Generate & Speak နှိပ်ပါ');
        setPhotoUrl(url);            // Can use in photo mode too
      };
      img.onerror = () => {
        setIsPromptLoading(false);
        setStatusMsg('❌ Generation failed — ထပ်ကြိုးစားပါ');
      };
      img.src = url;
    } catch {
      setIsPromptLoading(false);
      setStatusMsg('❌ Error');
    }
  };

  // ─── Shared Controls Panel ───────────────────────────────────────────────
  const ControlsPanel = ({ forPhoto = true }: { forPhoto?: boolean }) => (
    <aside className="w-72 border-l border-[#1f293d] bg-[#0c101c]/95 flex flex-col p-3 gap-3 overflow-y-auto flex-shrink-0">

      {/* Expression (photo mode only) */}
      {forPhoto && (
        <div className="bg-[#111726] rounded-xl border border-[#1f293d] p-3">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Smile className="w-3.5 h-3.5 text-purple-400" />
            Expression (မျက်နှာဟန်)
          </div>
          <div className="grid grid-cols-5 gap-1">
            {EXPRESSIONS.map(e => (
              <button key={e.id} onClick={() => setExpression(e.id)}
                title={e.label}
                className={`flex flex-col items-center gap-0.5 py-2 rounded-lg text-xl transition-all ${
                  expression === e.id
                    ? 'bg-purple-700/40 border border-purple-500/60'
                    : 'bg-[#0a0d14] border border-[#1f293d] hover:border-purple-500/40'
                }`}>
                {e.icon}
                <span className="text-[9px] text-slate-500">{e.id}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Voice */}
      <div className="bg-[#111726] rounded-xl border border-[#1f293d] p-3">
        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
          Voice (Edge-TTS — Zero Cost)
        </div>
        <div className="grid grid-cols-2 gap-1">
          {VOICES.map(v => (
            <button key={v.id} onClick={() => setSelectedVoice(v.id)}
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] transition-all text-left ${
                selectedVoice === v.id
                  ? 'bg-cyan-700/30 border border-cyan-500/60 text-cyan-300'
                  : 'bg-[#0a0d14] border border-[#1f293d] text-slate-400 hover:border-cyan-500/30'
              }`}>
              <span>{v.flag}</span>
              <div>
                <div className="font-medium leading-none">{v.label}</div>
                <div className="text-[9px] text-slate-500">{v.lang}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Rate / Pitch */}
      <div className="bg-[#111726] rounded-xl border border-[#1f293d] p-3 space-y-3">
        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          Voice Controls
        </div>
        <div>
          <div className="flex justify-between text-[10px] text-slate-500 mb-1">
            <span>Rate (အမြန်)</span><span className="text-amber-400">{rate.toFixed(1)}x</span>
          </div>
          <input type="range" min={0.5} max={2.0} step={0.1} value={rate}
            onChange={e => setRate(Number(e.target.value))}
            className="w-full h-1.5 accent-amber-500 cursor-pointer" />
        </div>
        <div>
          <div className="flex justify-between text-[10px] text-slate-500 mb-1">
            <span>Pitch (အသံ)</span><span className="text-purple-400">{pitch.toFixed(1)}x</span>
          </div>
          <input type="range" min={0.5} max={2.0} step={0.1} value={pitch}
            onChange={e => setPitch(Number(e.target.value))}
            className="w-full h-1.5 accent-purple-500 cursor-pointer" />
        </div>
      </div>

      {/* Script */}
      <div className="bg-[#111726] rounded-xl border border-[#1f293d] p-3">
        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <MessageSquare className="w-3.5 h-3.5 text-green-400" />
          Script (ပြောဆိုစာ)
        </div>
        <textarea
          value={forPhoto ? text : promptText2}
          onChange={e => forPhoto ? setText(e.target.value) : setPromptText2(e.target.value)}
          rows={4}
          placeholder="Avatar ပြောစေချင်တဲ့ စာသား..."
          className="w-full bg-[#0a0d14] border border-[#1f293d] rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 resize-none focus:outline-none focus:border-purple-500/60"
        />
      </div>

      {/* Action */}
      <div className="space-y-2">
        <button
          onClick={() => {
            if (isSpeaking || promptSpeaking) handleStop();
            else handleGenerate(null, forPhoto);
          }}
          disabled={isGenerating || isPromptLoading || (!photoUrl && forPhoto) || (!generatedImgUrl && !forPhoto && tab === 'prompt')}
          className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm transition-all shadow-lg ${
            isSpeaking || promptSpeaking
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : isGenerating
              ? 'bg-purple-800/40 text-purple-300 cursor-not-allowed'
              : !photoUrl && forPhoto
              ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
              : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-purple-900/40 hover:shadow-[0_0_20px_rgba(168,85,247,0.4)]'
          }`}>
          {isSpeaking || promptSpeaking
            ? <><Square className="w-4 h-4" /> Stop</>
            : isGenerating
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
            : <><Sparkles className="w-4 h-4" /> Generate &amp; Speak (ပြောဆိုပါ)</>
          }
        </button>

        {audioUrl && (
          <button onClick={() => { const a = document.createElement('a'); a.href = audioUrl; a.download = `auracraft_${Date.now()}.mp3`; a.click(); }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#111726] border border-[#1f293d] text-slate-300 hover:border-cyan-500/50 text-sm transition-all">
            <Download className="w-4 h-4" /> Audio Download (MP3)
          </button>
        )}
      </div>

      {/* Features card */}
      <div className="bg-gradient-to-br from-purple-900/20 to-pink-900/10 rounded-xl border border-purple-700/30 p-3 text-xs text-slate-400 space-y-1">
        <div className="font-semibold text-purple-300 flex items-center gap-1.5">
          <Heart className="w-3.5 h-3.5" /> Photo Avatar Features
        </div>
        <ul className="space-y-0.5 text-[11px]">
          <li>✅ Face jaw-drop warp (realistic open mouth)</li>
          <li>✅ Web Audio FFT lip-sync</li>
          <li>✅ Auto-blink every 2–4s</li>
          <li>✅ Subtle head tilt drift</li>
          <li>✅ 5 expression tints</li>
          <li>✅ 8 voices, zero cost</li>
        </ul>
      </div>
    </aside>
  );

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-[#070a12]">

      {/* ── Sub-tab bar ── */}
      <div className="flex-shrink-0 h-11 bg-[#0d121f] border-b border-[#1f293d] flex items-center px-4 gap-2">
        <button
          onClick={() => setTab('photo')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            tab === 'photo'
              ? 'bg-purple-600/30 border border-purple-500/60 text-purple-300'
              : 'text-slate-500 hover:text-slate-200'
          }`}>
          <Camera className="w-3.5 h-3.5" />
          📷 Photo Avatar (ပုံတင်ပြီး ပြောဆိုရန်)
        </button>
        <button
          onClick={() => setTab('prompt')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            tab === 'prompt'
              ? 'bg-pink-600/30 border border-pink-500/60 text-pink-300'
              : 'text-slate-500 hover:text-slate-200'
          }`}>
          <Wand2 className="w-3.5 h-3.5" />
          ✨ Prompt Avatar (AI ဖန်တီးပြီး ပြောဆိုရန်)
        </button>

        {statusMsg && (
          <div className="ml-auto text-[11px] text-slate-400 bg-[#111726] border border-[#1f293d] px-3 py-1 rounded-lg">
            {statusMsg}
          </div>
        )}
      </div>

      {/* ── Tab: Photo ── */}
      {tab === 'photo' && (
        <div className="flex flex-1 overflow-hidden">
          {/* Stage */}
          <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-[#0a0d14] to-[#07080f] relative p-4">

            {photoUrl ? (
              <div className="flex flex-col items-center gap-3">
                {/* Speaking ring */}
                {isSpeaking && (
                  <div className="absolute rounded-2xl animate-ping border-2 border-purple-400/25 w-[320px] h-[420px] pointer-events-none" />
                )}

                <div className={`relative rounded-2xl overflow-hidden border-2 shadow-2xl transition-all ${
                  isSpeaking
                    ? 'border-purple-500 shadow-[0_0_40px_rgba(168,85,247,0.4)]'
                    : 'border-[#1f293d]'
                }`} style={{ width: 300, height: 400 }}>
                  <canvas ref={canvasRef} width={300} height={400} className="block w-full h-full" />

                  {isSpeaking && (
                    <div className="absolute top-2 right-2 flex items-center gap-1 bg-purple-600/90 backdrop-blur-sm px-2 py-0.5 rounded-full text-white text-[10px] font-bold animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                      SPEAKING
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 bg-[#111726]/90 backdrop-blur-sm px-2 py-0.5 rounded-full text-[10px] text-slate-300 border border-[#1f293d]">
                    {EXPRESSIONS.find(e => e.id === expression)?.icon} {expression} • jaw-warp lip-sync
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#111726] border border-[#1f293d] text-slate-400 hover:text-slate-200 hover:border-purple-500/50 text-xs transition-all">
                    <RefreshCw className="w-3.5 h-3.5" />
                    ပုံပြောင်းရန်
                  </button>

                  <button onClick={() => {
                    setPhotoUrl(null);
                    setStatusMsg('🗑️ ဓာတ်ပုံကို ဖျက်ပြီးပါပြီ');
                  }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/40 border border-rose-500/40 text-rose-300 hover:bg-rose-900/60 text-xs transition-all shadow-sm">
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    ပုံဖျက်မည်
                  </button>
                </div>
              </div>
            ) : (
              /* Upload Zone */
              <div
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex flex-col items-center justify-center gap-5 cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-300 ${
                  isDragging
                    ? 'border-purple-500 bg-purple-900/20 shadow-[0_0_30px_rgba(168,85,247,0.2)]'
                    : 'border-[#2a3756] bg-[#0c111e]/60 hover:border-purple-600/50 hover:bg-purple-900/10'
                }`}
                style={{ width: 300, height: 400 }}>
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-900/60 to-pink-900/40 flex items-center justify-center border border-purple-700/30">
                  <Upload className="w-7 h-7 text-purple-400" />
                </div>
                <div className="text-center space-y-1.5">
                  <div className="text-base font-bold text-slate-300">ပုံတင်ပါ</div>
                  <div className="text-xs text-slate-500">မိမိ၏ ဓာတ်ပုံ upload လုပ်ပါ</div>
                  <div className="text-[11px] text-slate-600">JPG · PNG · WEBP — Drag & Drop</div>
                </div>
                <div className="flex items-center gap-4 text-[11px] text-slate-500">
                  <span className="flex items-center gap-1"><Camera className="w-3 h-3 text-purple-400" /> Selfie</span>
                  <span className="flex items-center gap-1"><Star className="w-3 h-3 text-pink-400" /> Cosplay</span>
                  <span className="flex items-center gap-1"><User className="w-3 h-3 text-cyan-400" /> Portrait</span>
                </div>
              </div>
            )}

            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </div>

          <ControlsPanel forPhoto={true} />
        </div>
      )}

      {/* ── Tab: Prompt ── */}
      {tab === 'prompt' && (
        <div className="flex flex-1 overflow-hidden">
          {/* Stage */}
          <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-[#0a0d14] to-[#07080f] relative p-4">

            {generatedImgUrl ? (
              <div className="flex flex-col items-center gap-3">
                {promptSpeaking && (
                  <div className="absolute rounded-2xl animate-ping border-2 border-pink-400/25 w-[320px] h-[420px] pointer-events-none" />
                )}
                <div className={`relative rounded-2xl overflow-hidden border-2 shadow-2xl transition-all ${
                  promptSpeaking
                    ? 'border-pink-500 shadow-[0_0_40px_rgba(236,72,153,0.4)]'
                    : 'border-[#1f293d]'
                }`} style={{ width: 300, height: 400 }}>
                  <img src={generatedImgUrl} alt="AI Avatar"
                    className="w-full h-full object-cover"
                    style={{ objectPosition: 'center top' }} />

                  {/* Mouth warp overlay via canvas when speaking */}
                  <canvas
                    ref={promptSpeaking ? canvasRef : undefined}
                    className={`absolute inset-0 w-full h-full ${promptSpeaking ? 'block' : 'hidden'}`}
                    width={300} height={400}
                  />

                  {promptSpeaking && (
                    <div className="absolute top-2 right-2 flex items-center gap-1 bg-pink-600/90 backdrop-blur-sm px-2 py-0.5 rounded-full text-white text-[10px] font-bold animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                      SPEAKING
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 bg-[#111726]/90 backdrop-blur-sm px-2 py-0.5 rounded-full text-[10px] text-slate-300 border border-[#1f293d]">
                    ✨ AI Generated • {PROMPT_STYLES.find(s => s.id === promptStyle)?.label}
                  </div>
                </div>

                <button
                  onClick={() => { setGeneratedImgUrl(null); setIsPromptLoading(false); }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#111726] border border-[#1f293d] text-slate-400 hover:text-slate-200 hover:border-pink-500/50 text-xs transition-all">
                  <RefreshCw className="w-3.5 h-3.5" />
                  ပြန်ဖန်တီးရန်
                </button>
              </div>
            ) : (
              /* Prompt Input Area */
              <div className="flex flex-col gap-4 w-full max-w-md">
                <div className="text-center space-y-1">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-900/60 to-purple-900/40 flex items-center justify-center border border-pink-700/30 mx-auto">
                    <Wand2 className="w-7 h-7 text-pink-400" />
                  </div>
                  <div className="text-base font-bold text-slate-300">AI Avatar ဖန်တီးပါ</div>
                  <div className="text-xs text-slate-500">Prompt ရိုက်ပြီး AI က Avatar ဖန်တီးပေးမည်</div>
                </div>

                {/* Style selector */}
                <div>
                  <div className="text-[11px] text-slate-500 mb-2 font-semibold uppercase tracking-wide">Avatar Style</div>
                  <div className="grid grid-cols-3 gap-2">
                    {PROMPT_STYLES.map(s => (
                      <button key={s.id} onClick={() => setPromptStyle(s.id)}
                        className={`px-2.5 py-2 rounded-lg text-xs font-medium transition-all ${
                          promptStyle === s.id
                            ? 'bg-pink-600/30 border border-pink-500/60 text-pink-300'
                            : 'bg-[#111726] border border-[#1f293d] text-slate-400 hover:border-pink-500/40'
                        }`}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Prompt text */}
                <div>
                  <div className="text-[11px] text-slate-500 mb-1.5 font-semibold uppercase tracking-wide">Prompt (ဖော်ပြချက်)</div>
                  <textarea
                    value={promptText}
                    onChange={e => setPromptText(e.target.value)}
                    rows={3}
                    placeholder={`ဥပမာ: ${PROMPT_STYLES.find(s => s.id === promptStyle)?.example}`}
                    className="w-full bg-[#111726] border border-[#1f293d] rounded-xl px-3 py-2.5 text-xs text-slate-200 placeholder-slate-600 resize-none focus:outline-none focus:border-pink-500/60 focus:ring-1 focus:ring-pink-500/30"
                  />
                </div>

                {/* Negative prompt */}
                <div>
                  <div className="text-[11px] text-slate-500 mb-1.5 font-semibold uppercase tracking-wide">Negative Prompt (မလိုချင်တာ)</div>
                  <input
                    value={promptNegative}
                    onChange={e => setPromptNegative(e.target.value)}
                    className="w-full bg-[#111726] border border-[#1f293d] rounded-xl px-3 py-2 text-xs text-slate-400 focus:outline-none focus:border-pink-500/60"
                  />
                </div>

                <button
                  onClick={handlePromptGenerate}
                  disabled={isPromptLoading || !promptText.trim()}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm transition-all ${
                    isPromptLoading
                      ? 'bg-pink-800/40 text-pink-300 cursor-not-allowed'
                      : !promptText.trim()
                      ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                      : 'bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white shadow-lg shadow-pink-900/30'
                  }`}>
                  {isPromptLoading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> AI Generating... (10-30s)</>
                    : <><Image className="w-4 h-4" /> Generate AI Avatar ✨</>
                  }
                </button>

                {isPromptLoading && (
                  <div className="text-center text-xs text-slate-500 animate-pulse">
                    🎨 Pollinations.ai မှ AI ဖန်တီးနေပါသည်... (10–30 seconds)
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Panel for Prompt mode — voice + script after avatar generated */}
          <ControlsPanel forPhoto={false} />
        </div>
      )}
    </div>
  );
};
