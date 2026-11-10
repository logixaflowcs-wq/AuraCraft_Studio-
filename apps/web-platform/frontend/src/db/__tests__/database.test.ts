import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { clearAllLocalData, db, getBlob, storeBlob } from '../database';

afterEach(async () => {
  await clearAllLocalData();
});

describe('IndexedDB blob storage', () => {
  it('stores and retrieves uploaded Blob bytes by opaque ID', async () => {
    const original = new Blob(['vrm-binary'], { type: 'model/vrm' });
    const id = await storeBlob(original, 'vrm');
    const restored = await getBlob(id);
    expect(restored).toBeInstanceOf(Blob);
    expect(await restored?.text()).toBe('vrm-binary');
  });

  it('clears all IndexedDB tables during a local reset', async () => {
    await db.projects.put({ id: 'project-1', name: 'Test', createdAt: new Date() } as never);
    await storeBlob(new Blob(['photo']), 'photo');
    await clearAllLocalData();
    expect(await db.projects.count()).toBe(0);
    expect(await db.blobs.count()).toBe(0);
    expect(await db.characters.count()).toBe(0);
  });
});
