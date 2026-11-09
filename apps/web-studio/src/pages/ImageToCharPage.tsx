import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Upload, Sparkles, Download, RefreshCw, ChevronRight, Loader2,
  Camera, Wand2, ArrowRight, Image as ImageIcon, Zap, Star, Heart, User
} from 'lucide-react';
import { API_ENDPOINTS } from '../config/api';

// ─── Style Presets ────────────────────────────────────────────────────────────
const CHARACTER_STYLES = [
  {
    id: 'anime',
    label: 'Anime Style',
    desc: 'Anime character ပြောင်း',
    icon: '🎌',
    color: '#38bdf8',
    params: { quantizeLevels: 7, edgeThreshold: 25, saturation: 1.7, brightness: 1.05, hueShift: 0, edgeWeight: 0.85, smooth: 2 }
  },
  {
    id: 'chibi',
    label: 'Chibi / Cute',
    desc: 'Cute chibi style',
    icon: '🌸',
    color: '#f472b6',
    params: { quantizeLevels: 5, edgeThreshold: 20, saturation: 1.9, brightness: 1.12, hueShift: 10, edgeWeight: 0.7, smooth: 3 }
  },
  {
    id: 'cartoon',
    label: 'Cartoon',
    desc: 'Western cartoon style',
    icon: '🎨',
    color: '#fb923c',
    params: { quantizeLevels: 9, edgeThreshold: 30, saturation: 1.4, brightness: 1.0, hueShift: 0, edgeWeight: 1.0, smooth: 1 }
  },
  {
    id: 'fantasy',
    label: 'Fantasy Art',
    desc: 'Fantasy painting style',
    icon: '🔮',
    color: '#a78bfa',
    params: { quantizeLevels: 12, edgeThreshold: 20, saturation: 1.5, brightness: 0.95, hueShift: -15, edgeWeight: 0.6, smooth: 2 }
  },
  {
    id: 'myanmar',
    label: 'Myanmar Art',
    desc: 'Traditional Myanmar art',
    icon: '🏺',
    color: '#f59e0b',
    params: { quantizeLevels: 8, edgeThreshold: 25, saturation: 1.3, brightness: 1.08, hueShift: 20, edgeWeight: 0.75, smooth: 2 }
  },
  {
    id: 'sketch',
    label: 'Pencil Sketch',
    desc: 'Hand-drawn pencil sketch',
    icon: '✏️',
    color: '#94a3b8',
    params: { quantizeLevels: 3, edgeThreshold: 15, saturation: 0.1, brightness: 1.2, hueShift: 0, edgeWeight: 1.2, smooth: 1 }
  },
];

// ─── Canvas Processing Utilities ──────────────────────────────────────────────

/** Box blur for canvas (smooth faces before edge detection) */
function boxBlur(src: Uint8ClampedArray, dst: Uint8ClampedArray, w: number, h: number, radius: number) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, count = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = Math.min(Math.max(x + dx, 0), w - 1);
          const ny = Math.min(Math.max(y + dy, 0), h - 1);
          const i = (ny * w + nx) * 4;
          r += src[i]; g += src[i + 1]; b += src[i + 2];
          count++;
        }
      }
      const idx = (y * w + x) * 4;
      dst[idx] = r / count; dst[idx + 1] = g / count; dst[idx + 2] = b / count; dst[idx + 3] = src[idx + 3];
    }
  }
}

/** RGB to HSL */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [h * 360, s, l];
}

/** HSL to RGB */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360;
  h /= 360;
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}

/** Sobel edge detection — returns grayscale edge map */
function sobelEdges(src: Uint8ClampedArray, w: number, h: number): Float32Array {
  const edges = new Float32Array(w * h);
  const Kx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const Ky = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let gx = 0, gy = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = ((y + ky) * w + (x + kx)) * 4;
          const gray = (src[idx] * 0.299 + src[idx + 1] * 0.587 + src[idx + 2] * 0.114);
          const ki = (ky + 1) * 3 + (kx + 1);
          gx += gray * Kx[ki];
          gy += gray * Ky[ki];
        }
      }
      edges[y * w + x] = Math.sqrt(gx * gx + gy * gy);
    }
  }
  return edges;
}

