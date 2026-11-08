/**
 * Web Audio API Real-time FFT Viseme and Lip-Sync Extractor
 * Zero-cost, runs completely in the browser client with 0 latency.
 */
export interface VisemeFrame {
  volume: number; // 0.0 to 1.0
  aa: number;     // Open mouth 'Ah'
  ih: number;     // 'Ee' sound
  ou: number;     // 'Oo' sound
  ee: number;     // Teeth together smile
  oh: number;     // Round open mouth
}

export class LipSyncAnalyzer {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array | null = null;
  private isRunning: boolean = false;

  public init(audioElement?: HTMLAudioElement): void {
    if (this.audioCtx) return;

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.audioCtx = new AudioContextClass();
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.smoothingTimeConstant = 0.5;

    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);

    if (audioElement) {
      try {
        const source = this.audioCtx.createMediaElementSource(audioElement);
        source.connect(this.analyser);
        this.analyser.connect(this.audioCtx.destination);
      } catch (err) {
        console.warn('[LipSync] Element source already connected or failed:', err);
      }
    }
    this.isRunning = true;
  }

  public getVisemes(): VisemeFrame {
    if (!this.analyser || !this.dataArray || !this.isRunning) {
      return { volume: 0, aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 };
    }

    (this.analyser as any).getByteFrequencyData(this.dataArray);

    let sum = 0;
    const len = this.dataArray.length;

    // Formant frequency bin ranges
    // Low frequencies (vowels like 'ou', 'oh') ~ 200Hz - 800Hz (bins 2-10)
    // Mid frequencies (vowels like 'aa', 'ah') ~ 800Hz - 2000Hz (bins 10-25)
    // High frequencies (fricatives like 'ih', 'ee') ~ 2000Hz - 4000Hz (bins 25-50)
    let lowSum = 0;
    let midSum = 0;
    let highSum = 0;

    for (let i = 0; i < len; i++) {
      const val = this.dataArray[i];
      sum += val;
      if (i >= 2 && i < 12) lowSum += val;
      if (i >= 12 && i < 28) midSum += val;
      if (i >= 28 && i < 55) highSum += val;
    }

    const avg = sum / len;
    const normalizedVolume = Math.min(1.0, Math.max(0, (avg - 10) / 100));

    if (normalizedVolume < 0.05) {
      return { volume: 0, aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 };
    }

    const lowRatio = lowSum / (10 * 255);
    const midRatio = midSum / (16 * 255);
    const highRatio = highSum / (27 * 255);

    return {
      volume: normalizedVolume,
      aa: Math.min(1.0, midRatio * 1.8),
      oh: Math.min(1.0, lowRatio * 1.5),
      ou: Math.min(1.0, lowRatio * 1.2),
      ee: Math.min(1.0, highRatio * 1.4),
      ih: Math.min(1.0, highRatio * 1.6),
    };
  }

  public resume(): void {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  public dispose(): void {
    this.isRunning = false;
    if (this.audioCtx) {
      this.audioCtx.close();
      this.audioCtx = null;
    }
  }
}

export const lipSync = new LipSyncAnalyzer();
