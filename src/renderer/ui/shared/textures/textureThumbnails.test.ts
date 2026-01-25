import type { AssetIndex } from '../../../../shared/domain/models';

import {
  TextureObjectUrlCache,
  ensureTextureObjectUrl,
  inferImageMimeType,
  resolveTextureRelativePath,
  type ObjectUrlAdapter,
  type ReadFileBytes
} from './textureThumbnails';

describe('inferImageMimeType', () => {
  it('recognizes common image extensions (case-insensitive)', () => {
    expect(inferImageMimeType('A.PNG')).toBe('image/png');
    expect(inferImageMimeType('A.jpg')).toBe('image/jpeg');
    expect(inferImageMimeType('A.JPEG')).toBe('image/jpeg');
    expect(inferImageMimeType('A.webp')).toBe('image/webp');
    expect(inferImageMimeType('A.gif')).toBe('image/gif');
  });

  it('falls back to application/octet-stream', () => {
    expect(inferImageMimeType('A.bmp')).toBe('application/octet-stream');
    expect(inferImageMimeType('')).toBe('application/octet-stream');
  });
});

describe('resolveTextureRelativePath', () => {
  const assetIndex = (entries: readonly string[]): AssetIndex => ({
    baseDir: '/tmp',
    entries,
    stats: { fileCount: entries.length },
    builtAtIso: '2026-01-25T00:00:00.000Z'
  });

  it('returns null for blank texture filename', () => {
    expect(resolveTextureRelativePath({ assetIndex: null, textureFileName: '' })).toBeNull();
    expect(resolveTextureRelativePath({ assetIndex: null, textureFileName: '   ' })).toBeNull();
  });

  it('defaults to Images/Textures when assetIndex is null', () => {
    expect(resolveTextureRelativePath({ assetIndex: null, textureFileName: 'A.png' })).toBe('Images/Textures/A.png');
  });

  it('uses Images/Textures when present in the index', () => {
    const index = assetIndex(['Images/Textures/A.png']);
    expect(resolveTextureRelativePath({ assetIndex: index, textureFileName: 'A.png' })).toBe('Images/Textures/A.png');
  });

  it('falls back to Assets/Images/Textures when present in the index', () => {
    const index = assetIndex(['Assets/Images/Textures/A.png']);
    expect(resolveTextureRelativePath({ assetIndex: index, textureFileName: 'A.png' })).toBe('Assets/Images/Textures/A.png');
  });

  it('returns null when neither texture path is present', () => {
    const index = assetIndex(['Images/Textures/Other.png']);
    expect(resolveTextureRelativePath({ assetIndex: index, textureFileName: 'A.png' })).toBeNull();
  });
});

describe('TextureObjectUrlCache', () => {
  it('evicts oldest entries and revokes URLs', () => {
    const revoked: string[] = [];

    const objectUrls: ObjectUrlAdapter = {
      create: (bytes, mimeType) => {
        void bytes;
        void mimeType;
        throw new Error('not used');
      },
      revoke: (url) => revoked.push(url)
    };

    const cache = new TextureObjectUrlCache({ maxEntries: 2, objectUrls });

    cache.put('A', 'url:A');
    cache.put('B', 'url:B');
    expect(cache.getSize()).toBe(2);

    cache.put('C', 'url:C');
    expect(cache.getSize()).toBe(2);
    expect(revoked).toEqual(['url:A']);
  });

  it('treats get() as a recency update for LRU ordering', () => {
    const revoked: string[] = [];

    const objectUrls: ObjectUrlAdapter = {
      create: (bytes, mimeType) => {
        void bytes;
        void mimeType;
        throw new Error('not used');
      },
      revoke: (url) => revoked.push(url)
    };

    const cache = new TextureObjectUrlCache({ maxEntries: 2, objectUrls });

    cache.put('A', 'url:A');
    cache.put('B', 'url:B');

    // A becomes most-recent.
    expect(cache.get('A')).toBe('url:A');

    // Evict should remove B (oldest), not A.
    cache.put('C', 'url:C');

    expect(revoked).toEqual(['url:B']);
    expect(cache.get('A')).toBe('url:A');
    expect(cache.get('C')).toBe('url:C');
  });

  it('clear() revokes all retained URLs', () => {
    const revoked: string[] = [];

    const objectUrls: ObjectUrlAdapter = {
      create: (bytes, mimeType) => {
        void bytes;
        void mimeType;
        throw new Error('not used');
      },
      revoke: (url) => revoked.push(url)
    };

    const cache = new TextureObjectUrlCache({ maxEntries: 10, objectUrls });
    cache.put('A', 'url:A');
    cache.put('B', 'url:B');

    cache.clear();
    expect(revoked.sort()).toEqual(['url:A', 'url:B']);
    expect(cache.getSize()).toBe(0);
  });
});

describe('ensureTextureObjectUrl', () => {
  it('returns cached URL without reading bytes', async () => {
    const objectUrls: ObjectUrlAdapter = {
      create: (bytes, mimeType) => {
        void bytes;
        void mimeType;
        return 'url:created';
      },
      revoke: (url) => {
        void url;
      }
    };

    const cache = new TextureObjectUrlCache({ maxEntries: 10, objectUrls });
    cache.put('Images/Textures/A.png', 'url:cached');

    let readCalls = 0;
    const readFileBytes: ReadFileBytes = async (args) => {
      void args;
      readCalls += 1;
      return { ok: true, value: new Uint8Array([1, 2, 3]) };
    };

    const result = await ensureTextureObjectUrl({
      cache,
      relativePath: 'Images/Textures/A.png',
      fileNameForMimeType: 'A.png',
      readFileBytes,
      objectUrls
    });

    expect(result).toBe('url:cached');
    expect(readCalls).toBe(0);
  });

  it('loads bytes and caches created URL on miss', async () => {
    const created: string[] = [];

    const objectUrls: ObjectUrlAdapter = {
      create: (bytes, mimeType) => {
        void bytes;
        created.push(mimeType);
        return 'url:created';
      },
      revoke: (url) => {
        void url;
      }
    };

    const cache = new TextureObjectUrlCache({ maxEntries: 10, objectUrls });

    const readFileBytes: ReadFileBytes = async (args) => {
      expect(args.relativePath).toBe('Images/Textures/A.png');
      return { ok: true, value: new Uint8Array([9]) };
    };

    const result = await ensureTextureObjectUrl({
      cache,
      relativePath: 'Images/Textures/A.png',
      fileNameForMimeType: 'A.png',
      readFileBytes,
      objectUrls
    });

    expect(result).toBe('url:created');
    expect(created).toEqual(['image/png']);
    expect(cache.get('Images/Textures/A.png')).toBe('url:created');
  });

  it('returns null when readFileBytes fails', async () => {
    const objectUrls: ObjectUrlAdapter = {
      create: (bytes, mimeType) => {
        void bytes;
        void mimeType;
        throw new Error('create should not be called');
      },
      revoke: (url) => {
        void url;
      }
    };

    const cache = new TextureObjectUrlCache({ maxEntries: 10, objectUrls });

    const readFileBytes: ReadFileBytes = async (args) => {
      void args;
      return { ok: false, error: new Error('read failed') };
    };

    const result = await ensureTextureObjectUrl({
      cache,
      relativePath: 'Images/Textures/A.png',
      fileNameForMimeType: 'A.png',
      readFileBytes,
      objectUrls
    });

    expect(result).toBeNull();
    expect(cache.get('Images/Textures/A.png')).toBeNull();
  });
});
