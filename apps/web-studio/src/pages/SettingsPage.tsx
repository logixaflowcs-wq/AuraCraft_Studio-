import React, { useState, useEffect } from 'react';
import { clearAllLocalData } from '../db/database';
import { API_BASE_URL, API_ENDPOINTS } from '../config/api';
import { Settings, Server, CheckCircle2, AlertCircle, RefreshCw, Database, Trash2, Cpu, Globe, Send, ShieldCheck, Loader2 } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [cleared, setCleared] = useState(false);
  const [telegramStatus, setTelegramStatus] = useState<string | null>(null);
  const [isTestingTelegram, setIsTestingTelegram] = useState(false);

  const checkHealth = async () => {
    setApiStatus('checking');
    try {
      const res = await fetch(API_BASE_URL + '/ready', { method: 'GET' });
      if (res.ok) setApiStatus('online');
      else setApiStatus('offline');
    } catch {
      // FIX(audit-3-G): a failed readiness request is offline, never a synthetic success.
      setApiStatus('offline');
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  const handleTestTelegram = async () => {
    setIsTestingTelegram(true);
    setTelegramStatus('Checking Telegram bot credentials...');
    try {
      // FIX(audit-3-G): call the backend getMe proxy; /health cannot verify bot credentials.
      const res = await fetch(API_BASE_URL + '/api/telegram/test');
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error('Telegram bot check failed');
      setTelegramStatus('✅ Bot connected: @' + (data.username || 'unknown'));
    } catch {
      setTelegramStatus('❌ Telegram bot check failed. Verify backend bot configuration.');
    } finally {
      setIsTestingTelegram(false);
    }
  };

  const handleClearCache = async () => {
    if (window.confirm('Clear all custom characters and reset to default factory presets?')) {
      try {
        // FIX(audit-3-A): clear every Dexie table as well as localStorage.
        await clearAllLocalData();
        localStorage.clear();
        setCleared(true);
        window.location.reload();
      } catch {
        setCleared(false);
        setTelegramStatus('❌ Could not clear local database. Close other tabs and retry.');
      }
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
                <span className="text-[11px] text-slate-500 font-mono break-all">{API_BASE_URL}</span>
              </div>
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${
                apiStatus === 'online' ? 'bg-emerald-950 text-emerald-400 border-emerald-800/40' :
                apiStatus === 'offline' ? 'bg-rose-950 text-rose-300 border-rose-800/40' :
                'bg-slate-800 text-slate-300 border-slate-700'
              }`}>
                {apiStatus === 'online' ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                {apiStatus === 'online' ? 'Online' : apiStatus === 'offline' ? 'Offline' : 'Checking'}
              </span>
            </div>

            {/* Narrativ Forge Bridge */}
            <div className="bg-[#0a0d14] p-3.5 rounded-xl border border-[#23314f] flex items-center justify-between">
              <div>
                <strong className="text-slate-200 block">Narrativ Forge Bridge</strong>
                <span className="text-[11px] text-slate-500 font-mono">Standalone Decoupled (JSON Pack Exchanger)</span>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-purple-950 text-purple-300 border border-purple-800/40">
                <CheckCircle2 className="w-3 h-3" />
                Decoupled Clean
              </span>
            </div>

            {/* Edge-TTS Neural Service */}
            <div className="bg-[#0a0d14] p-3.5 rounded-xl border border-[#23314f] flex items-center justify-between">
              <div>
                <strong className="text-slate-200 block">Edge-TTS Multilingual Engine</strong>
                <span className="text-[11px] text-slate-500 font-mono">Burmese &bull; Japanese &bull; English Neural</span>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800/40">
                <CheckCircle2 className="w-3 h-3" />
                Zero-Cost Ready
              </span>
            </div>

            {/* Telegram Topic 215 */}
            <div className="bg-[#0a0d14] p-3.5 rounded-xl border border-[#23314f] flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div>
                  <strong className="text-slate-200 block">The Nexus Hub Telegram Alerts</strong>
                  <span className="text-[11px] text-slate-500 font-mono">Configured by administrator</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleTestTelegram}
                    disabled={isTestingTelegram}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-900/40 hover:bg-blue-800/60 border border-blue-600/40 text-blue-300 text-[10px] font-semibold transition-all"
                  >
                    {isTestingTelegram ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                    Test Bridge
                  </button>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-blue-950 text-blue-300 border border-blue-800/40">
                    Topic 215
                  </span>
                </div>
              </div>
              {telegramStatus && (
                <div className="text-[11px] font-mono text-cyan-300 bg-[#111726] px-2.5 py-1 rounded-lg border border-[#1f293d]">
                  {telegramStatus}
                </div>
              )}
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
              Custom characters, personality prompts, and voice pairings created in AuraCraft Studio are stored securely in your browser's persistent local storage.
            </p>

            <div className="bg-[#0a0d14] p-4 rounded-xl border border-[#23314f] space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Character files:</span>
                <span className="text-emerald-400 font-semibold">Browser IndexedDB</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Preferences:</span>
                <span className="text-slate-300 font-semibold">Browser storage</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Scope:</span>
                <span className="text-cyan-400 font-semibold">This browser only</span>
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
