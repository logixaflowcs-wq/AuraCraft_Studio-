import React, { useState } from 'react';
import { buildObsSourceUrl } from './broadcastUtils';
import { Tv, Copy, Check, ExternalLink, ShieldCheck, Monitor, Sparkles, Layers, Sliders } from 'lucide-react';

export const BroadcastPage: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const [streamBg, setStreamBg] = useState<'transparent' | 'greenscreen' | 'cyber'>('transparent');
  const [resolution, setResolution] = useState('1080p');

  // FIX(audit-3-F): include both selected background and resolution in the OBS source URL.
  const obsUrl = buildObsSourceUrl(window.location.origin, streamBg, resolution);

  const handleCopy = () => {
    navigator.clipboard.writeText(obsUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0a0d14] text-slate-100 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="border-b border-[#1f293d] pb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-600/20 border border-emerald-500/40 rounded-xl text-emerald-400">
            <Tv className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              OBS Studio & Live Broadcast Command (တိုက်ရိုက်ထုတ်လွှင့်မှု)
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800/40">
                60 FPS Live Overlay
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Integrate your 3D persona directly into OBS Studio, Streamlabs, and vMix with real-time lip-sync and zero latency.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: OBS URL & Modes (7 cols) */}
        <div className="lg:col-span-7 space-y-5 bg-[#111726]/80 backdrop-blur-md border border-[#1f293d] p-6 rounded-2xl shadow-xl">
          <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Monitor className="w-4 h-4 text-cyan-400" />
            OBS Browser Source Configuration
          </h2>

          {/* Browser Source URL box */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Browser Source URL (OBS ထဲသို့ ထည့်သွင်းရမည့် Link)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={obsUrl}
                className="flex-1 bg-[#0a0d14] border border-[#23314f] rounded-xl px-3.5 py-2.5 text-xs text-cyan-300 font-mono select-all focus:outline-none"
              />
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-cyan-600/20 transition-all"
              >
                {copied ? <Check className="w-4 h-4 text-slate-950" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
            </div>
          </div>

          {/* Background Mode Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Streaming Background Alpha
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  id: 'transparent',
                  name: 'Alpha Transparent',
                  desc: 'Clean 100% transparent background for game & camera overlay.',
                  color: 'border-cyan-500 bg-cyan-950/20 text-cyan-300',
                },
                {
                  id: 'greenscreen',
                  name: 'Chroma Green (#00FF00)',
                  desc: 'Solid green for OBS Chroma Key filter.',
                  color: 'border-emerald-500 bg-emerald-950/20 text-emerald-300',
                },
                {
                  id: 'cyber',
                  name: 'Cyber Dark Stage',
                  desc: 'Deep cyberpunk stage with pedestal and rim lighting.',
                  color: 'border-purple-500 bg-purple-950/20 text-purple-300',
                },
              ].map((m) => (
                <div
                  key={m.id}
                  onClick={() => setStreamBg(m.id as any)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    streamBg === m.id
                      ? `${m.color} ring-1 ring-cyan-500/50 shadow-md`
                      : 'bg-[#0a0d14] border-[#1f293d] hover:border-slate-700 text-slate-400'
                  }`}
                >
                  <div className="text-xs font-bold mb-1">{m.name}</div>
                  <div className="text-[10px] leading-relaxed opacity-80">{m.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Resolution & FPS */}
          <div className="pt-2">
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Output Canvas Specs
            </label>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="bg-[#0a0d14] p-3 rounded-xl border border-[#23314f]">
                <span className="text-[10px] text-slate-400 block">Resolution</span>
                <select
                  aria-label="OBS resolution"
                  value={resolution}
                  onChange={(event) => setResolution(event.target.value)}
                  className="mt-1 w-full bg-[#111726] border border-[#23314f] rounded-lg px-2 py-1 text-slate-200"
                >
                  <option value="1080p">1920 × 1080 (FHD)</option>
                  <option value="720p">1280 × 720 (HD)</option>
                  <option value="480p">854 × 480 (SD)</option>
                </select>
              </div>
              <div className="bg-[#0a0d14] p-3 rounded-xl border border-[#23314f]">
                <span className="text-[10px] text-slate-400 block">Target Framerate</span>
                <span className="font-bold text-emerald-400">60 FPS WebGL</span>
              </div>
              <div className="bg-[#0a0d14] p-3 rounded-xl border border-[#23314f]">
                <span className="text-[10px] text-slate-400 block">Latency</span>
                <span className="font-bold text-cyan-400">&lt; 15 ms (Local)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Step-by-step Setup Guide (5 cols) */}
        <div className="lg:col-span-5 space-y-4 bg-[#111726]/80 backdrop-blur-md border border-[#1f293d] p-6 rounded-2xl shadow-xl">
          <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-purple-400" />
            OBS Studio တွင် ထည့်သွင်းနည်းလမ်းညွှန်
          </h2>

          <div className="space-y-3.5 text-xs text-slate-300">
            <div className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-purple-600/30 text-purple-300 font-bold flex items-center justify-center text-xs flex-shrink-0 border border-purple-500/40">
                1
              </span>
              <div>
                <strong className="text-white block mb-0.5">OBS Studio ကို ဖွင့်ပါ</strong>
                <p className="text-[11px] text-slate-400">Sources အကွက်တွင် <span className="text-cyan-300 font-mono">+ (Add Source)</span> ကို နှိပ်ပြီး <span className="text-purple-300 font-semibold">Browser</span> ကို ရွေးချယ်ပါ။</p>
              </div>
            </div>

            <div className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-purple-600/30 text-purple-300 font-bold flex items-center justify-center text-xs flex-shrink-0 border border-purple-500/40">
                2
              </span>
              <div>
                <strong className="text-white block mb-0.5">URL ကို ကူးယူထည့်ပါ</strong>
                <p className="text-[11px] text-slate-400">ဘယ်ဘက်ရှိ <span className="text-cyan-300 font-mono">Copy Link</span> ကို နှိပ်ပြီး URL နေရာတွင် ထည့်ပါ။ Width: 1920, Height: 1080 ဟု သတ်မှတ်ပါ။</p>
              </div>
            </div>

            <div className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-purple-600/30 text-purple-300 font-bold flex items-center justify-center text-xs flex-shrink-0 border border-purple-500/40">
                3
              </span>
              <div>
                <strong className="text-white block mb-0.5">Control Audio via OBS</strong>
                <p className="text-[11px] text-slate-400"><span className="text-emerald-300">"Control audio via OBS"</span> ကို အမှန်ခြစ်ပေးပါက အသံနှင့် နှုတ်ခမ်းလှုပ်ရှားမှု (Lip-Sync) ကို OBS Mixer တွင် တိုက်ရိုက် ထိန်းချုပ်နိုင်မည် ဖြစ်ပါသည်။</p>
              </div>
            </div>

            <div className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-purple-600/30 text-purple-300 font-bold flex items-center justify-center text-xs flex-shrink-0 border border-purple-500/40">
                4
              </span>
              <div>
                <strong className="text-white block mb-0.5">တိုက်ရိုက်လွှင့်ရန် အဆင်သင့်ဖြစ်ပါပြီ</strong>
                <p className="text-[11px] text-slate-400">စကားပြောလိုက်သည်နှင့် 3D Avatar ၏ မျက်တောင်ခတ်ခြင်း၊ ခေါင်းလှုပ်ရှားခြင်းနှင့် ပါးစပ် လှုပ်ရှားမှုများကို Live Stream တွင် တွေ့မြင်ရပါမည်။</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
