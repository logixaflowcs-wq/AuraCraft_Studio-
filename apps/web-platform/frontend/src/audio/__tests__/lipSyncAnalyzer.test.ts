import { afterEach, describe, expect, it, vi } from 'vitest';
import { LipSyncAnalyzer } from '../lipSyncAnalyzer';

class FakeAnalyser {
  fftSize = 512;
  smoothingTimeConstant = 0.5;
  frequencyBinCount = 256;
  connected = 0;
  disconnected = 0;
  connect() { this.connected += 1; }
  disconnect() { this.disconnected += 1; }
  getByteFrequencyData() {}
}

class FakeSource {
  connected = 0;
  disconnected = 0;
  connect() { this.connected += 1; }
  disconnect() { this.disconnected += 1; }
}

class FakeAudioContext {
  state: AudioContextState = 'running';
  destination = {};
  analysers: FakeAnalyser[] = [];
  sources: FakeSource[] = [];
  createAnalyser() { const node = new FakeAnalyser(); this.analysers.push(node); return node; }
  createMediaElementSource() { const node = new FakeSource(); this.sources.push(node); return node; }
  createMediaStreamSource() { return new FakeSource(); }
  resume() { return Promise.resolve(); }
  suspend() { return Promise.resolve(); }
  close() { return Promise.resolve(); }
}

afterEach(() => vi.unstubAllGlobals());

describe('LipSyncAnalyzer audio lifecycle', () => {
  it('reconnects a distinct source for each audio element while reusing one context', () => {
    const contexts: FakeAudioContext[] = [];
    vi.stubGlobal('window', { AudioContext: class extends FakeAudioContext { constructor() { super(); contexts.push(this); } } });
    const analyzer = new LipSyncAnalyzer();
    const first = {} as HTMLAudioElement;
    const second = {} as HTMLAudioElement;

    analyzer.init(first);
    analyzer.init(second);
    analyzer.init(first);

    expect(contexts).toHaveLength(1);
    expect(contexts[0].sources).toHaveLength(2);
    expect(contexts[0].sources[0].connected).toBe(2);
    expect(contexts[0].sources[0].disconnected).toBe(1);
    analyzer.dispose();
  });

  it('disconnects playback nodes on dispose and can initialize again', () => {
    const contexts: FakeAudioContext[] = [];
    vi.stubGlobal('window', { AudioContext: class extends FakeAudioContext { constructor() { super(); contexts.push(this); } } });
    const analyzer = new LipSyncAnalyzer();
    analyzer.init({} as HTMLAudioElement);
    analyzer.dispose();
    analyzer.init({} as HTMLAudioElement);
    expect(contexts).toHaveLength(1);
    expect(contexts[0].analysers).toHaveLength(2);
    analyzer.dispose();
  });
});