/** Main cartoon/anime conversion pipeline */
function convertToCharacter(
  srcCanvas: HTMLCanvasElement,
  dstCanvas: HTMLCanvasElement,
  styleId: string
) {
  const style = CHARACTER_STYLES.find(s => s.id === styleId)!;
  const p = style.params;
  const W = srcCanvas.width;
  const H = srcCanvas.height;

  const srcCtx = srcCanvas.getContext('2d')!;
  const dstCtx = dstCanvas.getContext('2d')!;
  dstCanvas.width = W;
  dstCanvas.height = H;

  // 1 — Get source pixels
  const srcData = srcCtx.getImageData(0, 0, W, H);
  const src = srcData.data;

  // 2 — Hardware-accelerated smooth source via temporary canvas
  const blurCanvas = document.createElement('canvas');
  blurCanvas.width = W;
  blurCanvas.height = H;
  const blurCtx = blurCanvas.getContext('2d')!;
  blurCtx.filter = `blur(${p.smooth}px)`;
  blurCtx.drawImage(srcCanvas, 0, 0);
  const smoothedData = blurCtx.getImageData(0, 0, W, H);
  const smoothed = smoothedData.data;

  // 3 — Color quantization + HSL adjustments
  const quantized = new Uint8ClampedArray(smoothed.length);
  const factor = 255 / (p.quantizeLevels - 1);

  for (let i = 0; i < smoothed.length; i += 4) {
    let r = smoothed[i], g = smoothed[i + 1], b = smoothed[i + 2];

    // Quantize
    r = Math.round(r / factor) * factor;
    g = Math.round(g / factor) * factor;
    b = Math.round(b / factor) * factor;

    // HSL adjustments (saturation, brightness, hue shift)
    let [h, s, l] = rgbToHsl(r, g, b);
    h = (h + p.hueShift + 360) % 360;
    s = Math.min(s * p.saturation, 1);
    l = Math.min(l * p.brightness, 1);
    if (styleId === 'sketch') l = 1 - (1 - l) * 0.4;
    [r, g, b] = hslToRgb(h, s, l);

    quantized[i] = r;
    quantized[i + 1] = g;
    quantized[i + 2] = b;
    quantized[i + 3] = smoothed[i + 3];
  }

  // 4 — Edge detection on original
  const edges = sobelEdges(src, W, H);
  let maxEdge = 1;
  for (let i = 0; i < edges.length; i += 20) {
    if (edges[i] > maxEdge) maxEdge = edges[i];
  }

  // 5 — Compose: quantized colors + edge lines
  const result = new Uint8ClampedArray(src.length);
  for (let i = 0; i < W * H; i++) {
    const idx = i * 4;
    const edgeStrength = Math.min(edges[i] / (maxEdge * 0.5), 1);
    const isEdge = edgeStrength > p.edgeThreshold / 100;

    if (styleId === 'sketch') {
      const edgeVal = isEdge ? Math.max(0, 255 - edgeStrength * 300 * p.edgeWeight) : 255;
      result[idx] = edgeVal;
      result[idx + 1] = edgeVal;
      result[idx + 2] = edgeVal;
    } else if (isEdge) {
      const dim = Math.max(0, 1 - edgeStrength * p.edgeWeight * 1.5);
      result[idx] = quantized[idx] * dim;
      result[idx + 1] = quantized[idx + 1] * dim;
      result[idx + 2] = quantized[idx + 2] * dim;
    } else {
      result[idx] = quantized[idx];
      result[idx + 1] = quantized[idx + 1];
      result[idx + 2] = quantized[idx + 2];
    }
    result[idx + 3] = src[idx + 3];
  }

  const resultData = new ImageData(result, W, H);
  dstCtx.putImageData(resultData, 0, 0);
}

