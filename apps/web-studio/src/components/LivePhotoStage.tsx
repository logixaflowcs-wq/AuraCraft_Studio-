import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Upload, Sparkles, Volume2, Camera, RefreshCw,
  User, CheckCircle2, Sliders, Maximize2, ShieldCheck, Heart, Radio, Trash2, RotateCcw
} from 'lucide-react';
import { lipSync } from '../audio/lipSyncAnalyzer';
import { translations, type Language } from '../utils/i18n';

export interface PhotoCharacter {
  id: string;
  name: string;
  category: 'anime' | 'realistic';
  url: string;
  badge: string;
  defaultVoice: string;
  defaultEmotion: string;
  mouthY?: number;
}

export const PRESET_PHOTO_CHARACTERS: PhotoCharacter[] = [
  {
    id: 'char_blue_kimono',
    name: 'Aoi (Blue Hair Kimono)',
    category: 'anime',
    url: '/avatars/blue_hair_girl.jpg',
    badge: '🌸 Realistic Cosplay',
    defaultVoice: 'ja-JP-NanamiNeural',
    defaultEmotion: 'neutral',
    mouthY: 0.65,
  },
  {
    id: 'char_blonde_cosplay',
    name: 'Elena (Blonde Cosplay)',
    category: 'anime',
    url: '/avatars/blonde_cosplay_girl.jpg',
    badge: '🌸 Realistic Cosplay',
    defaultVoice: 'ja-JP-NanamiNeural',
    defaultEmotion: 'happy',
    mouthY: 0.66,
  },
  {
    id: 'char_realistic_diplomat',
    name: 'Daw Khin Than (Diplomat)',
    category: 'realistic',
    url: '/avatars/blue_hair_girl.jpg',
    badge: '👤 Real Human Diplomat',
    defaultVoice: 'my-MM-NilarNeural',
    defaultEmotion: 'neutral',
    mouthY: 0.65,
  },
  {
    id: 'char_realistic_anchor',
    name: 'Ko Phyo (News Anchor)',
    category: 'realistic',
    url: '/avatars/blonde_cosplay_girl.jpg',
    badge: '👤 Real Human Anchor',
    defaultVoice: 'my-MM-ThihaNeural',
    defaultEmotion: 'neutral',
    mouthY: 0.66,
  },
];

interface LivePhotoStageProps {
  currentEmotion: string;
  bgMode: 'cyber' | 'greenscreen' | 'transparent';
  isSpeaking: boolean;
  activeCharacterUrl: string;
  activeCharacterName: string;
  lang?: Language;
  onSelectCharacter?: (char: PhotoCharacter) => void;
  onUploadCustomPhoto?: (file: File) => void;
  onResetPhoto?: () => void;
}

