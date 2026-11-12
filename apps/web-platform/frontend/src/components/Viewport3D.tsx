import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { VRMLoaderPlugin, VRMUtils, type VRM } from '@pixiv/three-vrm';
import { lipSync } from '../audio/lipSyncAnalyzer';
import { Upload, User, Sparkles, RefreshCw, CheckCircle2, RotateCcw, Maximize2, Eye, UserCheck, Camera, Globe } from 'lucide-react';
import { translations, type Language } from '../utils/i18n';
import { API_BASE_URL } from '../config/api';

// FIX(audit-3-C): enable Three.js resource caching so repeated VRM URLs reuse fetched assets.
THREE.Cache.enabled = true;

interface Viewport3DProps {
  currentEmotion: string;
  bgMode: 'cyber' | 'greenscreen' | 'transparent';
  isSpeaking: boolean;
  avatarScale?: number;
  currentModelUrl?: string;
  currentModelName?: string;
  lang?: Language;
  onModelChange?: (url: string, name: string) => void;
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
  onModelLoadStateChange?: (state: 'loading' | 'vrm' | 'procedural') => void;
}

type CameraPreset = 'face' | 'bust' | 'full';
type PoseType = 'natural' | 'presenter' | 'greeting' | 'tpose';

interface ModelPreset {
  id: string;
  name: string;
  category: 'anime' | 'realistic' | 'myanmar' | 'army' | 'streamer';
  url: string;
  outfitColor?: string;
  hairColor?: string;
  eyeColor?: string;
  photoUrl?: string;
  badge: string;
}

const PRESET_3D_MODELS: ModelPreset[] = [
  // 🌟 Photo-to-3D Avatars (Directly created from user's uploaded images in full 3D)
  {
    id: 'aoi_3d',
    name: '💙 Aoi 3D (Blue Hair Kimono - ပုံ ၄ အတိုင်း 3D)',
    category: 'anime',
    url: '/models/avatar_female_a.vrm',
    outfitColor: '#1e1e2e',
    hairColor: '#38bdf8',
    eyeColor: '#38bdf8',
    photoUrl: '/avatars/blue_hair_girl.jpg',
    badge: '🌸 Photo-to-3D Kimono',
  },
  {
    id: 'elena_3d',
    name: '💛 Elena 3D (Blonde Cosplay - ပထမပုံအတိုင်း 3D)',
    category: 'anime',
    url: '/models/avatar_female_a.vrm',
    outfitColor: '#f472b6',
    hairColor: '#facc15',
    eyeColor: '#818cf8',
    photoUrl: '/avatars/blonde_cosplay_girl.jpg',
    badge: '🌸 Photo-to-3D Cosplay',
  },

  // 1. Realistic 3D Human (လူရုပ်စစ်စစ်)
  { id: 'daw_khin', name: 'Daw Khin Than (ဒေါ်ခင်သန်း - Realistic 3D)', category: 'realistic', url: '/avatar_human.vrm', outfitColor: '#0f172a', hairColor: '#1e293b', badge: '👤 Diplomat (Realistic)' },
  { id: 'ko_phyo', name: 'Ko Phyo (ကိုဖြိုး - Realistic 3D)', category: 'realistic', url: '/avatar_human.vrm', outfitColor: '#1e3a8a', hairColor: '#1e293b', badge: '👤 News Anchor (Realistic)' },
  { id: 'dr_hlaing', name: 'Dr. Hlaing Min (ဒေါက်တာလှိုင် - Realistic 3D)', category: 'realistic', url: '/avatar_human.vrm', outfitColor: '#334155', hairColor: '#334155', badge: '👤 AI Scientist (Realistic)' },
  
  // 2. Anime 3D
  { id: 'sakura', name: 'Sakura Hoshino (サクラ 3D)', category: 'anime', url: '/models/avatar_female_a.vrm', outfitColor: '#ec4899', hairColor: '#f472b6', eyeColor: '#f472b6', badge: '🌸 Anime Idol' },
  { id: 'nanami', name: 'Nanami (七海 3D)', category: 'anime', url: '/models/avatar_female_a.vrm', outfitColor: '#1e3a8a', hairColor: '#38bdf8', eyeColor: '#38bdf8', badge: '💙 Anime Heroine' },
  { id: 'shinji', name: 'Shinji Kazama (シンジ 3D)', category: 'anime', url: '/models/avatar_female_c.vrm', outfitColor: '#0284c7', hairColor: '#0f172a', badge: '⚡ Mecha Pilot' },

  // 3. Myanmar Traditional
  { id: 'nilar', name: 'Daw Nilar (ဒေါ်နီလာ - 3D)', category: 'myanmar', url: '/models/avatar_female_a.vrm', outfitColor: '#f59e0b', hairColor: '#0f172a', badge: '🇲🇲 Traditional Host' },
  { id: 'min_thar', name: 'Min Thar Thant Zin (မင်းသား - 3D)', category: 'myanmar', url: '/avatar_human.vrm', outfitColor: '#d97706', hairColor: '#0f172a', badge: '🇲🇲 Royal Court' },

  // 4. Army / Tactical
  { id: 'gen_min', name: 'General Min Zaw (ဗိုလ်ချုပ် - 3D)', category: 'army', url: '/avatar_human.vrm', outfitColor: '#365314', hairColor: '#334155', badge: '🎖️ Army Commander' },
  { id: 'sgt_kyaw', name: 'Sergeant Kyaw Thu (တပ်ကြပ် - 3D)', category: 'army', url: '/avatar_human.vrm', outfitColor: '#4d7c0f', hairColor: '#1e293b', badge: '🎖️ Spec-Ops' },

  // 5. Streamer / VTuber
  { id: 'jenny', name: 'Jenny Nova (3D Streamer)', category: 'streamer', url: '/models/avatar_female_a.vrm', outfitColor: '#a855f7', hairColor: '#c084fc', badge: '🎙️ Cyber VTuber' },
];

