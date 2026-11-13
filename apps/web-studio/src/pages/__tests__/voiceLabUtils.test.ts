import { describe, expect, it } from 'vitest';
import { formatTtsRatePitch } from '../voiceLabUtils';

describe('Voice Lab TTS settings', () => {
  it('converts positive and negative rate/pitch controls to Edge-TTS format', () => {
    expect(formatTtsRatePitch(1.2, 15)).toEqual({ rate: '+20%', pitch: '+15Hz' });
    expect(formatTtsRatePitch(0.8, -10)).toEqual({ rate: '-20%', pitch: '-10Hz' });
  });
});