export const LivePhotoStage: React.FC<LivePhotoStageProps> = ({
  currentEmotion,
  bgMode,
  isSpeaking,
  activeCharacterUrl,
  activeCharacterName,
  lang = 'en',
  onSelectCharacter,
  onUploadCustomPhoto,
  onResetPhoto,
}) => {
  const t = translations[lang] || translations.en;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const animFrameRef = useRef<number>(0);

  const [imageLoaded, setImageLoaded] = useState(false);
  const [currentZoom, setCurrentZoom] = useState<'bust' | 'face' | 'full'>('bust');
  const [mouthYPercent, setMouthYPercent] = useState<number>(0.65);
  const [activeCategory, setActiveCategory] = useState<'all' | 'anime' | 'realistic'>('all');

  // Load source image
  useEffect(() => {
    setImageLoaded(false);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgRef.current = img;
      setImageLoaded(true);
    };
    img.src = activeCharacterUrl;
  }, [activeCharacterUrl]);

  // Handle local file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUploadCustomPhoto) {
      onUploadCustomPhoto(file);
    }
  };

  // Main Animation & High-Fidelity Lip-Sync Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let lastTime = performance.now();
    let mouthOpen = 0;

    const renderLoop = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      // Real-time speech amplitude from lipSync analyzer
      const visemes = lipSync.getVisemes();
      const currentEnergy = Math.max(visemes.aa, visemes.ih, visemes.ou, visemes.ee || 0);

      if (isSpeaking) {
        const target = Math.max(currentEnergy, 0.15 + Math.random() * 0.45);
        mouthOpen += (target - mouthOpen) * Math.min(dt * 18, 1);
      } else {
        mouthOpen = Math.max(mouthOpen - dt * 8, 0);
      }

      // Subtle natural breathing float
      const tSec = now * 0.0015;
      const breathScale = 1.0 + Math.sin(tSec * 1.8) * 0.002;
      const headSway = Math.sin(tSec * 0.9) * 0.25; // degrees

      const img = imgRef.current;
      if (img && img.complete) {
        const W = canvas.width;
        const H = canvas.height;

        ctx.clearRect(0, 0, W, H);

        // Background styling
        if (bgMode === 'greenscreen') {
          ctx.fillStyle = '#00ff00';
          ctx.fillRect(0, 0, W, H);
        } else if (bgMode === 'transparent') {
          // transparent
        } else {
          // Cyber dark studio backdrop
          const bgGrad = ctx.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, Math.max(W, H) * 0.8);
          bgGrad.addColorStop(0, '#131b2e');
          bgGrad.addColorStop(0.6, '#0b0f19');
          bgGrad.addColorStop(1, '#06080d');
          ctx.fillStyle = bgGrad;
          ctx.fillRect(0, 0, W, H);

          // Studio Stage Circular Podium Glow
          ctx.save();
          ctx.beginPath();
          ctx.ellipse(W / 2, H * 0.92, W * 0.38, H * 0.07, 0, 0, Math.PI * 2);
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 3;
          ctx.shadowColor = '#06b6d4';
          ctx.shadowBlur = 20;
          ctx.stroke();
          ctx.restore();
        }

        // Draw character with natural breathing and jaw-drop morph
        ctx.save();
        ctx.translate(W / 2, H / 2);
        ctx.rotate((headSway * Math.PI) / 180);
        ctx.scale(breathScale, breathScale);

        // Aspect ratio preserve
        let renderW = W * 0.85;
        let renderH = renderW * (img.height / img.width);
        if (currentZoom === 'face') {
          renderW = W * 1.35;
          renderH = renderW * (img.height / img.width);
        } else if (currentZoom === 'full') {
          renderW = W * 0.65;
          renderH = renderW * (img.height / img.width);
        }

        const x0 = -renderW / 2;
        const y0 = -renderH / 2 + (currentZoom === 'face' ? renderH * 0.15 : 0);

        // 1. Upper portion (forehead, eyes, nose) — 100% CRYSTAL CLEAR NATURAL PHOTO
        const splitPercent = mouthYPercent;
        const splitSrcY = img.height * splitPercent;
        const splitDstY = renderH * splitPercent;
        const jawStretch = mouthOpen * renderH * 0.038;

        ctx.drawImage(
          img,
          0, 0, img.width, splitSrcY,
          x0, y0, renderW, splitDstY
        );

        // 2. Lower portion (jaw, chin, neck, body) — moves naturally when speaking
        ctx.drawImage(
          img,
          0, splitSrcY, img.width, img.height - splitSrcY,
          x0, y0 + splitDstY + jawStretch * 0.6, renderW, renderH - splitDstY + jawStretch * 0.4
        );

        // 3. Natural inner mouth shadow & soft teeth glimpse when open
        if (mouthOpen > 0.08) {
          const mouthCenterX = 0;
          const mouthCenterY = y0 + splitDstY + jawStretch * 0.15;
          const mouthWidth = renderW * 0.18;
          const mouthHeight = Math.max(jawStretch * 0.8, 2);

          // Deep inner mouth cavity
          ctx.beginPath();
          ctx.ellipse(mouthCenterX, mouthCenterY, mouthWidth * 0.5, mouthHeight * 0.55, 0, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(18, 5, 12, ${0.75 + mouthOpen * 0.2})`;
          ctx.fill();

          // Subtle upper teeth hint
          if (mouthOpen > 0.22) {
            ctx.beginPath();
            ctx.ellipse(mouthCenterX, mouthCenterY - mouthHeight * 0.2, mouthWidth * 0.35, mouthHeight * 0.3, 0, 0, Math.PI);
            ctx.fillStyle = `rgba(245, 240, 235, ${(mouthOpen - 0.22) * 0.85})`;
            ctx.fill();
          }
        }

        // 4. Emotion lighting overlay
        if (currentEmotion === 'happy') {
          ctx.fillStyle = 'rgba(250, 204, 21, 0.03)';
          ctx.fillRect(x0, y0, renderW, renderH);
        } else if (currentEmotion === 'angry') {
          ctx.fillStyle = 'rgba(239, 68, 68, 0.04)';
          ctx.fillRect(x0, y0, renderW, renderH);
        } else if (currentEmotion === 'sad') {
          ctx.fillStyle = 'rgba(59, 130, 246, 0.03)';
          ctx.fillRect(x0, y0, renderW, renderH);
        }

        // 5. Speaking aura glow
        if (isSpeaking && mouthOpen > 0.1) {
          ctx.beginPath();
          ctx.ellipse(0, y0 + renderH * 0.5, renderW * 0.52, renderH * 0.52, 0, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(168, 85, 247, ${mouthOpen * 0.35})`;
          ctx.lineWidth = 3;
          ctx.stroke();
        }

        ctx.restore();
      }

      animFrameRef.current = requestAnimationFrame(renderLoop);
    };

    animFrameRef.current = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [bgMode, currentEmotion, isSpeaking, currentZoom, mouthYPercent]);

  return (
    <div className="relative w-full h-full overflow-hidden select-none bg-[#0a0d14]">
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={1280}
        height={720}
        className="w-full h-full object-contain"
      />

      {/* Hidden File Input for Custom Photo */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Top Floating Controls Bar */}
      <div className="absolute top-3 left-4 right-4 z-20 flex flex-col gap-2 pointer-events-auto">
        <div className="flex items-center gap-2 flex-wrap bg-[#0d1322]/95 backdrop-blur-md border border-[#23314f] p-2 rounded-xl shadow-2xl text-xs">
          {/* Categories */}
          <div className="flex items-center gap-1 border-r border-slate-700/60 pr-2">
            {[
              { id: 'all', label: t.catAll },
              { id: 'anime', label: t.catPhoto },
              { id: 'realistic', label: t.catRealistic },
            ].map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id as any)}
                className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                  activeCategory === cat.id
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Preset Photo Character Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 max-w-xl">
            {PRESET_PHOTO_CHARACTERS
              .filter(c => activeCategory === 'all' || c.category === activeCategory)
              .map(c => (
                <button
                  key={c.id}
                  onClick={() => {
                    if (c.mouthY) setMouthYPercent(c.mouthY);
                    if (onSelectCharacter) onSelectCharacter(c);
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap ${
                    activeCharacterName.includes(c.name.split(' ')[0])
                      ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-md shadow-pink-600/30 ring-1 ring-pink-400'
                      : 'bg-[#141b2d] text-slate-300 hover:bg-slate-800/60 border border-slate-700/40'
                  }`}
                >
                  <span>{c.name}</span>
                </button>
              ))}
          </div>

          {/* Right Actions: Remove/Reset Photo & Upload Any Photo */}
          <div className="flex items-center gap-1.5 ml-auto">
            {onResetPhoto && (
              <button
                onClick={onResetPhoto}
                className="flex items-center gap-1.5 bg-rose-950/60 hover:bg-rose-900/80 border border-rose-500/50 hover:border-rose-400 text-rose-300 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all shadow-md shadow-rose-950/40"
                title={t.removePhoto || 'Remove Photo / Reset to Default'}
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>{t.removePhoto || 'Remove Photo / Reset'}</span>
              </button>
            )}

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white px-3 py-1 rounded-lg text-[11px] font-semibold transition-all shadow-md shadow-pink-600/20"
              title="Upload any real photo, selfie, or cosplay image"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{t.uploadPhoto}</span>
            </button>
          </div>
        </div>

        {/* Sub-row: Camera Zoom & Mouth Position Calibration */}
        <div className="flex items-center justify-between bg-[#0a0f1d]/90 backdrop-blur-md border border-[#1b253b] px-3 py-1.5 rounded-xl shadow-lg text-[11px]">
          {/* Zoom Modes */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium">Camera:</span>
            {[
              { id: 'face', label: t.zoomFace },
              { id: 'bust', label: t.zoomBust },
              { id: 'full', label: t.zoomFull },
            ].map(z => (
              <button
                key={z.id}
                onClick={() => setCurrentZoom(z.id as any)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                  currentZoom === z.id
                    ? 'bg-pink-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {z.label}
              </button>
            ))}
          </div>

          {/* Mouth Position Slider */}
          <div className="flex items-center gap-2">
            <Sliders className="w-3 h-3 text-slate-400" />
            <span className="text-slate-400 text-[10px]">{t.mouthPos}:</span>
            <input
              type="range"
              min="0.55"
              max="0.75"
              step="0.01"
              value={mouthYPercent}
              onChange={(e) => setMouthYPercent(parseFloat(e.target.value))}
              className="w-24 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-pink-500"
            />
            <span className="text-[10px] text-pink-400 font-mono">
              {Math.round(mouthYPercent * 100)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
