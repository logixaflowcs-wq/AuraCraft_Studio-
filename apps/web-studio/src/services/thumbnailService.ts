/**
 * AuraCraft Studio — Thumbnail Service
 *
 * Renders an offscreen Three.js scene from a VRM Blob and returns a PNG Blob.
 * This runs entirely in the browser using WebGL — no DOM attachment required.
 *
 * Usage:
 *   const pngBlob = await generateThumbnail(vrmBlob);
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils, type VRM } from '@pixiv/three-vrm';

/** Thumbnail dimensions (square) */
const THUMB_SIZE = 512;

/**
 * Load a VRM from a Blob using three.js GLTFLoader.
 * Returns the VRM instance and its scene object.
 */
async function loadVRMFromBlob(blob: Blob): Promise<VRM> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const loader = new GLTFLoader();

    // Register the VRM plugin
    loader.register((parser) => new VRMLoaderPlugin(parser));

    loader.load(
      url,
      (gltf) => {
        URL.revokeObjectURL(url);
        const vrm: VRM = gltf.userData.vrm;
        if (!vrm) {
          reject(new Error('No VRM data found in GLTF'));
          return;
        }
        // Rotate to face camera (VRM models face +Z by default, we want them facing -Z)
        VRMUtils.rotateVRM0(vrm);
        resolve(vrm);
      },
      undefined,
      (error) => {
        URL.revokeObjectURL(url);
        reject(error);
      }
    );
  });
}

/**
 * Set up an offscreen Three.js renderer with a fixed size.
 * IMPORTANT: canvas is NOT attached to the DOM.
 */
function createOffscreenRenderer(): THREE.WebGLRenderer {
  const canvas = document.createElement('canvas');
  canvas.width = THUMB_SIZE;
  canvas.height = THUMB_SIZE;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true, // Required for toBlob()
  });

  renderer.setSize(THUMB_SIZE, THUMB_SIZE);
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  return renderer;
}

/**
 * Build a standard portrait scene: lights, background, camera.
 */
function buildPortraitScene(): {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
} {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a2e); // Deep navy — matches app dark theme

  // Ambient light — base illumination
  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambient);

  // Key light — front-top right
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
  keyLight.position.set(1.5, 2.5, 2);
  scene.add(keyLight);

  // Fill light — front-left, cooler tone
  const fillLight = new THREE.DirectionalLight(0x8888ff, 0.5);
  fillLight.position.set(-1.5, 1.5, 1);
  scene.add(fillLight);

  // Rim light — back-right edge highlight
  const rimLight = new THREE.DirectionalLight(0xffffff, 0.8);
  rimLight.position.set(-1, 2, -2);
  scene.add(rimLight);

  // Camera — portrait framing (head + upper torso)
  const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 50);
  camera.position.set(0, 1.4, 2.0);
  camera.lookAt(0, 1.3, 0);

  return { scene, camera };
}

/**
 * Generate a 512×512 PNG thumbnail from a VRM Blob.
 * Sets up an offscreen WebGL renderer, loads the VRM, renders one frame,
 * and returns the result as a PNG Blob.
 *
 * @param vrmBlob - The raw VRM file as a Blob
 * @returns PNG Blob of the rendered thumbnail
 */
export async function generateThumbnail(vrmBlob: Blob): Promise<Blob> {
  const renderer = createOffscreenRenderer();
  const { scene, camera } = buildPortraitScene();

  let vrm: VRM | null = null;

  try {
    vrm = await loadVRMFromBlob(vrmBlob);
    scene.add(vrm.scene);

    // Update VRM once (expression morphs, spring bones, etc.)
    vrm.update(0.016);

    // Render a single frame
    renderer.render(scene, camera);

    // Extract PNG blob from canvas
    return await new Promise<Blob>((resolve, reject) => {
      renderer.domElement.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas toBlob returned null'));
        },
        'image/png',
        1.0
      );
    });
  } finally {
    // Always clean up to prevent GPU memory leaks
    if (vrm) {
      VRMUtils.deepDispose(vrm.scene);
    }
    renderer.dispose();
  }
}
