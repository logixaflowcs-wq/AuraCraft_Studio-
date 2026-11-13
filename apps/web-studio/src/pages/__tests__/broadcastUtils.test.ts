import { describe, expect, it } from 'vitest';
import { buildObsSourceUrl } from '../broadcastUtils';

describe('OBS source URL', () => {
  it('includes selected background and resolution', () => {
    const url = new URL(buildObsSourceUrl('https://studio.example.com', 'greenscreen', '720p'));
    expect(url.searchParams.get('obs')).toBe('true');
    expect(url.searchParams.get('bg')).toBe('greenscreen');
    expect(url.searchParams.get('resolution')).toBe('720p');
  });
});
