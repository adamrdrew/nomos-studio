import { JsonFileRecentMapsRepository } from './JsonFileRecentMapsRepository';
import type { FileSystem } from '../settings/fileSystem';

describe('JsonFileRecentMapsRepository', () => {
  const createFs = (readFileImpl: FileSystem['readFile']): FileSystem => {
    return {
      readFile: readFileImpl,
      writeFile: async () => {},
      rename: async () => {},
      unlink: async () => {},
      mkdir: async () => {}
    };
  };

  it('returns empty list when recent-maps.json is missing', async () => {
    const fs = createFs(async () => {
      const error = new Error('missing') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      throw error;
    });

    const repo = new JsonFileRecentMapsRepository({ fs, userDataDirPath: '/userData' });

    const result = await repo.loadRecentMapPaths();

    expect(result).toEqual([]);
  });

  it('returns empty list for empty file', async () => {
    const fs = createFs(async () => '   ');

    const repo = new JsonFileRecentMapsRepository({ fs, userDataDirPath: '/userData' });

    const result = await repo.loadRecentMapPaths();

    expect(result).toEqual([]);
  });

  it('returns empty list for invalid JSON', async () => {
    const fs = createFs(async () => 'not-json');

    const repo = new JsonFileRecentMapsRepository({ fs, userDataDirPath: '/userData' });

    const result = await repo.loadRecentMapPaths();

    expect(result).toEqual([]);
  });

  it('returns empty list for non-array JSON', async () => {
    const fs = createFs(async () => JSON.stringify({ a: 1 }));

    const repo = new JsonFileRecentMapsRepository({ fs, userDataDirPath: '/userData' });

    const result = await repo.loadRecentMapPaths();

    expect(result).toEqual([]);
  });

  it('returns empty list when array contains non-strings', async () => {
    const fs = createFs(async () => JSON.stringify(['a', 1]));

    const repo = new JsonFileRecentMapsRepository({ fs, userDataDirPath: '/userData' });

    const result = await repo.loadRecentMapPaths();

    expect(result).toEqual([]);
  });

  it('returns list when JSON is a string array', async () => {
    const fs = createFs(async () => JSON.stringify(['/a', '/b']));

    const repo = new JsonFileRecentMapsRepository({ fs, userDataDirPath: '/userData' });

    const result = await repo.loadRecentMapPaths();

    expect(result).toEqual(['/a', '/b']);
  });

  it('saves using a tmp file and rename', async () => {
    const calls: Array<{ kind: string; args: unknown[] }> = [];

    const fs: FileSystem = {
      readFile: async () => '[]',
      mkdir: async (...args) => {
        calls.push({ kind: 'mkdir', args });
      },
      writeFile: async (...args) => {
        calls.push({ kind: 'writeFile', args });
      },
      rename: async (...args) => {
        calls.push({ kind: 'rename', args });
      },
      unlink: async (...args) => {
        calls.push({ kind: 'unlink', args });
      }
    };

    const repo = new JsonFileRecentMapsRepository({ fs, userDataDirPath: '/userData' });

    await repo.saveRecentMapPaths(['/a']);

    const mkdirCall = calls.find((c) => c.kind === 'mkdir');
    expect(mkdirCall?.args[0]).toBe('/userData');

    const writeCall = calls.find((c) => c.kind === 'writeFile');
    expect((writeCall?.args[0] as string) ?? '').toBe('/userData/recent-maps.json.tmp');

    const renameCall = calls.find((c) => c.kind === 'rename');
    expect(renameCall?.args).toEqual(['/userData/recent-maps.json.tmp', '/userData/recent-maps.json']);
  });
});
