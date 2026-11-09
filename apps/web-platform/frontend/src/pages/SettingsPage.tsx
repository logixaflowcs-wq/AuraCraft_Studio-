import React, { useState, useEffect } from 'react';
import { API_BASE_URL, API_ENDPOINTS } from '../config/api';
import { clearCustomAssets } from '../utils/customAssetStore';
import { Settings, Server, CheckCircle2, AlertCircle, RefreshCw, Database, Trash2, Cpu, Globe, Send, ShieldCheck } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [edgeTtsStatus, setEdgeTtsStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [cleared, setCleared] = useState(false);

  const checkHealth = async () => {
    setApiStatus('checking');
    try {
      const res = await fetch(API_ENDPOINTS.health, { method: 'GET', signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error('Health endpoint returned ' + res.status);
      const health = await res.json();
      setApiStatus(health.status === 'healthy' ? 'online' : 'offline');
      setEdgeTtsStatus(health.integrations?.edge_tts === 'available' ? 'online' : 'offline');
    } catch {
      setApiStatus('offline');
      setEdgeTtsStatus('offline');
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  const handleClearCache = async () => {
    if (window.confirm('Clear all custom characters and reset to default factory presets?')) {
      localStorage.removeItem('auracraft_custom_chars');
      localStorage.removeItem('auracraft_custom_characters');
      localStorage.removeItem('auracraft_deleted_chars');
      await clearCustomAssets().catch((error) => console.warn('Unable to clear IndexedDB assets:', error));
      setCleared(true);
      setTimeout(() => setCleared(false), 2500);
      window.location.reload();
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0a0d14] text-slate-100 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="border-b border-[#1f293d] pb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-800/60 border border-[#23314f] rounded-xl text-slate-300">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              System Settings & Ecosystem Bridges (ဆက်တင်များ)
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Microservice health, Telegram notifications bridge, and storage management for AuraCraft Studio.
            </p>
          </div>
        </div>

        <button
          onClick={checkHealth}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#111726] hover:bg-[#1a233a] border border-[#23314f] text-slate-300 text-xs transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${apiStatus === 'checking' ? 'animate-spin' : ''}`} />
          Refresh Services
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Service Connectivity Grid */}
        <div className="bg-[#111726]/80 backdrop-blur-md border border-[#1f293d] p-6 rounded-2xl shadow-xl space-y-4">
          <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Server className="w-4 h-4 text-cyan-400" />
            Ecosystem Network & Microservices
          </h2>

          <div className="space-y-3 text-xs">
            {/* Backend API */}
            <div className="bg-[#0a0d14] p-3.5 rounded-xl border border-[#23314f] flex items-center justify-between">
              <div>
                <strong className="text-slate-200 block">AuraCraft Backend API</strong>
                <span className="text-[11px] text-slate-500 font-mono">{API_BASE_URL || "API URL not configured"}</span>
              </div>
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold ${apiStatus === 'online' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40' : 'bg-rose-950 text-rose-300 border border-rose-800/40'}`}>
                {apiStatus === 'online' ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                {apiStatus === 'checking' ? 'Checking' : apiStatus === 'online' ? 'Online' : 'Offline'}
              </span>
            </div>

            {/* Narrativ Forge Bridge */}
            <div className="bg-[#0a0d14] p-3.5 rounded-xl border border-[#23314f] flex items-center justify-between">
              <div>
                <strong className="text-slate-200 block">Narrativ Forge Bridge</strong>
                <span className="text-[11px] text-slate-500 font-mono">Standalone Decoupled (JSON Pack Exchanger)</span>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                Not configured
              </span>
            </div>

            {/* Edge-TTS Neural Service */}
            <div className="bg-[#0a0d14] p-3.5 rounded-xl border border-[#23314f] flex items-center justify-between">
              <div>
                <strong className="text-slate-200 block">Edge-TTS Multilingual Engine</strong>
                <span className="text-[11px] text-slate-500 font-mono">Burmese &bull; Japanese &bull; English Neural</span>
              </div>
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold ${edgeTtsStatus === 'online' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40' : 'bg-rose-950 text-rose-300 border border-rose-800/40'}`}>
                {edgeTtsStatus === 'online' ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                {edgeTtsStatus === 'checking' ? 'Checking' : edgeTtsStatus === 'online' ? 'Available' : 'Unavailable'}
              </span>
            </div>

            {/* Telegram Topic 215 */}
            <div className="bg-[#0a0d14] p-3.5 rounded-xl border border-[#23314f] flex items-center justify-between">
              <div>
                <strong className="text-slate-200 block">The Nexus Hub Telegram Alerts</strong>
                <span className="text-[11px] text-slate-500 font-mono">@AuraCraftNexusBot &bull; Topic 215</span>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                Configured · not live-checked
              </span>
            </div>
          </div>
        </div>

        {/* Data Storage & Reset */}
        <div className="bg-[#111726]/80 backdrop-blur-md border border-[#1f293d] p-6 rounded-2xl shadow-xl space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Database className="w-4 h-4 text-purple-400" />
              Local Character Library Cache
            </h2>

            <p className="text-xs text-slate-400 leading-relaxed">
              Custom character details are stored in browser LocalStorage; uploaded photos and VRM files are stored in IndexedDB so they can be restored after a refresh.
            </p>

            <div className="bg-[#0a0d14] p-4 rounded-xl border border-[#23314f] space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Character Storage:</span>
                <span className="text-purple-300 font-mono">Studio assets + persona library</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Persistence Mode:</span>
                <span className="text-emerald-400 font-semibold">LocalStorage + IndexedDB</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Microservice Boundary:</span>
                <span className="text-cyan-400 font-semibold">Decoupled Microservice</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[#1f293d] flex items-center justify-between">
            <span className="text-xs text-slate-500">Reset custom characters to factory defaults</span>
            <button
              onClick={handleClearCache}
              className="flex items-center gap-1.5 px-4 py-2 bg-rose-950/40 hover:bg-rose-900/50 border border-rose-800/40 text-rose-300 rounded-xl text-xs font-semibold transition-all shadow-sm"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {cleared ? 'Cleared!' : 'Reset Custom Characters'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
