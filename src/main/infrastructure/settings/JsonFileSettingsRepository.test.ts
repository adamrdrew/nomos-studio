import path from 'node:path';

import { JsonFileSettingsRepository } from './JsonFileSettingsRepository';
import type { FileSystem } from './fileSystem';

type InMemoryFsState = {
  files: Map<string, string>;
  throwOn?: {
    readFile?: boolean;
    writeFile?: boolean;
    rename?: boolean;
    unlink?: boolean;
  };
  renameThrowsCode?: string;
};

function createInMemoryFileSystem(state: InMemoryFsState): FileSystem {
  return {
    readFile: async (filePath: string) => {
      if (state.throwOn?.readFile === true) {
        const error = new Error('read failed') as NodeJS.ErrnoException;
        error.code = 'EACCES';
        throw error;
      }
      const value = state.files.get(filePath);
      if (value === undefined) {
        const error = new Error('not found') as NodeJS.ErrnoException;
        error.code = 'ENOENT';
        throw error;
      }
      return value;
    },
    writeFile: async (filePath: string, data: string) => {
      if (state.throwOn?.writeFile === true) {
        throw new Error('write failed');
      }
      state.files.set(filePath, data);
    },
    rename: async (oldPath: string, newPath: string) => {
      if (state.throwOn?.rename === true) {
        const error = new Error('rename failed') as NodeJS.ErrnoException;
        error.code = state.renameThrowsCode ?? 'EPERM';
        throw error;
      }
      const value = state.files.get(oldPath);
      if (value === undefined) {
        throw new Error('missing source');
      }
      state.files.set(newPath, value);
      state.files.delete(oldPath);
    },
    unlink: async (filePath: string) => {
      if (state.throwOn?.unlink === true) {
        throw new Error('unlink failed');
      }
      state.files.delete(filePath);
    },
    mkdir: async () => {
      return;
    }
  };
}