const HAIR_COLORS = [
  { label: 'Cyan / Blue', color: '#38bdf8' },
  { label: 'Blonde / Gold', color: '#facc15' },
  { label: 'Pink Idol', color: '#f472b6' },
  { label: 'Cyber Violet', color: '#c084fc' },
  { label: 'Natural Black', color: '#1e293b' },
  { label: 'Silver White', color: '#f1f5f9' },
];

const OUTFIT_COLORS = [
  { label: 'Formal Navy', color: '#1e3a8a' },
  { label: 'Executive Black', color: '#0f172a' },
  { label: 'Army Olive', color: '#365314' },
  { label: 'Traditional Gold', color: '#f59e0b' },
  { label: 'Cyber Purple', color: '#7c3aed' },
  { label: 'Idol Crimson', color: '#e11d48' },
];

export const Viewport3D: React.FC<Viewport3DProps> = ({
  currentEmotion,
  bgMode,
  isSpeaking,
  avatarScale = 1.0,
  currentModelUrl = '/models/avatar_female_a.vrm',
  currentModelName = '🌸 Sakura (Anime Idol)',
  lang = 'en',
  onModelChange,
}) => {
  const t = translations[lang] || translations.en;
  const mountRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  // Active VRM Avatar
  const currentVrmRef = useRef<VRM | null>(null);
  const runtimePropsRef = useRef({ currentEmotion, isSpeaking });
  const loadVRMModelRef = useRef<(source: string | ArrayBuffer, name?: string) => void>(() => undefined);
  const mouseTargetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [avatarMode, setAvatarMode] = useState<'vrm' | 'procedural'>('vrm');
  const [modelLoading, setModelLoading] = useState(false);
  const [modelName, setModelName] = useState<string>(currentModelName);
  const [currentPreset, setCurrentPreset] = useState<CameraPreset>('bust');
  const [currentPose, setCurrentPose] = useState<PoseType>('natural');
  const [selectedHairColor, setSelectedHairColor] = useState<string | null>(null);
  const [selectedOutfitColor, setSelectedOutfitColor] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [showCatalog, setShowCatalog] = useState<boolean>(false);

  // Apply pose to active VRM model
  const applyPose = (vrm: VRM, pose: PoseType) => {
    if (!vrm.humanoid) return;
    const isVRM0 = (vrm.meta as any)?.metaVersion === '0' || !(vrm.meta as any)?.metaVersion;

    const leftUpperArm = vrm.humanoid.getNormalizedBoneNode('leftUpperArm');
    const rightUpperArm = vrm.humanoid.getNormalizedBoneNode('rightUpperArm');
    const leftLowerArm = vrm.humanoid.getNormalizedBoneNode('leftLowerArm');
    const rightLowerArm = vrm.humanoid.getNormalizedBoneNode('rightLowerArm');

    if (pose === 'natural') {
      const lz = isVRM0 ? 1.25 : -1.25;
      const rz = isVRM0 ? -1.25 : 1.25;
      if (leftUpperArm) leftUpperArm.rotation.set(0.12, 0, lz);
      if (rightUpperArm) rightUpperArm.rotation.set(0.12, 0, rz);
      if (leftLowerArm) leftLowerArm.rotation.set(0, -0.2, 0);
      if (rightLowerArm) rightLowerArm.rotation.set(0, 0.2, 0);
    } else if (pose === 'presenter') {
      const lz = isVRM0 ? 0.85 : -0.85;
      const rz = isVRM0 ? -0.85 : 0.85;
      if (leftUpperArm) leftUpperArm.rotation.set(0.3, 0, lz);
      if (rightUpperArm) rightUpperArm.rotation.set(0.3, 0, rz);
      if (leftLowerArm) leftLowerArm.rotation.set(0.4, -0.4, 0);
      if (rightLowerArm) rightLowerArm.rotation.set(0.4, 0.4, 0);
    } else if (pose === 'greeting') {
      const lz = isVRM0 ? 1.25 : -1.25;
      const rz = isVRM0 ? -0.4 : 0.4;
      if (leftUpperArm) leftUpperArm.rotation.set(0.12, 0, lz);
      if (rightUpperArm) rightUpperArm.rotation.set(0.5, 0, rz);
      if (rightLowerArm) rightLowerArm.rotation.set(0.7, isVRM0 ? -0.7 : 0.7, 0);
    } else if (pose === 'tpose') {
      if (leftUpperArm) leftUpperArm.rotation.set(0, 0, 0);
      if (rightUpperArm) rightUpperArm.rotation.set(0, 0, 0);
      if (leftLowerArm) leftLowerArm.rotation.set(0, 0, 0);
      if (rightLowerArm) rightLowerArm.rotation.set(0, 0, 0);
    }
  };

  const handleSelectPose = (pose: PoseType) => {
    setCurrentPose(pose);
    if (currentVrmRef.current) {
      applyPose(currentVrmRef.current, pose);
    }
  };

  // Procedural mesh fallback references
  const proceduralGroupRef = useRef<THREE.Group | null>(null);
  const headRef = useRef<THREE.Mesh | null>(null);
  const mouthRef = useRef<THREE.Mesh | null>(null);
  const leftEyeRef = useRef<THREE.Mesh | null>(null);
  const rightEyeRef = useRef<THREE.Mesh | null>(null);

  // Animation & Blink timers
  const blinkTimerRef = useRef(0);
  const nextBlinkRef = useRef(2.5);
  const isBlinkingRef = useRef(false);

  // Camera presets configuration
  const applyCameraPreset = (preset: CameraPreset) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    setCurrentPreset(preset);

    if (preset === 'face') {
      // Close-up on facial features and eyes
      camera.position.set(0, 1.36, 0.65);
      controls.target.set(0, 1.34, 0);
    } else if (preset === 'bust') {
      // Half body / bust portrait
      camera.position.set(0, 1.34, 1.10);
      controls.target.set(0, 1.30, 0);
    } else if (preset === 'full') {
      // Complete full body (Head, torso, waist, legs, and shoes)
      camera.position.set(0, 0.72, 3.20);
      controls.target.set(0, 0.68, 0);
    }
    controls.update();
  };

  // Function to load VRM from URL or ArrayBuffer
  const loadVRMModel = (source: string | ArrayBuffer, name: string = 'Custom VRM') => {
    const scene = sceneRef.current;
    if (!scene) return;

    setModelLoading(true);
    onModelLoadStateChange?.('loading');
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    const onLoad = (gltf: any) => {
      const vrm: VRM = gltf.userData.vrm;
      if (!vrm) {
        console.warn('GLTF parsed but no VRM data found, keeping fallback');
        setModelLoading(false);
        onModelLoadStateChange?.('procedural');
        return;
      }

      // Clean up previous VRM if exists
      if (currentVrmRef.current) {
        scene.remove(currentVrmRef.current.scene);
        VRMUtils.deepDispose(currentVrmRef.current.scene);
        currentVrmRef.current = null;
      }

      // Optimize & rotate VRM0 if applicable
      VRMUtils.removeUnnecessaryVertices(gltf.scene);
      VRMUtils.removeUnnecessaryJoints(gltf.scene);
      VRMUtils.rotateVRM0(vrm);

      // Adjust positioning and scale to sit on the floor
      vrm.scene.position.set(0, 0, 0);
      vrm.scene.scale.set(1.0, 1.0, 1.0);

      // Apply natural, well-proportioned arm pose (fixed for VRM 0 and VRM 1)
      applyPose(vrm, currentPose);

      // Natural leg stance (slight relaxation)
      const leftUpperLeg = vrm.humanoid?.getNormalizedBoneNode('leftUpperLeg');
      const rightUpperLeg = vrm.humanoid?.getNormalizedBoneNode('rightUpperLeg');
      if (leftUpperLeg) leftUpperLeg.rotation.z = -0.05;
      if (rightUpperLeg) rightUpperLeg.rotation.z = 0.05;

      // Hide procedural mesh when VRM is active
      if (proceduralGroupRef.current) {
        proceduralGroupRef.current.visible = false;
      }

      scene.add(vrm.scene);
      currentVrmRef.current = vrm;
      setAvatarMode('vrm');
      setModelName(name);
      setModelLoading(false);
      onModelLoadStateChange?.('vrm');

      // Re-apply custom hair color if set
      if (selectedHairColor) {
        const col = new THREE.Color(selectedHairColor);
        vrm.scene.traverse((child: any) => {
          if (child.isMesh && child.material) {
            const mat = child.material;
            const matName = (mat.name || child.name || '').toLowerCase();
            if (matName.includes('hair') || matName.includes('kami')) {
              if (Array.isArray(mat)) {
                mat.forEach(m => { if (m.color) m.color.copy(col); });
              } else if (mat.color) {
                mat.color.copy(col);
              }
            }
          }
        });
      }

      // Re-apply custom outfit color if set
      if (selectedOutfitColor) {
        const col = new THREE.Color(selectedOutfitColor);
        vrm.scene.traverse((child: any) => {
          if (child.isMesh && child.material) {
            const mat = child.material;
            const mname = (mat.name || child.name || '').toLowerCase();
            if (
              !mname.includes('face') && !mname.includes('eye') && !mname.includes('kao') &&
              !mname.includes('skin') && !mname.includes('hair') && !mname.includes('kami')
            ) {
              if (Array.isArray(mat)) {
                mat.forEach((m: any) => { if (m.color) m.color.copy(col); });
              } else if (mat.color) {
                mat.color.copy(col);
              }
            }
          }
        });
      }
    };

    const onError = (error: any) => {
      console.error('Failed to load VRM model:', error);
      setModelLoading(false);
      onModelLoadStateChange?.('procedural');
      if (proceduralGroupRef.current) {
        proceduralGroupRef.current.visible = true;
      }
      setAvatarMode('procedural');
    };

    if (typeof source === 'string') {
      // FIX(audit-2-B): imported VRM API paths must resolve through the edge gateway, not the static-site origin.
      const resolvedSource = typeof source === 'string' && source.startsWith('/api/')
        ? API_BASE_URL + source
        : source;
      loader.load(resolvedSource, onLoad, undefined, onError);
    } else {
      loader.parse(source, '', onLoad, onError);
    }
  };