interface ImageToCharPageProps {
  onCastTo3DStage?: (modelUrl: string, modelName: string, actorName?: string, voice?: string) => void;
  onSetExactPhotoAsStageAvatar?: (url: string, name: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────
export const ImageToCharPage: React.FC<ImageToCharPageProps> = ({
  onCastTo3DStage,
  onSetExactPhotoAsStageAvatar,
}) => {
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [convertedUrl, setConvertedUrl] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState('anime');
  const [isConverting, setIsConverting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showBefore, setShowBefore] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isGenTTS, setIsGenTTS]     = useState(false);
  const [ttsText, setTtsText]       = useState('မင်္ဂလာပါ! ကျွန်မက AI Character ပါ!');
  const [ttsVoice, setTtsVoice]     = useState('my-MM-NilarNeural');
  const [audioUrl, setAudioUrl]     = useState<string | null>(null);

  const fileInputRef  = useRef<HTMLInputElement>(null);
  const srcCanvasRef  = useRef<HTMLCanvasElement>(null);
  const dstCanvasRef  = useRef<HTMLCanvasElement>(null);
  const imgRef        = useRef<HTMLImageElement | null>(null);
  const audioCtxRef   = useRef<AudioContext | null>(null);
  const analyserRef   = useRef<AnalyserNode | null>(null);
  const audioRef      = useRef<HTMLAudioElement | null>(null);
  const animRef       = useRef<number>(0);

  // ── Lip-sync animation on converted canvas ──
  useEffect(() => {
    if (!isSpeaking || !dstCanvasRef.current) return;
    const canvas = dstCanvasRef.current;
    const ctx = canvas.getContext('2d')!;
    let baseImageData: ImageData | null = null;
    try { baseImageData = ctx.getImageData(0, 0, canvas.width, canvas.height); } catch { return; }
    const W = canvas.width, H = canvas.height;

    let lastTime = performance.now();
    let mouth = 0;

    const loop = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      if (analyserRef.current) {
        const buf = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(buf);
        const avg = buf.slice(0, 24).reduce((a, b) => a + b, 0) / 24;
        mouth += (Math.min(avg / 85, 1) - mouth) * Math.min(dt * 18, 1);
      } else {
        mouth = Math.max(mouth - dt * 8, 0);
      }

      if (baseImageData) {
        ctx.putImageData(baseImageData, 0, 0);
        // Draw mouth open overlay on face area
        if (mouth > 0.05) {
          const mX = W * 0.5, mY = H * 0.72;
          const mW = W * 0.12, mH = mouth * H * 0.06;
          ctx.beginPath();
          ctx.ellipse(mX, mY, mW, mH, 0, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(5,2,10,${0.6 + mouth * 0.3})`;
          ctx.fill();
          if (mouth > 0.3) {
            ctx.beginPath();
            ctx.ellipse(mX, mY - mH * 0.3, mW * 0.75, mH * 0.35, 0, 0, Math.PI);
            ctx.fillStyle = `rgba(230,220,210,${(mouth - 0.3) * 0.85})`;
            ctx.fill();
          }
          // Glow
          const g = ctx.createRadialGradient(mX, mY, 0, mX, mY, mW * 1.5);
          g.addColorStop(0, `rgba(168,85,247,${mouth * 0.3})`);
          g.addColorStop(1, 'transparent');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.ellipse(mX, mY, mW * 1.5, mH * 2, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [isSpeaking]);

  // ── Load photo ──
  const loadImage = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    setOriginalUrl(url);
    setConvertedUrl(null);

    const img = new window.Image();
    img.onload = () => {
      imgRef.current = img;
    };
    img.src = url;
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) loadImage(f);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f?.type.startsWith('image/')) loadImage(f);
  };

  // ── Convert ──
  const handleConvert = useCallback(async () => {
    setIsConverting(true);

    try {
      // Fail-safe: ensure imgRef is ready
      if (!imgRef.current && originalUrl) {
        const img = new window.Image();
        await new Promise((res, rej) => {
          img.onload = () => { imgRef.current = img; res(null); };
          img.onerror = rej;
          img.src = originalUrl;
        });
      }

      if (!imgRef.current) return;

      // Run conversion in next tick to let UI show loading spinner
      await new Promise(r => setTimeout(r, 60));

      const img = imgRef.current;
      const targetW = 400;
      const targetH = Math.round(img.height * (targetW / img.width));

      // 1. Offscreen source canvas
      const srcCanvas = document.createElement('canvas');
      srcCanvas.width = targetW;
      srcCanvas.height = targetH;
      const srcCtx = srcCanvas.getContext('2d')!;
      srcCtx.drawImage(img, 0, 0, targetW, targetH);

      // 2. Offscreen destination canvas
      const dstCanvas = document.createElement('canvas');
      dstCanvas.width = targetW;
      dstCanvas.height = targetH;

      convertToCharacter(srcCanvas, dstCanvas, selectedStyle);

      const dataUrl = dstCanvas.toDataURL('image/png');
      setConvertedUrl(dataUrl);

      // 3. Draw directly onto the visible canvas if available
      if (dstCanvasRef.current) {
        dstCanvasRef.current.width = targetW;
        dstCanvasRef.current.height = targetH;
        const ctx = dstCanvasRef.current.getContext('2d');
        ctx?.drawImage(dstCanvas, 0, 0);
      }
    } catch (err) {
      console.error('Conversion failed:', err);
    } finally {
      setIsConverting(false);
    }
  }, [selectedStyle, originalUrl]);

  // Ensure converted image stays painted on visible canvas
  useEffect(() => {
    if (!convertedUrl || !dstCanvasRef.current) return;
    const canvas = dstCanvasRef.current;
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0);
    };
    img.src = convertedUrl;
  }, [convertedUrl]);

  // ── Download ──
  const handleDownload = () => {
    if (!convertedUrl) return;
    const a = document.createElement('a');
    a.href = convertedUrl;
    a.download = `auracraft_character_${selectedStyle}_${Date.now()}.png`;
    a.click();
  };

  // ── TTS Speak ──
  const handleSpeak = async () => {
    if (!ttsText.trim() || !convertedUrl) return;
    setIsGenTTS(true);
    try {
      const res = await fetch(API_ENDPOINTS.tts, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: ttsText, voice: ttsVoice, rate: '+0%', pitch: '+0Hz' }),
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);

      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const actx = audioCtxRef.current;
      if (actx.state === 'suspended') await actx.resume();
      const analyser = actx.createAnalyser(); analyser.fftSize = 64;
      analyserRef.current = analyser; analyser.connect(actx.destination);
      const audio = new Audio(url); audioRef.current = audio;
      const src = actx.createMediaElementSource(audio); src.connect(analyser);
      setIsSpeaking(true); audio.play();
      audio.onended = () => { setIsSpeaking(false); analyserRef.current = null; setIsGenTTS(false); };
    } catch {
      // Fallback
      const utt = new SpeechSynthesisUtterance(ttsText);
      setIsSpeaking(true);
      utt.onend = () => { setIsSpeaking(false); setIsGenTTS(false); };
      speechSynthesis.speak(utt);
    }
  };

  const handleStopSpeak = () => {
    audioRef.current?.pause(); speechSynthesis.cancel();
    analyserRef.current = null; setIsSpeaking(false); setIsGenTTS(false);
  };

  const curStyle = CHARACTER_STYLES.find(s => s.id === selectedStyle)!;

  return (
    <div className="flex h-full w-full overflow-hidden bg-[#070a12]">

      {/* ── LEFT: Preview Stage ── */}
      <div className="flex-1 flex flex-col items-center justify-center gap-5 bg-gradient-to-b from-[#0a0d14] to-[#07080f] p-6 relative">

        {/* Header */}
        <div className="absolute top-4 left-4 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-lg" style={{ background: `${curStyle.color}30`, border: `1px solid ${curStyle.color}50` }}>
            <Wand2 className="w-4 h-4" style={{ color: curStyle.color }} />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-200">Image → Character Convert</div>
            <div className="text-[10px] text-slate-500">ပုံကနေ Anime / Cartoon character ပြောင်းရန်</div>
          </div>
        </div>

        {originalUrl ? (
          <div className="flex flex-col items-center gap-4 mt-6">

            {/* Before / After comparison */}
            <div className="flex items-center gap-4">
              {/* Original */}
              <div className="flex flex-col items-center gap-1.5">
                <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">Original</div>
                <div className={`rounded-xl overflow-hidden border-2 shadow-xl transition-all ${showBefore ? 'border-slate-400' : 'border-[#1f293d]'}`}
                  style={{ width: 200, height: 260 }}>
                  <img src={originalUrl} alt="original" className="w-full h-full object-cover" style={{ objectPosition: 'center top' }} />
                </div>
              </div>

              {/* Arrow */}
              <div className="flex flex-col items-center gap-2">
                {isConverting
                  ? <Loader2 className="w-8 h-8 animate-spin" style={{ color: curStyle.color }} />
                  : <ArrowRight className="w-8 h-8 text-slate-500" />
                }
                <div className="text-[10px] text-slate-600">{curStyle.icon} {curStyle.label}</div>
              </div>

              {/* Converted */}
              <div className="flex flex-col items-center gap-1.5">
                <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: curStyle.color }}>Character</div>
                <div className={`relative rounded-xl overflow-hidden border-2 shadow-xl transition-all ${
                  isSpeaking
                    ? 'shadow-[0_0_30px_rgba(168,85,247,0.4)] border-purple-500'
                    : convertedUrl ? 'border-purple-700/50' : 'border-[#1f293d] border-dashed'
                }`} style={{ width: 200, height: 260, background: '#0c111e' }}>
                  
                  {/* Canvas is always mounted so ref is never null */}
                  <canvas
                    ref={dstCanvasRef}
                    className={`w-full h-full object-cover ${convertedUrl ? 'block' : 'hidden'}`}
                  />

                  {convertedUrl && isSpeaking && (
                    <div className="absolute top-2 right-2 flex items-center gap-1 bg-purple-600/90 px-2 py-0.5 rounded-full text-white text-[10px] font-bold animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" /> SPEAKING
                    </div>
                  )}

                  {!convertedUrl && (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                      <Sparkles className="w-8 h-8 text-slate-700" />
                      <div className="text-[11px] text-slate-600">Convert နှိပ်ပါ</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Hidden src canvas for processing */}
            <canvas ref={srcCanvasRef} className="hidden" />

            {/* Actions for original image */}
            <div className="flex flex-col items-center gap-2">
              {onSetExactPhotoAsStageAvatar && (
                <button
                  onClick={() => {
                    onSetExactPhotoAsStageAvatar(originalUrl, 'Uploaded Character (ပုံစံအတိအကျ)');
                  }}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-pink-600 via-rose-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white shadow-xl shadow-pink-600/40 hover:scale-[1.02] transition-all border border-pink-400/40"
                >
                  <Camera className="w-4 h-4 text-white" />
                  <span>📸 ဤပုံစံအတိအကျကို စင်ပေါ်တင်မည် (Use Exact Photo on Studio Stage)</span>
                </button>
              )}

              {/* Convert button */}
              {!convertedUrl && (
                <button
                  onClick={handleConvert}
                  disabled={isConverting}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs transition-all shadow-lg ${
                    isConverting
                      ? 'bg-purple-800/40 text-purple-300 cursor-not-allowed'
                      : 'text-white shadow-purple-900/40 hover:shadow-[0_0_20px_rgba(168,85,247,0.4)]'
                  }`}
                  style={{ background: isConverting ? undefined : `linear-gradient(to right, ${curStyle.color}cc, #a855f7cc)` }}>
                  {isConverting
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Converting...</>
                    : <><Wand2 className="w-4 h-4" /> Convert to {curStyle.label} {curStyle.icon}</>
                  }
                </button>
              )}
            </div>

            {/* Post-convert actions */}
            {convertedUrl && (
              <div className="flex flex-col items-center gap-3">
                {onCastTo3DStage && (
                  <button
                    onClick={() => {
                      onCastTo3DStage(
                        selectedStyle === 'anime' || selectedStyle === 'chibi'
                          ? '/models/avatar_female_a.vrm'
                          : '/models/avatar_female_c.vrm',
                        selectedStyle === 'anime' ? '🌸 Sakura (Anime 3D Idol)' : '💙 Nanami (Anime 3D Heroine)',
                        'Anime 3D Character',
                        'ja-JP-NanamiNeural'
                      );
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-xl shadow-purple-600/40 hover:scale-[1.02] transition-all border border-purple-400/30"
                  >
                    <Sparkles className="w-4 h-4 text-amber-300 animate-spin" />
                    <span>🌟 ပုံ ၂ ကလို 3D Character စင်ပေါ်သို့တင်မည် (Send to 3D Persona Stage)</span>
                  </button>
                )}

                <div className="flex items-center gap-2 flex-wrap justify-center">
                  <button onClick={handleDownload}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#111726] border border-[#1f293d] text-slate-300 hover:border-cyan-500/50 text-xs transition-all">
                    <Download className="w-3.5 h-3.5" /> PNG Download
                  </button>
                  <button onClick={() => { setConvertedUrl(null); handleConvert(); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#111726] border border-[#1f293d] text-slate-300 hover:border-purple-500/50 text-xs transition-all">
                    <RefreshCw className="w-3.5 h-3.5" /> ထပ်ပြောင်း
                  </button>
                  <button onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#111726] border border-[#1f293d] text-slate-300 hover:border-slate-400/50 text-xs transition-all">
                    <Upload className="w-3.5 h-3.5" /> ပုံပြောင်း
                  </button>
                </div>
              </div>
            )}
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
                ? 'border-purple-500 bg-purple-900/20'
                : 'border-[#2a3756] bg-[#0c111e]/60 hover:border-purple-600/50'
            }`}
            style={{ width: 480, height: 400 }}>
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-900/60 to-pink-900/40 flex items-center justify-center border border-purple-700/30">
              <Upload className="w-9 h-9 text-purple-400" />
            </div>
            <div className="text-center space-y-2">
              <div className="text-lg font-bold text-slate-200">ပုံတင်ပါ — Character ပြောင်းရန်</div>
              <div className="text-sm text-slate-500">မိမိ ဓာတ်ပုံ သို့မဟုတ် မည်သည့်ပုံမဆို upload လုပ်ပါ</div>
              <div className="text-xs text-slate-600">JPG · PNG · WEBP — Drag & Drop or Click</div>
            </div>
            <div className="flex items-center gap-6 text-xs text-slate-500">
              {CHARACTER_STYLES.map(s => (
                <span key={s.id} className="flex items-center gap-1">{s.icon} {s.label}</span>
              ))}
            </div>
          </div>
        )}

        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      </div>

      {/* ── RIGHT: Controls ── */}
      <aside className="w-72 border-l border-[#1f293d] bg-[#0c101c]/95 flex flex-col p-3 gap-3 overflow-y-auto flex-shrink-0">

        {/* Style Selector */}
        <div className="bg-[#111726] rounded-xl border border-[#1f293d] p-3">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            Character Style ရွေးချယ်ပါ
          </div>
          <div className="space-y-1.5">
            {CHARACTER_STYLES.map(style => (
              <button
                key={style.id}
                onClick={() => { setSelectedStyle(style.id); setConvertedUrl(null); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all border ${
                  selectedStyle === style.id
                    ? 'border-opacity-60 bg-opacity-20'
                    : 'border-[#1f293d] bg-[#0a0d14] hover:border-opacity-30'
                }`}
                style={selectedStyle === style.id
                  ? { borderColor: style.color, background: `${style.color}18` }
                  : {}}>
                <span className="text-2xl">{style.icon}</span>
                <div className="flex-1">
                  <div className="text-xs font-bold text-slate-200">{style.label}</div>
                  <div className="text-[10px] text-slate-500">{style.desc}</div>
                </div>
                {selectedStyle === style.id && (
                  <div className="w-2 h-2 rounded-full" style={{ background: style.color }} />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Convert CTA (also here for convenience) */}
        {originalUrl && (
          <button
            onClick={convertedUrl ? () => { setConvertedUrl(null); handleConvert(); } : handleConvert}
            disabled={isConverting}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm transition-all ${
              isConverting ? 'cursor-not-allowed opacity-60 bg-[#1f293d] text-slate-400' : 'text-white shadow-lg'
            }`}
            style={isConverting ? {} : { background: `linear-gradient(to right, ${curStyle.color}bb, #a855f7bb)` }}>
            {isConverting
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Converting...</>
              : <><Wand2 className="w-4 h-4" /> {convertedUrl ? '↺ ပြန်ပြောင်း' : `Convert → ${curStyle.label}`}</>
            }
          </button>
        )}

        {/* Speak Section — only after converted */}
        {convertedUrl && (
          <div className="bg-[#111726] rounded-xl border border-[#1f293d] p-3 space-y-3">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              Character ကို ပြောဆိုစေပါ
            </div>

            {/* Voice quick-pick */}
            <div className="grid grid-cols-2 gap-1">
              {[
                { id: 'my-MM-NilarNeural', label: '🇲🇲 Nilar ♀' },
                { id: 'my-MM-ThihaNeural', label: '🇲🇲 Thiha ♂' },
                { id: 'ja-JP-NanamiNeural', label: '🇯🇵 Nanami ♀' },
                { id: 'en-US-JennyNeural', label: '🇺🇸 Jenny ♀' },
              ].map(v => (
                <button key={v.id} onClick={() => setTtsVoice(v.id)}
                  className={`px-2 py-1.5 rounded-lg text-[11px] transition-all border ${
                    ttsVoice === v.id
                      ? 'bg-cyan-700/30 border-cyan-500/60 text-cyan-300'
                      : 'bg-[#0a0d14] border-[#1f293d] text-slate-400 hover:border-cyan-500/30'
                  }`}>{v.label}</button>
              ))}
            </div>

            <textarea value={ttsText} onChange={e => setTtsText(e.target.value)} rows={3}
              placeholder="Character ပြောဆိုစေချင်တဲ့ စာသား..."
              className="w-full bg-[#0a0d14] border border-[#1f293d] rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 resize-none focus:outline-none focus:border-purple-500/60" />

            <button
              onClick={isSpeaking ? handleStopSpeak : handleSpeak}
              disabled={isGenTTS && !isSpeaking}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${
                isSpeaking
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-purple-900/30'
              }`}>
              {isSpeaking
                ? '⏹ Stop Speaking'
                : isGenTTS
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
                : <><Sparkles className="w-4 h-4" /> Generate &amp; Speak</>
              }
            </button>
          </div>
        )}

        {/* Info */}
        <div className="bg-gradient-to-br from-purple-900/20 to-indigo-900/10 rounded-xl border border-purple-700/30 p-3 text-xs text-slate-400 space-y-1.5">
          <div className="font-semibold text-purple-300 flex items-center gap-1.5">
            <Heart className="w-3.5 h-3.5" /> ဤ Feature အကြောင်း
          </div>
          <ul className="space-y-1 text-[11px]">
            <li>✅ 100% Client-side (API key မလို)</li>
            <li>✅ Canvas Sobel edge detection</li>
            <li>✅ Color quantization (anime palette)</li>
            <li>✅ HSL saturation / hue shift</li>
            <li>✅ 6 conversion styles</li>
            <li>✅ PNG download</li>
            <li>✅ Character talking lip-sync</li>
            <li>🔄 HQ AI conversion (backend upgrade)</li>
          </ul>
        </div>
      </aside>
    </div>
  );
};
