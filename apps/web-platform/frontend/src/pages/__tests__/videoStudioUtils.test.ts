import { describe, expect, it } from 'vitest';
import { createSceneId } from '../videoStudioUtils';

describe('video studio scene identifiers', () => {
  it('creates unique IDs when scenes are re-added', () => {
    const ids = new Set(Array.from({ length: 100 }, () => createSceneId()));
    expect(ids.size).toBe(100);
  });
});
