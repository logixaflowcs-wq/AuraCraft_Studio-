import React from 'react';
import { Smile, Frown, Flame, HelpCircle, Meh, Sparkles } from 'lucide-react';

interface EmotionPaletteProps {
  currentEmotion: string;
  onSelectEmotion: (emotion: string) => void;
}

export const EmotionPalette: React.FC<EmotionPaletteProps> = ({
  currentEmotion,
  onSelectEmotion,
}) => {
  const emotions = [
    { id: 'neutral', label: 'Neutral', icon: Meh, color: 'text-slate-400 border-slate-700' },
    { id: 'happy', label: 'Happy', icon: Smile, color: 'text-emerald-400 border-emerald-800/60' },
    { id: 'surprised', label: 'Surprised', icon: Sparkles, color: 'text-amber-400 border-amber-800/60' },
    { id: 'angry', label: 'Angry', icon: Flame, color: 'text-rose-400 border-rose-800/60' },
    { id: 'sad', label: 'Sad', icon: Frown, color: 'text-indigo-400 border-indigo-800/60' },
  ];

  return (
    <div className="bg-[#111726]/80 backdrop-blur-md border border-[#1f293d] rounded-xl p-3">
      <div className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider flex items-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
        Facial Expression Palette
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {emotions.map((em) => {
          const Icon = em.icon;
          const isActive = currentEmotion === em.id;
          return (
            <button
              key={em.id}
              onClick={() => onSelectEmotion(em.id)}
              className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all text-xs font-medium ${
                isActive
                  ? 'bg-cyan-500/15 border-cyan-500 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
                  : 'bg-[#0a0d14]/60 border-slate-800/80 hover:border-slate-700 text-slate-400'
              }`}
            >
              <Icon className={`w-4 h-4 mb-1 ${isActive ? 'text-cyan-400' : em.color}`} />
              <span className="text-[10px]">{em.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
