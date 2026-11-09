/**
 * AuraCraft Studio — Reference Sheet Service
 *
 * Renders a VRM from 5 camera angles and stitches them into a single PNG
 * "reference sheet" — the core tool for preventing character drift in AI videos.
 *
 * Layout (2 columns × 3 rows):
 *   [ FRONT  ] [ LEFT   ]
 *   [ RIGHT  ] [ BACK   ]
 *   [ CLOSEUP] [ (blank)]
 *
 * Usage:
 *   const refBlob = await generateReferenceSheet(vrmBlob);
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils, type VRM } from '@pixiv/three-vrm';

/** Size of each individual angle panel (pixels) */
const PANEL_SIZE = 512;

/** Label configuration */
const LABEL_HEIGHT = 32;
const LABEL_FONT = 'bold 18px system-ui, sans-serif';
const LABEL_COLOR = '#e2e8f0';
const LABEL_BG = 'rgba(10,13,20,0.85)';

/** Grid layout: 2 columns × 3 rows */
const COLS = 2;
const ROWS = 3;

// ─────────────────────────────────────────────
// Camera angle definitions
// ─────────────────────────────────────────────
interface CameraAngle {
  label: string;
  position: THREE.Vector3;
  target: THREE.Vector3;
}

const CAMERA_ANGLES: CameraAngle[] = [
  {
    label: 'FRONT',
    position: new THREE.Vector3(0, 1.3, 2.2),
    target: new THREE.Vector3(0, 1.2, 0),
  },
  {
    label: 'LEFT',
    position: new THREE.Vector3(-2.2, 1.3, 0),
    target: new THREE.Vector3(0, 1.2, 0),
  },
  {
    label: 'RIGHT',
    position: new THREE.Vector3(2.2, 1.3, 0),
    target: new THREE.Vector3(0, 1.2, 0),
  },
  {
    label: 'BACK',
    position: new THREE.Vector3(0, 1.3, -2.2),
    target: new THREE.Vector3(0, 1.2, 0),
  },
  {
    label: 'FACE CLOSEUP',
    position: new THREE.Vector3(0, 1.6, 0.9),
    target: new THREE.Vector3(0, 1.55, 0),
  },
];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

async function loadVRMFromBlob(blob: Blob): Promise<VRM> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));
    loader.load(
      url,
      (gltf) => {
        URL.revokeObjectURL(url);
        const vrm: VRM = gltf.userData.vrm;
        if (!vrm) {
          reject(new Error('No VRM data in GLTF'));
          return;
        }
        VRMUtils.rotateVRM0(vrm);
        resolve(vrm);
      },
      undefined,
      (err) => {
        URL.revokeObjectURL(url);
        reject(err);
      }
    );
  });
}

function createPanelRenderer(): THREE.WebGLRenderer {
  const canvas = document.createElement('canvas');
  canvas.width = PANEL_SIZE;
  canvas.height = PANEL_SIZE;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
  });
  renderer.setSize(PANEL_SIZE, PANEL_SIZE);
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  return renderer;
}

function buildScene(vrm: VRM): { scene: THREE.Scene; camera: THREE.PerspectiveCamera } {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111827);

  scene.add(new THREE.AmbientLight(0xffffff, 0.7));

  const key = new THREE.DirectionalLight(0xffffff, 1.3);
  key.position.set(1.5, 3, 2);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x9999ff, 0.4);
  fill.position.set(-2, 1, 1);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xffffff, 0.6);
  rim.position.set(0, 3, -3);
  scene.add(rim);

  scene.add(vrm.scene);
  vrm.update(0.016);

  const camera = new THREE.PerspectiveCamera(28, 1, 0.01, 50);
  return { scene, camera };
}

/**
 * Render a single panel from the given camera angle.
 * Returns the panel as an ImageBitmap for compositing.
 */