// Procedural Hair Texture Generator with silky anime strands
const createAnimeHairTexture = (hexColor: string): THREE.CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const base = new THREE.Color(hexColor);
  const hsl = { h: 0, s: 0, l: 0 };
  base.getHSL(hsl);

  const highlight = new THREE.Color().setHSL(hsl.h, Math.max(0, hsl.s - 0.1), Math.min(1, hsl.l + 0.3));
  const shadow = new THREE.Color().setHSL(hsl.h, Math.min(1, hsl.s + 0.1), Math.max(0, hsl.l - 0.25));

  // Gradient background
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, shadow.getStyle());
  grad.addColorStop(0.35, base.getStyle());
  grad.addColorStop(0.5, highlight.getStyle()); // Specular ring highlight
  grad.addColorStop(0.65, base.getStyle());
  grad.addColorStop(1.0, shadow.getStyle());
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 512);

  // Hair strands
  ctx.strokeStyle = highlight.getStyle();
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.35;
  for (let x = 0; x < 256; x += 4) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + (Math.random() - 0.5) * 4, 512);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

// Procedural Cloth Texture
const createAnimeClothTexture = (hexColor: string): THREE.CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = hexColor;
  ctx.fillRect(0, 0, 256, 256);

  // Subtle woven fabric detail
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  for (let y = 0; y < 256; y += 4) {
    ctx.fillRect(0, y, 256, 1);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

  // Hair color tint function
  const applyHairColor = (hex: string) => {
    setSelectedHairColor(hex);
    const vrm = currentVrmRef.current;
    if (!vrm) return;
    const col = new THREE.Color(hex);
    const shadowCol = col.clone().multiplyScalar(0.65);
    const hairTexture = createAnimeHairTexture(hex);

    vrm.scene.traverse((child: any) => {
      if (child.isMesh && child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((mat: any) => {
          const matName = (mat.name || child.name || '').toLowerCase();
          if (matName.includes('hair') || matName.includes('kami')) {
            mat.map = hairTexture;
            if (mat.uniforms?.map) mat.uniforms.map.value = hairTexture;
            mat.color?.set('#ffffff');
            if (mat.uniforms?.litFactor) mat.uniforms.litFactor.value.set('#ffffff');
            if ('shadeColorFactor' in mat) mat.shadeColorFactor.copy(shadowCol);
            if (mat.uniforms?.shadeColorFactor) mat.uniforms.shadeColorFactor.value.copy(shadowCol);
            if (mat.uniforms?.shadeMultiplyTexture) mat.uniforms.shadeMultiplyTexture.value = hairTexture;
            mat.needsUpdate = true;
          }
        });
      }
    });
  };

  const applyOutfitColor = (hex: string) => {
    setSelectedOutfitColor(hex);
    const vrm = currentVrmRef.current;
    if (!vrm) return;
    const col = new THREE.Color(hex);
    const shadowCol = col.clone().multiplyScalar(0.6);
    const clothTexture = createAnimeClothTexture(hex);

    vrm.scene.traverse((child: any) => {
      if (child.isMesh && child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((mat: any) => {
          const name = (mat.name || child.name || '').toLowerCase();
          if (
            !name.includes('face') && !name.includes('eye') && !name.includes('kao') &&
            !name.includes('skin') && !name.includes('hair') && !name.includes('kami')
          ) {
            mat.map = clothTexture;
            if (mat.uniforms?.map) mat.uniforms.map.value = clothTexture;
            mat.color?.set('#ffffff');
            if (mat.uniforms?.litFactor) mat.uniforms.litFactor.value.set('#ffffff');
            if ('shadeColorFactor' in mat) mat.shadeColorFactor.copy(shadowCol);
            if (mat.uniforms?.shadeColorFactor) mat.uniforms.shadeColorFactor.value.copy(shadowCol);
            if (mat.uniforms?.shadeMultiplyTexture) mat.uniforms.shadeMultiplyTexture.value = clothTexture;
            mat.needsUpdate = true;
          }
        });
      }
    });
  };

  // Apply photo texture to face mesh
  const applyPhotoFace = (photoUrl: string) => {
    const vrm = currentVrmRef.current;
    if (!vrm) return;
    const loader = new THREE.TextureLoader();
    loader.load(photoUrl, (texture) => {
      texture.flipY = false;
      texture.colorSpace = THREE.SRGBColorSpace;
      vrm.scene.traverse((child: any) => {
        if (child.isMesh && child.material) {
          const mat = child.material;
          const name = (mat.name || child.name || '').toLowerCase();
          if (name.includes('face') || name.includes('skin')) {
            if (Array.isArray(mat)) {
              mat.forEach(m => { m.map = texture; m.needsUpdate = true; });
            } else {
              mat.map = texture;
              mat.needsUpdate = true;
            }
          }
        }
      });
    });
  };

  const applyEyeColor = (hex: string) => {
    const vrm = currentVrmRef.current;
    if (!vrm) return;
    const col = new THREE.Color(hex);
    vrm.scene.traverse((child: any) => {
      if (child.isMesh && child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((mat: any) => {
          const name = (mat.name || child.name || '').toLowerCase();
          if (name.includes('eyeiris') || name.includes('iris')) {
            mat.color?.copy(col);
            if (mat.uniforms?.litFactor) mat.uniforms.litFactor.value.copy(col);
            mat.needsUpdate = true;
          }
        });
      }
    });
  };

  const handleSelectModel = (
    url: string, 
    name: string, 
    outfitCol?: string, 
    hairCol?: string, 
    eyeCol?: string
  ) => {
    loadVRMModel(url, name);
    setTimeout(() => {
      if (hairCol) applyHairColor(hairCol);
      if (outfitCol) applyOutfitColor(outfitCol);
      if (eyeCol) applyEyeColor(eyeCol);
    }, 600);
    // Double-apply to catch slow loads
    setTimeout(() => {
      if (hairCol) applyHairColor(hairCol);
      if (outfitCol) applyOutfitColor(outfitCol);
      if (eyeCol) applyEyeColor(eyeCol);
    }, 1600);
    if (onModelChange) onModelChange(url, name);
  };

  // Convert uploaded 2D photo into 3D Model by mapping to 3D base mesh
  const photoTo3DInputRef = useRef<HTMLInputElement>(null);
  const handlePhotoTo3DUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const customName = `${file.name.replace(/\.[^/.]+$/, '')} (3D Avatar)`;
    // Load female anime 3D mesh as base and map face & style
    loadVRMModel('/models/avatar_female_a.vrm', customName);
    setTimeout(() => {
      applyPhotoFace(url);
    }, 500);
    if (onModelChange) onModelChange('/models/avatar_female_a.vrm', customName);
  };

  // Custom VRM File selection handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const buffer = event.target?.result as ArrayBuffer;
      if (buffer) {
        loadVRMModel(buffer, file.name.replace(/\.[^/.]+$/, ''));
      }
    };
    reader.readAsArrayBuffer(file);
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    if (bgMode === 'greenscreen') {
      scene.background = new THREE.Color(0x00ff00);
    } else if (bgMode === 'transparent') {
      scene.background = null;
    } else {
      scene.background = new THREE.Color(0x0a0d14);
    }

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(28, width / height, 0.1, 100);
    camera.position.set(0, 1.34, 1.10);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    onCanvasReady?.(renderer.domElement);

    // 4. OrbitControls (Full 360° mouse rotation, zoom in/out to see full body)
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 1.30, 0);
    controls.minDistance = 0.4;
    controls.maxDistance = 5.0;
    controls.maxPolarAngle = Math.PI / 2 + 0.05; // Prevent going underground
    controlsRef.current = controls;

    // 5. Studio Stage Ground / Pedestal (Circular pedestal for full body view)
    const stageGeo = new THREE.CylinderGeometry(1.2, 1.3, 0.04, 64);
    const stageMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.2,
      metalness: 0.8,
    });
    const stageMesh = new THREE.Mesh(stageGeo, stageMat);
    stageMesh.position.set(0, -0.02, 0);
    scene.add(stageMesh);

    // Glowing stage ring
    const ringGeo = new THREE.RingGeometry(1.18, 1.22, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      side: THREE.DoubleSide,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.set(0, 0.001, 0);
    scene.add(ringMesh);

    // 6. Lights: Cinematic studio three-point lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xfff5ea, 1.8);
    keyLight.position.set(1.5, 2.5, 2.0);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 1.0);
    fillLight.position.set(-2.0, 1.5, 1.0);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xa855f7, 1.5);
    rimLight.position.set(0, 2.5, -2.0);
    scene.add(rimLight);

    // Subtle foot light for full body shoes/legs visibility
    const footLight = new THREE.DirectionalLight(0x38bdf8, 0.6);
    footLight.position.set(0, 0.2, 1.5);
    scene.add(footLight);

    // 7. Procedural Fallback Mesh
    const proceduralGroup = new THREE.Group();
    proceduralGroupRef.current = proceduralGroup;

    const skinMaterial = new THREE.MeshStandardMaterial({
      color: 0xffdfd0,
      roughness: 0.4,
      metalness: 0.05,
    });

    const neckGeo = new THREE.CylinderGeometry(0.08, 0.1, 0.25, 16);
    const neck = new THREE.Mesh(neckGeo, skinMaterial);
    neck.position.set(0, 1.15, 0);
    proceduralGroup.add(neck);

    const bodyGeo = new THREE.CylinderGeometry(0.24, 0.28, 0.6, 24);
    const suitMaterial = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });
    const body = new THREE.Mesh(bodyGeo, suitMaterial);
    body.position.set(0, 0.85, 0);
    proceduralGroup.add(body);

    const headGroup = new THREE.Group();
    headGroup.position.set(0, 1.38, 0);
    const headGeo = new THREE.SphereGeometry(0.24, 32, 32);
    headGeo.scale(1.0, 1.15, 0.95);
    const head = new THREE.Mesh(headGeo, skinMaterial);
    headGroup.add(head);
    headRef.current = head;

    const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
    const eyeGeo = new THREE.SphereGeometry(0.05, 16, 16);
    eyeGeo.scale(1.0, 1.4, 0.3);
    const pupilGeo = new THREE.SphereGeometry(0.028, 16, 16);
    pupilGeo.scale(1.0, 1.2, 0.2);

    const leftEye = new THREE.Mesh(eyeGeo, eyeWhiteMat);
    leftEye.position.set(0.09, 0.04, 0.21);
    headGroup.add(leftEye);
    leftEyeRef.current = leftEye;
    const leftPupil = new THREE.Mesh(pupilGeo, pupilMat);
    leftPupil.position.set(0.09, 0.04, 0.225);
    headGroup.add(leftPupil);

    const rightEye = new THREE.Mesh(eyeGeo, eyeWhiteMat);
    rightEye.position.set(-0.09, 0.04, 0.21);
    headGroup.add(rightEye);
    rightEyeRef.current = rightEye;
    const rightPupil = new THREE.Mesh(pupilGeo, pupilMat);
    rightPupil.position.set(-0.09, 0.04, 0.225);
    headGroup.add(rightPupil);

    const mouthMat = new THREE.MeshBasicMaterial({ color: 0xe11d48 });
    const mouthGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.015, 16);
    mouthGeo.scale(1.0, 0.4, 0.8);
    const mouth = new THREE.Mesh(mouthGeo, mouthMat);
    mouth.position.set(0, -0.12, 0.215);
    mouth.rotation.x = Math.PI / 2;
    headGroup.add(mouth);
    mouthRef.current = mouth;

    const hairGroup = new THREE.Group();
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.3 });
    const hairTopGeo = new THREE.SphereGeometry(0.26, 24, 24);
    hairTopGeo.scale(1.04, 1.1, 1.05);
    const hairTop = new THREE.Mesh(hairTopGeo, hairMat);
    hairTop.position.set(0, 0.06, -0.02);
    hairGroup.add(hairTop);

    for (let i = -3; i <= 3; i++) {
      const bangGeo = new THREE.ConeGeometry(0.04, 0.18, 8);
      const bang = new THREE.Mesh(bangGeo, hairMat);
      bang.position.set(i * 0.05, 0.12, 0.22);
      bang.rotation.z = (i * -0.1);
      bang.rotation.x = 0.2;
      hairGroup.add(bang);
    }
    headGroup.add(hairGroup);
    proceduralGroup.add(headGroup);
    scene.add(proceduralGroup);

    // 8. Animation Engine
    let animationFrameId: number;
    const clock = new THREE.Clock();
    const currentMouse = { x: 0, y: 0 };

    const handlePointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      mouseTargetRef.current = {
        x: Math.max(-1, Math.min(1, nx)),
        y: Math.max(-1, Math.min(1, ny)),
      };
    };
    container.addEventListener('pointermove', handlePointerMove);

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const time = clock.getElapsedTime();

      // Controls update for smooth damping
      if (controlsRef.current) {
        controlsRef.current.update();
      }

      // Natural Human Breathing Cycle
      const breath = Math.sin(time * 1.8) * 0.005;
      const headSway = Math.sin(time * 0.7) * 0.025;

      // Dynamic Interactive Mouse Pointer Tracking
      currentMouse.x += (mouseTargetRef.current.x - currentMouse.x) * 0.05;
      currentMouse.y += (mouseTargetRef.current.y - currentMouse.y) * 0.05;

      const vrm = currentVrmRef.current;
      const { currentEmotion: emotion, isSpeaking: speaking } = runtimePropsRef.current;
      const visemes = lipSync.getVisemes();

      // --- VRM Humanoid Animation Path ---
      if (vrm) {
        const headNode = vrm.humanoid?.getNormalizedBoneNode('head');
        const neckNode = vrm.humanoid?.getNormalizedBoneNode('neck');
        const spineNode = vrm.humanoid?.getNormalizedBoneNode('spine');

        if (spineNode) {
          spineNode.rotation.x = breath * 0.5 - currentMouse.y * 0.03;
          spineNode.rotation.y = currentMouse.x * 0.06;
        }
        if (neckNode) {
          neckNode.rotation.y = headSway * 0.4 + currentMouse.x * 0.16;
          neckNode.rotation.x = -currentMouse.y * 0.10;
        }
        if (headNode) {
          headNode.rotation.y = headSway * 0.6 + currentMouse.x * 0.26;
          headNode.rotation.x = -currentMouse.y * 0.18;
          headNode.rotation.z = Math.cos(time * 0.5) * 0.012 - currentMouse.x * 0.04;
        }

        // Natural Human Blinking Engine via VRM Expressions
        blinkTimerRef.current += delta;
        if (blinkTimerRef.current > nextBlinkRef.current) {
          isBlinkingRef.current = true;
          vrm.expressionManager?.setValue('blink', 1.0);

          if (blinkTimerRef.current > nextBlinkRef.current + 0.12) {
            vrm.expressionManager?.setValue('blink', 0.0);
            blinkTimerRef.current = 0;
            nextBlinkRef.current = 2.0 + Math.random() * 3.5;
            isBlinkingRef.current = false;
          }
        }

        // Real-Time Lip Sync Visemes on Human Face
        if (vrm.expressionManager) {
          if (visemes.volume > 0.04 || speaking) {
            const openVal = Math.min(1.0, Math.max(visemes.aa, visemes.volume * 2.0, speaking ? 0.4 + Math.sin(time * 14) * 0.35 : 0));
            vrm.expressionManager.setValue('aa', openVal);
            vrm.expressionManager.setValue('ih', visemes.ee * 0.7);
            vrm.expressionManager.setValue('ou', visemes.oh * 0.8);
          } else {
            vrm.expressionManager.setValue('aa', 0);
            vrm.expressionManager.setValue('ih', 0);
            vrm.expressionManager.setValue('ou', 0);
          }

          // Emotional Facial Blendshapes
          vrm.expressionManager.setValue('happy', emotion === 'happy' ? 0.8 : 0);
          vrm.expressionManager.setValue('angry', emotion === 'angry' ? 0.75 : 0);
          vrm.expressionManager.setValue('sad', emotion === 'sad' ? 0.7 : 0);
          vrm.expressionManager.setValue('surprised', emotion === 'surprised' ? 0.8 : 0);
          vrm.expressionManager.setValue('relaxed', emotion === 'neutral' ? 0.2 : 0);

          vrm.expressionManager.update();
        }

        // VRM physics and spring-bones update
        vrm.update(delta);
      } else {
        if (headGroup) {
          headGroup.position.y = 1.38 + breath;
          headGroup.rotation.y = headSway;
        }
        if (mouth) {
          if (visemes.volume > 0.05 || speaking) {
            const openAmount = Math.max(visemes.aa, visemes.volume * 1.5, speaking ? 0.4 + Math.sin(time * 15) * 0.3 : 0);
            mouth.scale.set(1.0 + visemes.ee * 0.5, 0.4 + openAmount * 2.5, 0.8);
          } else {
            mouth.scale.set(1.0, 0.2, 0.8);
          }
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('pointermove', handlePointerMove);
      controls.dispose();
      renderer.dispose();
      // FIX(audit-3-C): dispose the complete scene graph on unmount, including VRM and procedural assets.
      VRMUtils.deepDispose(scene);
      currentVrmRef.current = null;
      sceneRef.current = null;
      rendererRef.current = null;
      onCanvasReady?.(null);
      cameraRef.current = null;
      controlsRef.current = null;
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [onCanvasReady, onModelLoadStateChange]);

  // FIX(audit-3-C): keep animation state current without rebuilding the WebGL scene.
  useEffect(() => {
    runtimePropsRef.current = { currentEmotion, isSpeaking };
  }, [currentEmotion, isSpeaking]);

  // FIX(audit-3-C): background changes update the existing scene instead of recreating renderer resources.
  useEffect(() => {
    if (!sceneRef.current) return;
    sceneRef.current.background = bgMode === 'greenscreen'
      ? new THREE.Color(0x00ff00)
      : bgMode === 'transparent' ? null : new THREE.Color(0x0a0d14);
  }, [bgMode]);

  // FIX(audit-3-C): load/switch models independently from the mount-only scene lifecycle.
  loadVRMModelRef.current = loadVRMModel;
  useEffect(() => {
    loadVRMModelRef.current(currentModelUrl, currentModelName);
  }, [currentModelUrl, currentModelName]);

  // Reapply preset colors after a newly selected model has finished loading.
  useEffect(() => {
    if (modelLoading) return;
    const preset = PRESET_3D_MODELS.find((item) => item.url === currentModelUrl && item.name === currentModelName)
      || PRESET_3D_MODELS.find((item) => item.url === currentModelUrl);
    if (preset?.hairColor) applyHairColor(preset.hairColor);
    if (preset?.outfitColor) applyOutfitColor(preset.outfitColor);
    if (preset?.eyeColor) applyEyeColor(preset.eyeColor);
  }, [modelLoading, currentModelUrl, currentModelName]);

  return (
    <div className="relative w-full h-full overflow-hidden select-none">
      {/* 3D Canvas Container */}
      <div
        ref={mountRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        title="🖱️ Left Click: 360° Rotate • Mouse Wheel: Zoom in/out (See Full Body) • Right Click: Pan"
      />

      {/* Hidden File Input for Custom VRM Loading */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".vrm,.glb"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Top Floating Avatar Controller Bar */}
      <div className="absolute top-16 left-4 right-4 z-20 flex flex-col gap-2 pointer-events-auto">
        {/* Row 1: Category Filter & Character Switcher */}
        <div className="flex items-center gap-2 flex-wrap bg-[#0d1322]/95 backdrop-blur-md border border-[#23314f] p-2 rounded-xl shadow-2xl text-xs">
          {/* Categories */}
          <div className="flex items-center gap-1 border-r border-slate-700/60 pr-2">
            {[
              { id: 'all', label: t.catAll },
              { id: 'realistic', label: t.catRealistic },
              { id: 'anime', label: t.catAnime },
              { id: 'myanmar', label: t.catMyanmar },
              { id: 'army', label: t.catArmy },
              { id: 'streamer', label: t.catStreamer },
            ].map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
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

          {/* Model Pills for selected category */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 max-w-xl">
            {PRESET_3D_MODELS
              .filter(m => activeCategory === 'all' || m.category === activeCategory)
              .map(m => (
                <button
                  key={m.id}
                  onClick={() => handleSelectModel(m.url, m.name, m.outfitColor, m.hairColor, m.eyeColor)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap ${
                    modelName === m.name
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/30 ring-1 ring-purple-400'
                      : 'bg-[#141b2d] text-slate-300 hover:bg-slate-800/60 border border-slate-700/40'
                  }`}
                >
                  <span>{m.name}</span>
                </button>
              ))}
          </div>

          {/* Action Buttons: Ready Player Me, Upload VRM */}
          <div className="flex items-center gap-1.5 ml-auto">
            <button
              onClick={() => {
                const url = prompt(
                  lang === 'my' 
                    ? 'Ready Player Me 3D Avatar (.glb သို့မဟုတ် .vrm) URL ထည့်ပါ:' 
                    : 'Enter Ready Player Me 3D Avatar (.glb or .vrm) URL:',
                  'https://models.readyplayer.me/64d38c7f3b89b8001cb7419e.glb'
                );
                if (url && url.trim()) {
                  loadVRMModel(url.trim(), 'Ready Player Me 3D');
                  if (onModelChange) onModelChange(url.trim(), 'Ready Player Me 3D');
                }
              }}
              title="Import Ready Player Me 3D Avatar URL"
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-600/25 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/40 hover:border-indigo-400 rounded-lg transition-all font-semibold text-[11px] shadow-sm"
            >
              <Globe className="w-3 h-3 text-indigo-400" />
              <span>RPM 3D</span>
            </button>

            {modelLoading ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 px-2">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Loading...
              </span>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                title="Upload custom .vrm or .glb 3D avatar"
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 hover:border-cyan-400 rounded-lg transition-all font-medium text-[11px] shadow-sm"
              >
                <Upload className="w-3 h-3" />
                <span>.VRM / .GLB</span>
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Pose / Arm Adjuster + Hair + Outfit Colors */}
        <div className="flex items-center gap-3 flex-wrap bg-[#0d1322]/90 backdrop-blur-md border border-[#23314f] px-3 py-1.5 rounded-xl shadow-xl text-xs">
          {/* Pose Selector */}
          <div className="flex items-center gap-1 border-r border-slate-700/60 pr-2">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mr-1">Pose:</span>
            {[
              { id: 'natural', label: '🧘 Natural (သဘာဝ)' },
              { id: 'presenter', label: '🎙️ Presenter (ကြေညာသူ)' },
              { id: 'greeting', label: '👋 Wave (နှုတ်ဆက်)' },
              { id: 'tpose', label: '🧍 T-Pose' },
            ].map(p => (
              <button
                key={p.id}
                onClick={() => handleSelectPose(p.id as PoseType)}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                  currentPose === p.id
                    ? 'bg-cyan-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* 3D Hair Color */}
          <div className="flex items-center gap-1 border-r border-slate-700/60 pr-2">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mr-1">Hair:</span>
            {HAIR_COLORS.map(c => (
              <button
                key={c.color}
                onClick={() => applyHairColor(c.color)}
                title={c.label}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] transition-all border ${
                  selectedHairColor === c.color
                    ? 'border-purple-400 bg-purple-950/60 text-white'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full border border-black/40" style={{ backgroundColor: c.color }} />
                <span>{c.label}</span>
              </button>
            ))}
          </div>

          {/* Outfit Color */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mr-1">Outfit:</span>
            {OUTFIT_COLORS.map(o => (
              <button
                key={o.color}
                onClick={() => applyOutfitColor(o.color)}
                title={o.label}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] transition-all border ${
                  selectedOutfitColor === o.color
                    ? 'border-cyan-400 bg-cyan-950/60 text-white'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full border border-black/40" style={{ backgroundColor: o.color }} />
                <span>{o.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Camera View Switcher (Face / Bust / Full Body) */}
      <div className="absolute top-20 right-4 z-20 flex items-center gap-1 bg-[#0d1322]/90 backdrop-blur-md border border-[#23314f] p-1 rounded-xl shadow-xl text-xs pointer-events-auto">
        <button
          onClick={() => applyCameraPreset('face')}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all font-medium text-[11px] ${
            currentPreset === 'face'
              ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20 font-semibold'
              : 'text-slate-300 hover:bg-slate-800/60'
          }`}
          title="Zoom to Face Close-up"
        >
          <Eye className="w-3 h-3" />
          Face
        </button>
        <button
          onClick={() => applyCameraPreset('bust')}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all font-medium text-[11px] ${
            currentPreset === 'bust'
              ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20 font-semibold'
              : 'text-slate-300 hover:bg-slate-800/60'
          }`}
          title="Upper Body / Bust Portrait"
        >
          <UserCheck className="w-3 h-3" />
          Bust
        </button>
        <button
          onClick={() => applyCameraPreset('full')}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all font-medium text-[11px] ${
            currentPreset === 'full'
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/30 font-semibold'
              : 'text-purple-300 hover:bg-purple-950/40'
          }`}
          title="Show Complete Full Body (Head to Shoes)"
        >
          <Maximize2 className="w-3 h-3" />
          Full Body (တစ်ကိုယ်လုံး)
        </button>
      </div>

      {/* Bottom Hint: Interactive 360 & Mouse Controls */}
      <div className="absolute bottom-4 left-4 z-10 pointer-events-none">
        <div className="text-[11px] text-slate-400/90 bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800/80 inline-flex items-center gap-2 shadow-lg">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>
            <strong className="text-slate-200">360° Rotate:</strong> Click & Drag &bull;{' '}
            <strong className="text-slate-200">Zoom (အောက်ပိုင်း/တစ်ကိုယ်လုံး):</strong> Mouse Scroll
          </span>
        </div>
      </div>
    </div>
  );
};
