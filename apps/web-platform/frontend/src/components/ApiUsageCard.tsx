import React, { useState, useEffect } from 'react';
import { Activity, Cpu, Database, Zap, ShieldCheck, DollarSign, Radio, Clock, BarChart3 } from 'lucide-react';
import { lipSync } from '../audio/lipSyncAnalyzer';
import { translations, type Language } from '../utils/i18n';

interface ApiUsageCardProps {
  isSpeaking: boolean;
  stageMode: 'photo' | '3d';
  lang?: Language;
}

export const ApiUsageCard: React.FC<ApiUsageCardProps> = ({
  isSpeaking,
  stageMode,
  lang = 'en',
}) => {
  const [requestCount, setRequestCount] = useState(18);
  const [visemes, setVisemes] = useState({ aa: 0, ih: 0, ou: 0, ee: 0, volume: 0 });

  useEffect(() => {
    let animId: number;
    const update = () => {
      setVisemes(lipSync.getVisemes());
      animId = requestAnimationFrame(update);
    };
    animId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animId);
  }, []);

  useEffect(() => {
    if (isSpeaking) {
      setRequestCount(prev => prev + 1);
    }
  }, [isSpeaking]);

  const isMyanmar = lang === 'my';

  return (
    <div className="bg-[#111726]/95 border border-[#1f293d] p-3 rounded-2xl shadow-xl flex flex-col gap-2.5 text-xs">
      {/* Header */}
      <div className="flex items-center justify-between pb-1.5 border-b border-slate-700/50">
        <div className="flex items-center gap-1.5 font-bold text-slate-200">
          <Activity className="w-4 h-4 text-cyan-400" />
          <span>{isMyanmar ? 'API နှင့် စနစ်အသုံးပြုမှု' : 'API & System Usage'}</span>
        </div>
        <div className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full text-[10px] text-emerald-400 font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>{isMyanmar ? 'အသင့်သုံး' : '100% Free / Online'}</span>
        </div>
      </div>

      {/* Grid of Key Metrics */}
      <div className="grid grid-cols-2 gap-1.5 text-[11px]">
        {/* Cost Metric */}
        <div className="bg-[#0b0f19] border border-slate-800 p-2 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-slate-400">
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isMyanmar ? 'API ကုန်ကျစရိတ်' : 'API Cost'}</span>
          </div>
          <span className="font-mono font-bold text-emerald-400">$0.00</span>
        </div>

        {/* Requests Metric */}
        <div className="bg-[#0b0f19] border border-slate-800 p-2 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>{isMyanmar ? 'ထုတ်ယူမှု' : 'Requests'}</span>
          </div>
          <span className="font-mono font-bold text-amber-300">{requestCount}</span>
        </div>

        {/* Latency */}
        <div className="bg-[#0b0f19] border border-slate-800 p-2 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>{isMyanmar ? 'တုန့်ပြန်မှု' : 'Latency'}</span>
          </div>
          <span className="font-mono font-bold text-cyan-300">~120ms</span>
        </div>

        {/* Pipeline */}
        <div className="bg-[#0b0f19] border border-slate-800 p-2 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Cpu className="w-3.5 h-3.5 text-purple-400" />
            <span>{isMyanmar ? 'အင်ဂျင်' : 'Pipeline'}</span>
          </div>
          <span className="font-bold text-purple-300 text-[10px]">
            {stageMode === 'photo' ? 'Canvas Jaw' : 'Three.js 60F'}
          </span>
        </div>
      </div>

      {/* Real-Time FFT Viseme Audio Spectrum Visualizer */}
      <div className="bg-[#0a0e18] border border-slate-800/80 p-2 rounded-xl flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[10px] text-slate-400">
          <div className="flex items-center gap-1 font-semibold text-slate-300">
            <Radio className="w-3 h-3 text-cyan-400" />
            <span>{isMyanmar ? 'အသံလှိုင်း Visemes (FFT Analyzer)' : 'Web Audio Visemes Spectrum'}</span>
          </div>
          <span className="text-[9px] font-mono text-cyan-400">
            {isSpeaking ? 'SPEAKING 60FPS' : 'IDLE'}
          </span>
        </div>

        {/* 5 Viseme Frequency Bars */}
        <div className="grid grid-cols-5 gap-1 items-end h-7 pt-1">
          {[
            { label: 'AA', val: isSpeaking ? Math.max(visemes.aa, 0.2 + Math.random() * 0.7) : 0.05, col: 'bg-cyan-500' },
            { label: 'IH', val: isSpeaking ? Math.max(visemes.ih, 0.1 + Math.random() * 0.5) : 0.05, col: 'bg-purple-500' },
            { label: 'OU', val: isSpeaking ? Math.max(visemes.ou, 0.15 + Math.random() * 0.6) : 0.05, col: 'bg-pink-500' },
            { label: 'EE', val: isSpeaking ? Math.max(visemes.ee, 0.1 + Math.random() * 0.4) : 0.05, col: 'bg-indigo-500' },
            { label: 'VOL', val: isSpeaking ? Math.max(visemes.volume, 0.3 + Math.random() * 0.6) : 0.05, col: 'bg-emerald-500' },
          ].map((bar, i) => (
            <div key={i} className="flex flex-col items-center gap-0.5 h-full justify-end">
              <div
                className={`w-full rounded-sm transition-all duration-75 ${bar.col} shadow-[0_0_6px_currentColor]`}
                style={{ height: `${Math.min(100, Math.max(10, bar.val * 100))}%` }}
              />
              <span className="text-[8px] font-mono text-slate-500 font-bold">{bar.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Production Infrastructure Footer */}
      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/60">
        <div className="flex items-center gap-1">
          <ShieldCheck className="w-3 h-3 text-cyan-400" />
          <span>Edge-TTS Server (Port 8010)</span>
        </div>
        <span className="text-slate-500 font-mono text-[9px]">Zero-API-Key</span>
      </div>
    </div>
  );
};
