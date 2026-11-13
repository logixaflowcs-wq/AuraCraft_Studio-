import { describe, expect, it } from 'vitest';
import { limitPollinationsPrompt } from '../photoAvatarUtils';

describe('Pollinations prompt limit', () => {
  it('caps prompts at 1000 characters', () => {
    expect(limitPollinationsPrompt('x'.repeat(1200))).toHaveLength(1000);
    expect(limitPollinationsPrompt('safe')).toBe('safe');
  });
});