async function renderPanel(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  angle: CameraAngle
): Promise<ImageBitmap> {
  camera.position.copy(angle.position);
  camera.lookAt(angle.target);
  renderer.render(scene, camera);

  return new Promise<ImageBitmap>((resolve, reject) => {
    renderer.domElement.toBlob(
      async (blob) => {
        if (!blob) {
          reject(new Error('Panel render returned null blob'));
          return;
        }
        resolve(await createImageBitmap(blob));
      },
      'image/png',
      1.0
    );
  });
}

/**
 * Draw a label overlay onto a 2D canvas context.
 */
function drawLabel(ctx: CanvasRenderingContext2D, label: string, x: number, y: number): void {
  ctx.save();
  ctx.font = LABEL_FONT;
  const textWidth = ctx.measureText(label).width;
  const padding = 10;
  const boxWidth = textWidth + padding * 2;

  // Label background
  ctx.fillStyle = LABEL_BG;
  ctx.fillRect(x + 8, y + PANEL_SIZE - LABEL_HEIGHT - 8, boxWidth, LABEL_HEIGHT);

  // Label text
  ctx.fillStyle = LABEL_COLOR;
  ctx.fillText(label, x + 8 + padding, y + PANEL_SIZE - 8 - 8);
  ctx.restore();
}

// ─────────────────────────────────────────────
// Main Export
// ─────────────────────────────────────────────

/**
 * Generate a reference sheet PNG from a VRM Blob.
 * Renders the character from 5 angles and stitches them into a 2×3 grid.
 *
 * @param vrmBlob - Raw VRM file as Blob
 * @returns PNG Blob of the full reference sheet (1024×1536 px)
 */
export async function generateReferenceSheet(vrmBlob: Blob): Promise<Blob> {
  const renderer = createPanelRenderer();
  let vrm: VRM | null = null;

  try {
    vrm = await loadVRMFromBlob(vrmBlob);
    const { scene, camera } = buildScene(vrm);

    // Render all 5 angle panels
    const panels: ImageBitmap[] = [];
    for (const angle of CAMERA_ANGLES) {
      panels.push(await renderPanel(renderer, scene, camera, angle));
    }

    // Stitch panels into a 2×3 grid on a 2D canvas
    const sheetWidth = PANEL_SIZE * COLS;
    const sheetHeight = PANEL_SIZE * ROWS;

    const stitchCanvas = document.createElement('canvas');
    stitchCanvas.width = sheetWidth;
    stitchCanvas.height = sheetHeight;
    const ctx = stitchCanvas.getContext('2d')!;

    // Fill background
    ctx.fillStyle = '#0a0d14';
    ctx.fillRect(0, 0, sheetWidth, sheetHeight);

    // Draw panels in grid order + labels
    panels.forEach((bitmap, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = col * PANEL_SIZE;
      const y = row * PANEL_SIZE;
      ctx.drawImage(bitmap, x, y, PANEL_SIZE, PANEL_SIZE);
      drawLabel(ctx, CAMERA_ANGLES[i].label, x, y);
      bitmap.close(); // Free ImageBitmap memory
    });

    // Draw "Reference Sheet" header
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillStyle = '#6366f1';
    ctx.fillText('⬛ AuraCraft · Identity Reference Sheet', 16, 24);

    // Draw thin grid lines
    ctx.strokeStyle = 'rgba(99,102,241,0.3)';
    ctx.lineWidth = 1;
    for (let c = 1; c < COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * PANEL_SIZE, 0);
      ctx.lineTo(c * PANEL_SIZE, sheetHeight);
      ctx.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * PANEL_SIZE);
      ctx.lineTo(sheetWidth, r * PANEL_SIZE);
      ctx.stroke();
    }

    // Export as PNG blob
    return await new Promise<Blob>((resolve, reject) => {
      stitchCanvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Reference sheet toBlob returned null'));
        },
        'image/png',
        1.0
      );
    });
  } finally {
    if (vrm) {
      VRMUtils.deepDispose(vrm.scene);
    }
    renderer.dispose();
  }
}
