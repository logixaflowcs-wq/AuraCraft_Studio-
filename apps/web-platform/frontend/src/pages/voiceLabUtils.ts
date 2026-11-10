// FIX(audit-3-E): normalize Voice Lab controls to the Edge-TTS rate/pitch string contract.
export function formatTtsRatePitch(rate: number, pitch: number): { rate: string; pitch: string } {
  const ratePercent = Math.round((rate - 1) * 100);
  return {
    rate: (ratePercent >= 0 ? '+' : '') + ratePercent + '%',
    pitch: (pitch >= 0 ? '+' : '') + Math.round(pitch) + 'Hz',
  };
}
