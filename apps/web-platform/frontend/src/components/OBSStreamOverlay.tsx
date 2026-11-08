import React from 'react';
import { Video, Monitor, Cast, Eye } from 'lucide-react';

interface OBSStreamOverlayProps {
  bgMode: 'cyber' | 'greenscreen' | 'transparent';
  onSelectBgMode: (mode: 'cyber' | 'greenscreen' | 'transparent') => void;
  isOBSMode: boolean;
  onToggleOBSMode: () => void;
}

export const OBSStreamOverlay: React.FC<OBSStreamOverlayProps> = ({
  bgMode,
  onSelectBgMode,
  isOBSMode,
  onToggleOBSMode,
}) => {
  return (
    <div className="bg-[#111726]/80 backdrop-blur-md border border-[#1f293d] rounded-xl p-3">
      <div className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <Video className="w-3.5 h-3.5 text-rose-400" />
          OBS Studio & Broadcast Mode
        </span>
        <button
          onClick={onToggleOBSMode}
          className={`text-[10px] px-2 py-0.5 rounded border transition-all ${
            isOBSMode
              ? 'bg-rose-500/20 border-rose-500 text-rose-300 font-bold'
              : 'bg-slate-800 border-slate-700 text-slate-400'
          }`}
        >
          {isOBSMode ? '🔴 LIVE OVERLAY ON' : 'OBS Overlay Off'}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-1.5 mb-2">
        <button
          onClick={() => onSelectBgMode('cyber')}
          className={`p-1.5 rounded-lg border text-center text-[10px] transition-all ${
            bgMode === 'cyber'
              ? 'bg-cyan-500/15 border-cyan-500 text-cyan-300'
              : 'bg-[#0a0d14] border-slate-800 text-slate-400'
          }`}
        >
          Cyber Dark
        </button>
        <button
          onClick={() => onSelectBgMode('greenscreen')}
          className={`p-1.5 rounded-lg border text-center text-[10px] transition-all ${
            bgMode === 'greenscreen'
              ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold'
              : 'bg-[#0a0d14] border-slate-800 text-slate-400'
          }`}
        >
          Green Screen
        </button>
        <button
          onClick={() => onSelectBgMode('transparent')}
          className={`p-1.5 rounded-lg border text-center text-[10px] transition-all ${
            bgMode === 'transparent'
              ? 'bg-purple-500/20 border-purple-500 text-purple-300 font-bold'
              : 'bg-[#0a0d14] border-slate-800 text-slate-400'
          }`}
        >
          Alpha Transparent
        </button>
      </div>

      <p className="text-[10px] text-slate-400 leading-relaxed">
        💡 <span className="text-slate-300 font-medium">OBS Streaming Tip:</span> Add a Browser Source in OBS with URL{' '}
        <code className="text-cyan-400 bg-slate-900 px-1 py-0.5 rounded text-[9px]">http://localhost:5180/?obs=true</code>{' '}
        and check &quot;Shutdown source when not visible&quot;.
      </p>
    </div>
  );
};
