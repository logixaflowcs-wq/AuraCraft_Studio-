import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { importAuraPackage, validateArchiveEntries } from '../exportService';

describe('Aura package security validation', () => {
  it('rejects packages with a missing mandatory checksum', async () => {
    const zip = new JSZip();
    zip.file('manifest.json', JSON.stringify({
      version: '1.0', characterId: 'id', characterName: 'Name', identityPrompt: '',
      tags: [], style: 'anime', exportedAt: new Date().toISOString(), source: 'AuraCraft-Studio-v1',
    }));
    zip.file('model.vrm', new Uint8Array([1, 2, 3]));
    const archive = await zip.generateAsync({ type: 'blob' });
    await expect(importAuraPackage(archive)).rejects.toThrow();
  });

  it('rejects unknown manifest properties', async () => {
    const zip = new JSZip();
    zip.file('manifest.json', JSON.stringify({
      version: '1.0', characterId: 'id', characterName: 'Name', vrmChecksum: 'a'.repeat(64),
      identityPrompt: '', tags: [], style: 'anime', exportedAt: new Date().toISOString(),
      source: 'AuraCraft-Studio-v1', unexpected: true,
    }));
    zip.file('model.vrm', new Uint8Array([1, 2, 3]));
    const archive = await zip.generateAsync({ type: 'blob' });
    await expect(importAuraPackage(archive)).rejects.toThrow();
  });

  it('rejects archives exceeding the expanded-size limit before reading entries', () => {
    const fakeZip = { files: {
      'model.vrm': { dir: false, _data: { uncompressedSize: 201 * 1024 * 1024 } },
    } } as unknown as JSZip;
    expect(() => validateArchiveEntries(fakeZip)).toThrow('200MB');
  });

  it('rejects a VRM larger than 100MB', () => {
    const fakeZip = { files: {
      'model.vrm': { dir: false, _data: { uncompressedSize: 101 * 1024 * 1024 } },
    } } as unknown as JSZip;
    expect(() => validateArchiveEntries(fakeZip)).toThrow('100MB');
  });
});
