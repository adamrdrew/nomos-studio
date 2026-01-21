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

  it('returns empty list when readFile throws a non-ENOENT error', async () => {
    const fs = createFs(async () => {
      const error = new Error('access denied') as NodeJS.ErrnoException;
      error.code = 'EACCES';
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

  it('attempts to unlink tmp when rename fails after writing tmp', async () => {
    const calls: Array<{ kind: string; args: unknown[] }> = [];

    const fs: FileSystem = {
      readFile: async () => '[]',
      mkdir: async (...args) => {
        calls.push({ kind: 'mkdir', args });
      },
      writeFile: async (...args) => {
        calls.push({ kind: 'writeFile', args });
      },
      rename: async () => {
        const error = new Error('rename failed') as NodeJS.ErrnoException;
        error.code = 'EINVAL';
        throw error;
      },
      unlink: async (...args) => {
        calls.push({ kind: 'unlink', args });
      }
    };

    const repo = new JsonFileRecentMapsRepository({ fs, userDataDirPath: '/userData' });

    await repo.saveRecentMapPaths(['/a']);

    const unlinkCall = calls.find((c) => c.kind === 'unlink');
    expect(unlinkCall?.args[0]).toBe('/userData/recent-maps.json.tmp');
  });

  it('does not attempt to unlink tmp when writeFile throws before tmp is written', async () => {
    const calls: Array<{ kind: string; args: unknown[] }> = [];

    const fs: FileSystem = {
      readFile: async () => '[]',
      mkdir: async () => {},
      writeFile: async () => {
        throw new Error('write failed');
      },
      rename: async () => {
        calls.push({ kind: 'rename', args: [] });
      },
      unlink: async (...args) => {
        calls.push({ kind: 'unlink', args });
      }
    };

    const repo = new JsonFileRecentMapsRepository({ fs, userDataDirPath: '/userData' });

    await repo.saveRecentMapPaths(['/a']);

    const unlinkCall = calls.find((c) => c.kind === 'unlink');
    expect(unlinkCall).toBeUndefined();
  });

  it('uses backup-then-replace when rename(tmp, dest) throws EPERM (Windows-style) and backup name collides', async () => {
    const calls: Array<{ kind: string; args: unknown[] }> = [];
    let tmpToDestAttempt = 0;

    const fs: FileSystem = {
      readFile: async () => '[]',
      mkdir: async () => {},
      writeFile: async () => {},
      rename: async (from, to) => {
        calls.push({ kind: 'rename', args: [from, to] });

        // 1) tmp -> dest fails (Windows style)
        if (from === '/userData/recent-maps.json.tmp' && to === '/userData/recent-maps.json') {
          tmpToDestAttempt += 1;
          if (tmpToDestAttempt === 1) {
            const error = new Error('ephemeral windows rename error') as NodeJS.ErrnoException;
            error.code = 'EPERM';
            throw error;
          }
          return;
        }

        // 2) dest -> dest.bak collides, then succeeds on .bak.1
        if (from === '/userData/recent-maps.json' && to === '/userData/recent-maps.json.bak') {
          const error = new Error('backup exists') as NodeJS.ErrnoException;
          error.code = 'EEXIST';
          throw error;
        }

        return;
      },
      unlink: async (pathToUnlink) => {
        calls.push({ kind: 'unlink', args: [pathToUnlink] });
      }
    };

    const repo = new JsonFileRecentMapsRepository({ fs, userDataDirPath: '/userData' });

    await repo.saveRecentMapPaths(['/a']);

    expect(calls).toEqual([
      { kind: 'rename', args: ['/userData/recent-maps.json.tmp', '/userData/recent-maps.json'] },
      { kind: 'rename', args: ['/userData/recent-maps.json', '/userData/recent-maps.json.bak'] },
      { kind: 'rename', args: ['/userData/recent-maps.json', '/userData/recent-maps.json.bak.1'] },
      { kind: 'rename', args: ['/userData/recent-maps.json.tmp', '/userData/recent-maps.json'] },
      { kind: 'unlink', args: ['/userData/recent-maps.json.bak.1'] }
    ]);
  });

  it('completes successfully even if backup cleanup (unlink) fails', async () => {
    const calls: Array<{ kind: string; args: unknown[] }> = [];
    let phase: 'first-rename' | 'second-rename' = 'first-rename';

    const fs: FileSystem = {
      readFile: async () => '[]',
      mkdir: async () => {},
      writeFile: async () => {},
      rename: async (from, to) => {
        calls.push({ kind: 'rename', args: [from, to] });

        if (from === '/userData/recent-maps.json.tmp' && to === '/userData/recent-maps.json' && phase === 'first-rename') {
          phase = 'second-rename';
          const error = new Error('windows rename error') as NodeJS.ErrnoException;
          error.code = 'EEXIST';
          throw error;
        }

        return;
      },
      unlink: async (pathToUnlink) => {
        calls.push({ kind: 'unlink', args: [pathToUnlink] });
        const error = new Error('cleanup failed') as NodeJS.ErrnoException;
        error.code = 'EPERM';
        throw error;
      }
    };

    const repo = new JsonFileRecentMapsRepository({ fs, userDataDirPath: '/userData' });

    await repo.saveRecentMapPaths(['/a']);

    // The save completes; the cleanup failure is best-effort.
    expect(calls).toEqual([
      { kind: 'rename', args: ['/userData/recent-maps.json.tmp', '/userData/recent-maps.json'] },
      { kind: 'rename', args: ['/userData/recent-maps.json', '/userData/recent-maps.json.bak'] },
      { kind: 'rename', args: ['/userData/recent-maps.json.tmp', '/userData/recent-maps.json'] },
      { kind: 'unlink', args: ['/userData/recent-maps.json.bak'] }
    ]);
  });

  it('attempts to restore the backup if the second rename(tmp, dest) fails after backup is created', async () => {
    const calls: Array<{ kind: string; args: unknown[] }> = [];
    let renameCount = 0;

    const fs: FileSystem = {
      readFile: async () => '[]',
      mkdir: async () => {},
      writeFile: async () => {},
      rename: async (from, to) => {
        calls.push({ kind: 'rename', args: [from, to] });
        renameCount += 1;

        // 1) tmp -> dest throws Windows-style error to enter backup flow.
        if (renameCount === 1) {
          const error = new Error('windows rename error') as NodeJS.ErrnoException;
          error.code = 'EPERM';
          throw error;
        }

        // 2) dest -> backup succeeds.
        if (renameCount === 2) {
          return;
        }

        // 3) tmp -> dest fails with non-Windows error; triggers restore attempt.
        if (renameCount === 3) {
          const error = new Error('rename failed') as NodeJS.ErrnoException;
          error.code = 'EINVAL';
          throw error;
        }

        // 4) backup -> dest restore attempt (best effort)
        return;
      },
      unlink: async (pathToUnlink) => {
        calls.push({ kind: 'unlink', args: [pathToUnlink] });
      }
    };

    const repo = new JsonFileRecentMapsRepository({ fs, userDataDirPath: '/userData' });

    await repo.saveRecentMapPaths(['/a']);

    // saveRecentMapPaths swallows errors, but must attempt restore and tmp cleanup.
    expect(calls).toEqual([
      { kind: 'rename', args: ['/userData/recent-maps.json.tmp', '/userData/recent-maps.json'] },
      { kind: 'rename', args: ['/userData/recent-maps.json', '/userData/recent-maps.json.bak'] },
      { kind: 'rename', args: ['/userData/recent-maps.json.tmp', '/userData/recent-maps.json'] },
      { kind: 'rename', args: ['/userData/recent-maps.json.bak', '/userData/recent-maps.json'] },
      { kind: 'unlink', args: ['/userData/recent-maps.json.tmp'] }
    ]);
  });
});
