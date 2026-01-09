import { AssetIndexer } from './AssetIndexer';
import type { DirectoryReader } from './directoryReader';
import path from 'node:path';

type Tree = Readonly<Record<string, readonly { name: string; isDirectory: boolean }[]>>;

function createTreeReader(tree: Tree): DirectoryReader {
  return {
    readDir: async (dirPath: string) => {
      const entries = tree[dirPath];
      if (entries === undefined) {
        throw new Error('missing dir');
      }
      return entries;
    }
  };
}

describe('AssetIndexer', () => {
  it('builds a sorted list of relative paths', async () => {
    const baseDir = path.join('root', 'assets');
    const texturesDir = path.join(baseDir, 'textures');

    const tree: Tree = {
      [baseDir]: [
        { name: 'textures', isDirectory: true },
        { name: 'readme.txt', isDirectory: false }
      ],
      [texturesDir]: [
        { name: 'b.png', isDirectory: false },
        { name: 'a.png', isDirectory: false }
      ]
    };

    const indexer = new AssetIndexer({
      directoryReader: createTreeReader(tree),
      nowIso: () => '2026-01-09T00:00:00.000Z'
    });

    const result = await indexer.buildIndex(baseDir);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.entries).toEqual(['readme.txt', 'textures/a.png', 'textures/b.png']);
      expect(result.value.stats.fileCount).toBe(3);
      expect(result.value.builtAtIso).toBe('2026-01-09T00:00:00.000Z');
    }
  });

  it('returns missing-base-dir error when baseDir is empty', async () => {
    const indexer = new AssetIndexer({
      directoryReader: createTreeReader({}),
      nowIso: () => '2026-01-09T00:00:00.000Z'
    });

    const result = await indexer.buildIndex('');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('asset-index/missing-base-dir');
    }
  });

  it('returns read-failed error when directory read throws', async () => {
    const baseDir = path.join('root', 'assets');
    const indexer = new AssetIndexer({
      directoryReader: createTreeReader({}),
      nowIso: () => '2026-01-09T00:00:00.000Z'
    });

    const result = await indexer.buildIndex(baseDir);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('asset-index/read-failed');
    }
  });
});
