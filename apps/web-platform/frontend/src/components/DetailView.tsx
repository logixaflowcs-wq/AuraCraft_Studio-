/**
 * AuraCraft Studio — Detail View
 *
 * Full-screen panel shown when a character card is clicked.
 * Features:
 *   - 3D VRM Preview with OrbitControls (reuses existing VRM loader pattern)
 *   - Reference Sheet display (5-angle identity grid)
 *   - Identity prompt display + PromptBuilder
 *   - Export and Snapshot actions
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { VRMLoaderPlugin, VRMUtils, type VRM } from '@pixiv/three-vrm';
import {
  X, Download, Camera, RefreshCw, Layers,
  FileText, Info, Tag, ChevronDown, ChevronUp
} from 'lucide-react';
import { PromptBuilder } from './PromptBuilder';
import { exportCharacterAsAura } from '../services/exportService';
import { updateCharacter } from '../services/characterService';
import type { Character } from '../types/character';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────
interface DetailViewProps {
  character: Character;
  onClose: () => void;
  onCharacterUpdated?: (updated: Character) => void;
}

// ─────────────────────────────────────────────
// Active Panel Type
// ─────────────────────────────────────────────
type DetailPanel = 'info' | 'prompt' | 'refsheet';

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────
export const DetailView: React.FC<DetailViewProps> = ({
  character,
  onClose,
  onCharacterUpdated,
}) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const vrmRef = useRef<VRM | null>(null);
  const animFrameRef = useRef<number>(0);

  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [refSheetUrl, setRefSheetUrl] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<DetailPanel>('info');
  const [vrmLoaded, setVrmLoaded] = useState(false);
  const [vrmError, setVrmError] = useState<string | null>(null);
  const [currentCharacter, setCurrentCharacter] = useState(character);

  // ── Create object URLs for blobs ──
  useEffect(() => {
    if (character.thumbnailBlob) {
      const url = URL.createObjectURL(character.thumbnailBlob);
      setThumbnailUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [character.thumbnailBlob]);

  useEffect(() => {
    if (character.referenceSheetBlob) {
      const url = URL.createObjectURL(character.referenceSheetBlob);
      setRefSheetUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [character.referenceSheetBlob]);

  // ── Three.js VRM Viewer Setup ──
  useEffect(() => {
    if (!viewportRef.current || !character.vrmBlob) {
      setVrmError('No VRM model available for this character.');
      return;
    }

    const container = viewportRef.current;
    const W = container.clientWidth;
    const H = container.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d121f);
    sceneRef.current = scene;

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(1, 2, 2);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x8888ff, 0.4);
    fill.position.set(-2, 1, 1);
    scene.add(fill);

    // Grid helper (subtle)
    const grid = new THREE.GridHelper(4, 20, 0x1f293d, 0x1f293d);
    scene.add(grid);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Camera
    const camera = new THREE.PerspectiveCamera(30, W / H, 0.01, 50);
    camera.position.set(0, 1.3, 2.8);
    camera.lookAt(0, 1.0, 0);
    cameraRef.current = camera;

    // OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.0, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.5;
    controls.maxDistance = 8;
    controls.update();
    controlsRef.current = controls;

    // Load VRM
    const vrmUrl = URL.createObjectURL(character.vrmBlob);
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    loader.load(
      vrmUrl,
      (gltf) => {
        URL.revokeObjectURL(vrmUrl);
        const vrm: VRM = gltf.userData.vrm;
        if (!vrm) {
          setVrmError('Invalid VRM file.');
          return;
        }
        VRMUtils.rotateVRM0(vrm);
        scene.add(vrm.scene);
        vrmRef.current = vrm;
        setVrmLoaded(true);
      },
      undefined,
      (err: unknown) => {
        URL.revokeObjectURL(vrmUrl);
        const msg = err instanceof Error ? err.message : String(err);
        setVrmError(`Failed to load VRM: ${msg}`);
      }
    );

    // Resize handler
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Animation loop
    let clock = new THREE.Clock();
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      controls.update();
      if (vrmRef.current) vrmRef.current.update(delta);
      renderer.render(scene, camera);
    };
    animate();

    // Cleanup
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      renderer.dispose();
      if (vrmRef.current) {
        VRMUtils.deepDispose(vrmRef.current.scene);
        vrmRef.current = null;
      }
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [character.vrmBlob]);

  // ── Handlers ──
  const handleExport = useCallback(async () => {
    try {
      await exportCharacterAsAura(currentCharacter);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Export failed');
    }
  }, [currentCharacter]);

  const handlePromptSaved = useCallback(
    async (prompt: string) => {
      const updated = { ...currentCharacter, identityPrompt: prompt, updatedAt: new Date() };
      setCurrentCharacter(updated);
      await updateCharacter(currentCharacter.id, { identityPrompt: prompt });
      onCharacterUpdated?.(updated);
    },
    [currentCharacter, onCharacterUpdated]
  );

  const resetCamera = useCallback(() => {
    if (!cameraRef.current || !controlsRef.current) return;
    cameraRef.current.position.set(0, 1.3, 2.8);
    controlsRef.current.target.set(0, 1.0, 0);
    controlsRef.current.update();
  }, []);

  // ── Keyboard accessibility: Close on Escape key ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Character details for ${currentCharacter.name}`}
      className="fixed inset-0 z-50 flex flex-col lg:flex-row bg-[#0a0d14]/95 backdrop-blur-sm overflow-y-auto lg:overflow-hidden"
    >
      {/* ── LEFT: 3D VRM Viewport ── */}
      <div className="flex-1 relative flex flex-col min-h-[380px] lg:min-h-0">
        {/* Viewport header */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-2 bg-gradient-to-b from-black/60 to-transparent">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-slate-300 font-medium">{currentCharacter.name}</span>
            {vrmLoaded && (
              <span className="text-[10px] text-emerald-400 bg-emerald-900/30 border border-emerald-700/50 px-2 py-0.5 rounded-full">
                VRM Loaded
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={resetCamera}
              className="p-1.5 rounded-lg bg-black/40 border border-white/10 text-slate-300 hover:text-white hover:bg-black/60 transition-colors"
              title="Reset camera"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-black/40 border border-white/10 text-slate-300 hover:text-rose-300 hover:bg-rose-500/20 hover:border-rose-500/40 transition-colors"
              title="Close (Esc)"
              aria-label="Close dialog"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 3D viewport container */}
        <div ref={viewportRef} className="flex-1 w-full min-h-[380px] lg:min-h-0" />

        {/* VRM error state */}
        {vrmError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0d121f]">
            {thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt={currentCharacter.name}
                className="max-w-xs max-h-xs rounded-xl object-cover opacity-80"
              />
            ) : (
              <span className="text-7xl opacity-20">🧍</span>
            )}
            <p className="text-slate-400 text-sm text-center px-8">{vrmError}</p>
          </div>
        )}

        {/* Bottom overlay: controls hint */}
        {vrmLoaded && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] text-slate-500 bg-black/40 px-3 py-1 rounded-full">
            Drag to orbit · Scroll to zoom · Right-click to pan
          </div>
        )}
      </div>

      {/* ── RIGHT PANEL: Info / Prompt / Reference Sheet ── */}
      <div className="w-full lg:w-96 flex-shrink-0 border-t lg:border-t-0 lg:border-l border-[#1f293d] bg-[#0c101c] flex flex-col overflow-hidden">
        {/* Character header */}
        <div className="px-4 py-4 border-b border-[#1f293d] flex items-center gap-3">
          {thumbnailUrl && (
            <img
              src={thumbnailUrl}
              alt={currentCharacter.name}
              className="w-12 h-12 rounded-xl object-cover border border-[#1f293d]"
            />
          )}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-100 truncate">{currentCharacter.name}</p>
            <p className="text-xs text-indigo-400 capitalize">{currentCharacter.style} · {currentCharacter.tags.slice(0, 2).map(t => `#${t}`).join(' ')}</p>
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 hover:bg-indigo-600/40 text-xs font-semibold transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            .aura
          </button>
        </div>

        {/* Panel Tabs */}
        <div className="flex border-b border-[#1f293d]">
          {([
            { id: 'info',     label: 'Info',     icon: <Info className="w-3.5 h-3.5" /> },
            { id: 'prompt',   label: 'Prompt',   icon: <FileText className="w-3.5 h-3.5" /> },
            { id: 'refsheet', label: 'Ref Sheet',icon: <Layers className="w-3.5 h-3.5" /> },
          ] as { id: DetailPanel; label: string; icon: React.ReactNode }[]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActivePanel(tab.id)}
              className={`
                flex-1 flex items-center justify-center gap-1.5
                py-2.5 text-xs font-medium transition-all
                ${activePanel === tab.id
                  ? 'text-indigo-300 border-b-2 border-indigo-500 bg-indigo-500/5'
                  : 'text-slate-500 hover:text-slate-300 border-b-2 border-transparent'
                }
              `}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Panel Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* ── INFO PANEL ── */}
          {activePanel === 'info' && (
            <div className="flex flex-col gap-4">
              <InfoRow label="Style" value={<span className="capitalize">{currentCharacter.style}</span>} />
              <InfoRow
                label="Tags"
                value={
                  <div className="flex flex-wrap gap-1">
                    {currentCharacter.tags.length > 0
                      ? currentCharacter.tags.map((tag) => (
                          <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                            #{tag}
                          </span>
                        ))
                      : <span className="text-slate-500 text-xs">No tags</span>
                    }
                  </div>
                }
              />
              <InfoRow label="Voice" value={<span className="font-mono text-xs">{currentCharacter.voiceId || 'Not set'}</span>} />
              <InfoRow label="Default Emotion" value={currentCharacter.defaultEmotion || 'neutral'} />
              <InfoRow label="Favorite" value={currentCharacter.isFavorite ? '⭐ Yes' : 'No'} />
              <InfoRow
                label="Created"
                value={new Date(currentCharacter.createdAt).toLocaleDateString()}
              />
              <InfoRow
                label="Last Updated"
                value={new Date(currentCharacter.updatedAt).toLocaleDateString()}
              />

              {/* Identity prompt preview */}
              {currentCharacter.identityPrompt && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5" />
                    Identity Prompt
                  </label>
                  <div className="px-3 py-2 rounded-lg bg-[#070a12] border border-[#1f293d] text-xs text-indigo-200 font-mono leading-relaxed">
                    {currentCharacter.identityPrompt}
                  </div>
                </div>
              )}

              {!currentCharacter.identityPrompt && (
                <button
                  onClick={() => setActivePanel('prompt')}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-indigo-500/40 text-indigo-400 hover:bg-indigo-500/10 text-xs font-medium transition-all"
                >
                  <FileText className="w-4 h-4" />
                  Build Identity Prompt →
                </button>
              )}
            </div>
          )}

          {/* ── PROMPT BUILDER PANEL ── */}
          {activePanel === 'prompt' && (
            <PromptBuilder
              character={currentCharacter}
              onPromptSaved={handlePromptSaved}
            />
          )}

          {/* ── REFERENCE SHEET PANEL ── */}
          {activePanel === 'refsheet' && (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-slate-400">
                5-angle reference sheet for consistent AI video/image generation.
              </p>
              {refSheetUrl ? (
                <div className="rounded-xl overflow-hidden border border-[#1f293d]">
                  <img
                    src={refSheetUrl}
                    alt="Reference sheet"
                    className="w-full object-contain"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                  <span className="text-4xl opacity-20">📋</span>
                  <p className="text-slate-500 text-xs">
                    No reference sheet generated yet.
                    <br />
                    Re-import the VRM file to auto-generate one.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// Info Row Helper
// ─────────────────────────────────────────────
const InfoRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex items-start justify-between gap-3">
    <span className="text-xs text-slate-500 font-medium shrink-0 w-28">{label}</span>
    <span className="text-xs text-slate-300 text-right">{value}</span>
  </div>
);