describe('JsonFileSettingsRepository', () => {
  const userDataDirPath = '/user-data';
  const filePath = path.join(userDataDirPath, 'nomos-settings.json');

  it('returns defaults when settings file does not exist', async () => {
    const fs = createInMemoryFileSystem({ files: new Map() });
    const repository = new JsonFileSettingsRepository({ fs, userDataDirPath });

    const result = await repository.loadSettings();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.assetsDirPath).toBeNull();
      expect(result.value.gameExecutablePath).toBeNull();
    }
  });

  it('returns parse error when JSON is invalid', async () => {
    const fs = createInMemoryFileSystem({ files: new Map([[filePath, '{nope']]) });
    const repository = new JsonFileSettingsRepository({ fs, userDataDirPath });

    const result = await repository.loadSettings();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('settings/parse-failed');
    }
  });

  it('returns parse error when settings JSON is not an object', async () => {
    const fs = createInMemoryFileSystem({ files: new Map([[filePath, '"not-an-object"']]) });
    const repository = new JsonFileSettingsRepository({ fs, userDataDirPath });

    const result = await repository.loadSettings();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('settings/parse-failed');
      expect(result.error.message).toBe('Settings file is not a JSON object');
    }
  });

  it('returns read-failed when readFile throws a non-ENOENT error', async () => {
    const fs = createInMemoryFileSystem({ files: new Map([[filePath, '{}']]), throwOn: { readFile: true } });
    const repository = new JsonFileSettingsRepository({ fs, userDataDirPath });

    const result = await repository.loadSettings();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('settings/read-failed');
    }
  });

  it('treats non-string settings fields as null', async () => {
    const fs = createInMemoryFileSystem({
      files: new Map([
        [
          filePath,
          JSON.stringify({
            assetsDirPath: 123,
            gameExecutablePath: { path: '/game.exe' }
          })
        ]
      ])
    });
    const repository = new JsonFileSettingsRepository({ fs, userDataDirPath });

    const result = await repository.loadSettings();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.assetsDirPath).toBeNull();
      expect(result.value.gameExecutablePath).toBeNull();
    }
  });

  it('respects fileName override when loading settings', async () => {
    const customFileName = 'custom-settings.json';
    const customFilePath = path.join(userDataDirPath, customFileName);

    const fs = createInMemoryFileSystem({
      files: new Map([[customFilePath, JSON.stringify({ assetsDirPath: '/assets', gameExecutablePath: '/game.exe' })]])
    });

    const repository = new JsonFileSettingsRepository({ fs, userDataDirPath, fileName: customFileName });

    const result = await repository.loadSettings();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.assetsDirPath).toBe('/assets');
      expect(result.value.gameExecutablePath).toBe('/game.exe');
    }
  });

  it('saves settings atomically via temp+rename', async () => {
    const fs = createInMemoryFileSystem({ files: new Map() });
    const repository = new JsonFileSettingsRepository({ fs, userDataDirPath });

    const saveResult = await repository.saveSettings({
      assetsDirPath: '/assets',
      gameExecutablePath: '/game.exe'
    });

    expect(saveResult.ok).toBe(true);

    const loaded = await repository.loadSettings();
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(loaded.value.assetsDirPath).toBe('/assets');
      expect(loaded.value.gameExecutablePath).toBe('/game.exe');
    }
  });

  it('returns write-failed when writeFile throws', async () => {
    const fs = createInMemoryFileSystem({ files: new Map(), throwOn: { writeFile: true } });
    const repository = new JsonFileSettingsRepository({ fs, userDataDirPath });

    const result = await repository.saveSettings({ assetsDirPath: null, gameExecutablePath: null });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('settings/write-failed');
    }
  });

  it('handles Windows-style rename failures by moving destination to backup and retrying', async () => {
    const state: InMemoryFsState = {
      files: new Map([[filePath, JSON.stringify({ assetsDirPath: '/old', gameExecutablePath: null })]])
    };

    const fs = createInMemoryFileSystem(state);
    const repository = new JsonFileSettingsRepository({ fs, userDataDirPath });

    const tmpPath = `${filePath}.tmp`;
    const backupPath = `${filePath}.bak`;

    const originalRename = fs.rename;
    let threwOnce = false;
    (fs as unknown as { rename: FileSystem['rename'] }).rename = async (oldPath: string, newPath: string) => {
      if (!threwOnce && oldPath === tmpPath && newPath === filePath) {
        threwOnce = true;
        const error = new Error('rename failed') as NodeJS.ErrnoException;
        error.code = 'EEXIST';
        throw error;
      }
      return originalRename(oldPath, newPath);
    };

    const saveResult = await repository.saveSettings({ assetsDirPath: '/assets', gameExecutablePath: null });

    expect(saveResult.ok).toBe(true);
    expect(state.files.has(tmpPath)).toBe(false);
    expect(state.files.has(backupPath)).toBe(false);
    expect(state.files.get(filePath)).toBe(
      JSON.stringify({ version: 1, assetsDirPath: '/assets', gameExecutablePath: null }, null, 2)
    );
  });

  it('cleans up tmp file when rename fails with an unhandled code', async () => {
    const state: InMemoryFsState = {
      files: new Map()
    };

    const fs = createInMemoryFileSystem(state);
    const repository = new JsonFileSettingsRepository({ fs, userDataDirPath });

    const tmpPath = `${filePath}.tmp`;

    const originalRename = fs.rename;
    (fs as unknown as { rename: FileSystem['rename'] }).rename = async (oldPath: string, newPath: string) => {
      if (oldPath === tmpPath && newPath === filePath) {
        const error = new Error('rename failed') as NodeJS.ErrnoException;
        error.code = 'EINVAL';
        throw error;
      }
      return originalRename(oldPath, newPath);
    };

    const saveResult = await repository.saveSettings({ assetsDirPath: '/assets', gameExecutablePath: null });

    expect(saveResult.ok).toBe(false);
    expect(state.files.has(tmpPath)).toBe(false);
  });

  it('retries backup name when the first backup path already exists', async () => {
    const backupPath = `${filePath}.bak`;
    const backupPath1 = `${filePath}.bak.1`;

    const state: InMemoryFsState = {
      files: new Map([
        [filePath, JSON.stringify({ assetsDirPath: '/old', gameExecutablePath: null })],
        [backupPath, 'existing-backup']
      ])
    };

    const fs = createInMemoryFileSystem(state);
    const repository = new JsonFileSettingsRepository({ fs, userDataDirPath });

    const tmpPath = `${filePath}.tmp`;

    const originalRename = fs.rename;
    let threwOnce = false;
    (fs as unknown as { rename: FileSystem['rename'] }).rename = async (oldPath: string, newPath: string) => {
      if (!threwOnce && oldPath === tmpPath && newPath === filePath) {
        threwOnce = true;
        const error = new Error('rename failed') as NodeJS.ErrnoException;
        error.code = 'EEXIST';
        throw error;
      }

      if (oldPath === filePath && newPath === backupPath) {
        const error = new Error('backup exists') as NodeJS.ErrnoException;
        error.code = 'EEXIST';
        throw error;
      }

      return originalRename(oldPath, newPath);
    };

    const saveResult = await repository.saveSettings({ assetsDirPath: '/assets', gameExecutablePath: null });

    expect(saveResult.ok).toBe(true);
    expect(state.files.has(tmpPath)).toBe(false);
    expect(state.files.has(backupPath1)).toBe(false);
    expect(state.files.get(filePath)).toBe(
      JSON.stringify({ version: 1, assetsDirPath: '/assets', gameExecutablePath: null }, null, 2)
    );
  });

  it('ignores backup cleanup failures and still succeeds', async () => {
    const state: InMemoryFsState = {
      files: new Map([[filePath, JSON.stringify({ assetsDirPath: '/old', gameExecutablePath: null })]])
    };

    const fs = createInMemoryFileSystem(state);
    const repository = new JsonFileSettingsRepository({ fs, userDataDirPath });

    const tmpPath = `${filePath}.tmp`;
    const backupPath = `${filePath}.bak`;

    const originalRename = fs.rename;
    let threwOnce = false;
    (fs as unknown as { rename: FileSystem['rename'] }).rename = async (oldPath: string, newPath: string) => {
      if (!threwOnce && oldPath === tmpPath && newPath === filePath) {
        threwOnce = true;
        const error = new Error('rename failed') as NodeJS.ErrnoException;
        error.code = 'EPERM';
        throw error;
      }
      return originalRename(oldPath, newPath);
    };

    const originalUnlink = fs.unlink;
    (fs as unknown as { unlink: FileSystem['unlink'] }).unlink = async (pathToUnlink: string) => {
      if (pathToUnlink === backupPath) {
        throw new Error('unlink failed');
      }
      return originalUnlink(pathToUnlink);
    };

    const saveResult = await repository.saveSettings({ assetsDirPath: '/assets', gameExecutablePath: null });

    expect(saveResult.ok).toBe(true);
    expect(state.files.has(tmpPath)).toBe(false);
    expect(state.files.has(backupPath)).toBe(true);
    expect(state.files.get(filePath)).toBe(
      JSON.stringify({ version: 1, assetsDirPath: '/assets', gameExecutablePath: null }, null, 2)
    );
  });

  it('preserves unknown keys when updating settings', async () => {
    const state: InMemoryFsState = {
      files: new Map([
        [
          filePath,
          JSON.stringify({
            version: 1,
            assetsDirPath: '/old',
            gameExecutablePath: '/old-engine',
            extra: 123,
            future: { enabled: true }
          })
        ]
      ])
    };

    const fs = createInMemoryFileSystem(state);
    const repository = new JsonFileSettingsRepository({ fs, userDataDirPath });

    const saveResult = await repository.saveSettings({ assetsDirPath: '/assets', gameExecutablePath: null });

    expect(saveResult.ok).toBe(true);

    const updatedText = state.files.get(filePath);
    expect(updatedText).toBeDefined();
    if (updatedText === undefined) {
      throw new Error('Expected settings file to exist');
    }

    const updated = JSON.parse(updatedText) as Record<string, unknown>;
    expect(updated['version']).toBe(1);
    expect(updated['assetsDirPath']).toBe('/assets');
    expect(updated['gameExecutablePath']).toBeNull();
    expect(updated['extra']).toBe(123);
    expect(updated['future']).toEqual({ enabled: true });
  });

  it('fails when all backup candidates already exist and cleans up tmp', async () => {
    const state: InMemoryFsState = {
      files: new Map([[filePath, JSON.stringify({ assetsDirPath: '/old', gameExecutablePath: null })]])
    };

    const fs = createInMemoryFileSystem(state);
    const repository = new JsonFileSettingsRepository({ fs, userDataDirPath });

    const tmpPath = `${filePath}.tmp`;

    const originalRename = fs.rename;
    let threwOnce = false;
    (fs as unknown as { rename: FileSystem['rename'] }).rename = async (oldPath: string, newPath: string) => {
      if (!threwOnce && oldPath === tmpPath && newPath === filePath) {
        threwOnce = true;
        const error = new Error('rename failed') as NodeJS.ErrnoException;
        error.code = 'EEXIST';
        throw error;
      }

      if (oldPath === filePath && newPath.startsWith(`${filePath}.bak`)) {
        const error = new Error('backup exists') as NodeJS.ErrnoException;
        error.code = 'EEXIST';
        throw error;
      }

      return originalRename(oldPath, newPath);
    };

    const saveResult = await repository.saveSettings({ assetsDirPath: '/assets', gameExecutablePath: null });

    expect(saveResult.ok).toBe(false);
    expect(state.files.has(tmpPath)).toBe(false);
    expect(state.files.get(filePath)).toBe(JSON.stringify({ assetsDirPath: '/old', gameExecutablePath: null }));
  });

  it('attempts restore but does not crash if restore fails', async () => {
    const state: InMemoryFsState = {
      files: new Map([[filePath, JSON.stringify({ assetsDirPath: '/old', gameExecutablePath: null })]])
    };

    const fs = createInMemoryFileSystem(state);
    const repository = new JsonFileSettingsRepository({ fs, userDataDirPath });

    const tmpPath = `${filePath}.tmp`;
    const backupPath = `${filePath}.bak`;

    const originalRename = fs.rename;
    let threwInitialRename = false;
    let threwSecondRename = false;
    (fs as unknown as { rename: FileSystem['rename'] }).rename = async (oldPath: string, newPath: string) => {
      if (!threwInitialRename && oldPath === tmpPath && newPath === filePath) {
        threwInitialRename = true;
        const error = new Error('rename failed') as NodeJS.ErrnoException;
        error.code = 'EEXIST';
        throw error;
      }

      if (!threwSecondRename && threwInitialRename && oldPath === tmpPath && newPath === filePath) {
        threwSecondRename = true;
        const error = new Error('rename failed again') as NodeJS.ErrnoException;
        error.code = 'EPERM';
        throw error;
      }

      if (oldPath === backupPath && newPath === filePath) {
        const error = new Error('restore failed') as NodeJS.ErrnoException;
        error.code = 'EPERM';
        throw error;
      }

      return originalRename(oldPath, newPath);
    };

    const saveResult = await repository.saveSettings({ assetsDirPath: '/assets', gameExecutablePath: null });

    expect(saveResult.ok).toBe(false);
    expect(state.files.has(tmpPath)).toBe(false);
    expect(state.files.has(backupPath)).toBe(true);
    expect(state.files.has(filePath)).toBe(false);
  });

  it('returns write-failed when moving destination to backup throws a non-EEXIST error and cleans up tmp', async () => {
    const state: InMemoryFsState = {
      files: new Map([[filePath, JSON.stringify({ assetsDirPath: '/old', gameExecutablePath: null })]])
    };

    const fs = createInMemoryFileSystem(state);
    const repository = new JsonFileSettingsRepository({ fs, userDataDirPath });

    const tmpPath = `${filePath}.tmp`;
    const backupPath = `${filePath}.bak`;

    const originalRename = fs.rename;
    let threwOnce = false;
    (fs as unknown as { rename: FileSystem['rename'] }).rename = async (oldPath: string, newPath: string) => {
      if (!threwOnce && oldPath === tmpPath && newPath === filePath) {
        threwOnce = true;
        const error = new Error('rename failed') as NodeJS.ErrnoException;
        error.code = 'EEXIST';
        throw error;
      }

      if (oldPath === filePath && newPath === backupPath) {
        const error = new Error('backup move failed') as NodeJS.ErrnoException;
        error.code = 'EACCES';
        throw error;
      }

      return originalRename(oldPath, newPath);
    };

    const saveResult = await repository.saveSettings({ assetsDirPath: '/assets', gameExecutablePath: null });

    expect(saveResult.ok).toBe(false);
    expect(state.files.has(tmpPath)).toBe(false);
    expect(state.files.get(filePath)).toBe(JSON.stringify({ assetsDirPath: '/old', gameExecutablePath: null }));
  });

  it('does not throw if tmp cleanup fails after a save failure', async () => {
    const state: InMemoryFsState = {
      files: new Map()
    };

    const fs = createInMemoryFileSystem(state);
    const repository = new JsonFileSettingsRepository({ fs, userDataDirPath });

    const tmpPath = `${filePath}.tmp`;

    const originalRename = fs.rename;
    (fs as unknown as { rename: FileSystem['rename'] }).rename = async (oldPath: string, newPath: string) => {
      if (oldPath === tmpPath && newPath === filePath) {
        const error = new Error('rename failed') as NodeJS.ErrnoException;
        error.code = 'EINVAL';
        throw error;
      }
      return originalRename(oldPath, newPath);
    };

    const originalUnlink = fs.unlink;
    (fs as unknown as { unlink: FileSystem['unlink'] }).unlink = async (pathToUnlink: string) => {
      if (pathToUnlink === tmpPath) {
        throw new Error('unlink failed');
      }
      return originalUnlink(pathToUnlink);
    };

    const saveResult = await repository.saveSettings({ assetsDirPath: '/assets', gameExecutablePath: null });

    expect(saveResult.ok).toBe(false);
    expect(state.files.has(tmpPath)).toBe(true);
  });
});
