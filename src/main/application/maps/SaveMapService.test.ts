import { SaveMapService } from './SaveMapService';
import type { AppStore } from '../store/AppStore';
import type { FileSystem } from '../../infrastructure/settings/fileSystem';
import type { UserNotifier } from '../ui/UserNotifier';
import type { MapDocument } from '../../../shared/domain/models';

describe('SaveMapService', () => {
  it('returns no-document when no map is loaded', async () => {
    const store: AppStore = {
      getState: () => ({
        settings: { assetsDirPath: null, gameExecutablePath: null },
        assetIndex: null,
        assetIndexError: null,
        mapDocument: null
      }),
      subscribe: () => () => {},
      setSettings: () => {},
      setAssetIndex: () => {},
      setAssetIndexError: () => {},
      setMapDocument: () => {}
    } as unknown as AppStore;

    const fs: FileSystem = {
      readFile: async () => '',
      writeFile: async () => {},
      rename: async () => {},
      unlink: async () => {},
      mkdir: async () => {}
    };

    const notifier: UserNotifier = {
      showError: async () => {},
      showInfo: async () => {}
    };

    const service = new SaveMapService(store, fs, notifier);

    const result = await service.saveCurrentDocument();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('map-io/no-document');
    }
  });

  it('writes pretty-printed JSON and clears dirty flag', async () => {
    let savedText: string | null = null;
    let storedDirty: boolean | null = null;

    const store: AppStore = {
      getState: () => ({
        settings: { assetsDirPath: null, gameExecutablePath: null },
        assetIndex: null,
        assetIndexError: null,
        mapDocument: {
          filePath: '/maps/test.json',
          json: { a: 1 },
          dirty: true,
          lastValidation: null,
          revision: 1
        }
      }),
      subscribe: () => () => {},
      setSettings: () => {},
      setAssetIndex: () => {},
      setAssetIndexError: () => {},
      setMapDocument: (doc: MapDocument | null) => {
        storedDirty = doc?.dirty ?? null;
      }
    } as unknown as AppStore;

    const fs: FileSystem = {
      readFile: async () => '',
      writeFile: async (_filePath, data) => {
        savedText = data;
      },
      rename: async () => {},
      unlink: async () => {},
      mkdir: async () => {}
    };

    const notifier: UserNotifier = {
      showError: async () => {},
      showInfo: async () => {}
    };

    const service = new SaveMapService(store, fs, notifier);

    const result = await service.saveCurrentDocument();

    expect(result.ok).toBe(true);
    expect(savedText).toBe(`{
  "a": 1
}\n`);
    expect(storedDirty).toBe(false);
  });

  it('round-trips door required-item fields through save serialization', async () => {
    let savedText: string | null = null;

    const store: AppStore = {
      getState: () => ({
        settings: { assetsDirPath: null, gameExecutablePath: null },
        assetIndex: null,
        assetIndexError: null,
        mapDocument: {
          filePath: '/maps/test.json',
          json: {
            doors: [
              {
                id: 'right_door',
                wall_index: 5,
                tex: 'DOOR_1A.PNG',
                starts_closed: true,
                required_item: 'orange_key',
                required_item_missing_message: 'The door is locked. You need the orange key.'
              }
            ]
          },
          dirty: true,
          lastValidation: null,
          revision: 1
        }
      }),
      subscribe: () => () => {},
      setSettings: () => {},
      setAssetIndex: () => {},
      setAssetIndexError: () => {},
      setMapDocument: () => {}
    } as unknown as AppStore;

    const fs: FileSystem = {
      readFile: async () => '',
      writeFile: async (_filePath, data) => {
        savedText = data;
      },
      rename: async () => {},
      unlink: async () => {},
      mkdir: async () => {}
    };

    const notifier: UserNotifier = {
      showError: async () => {},
      showInfo: async () => {}
    };

    const service = new SaveMapService(store, fs, notifier);

    const result = await service.saveCurrentDocument();
    expect(result.ok).toBe(true);

    expect(savedText).not.toBeNull();
    const parsed = JSON.parse(savedText ?? 'null') as Record<string, unknown>;
    expect(parsed['doors']).toEqual([
      {
        id: 'right_door',
        wall_index: 5,
        tex: 'DOOR_1A.PNG',
        starts_closed: true,
        required_item: 'orange_key',
        required_item_missing_message: 'The door is locked. You need the orange key.'
      }
    ]);
  });

  it('returns write-failed when writeFile throws', async () => {
    const store: AppStore = {
      getState: () => ({
        settings: { assetsDirPath: null, gameExecutablePath: null },
        assetIndex: null,
        assetIndexError: null,
        mapDocument: {
          filePath: '/maps/test.json',
          json: { a: 1 },
          dirty: true,
          lastValidation: null,
          revision: 1
        }
      }),
      subscribe: () => () => {},
      setSettings: () => {},
      setAssetIndex: () => {},
      setAssetIndexError: () => {},
      setMapDocument: () => {}
    } as unknown as AppStore;

    const fs: FileSystem = {
      readFile: async () => '',
      writeFile: async () => {
        throw new Error('nope');
      },
      rename: async () => {},
      unlink: async () => {},
      mkdir: async () => {}
    };

    const notifier: UserNotifier = {
      showError: async () => {},
      showInfo: async () => {}
    };

    const service = new SaveMapService(store, fs, notifier);

    const result = await service.saveCurrentDocument();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('map-io/write-failed');
    }
  });

  it('returns write-failed when JSON serialization throws', async () => {
    const store: AppStore = {
      getState: () => {
        const circular: Record<string, unknown> = {};
        circular['self'] = circular;

        return {
          settings: { assetsDirPath: null, gameExecutablePath: null },
          assetIndex: null,
          assetIndexError: null,
          mapDocument: {
            filePath: '/maps/test.json',
            json: circular,
            dirty: true,
            lastValidation: null,
            revision: 1
          }
        };
      },
      subscribe: () => () => {},
      setSettings: () => {},
      setAssetIndex: () => {},
      setAssetIndexError: () => {},
      setMapDocument: () => {}
    } as unknown as AppStore;

    const fs: FileSystem = {
      readFile: async () => '',
      writeFile: async () => {},
      rename: async () => {},
      unlink: async () => {},
      mkdir: async () => {}
    };

    const errorCalls: Array<Readonly<{ title: string; message: string }>> = [];
    const notifier: UserNotifier = {
      showError: async (title, message) => {
        errorCalls.push({ title, message });
      },
      showInfo: async () => {}
    };

    const service = new SaveMapService(store, fs, notifier);

    const result = await service.saveCurrentDocument();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('map-io/write-failed');
    }
    expect(errorCalls).toEqual([{ title: 'Save Failed', message: 'Failed to serialize map JSON.' }]);
  });

  it('moves destination to a backup and retries rename on Windows-style rename error', async () => {
    const renameCalls: Array<Readonly<{ from: string; to: string }>> = [];
    const unlinkCalls: string[] = [];

    const filePath = '/maps/test.json';
    const tmpPath = `${filePath}.tmp`;
    const backupPath = `${filePath}.bak`;

    const store: AppStore = {
      getState: () => ({
        settings: { assetsDirPath: null, gameExecutablePath: null },
        assetIndex: null,
        assetIndexError: null,
        mapDocument: {
          filePath,
          json: { a: 1 },
          dirty: true,
          lastValidation: null,
          revision: 1
        }
      }),
      subscribe: () => () => {},
      setSettings: () => {},
      setAssetIndex: () => {},
      setAssetIndexError: () => {},
      setMapDocument: () => {}
    } as unknown as AppStore;

    const fs: FileSystem = {
      readFile: async () => '',
      writeFile: async () => {},
      rename: async (from, to) => {
        renameCalls.push({ from, to });
        if (from === tmpPath && to === filePath && renameCalls.length === 1) {
          const error = new Error('rename failed') as NodeJS.ErrnoException;
          error.code = 'EEXIST';
          throw error;
        }
      },
      unlink: async (pathToUnlink) => {
        unlinkCalls.push(pathToUnlink);
      },
      mkdir: async () => {}
    };

    const notifier: UserNotifier = {
      showError: async () => {},
      showInfo: async () => {}
    };

    const service = new SaveMapService(store, fs, notifier);

    const result = await service.saveCurrentDocument();

    expect(result.ok).toBe(true);
    expect(renameCalls).toEqual([
      { from: tmpPath, to: filePath },
      { from: filePath, to: backupPath },
      { from: tmpPath, to: filePath }
    ]);
    expect(unlinkCalls).toEqual([backupPath]);
  });

  it('cleans up tmp file when rename fails with an unhandled code', async () => {
    const filePath = '/maps/test.json';
    const tmpPath = `${filePath}.tmp`;
    const unlinkCalls: string[] = [];

    const store: AppStore = {
      getState: () => ({
        settings: { assetsDirPath: null, gameExecutablePath: null },
        assetIndex: null,
        assetIndexError: null,
        mapDocument: {
          filePath,
          json: { a: 1 },
          dirty: true,
          lastValidation: null,
          revision: 1
        }
      }),
      subscribe: () => () => {},
      setSettings: () => {},
      setAssetIndex: () => {},
      setAssetIndexError: () => {},
      setMapDocument: () => {}
    } as unknown as AppStore;

    const fs: FileSystem = {
      readFile: async () => '',
      writeFile: async () => {},
      rename: async () => {
        const error = new Error('rename failed') as NodeJS.ErrnoException;
        error.code = 'EINVAL';
        throw error;
      },
      unlink: async (pathToUnlink) => {
        unlinkCalls.push(pathToUnlink);
      },
      mkdir: async () => {}
    };

    const notifier: UserNotifier = {
      showError: async () => {},
      showInfo: async () => {}
    };

    const service = new SaveMapService(store, fs, notifier);

    const result = await service.saveCurrentDocument();

    expect(result.ok).toBe(false);
    expect(unlinkCalls).toContain(tmpPath);
  });

  it('attempts to restore destination if backup was created and second rename fails', async () => {
    const renameCalls: Array<Readonly<{ from: string; to: string }>> = [];
    const unlinkCalls: string[] = [];

    const filePath = '/maps/test.json';
    const tmpPath = `${filePath}.tmp`;
    const backupPath = `${filePath}.bak`;

    const store: AppStore = {
      getState: () => ({
        settings: { assetsDirPath: null, gameExecutablePath: null },
        assetIndex: null,
        assetIndexError: null,
        mapDocument: {
          filePath,
          json: { a: 1 },
          dirty: true,
          lastValidation: null,
          revision: 1
        }
      }),
      subscribe: () => () => {},
      setSettings: () => {},
      setAssetIndex: () => {},
      setAssetIndexError: () => {},
      setMapDocument: () => {}
    } as unknown as AppStore;

    const fs: FileSystem = {
      readFile: async () => '',
      writeFile: async () => {},
      rename: async (from, to) => {
        renameCalls.push({ from, to });

        // First attempt to move tmp into place fails like Windows.
        if (from === tmpPath && to === filePath && renameCalls.length === 1) {
          const error = new Error('rename failed') as NodeJS.ErrnoException;
          error.code = 'EEXIST';
          throw error;
        }

        // Second attempt to move tmp into place fails again.
        if (from === tmpPath && to === filePath && renameCalls.length === 3) {
          const error = new Error('rename failed again') as NodeJS.ErrnoException;
          error.code = 'EPERM';
          throw error;
        }

        // Restore path is allowed.
      },
      unlink: async (pathToUnlink) => {
        unlinkCalls.push(pathToUnlink);
      },
      mkdir: async () => {}
    };

    const notifier: UserNotifier = {
      showError: async () => {},
      showInfo: async () => {}
    };

    const service = new SaveMapService(store, fs, notifier);

    const result = await service.saveCurrentDocument();

    expect(result.ok).toBe(false);
    expect(renameCalls).toEqual([
      { from: tmpPath, to: filePath },
      { from: filePath, to: backupPath },
      { from: tmpPath, to: filePath },
      { from: backupPath, to: filePath }
    ]);
    expect(unlinkCalls).toContain(tmpPath);
  });

  it('retries backup name when the first backup path already exists', async () => {
    const renameCalls: Array<Readonly<{ from: string; to: string }>> = [];
    const unlinkCalls: string[] = [];

    const filePath = '/maps/test.json';
    const tmpPath = `${filePath}.tmp`;
    const backupPath = `${filePath}.bak`;
    const backupPath1 = `${filePath}.bak.1`;

    const store: AppStore = {
      getState: () => ({
        settings: { assetsDirPath: null, gameExecutablePath: null },
        assetIndex: null,
        assetIndexError: null,
        mapDocument: {
          filePath,
          json: { a: 1 },
          dirty: true,
          lastValidation: null,
          revision: 1
        }
      }),
      subscribe: () => () => {},
      setSettings: () => {},
      setAssetIndex: () => {},
      setAssetIndexError: () => {},
      setMapDocument: () => {}
    } as unknown as AppStore;

    const fs: FileSystem = {
      readFile: async () => '',
      writeFile: async () => {},
      rename: async (from, to) => {
        renameCalls.push({ from, to });

        if (from === tmpPath && to === filePath && renameCalls.length === 1) {
          const error = new Error('rename failed') as NodeJS.ErrnoException;
          error.code = 'EEXIST';
          throw error;
        }

        if (from === filePath && to === backupPath) {
          const error = new Error('backup exists') as NodeJS.ErrnoException;
          error.code = 'EEXIST';
          throw error;
        }
      },
      unlink: async (pathToUnlink) => {
        unlinkCalls.push(pathToUnlink);
      },
      mkdir: async () => {}
    };

    const notifier: UserNotifier = {
      showError: async () => {},
      showInfo: async () => {}
    };

    const service = new SaveMapService(store, fs, notifier);

    const result = await service.saveCurrentDocument();

    expect(result.ok).toBe(true);
    expect(renameCalls).toEqual([
      { from: tmpPath, to: filePath },
      { from: filePath, to: backupPath },
      { from: filePath, to: backupPath1 },
      { from: tmpPath, to: filePath }
    ]);
    expect(unlinkCalls).toEqual([backupPath1]);
  });

  it('ignores backup cleanup failures and still succeeds', async () => {
    const renameCalls: Array<Readonly<{ from: string; to: string }>> = [];
    const unlinkCalls: string[] = [];

    const filePath = '/maps/test.json';
    const tmpPath = `${filePath}.tmp`;
    const backupPath = `${filePath}.bak`;

    const store: AppStore = {
      getState: () => ({
        settings: { assetsDirPath: null, gameExecutablePath: null },
        assetIndex: null,
        assetIndexError: null,
        mapDocument: {
          filePath,
          json: { a: 1 },
          dirty: true,
          lastValidation: null,
          revision: 1
        }
      }),
      subscribe: () => () => {},
      setSettings: () => {},
      setAssetIndex: () => {},
      setAssetIndexError: () => {},
      setMapDocument: () => {}
    } as unknown as AppStore;

    const fs: FileSystem = {
      readFile: async () => '',
      writeFile: async () => {},
      rename: async (from, to) => {
        renameCalls.push({ from, to });
        if (from === tmpPath && to === filePath && renameCalls.length === 1) {
          const error = new Error('rename failed') as NodeJS.ErrnoException;
          error.code = 'EPERM';
          throw error;
        }
      },
      unlink: async (pathToUnlink) => {
        unlinkCalls.push(pathToUnlink);
        if (pathToUnlink === backupPath) {
          throw new Error('unlink failed');
        }
      },
      mkdir: async () => {}
    };

    const notifier: UserNotifier = {
      showError: async () => {},
      showInfo: async () => {}
    };

    const service = new SaveMapService(store, fs, notifier);

    const result = await service.saveCurrentDocument();

    expect(result.ok).toBe(true);
    expect(renameCalls).toEqual([
      { from: tmpPath, to: filePath },
      { from: filePath, to: backupPath },
      { from: tmpPath, to: filePath }
    ]);
    expect(unlinkCalls).toEqual([backupPath]);
  });

  it('fails when all backup candidates already exist and cleans up tmp', async () => {
    const renameCalls: Array<Readonly<{ from: string; to: string }>> = [];
    const unlinkCalls: string[] = [];

    const filePath = '/maps/test.json';
    const tmpPath = `${filePath}.tmp`;

    const store: AppStore = {
      getState: () => ({
        settings: { assetsDirPath: null, gameExecutablePath: null },
        assetIndex: null,
        assetIndexError: null,
        mapDocument: {
          filePath,
          json: { a: 1 },
          dirty: true,
          lastValidation: null,
          revision: 1
        }
      }),
      subscribe: () => () => {},
      setSettings: () => {},
      setAssetIndex: () => {},
      setAssetIndexError: () => {},
      setMapDocument: () => {}
    } as unknown as AppStore;

    const fs: FileSystem = {
      readFile: async () => '',
      writeFile: async () => {},
      rename: async (from, to) => {
        renameCalls.push({ from, to });

        if (from === tmpPath && to === filePath && renameCalls.length === 1) {
          const error = new Error('rename failed') as NodeJS.ErrnoException;
          error.code = 'EEXIST';
          throw error;
        }

        if (from === filePath && to.startsWith(`${filePath}.bak`)) {
          const error = new Error('backup exists') as NodeJS.ErrnoException;
          error.code = 'EEXIST';
          throw error;
        }
      },
      unlink: async (pathToUnlink) => {
        unlinkCalls.push(pathToUnlink);
      },
      mkdir: async () => {}
    };

    const notifier: UserNotifier = {
      showError: async () => {},
      showInfo: async () => {}
    };

    const service = new SaveMapService(store, fs, notifier);

    const result = await service.saveCurrentDocument();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('map-io/write-failed');
    }

    const backupRenameCalls = renameCalls.filter((call) => call.from === filePath);
    expect(backupRenameCalls).toHaveLength(10);
    expect(backupRenameCalls[0]).toEqual({ from: filePath, to: `${filePath}.bak` });
    expect(backupRenameCalls[9]).toEqual({ from: filePath, to: `${filePath}.bak.9` });
    expect(unlinkCalls).toContain(tmpPath);
  });

  it('attempts restore but does not crash if restore fails', async () => {
    const renameCalls: Array<Readonly<{ from: string; to: string }>> = [];
    const unlinkCalls: string[] = [];

    const filePath = '/maps/test.json';
    const tmpPath = `${filePath}.tmp`;
    const backupPath = `${filePath}.bak`;

    const store: AppStore = {
      getState: () => ({
        settings: { assetsDirPath: null, gameExecutablePath: null },
        assetIndex: null,
        assetIndexError: null,
        mapDocument: {
          filePath,
          json: { a: 1 },
          dirty: true,
          lastValidation: null,
          revision: 1
        }
      }),
      subscribe: () => () => {},
      setSettings: () => {},
      setAssetIndex: () => {},
      setAssetIndexError: () => {},
      setMapDocument: () => {}
    } as unknown as AppStore;

    const fs: FileSystem = {
      readFile: async () => '',
      writeFile: async () => {},
      rename: async (from, to) => {
        renameCalls.push({ from, to });

        if (from === tmpPath && to === filePath && renameCalls.length === 1) {
          const error = new Error('rename failed') as NodeJS.ErrnoException;
          error.code = 'EEXIST';
          throw error;
        }

        if (from === tmpPath && to === filePath && renameCalls.length === 3) {
          const error = new Error('rename failed again') as NodeJS.ErrnoException;
          error.code = 'EPERM';
          throw error;
        }

        if (from === backupPath && to === filePath) {
          const error = new Error('restore failed') as NodeJS.ErrnoException;
          error.code = 'EPERM';
          throw error;
        }
      },
      unlink: async (pathToUnlink) => {
        unlinkCalls.push(pathToUnlink);
      },
      mkdir: async () => {}
    };

    const notifier: UserNotifier = {
      showError: async () => {},
      showInfo: async () => {}
    };

    const service = new SaveMapService(store, fs, notifier);

    const result = await service.saveCurrentDocument();

    expect(result.ok).toBe(false);
    expect(renameCalls).toEqual([
      { from: tmpPath, to: filePath },
      { from: filePath, to: backupPath },
      { from: tmpPath, to: filePath },
      { from: backupPath, to: filePath }
    ]);
    expect(unlinkCalls).toContain(tmpPath);
  });

  it('fails when moving destination to backup throws a non-EEXIST error and cleans up tmp', async () => {
    const renameCalls: Array<Readonly<{ from: string; to: string }>> = [];
    const unlinkCalls: string[] = [];

    const filePath = '/maps/test.json';
    const tmpPath = `${filePath}.tmp`;
    const backupPath = `${filePath}.bak`;

    const store: AppStore = {
      getState: () => ({
        settings: { assetsDirPath: null, gameExecutablePath: null },
        assetIndex: null,
        assetIndexError: null,
        mapDocument: {
          filePath,
          json: { a: 1 },
          dirty: true,
          lastValidation: null,
          revision: 1
        }
      }),
      subscribe: () => () => {},
      setSettings: () => {},
      setAssetIndex: () => {},
      setAssetIndexError: () => {},
      setMapDocument: () => {}
    } as unknown as AppStore;

    const fs: FileSystem = {
      readFile: async () => '',
      writeFile: async () => {},
      rename: async (from, to) => {
        renameCalls.push({ from, to });

        if (from === tmpPath && to === filePath && renameCalls.length === 1) {
          const error = new Error('rename failed') as NodeJS.ErrnoException;
          error.code = 'EEXIST';
          throw error;
        }

        if (from === filePath && to === backupPath) {
          const error = new Error('backup move failed') as NodeJS.ErrnoException;
          error.code = 'EACCES';
          throw error;
        }
      },
      unlink: async (pathToUnlink) => {
        unlinkCalls.push(pathToUnlink);
      },
      mkdir: async () => {}
    };

    const notifier: UserNotifier = {
      showError: async () => {},
      showInfo: async () => {}
    };

    const service = new SaveMapService(store, fs, notifier);

    const result = await service.saveCurrentDocument();

    expect(result.ok).toBe(false);
    expect(renameCalls).toEqual([
      { from: tmpPath, to: filePath },
      { from: filePath, to: backupPath }
    ]);
    expect(unlinkCalls).toContain(tmpPath);
  });

  it('does not throw if tmp cleanup fails after a save failure', async () => {
    const filePath = '/maps/test.json';
    const tmpPath = `${filePath}.tmp`;
    const unlinkCalls: string[] = [];

    const store: AppStore = {
      getState: () => ({
        settings: { assetsDirPath: null, gameExecutablePath: null },
        assetIndex: null,
        assetIndexError: null,
        mapDocument: {
          filePath,
          json: { a: 1 },
          dirty: true,
          lastValidation: null,
          revision: 1
        }
      }),
      subscribe: () => () => {},
      setSettings: () => {},
      setAssetIndex: () => {},
      setAssetIndexError: () => {},
      setMapDocument: () => {}
    } as unknown as AppStore;

    const fs: FileSystem = {
      readFile: async () => '',
      writeFile: async () => {},
      rename: async () => {
        const error = new Error('rename failed') as NodeJS.ErrnoException;
        error.code = 'EINVAL';
        throw error;
      },
      unlink: async (pathToUnlink) => {
        unlinkCalls.push(pathToUnlink);
        if (pathToUnlink === tmpPath) {
          throw new Error('unlink failed');
        }
      },
      mkdir: async () => {}
    };

    const notifier: UserNotifier = {
      showError: async () => {},
      showInfo: async () => {}
    };

    const service = new SaveMapService(store, fs, notifier);

    const result = await service.saveCurrentDocument();

    expect(result.ok).toBe(false);
    expect(unlinkCalls).toContain(tmpPath);
  });

  describe('saveCurrentDocumentAs', () => {
    it('returns no-document when no map is loaded', async () => {
      const store: AppStore = {
        getState: () => ({
          settings: { assetsDirPath: null, gameExecutablePath: null },
          assetIndex: null,
          assetIndexError: null,
          mapDocument: null
        }),
        subscribe: () => () => {},
        setSettings: () => {},
        setAssetIndex: () => {},
        setAssetIndexError: () => {},
        setMapDocument: () => {}
      } as unknown as AppStore;

      const fs: FileSystem = {
        readFile: async () => '',
        writeFile: async () => {},
        rename: async () => {},
        unlink: async () => {},
        mkdir: async () => {}
      };

      const errorCalls: Array<Readonly<{ title: string; message: string }>> = [];
      const notifier: UserNotifier = {
        showError: async (title, message) => {
          errorCalls.push({ title, message });
        },
        showInfo: async () => {}
      };

      const service = new SaveMapService(store, fs, notifier);

      const result = await service.saveCurrentDocumentAs('/maps/other.json');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('map-io/no-document');
      }
      expect(errorCalls).toEqual([{ title: 'Save Failed', message: 'No map is currently loaded.' }]);
    });

    it('returns write-failed when JSON serialization fails', async () => {
      const cyclic: { self?: unknown } = {};
      cyclic.self = cyclic;

      const store: AppStore = {
        getState: () => ({
          settings: { assetsDirPath: null, gameExecutablePath: null },
          assetIndex: null,
          assetIndexError: null,
          mapDocument: {
            filePath: '/maps/test.json',
            json: cyclic as unknown as Record<string, unknown>,
            dirty: true,
            lastValidation: null,
            revision: 1
          }
        }),
        subscribe: () => () => {},
        setSettings: () => {},
        setAssetIndex: () => {},
        setAssetIndexError: () => {},
        setMapDocument: () => {}
      } as unknown as AppStore;

      const fs: FileSystem = {
        readFile: async () => '',
        writeFile: async () => {},
        rename: async () => {},
        unlink: async () => {},
        mkdir: async () => {}
      };

      const errorCalls: Array<Readonly<{ title: string; message: string }>> = [];
      const notifier: UserNotifier = {
        showError: async (title, message) => {
          errorCalls.push({ title, message });
        },
        showInfo: async () => {}
      };

      const service = new SaveMapService(store, fs, notifier);

      const result = await service.saveCurrentDocumentAs('/maps/other.json');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('map-io/write-failed');
      }
      expect(errorCalls).toEqual([{ title: 'Save Failed', message: 'Failed to serialize map JSON.' }]);
    });

    it('returns write-failed when writeFile throws', async () => {
      const storedDocuments: Array<MapDocument | null> = [];

      const store: AppStore = {
        getState: () => ({
          settings: { assetsDirPath: null, gameExecutablePath: null },
          assetIndex: null,
          assetIndexError: null,
          mapDocument: {
            filePath: '/maps/test.json',
            json: { a: 1 },
            dirty: true,
            lastValidation: null,
            revision: 1
          }
        }),
        subscribe: () => () => {},
        setSettings: () => {},
        setAssetIndex: () => {},
        setAssetIndexError: () => {},
        setMapDocument: (doc: MapDocument | null) => {
          storedDocuments.push(doc);
        }
      } as unknown as AppStore;

      const fs: FileSystem = {
        readFile: async () => '',
        writeFile: async () => {
          throw new Error('nope');
        },
        rename: async () => {},
        unlink: async () => {},
        mkdir: async () => {}
      };

      const errorCalls: Array<Readonly<{ title: string; message: string }>> = [];
      const notifier: UserNotifier = {
        showError: async (title, message) => {
          errorCalls.push({ title, message });
        },
        showInfo: async () => {}
      };

      const service = new SaveMapService(store, fs, notifier);

      const result = await service.saveCurrentDocumentAs('/maps/other.json');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('map-io/write-failed');
      }
      expect(storedDocuments).toEqual([]);
      expect(errorCalls).toEqual([{ title: 'Save Failed', message: 'Failed to write map file.' }]);
    });

    it('cleans up tmp and returns write-failed when safe replace throws', async () => {
      const unlinkCalls: string[] = [];

      const destinationPath = '/maps/other.json';
      const tmpPath = `${destinationPath}.tmp`;

      const store: AppStore = {
        getState: () => ({
          settings: { assetsDirPath: null, gameExecutablePath: null },
          assetIndex: null,
          assetIndexError: null,
          mapDocument: {
            filePath: '/maps/test.json',
            json: { a: 1 },
            dirty: true,
            lastValidation: null,
            revision: 1
          }
        }),
        subscribe: () => () => {},
        setSettings: () => {},
        setAssetIndex: () => {},
        setAssetIndexError: () => {},
        setMapDocument: () => {}
      } as unknown as AppStore;

      const fs: FileSystem = {
        readFile: async () => '',
        writeFile: async () => {},
        rename: async () => {
          const error = new Error('rename failed') as NodeJS.ErrnoException;
          error.code = 'EINVAL';
          throw error;
        },
        unlink: async (pathToUnlink) => {
          unlinkCalls.push(pathToUnlink);
        },
        mkdir: async () => {}
      };

      const errorCalls: Array<Readonly<{ title: string; message: string }>> = [];
      const notifier: UserNotifier = {
        showError: async (title, message) => {
          errorCalls.push({ title, message });
        },
        showInfo: async () => {}
      };

      const service = new SaveMapService(store, fs, notifier);

      const result = await service.saveCurrentDocumentAs(destinationPath);

      expect(result.ok).toBe(false);
      expect(unlinkCalls).toContain(tmpPath);
      expect(errorCalls).toEqual([{ title: 'Save Failed', message: 'Failed to write map file.' }]);
    });

    it('writes to the destination path and updates filePath and dirty flag on success', async () => {
      const destinationPath = '/maps/other.json';
      const tmpPath = `${destinationPath}.tmp`;

      let savedPath: string | null = null;
      let savedText: string | null = null;
      let storedDocument: unknown = null;
      const renameCalls: Array<Readonly<{ from: string; to: string }>> = [];

      const store: AppStore = {
        getState: () => ({
          settings: { assetsDirPath: null, gameExecutablePath: null },
          assetIndex: null,
          assetIndexError: null,
          mapDocument: {
            filePath: '/maps/test.json',
            json: { a: 1 },
            dirty: true,
            lastValidation: null,
            revision: 1
          }
        }),
        subscribe: () => () => {},
        setSettings: () => {},
        setAssetIndex: () => {},
        setAssetIndexError: () => {},
        setMapDocument: (doc: MapDocument | null) => {
          storedDocument = doc;
        }
      } as unknown as AppStore;

      const fs: FileSystem = {
        readFile: async () => '',
        writeFile: async (filePath, data) => {
          savedPath = filePath;
          savedText = data;
        },
        rename: async (from, to) => {
          renameCalls.push({ from, to });
        },
        unlink: async () => {},
        mkdir: async () => {}
      };

      const notifier: UserNotifier = {
        showError: async () => {},
        showInfo: async () => {}
      };

      const service = new SaveMapService(store, fs, notifier);

      const result = await service.saveCurrentDocumentAs(destinationPath);

      expect(result.ok).toBe(true);
      expect(savedPath).toBe(tmpPath);
      expect(savedText).toBe(`{
  "a": 1
}\n`);
      expect(renameCalls).toEqual([{ from: tmpPath, to: destinationPath }]);
      expect(storedDocument).not.toBeNull();
      if (storedDocument === null) {
        throw new Error('Expected store.setMapDocument to be called with a MapDocument');
      }
      const stored = storedDocument as { filePath: string; dirty: boolean };
      expect(stored.filePath).toBe(destinationPath);
      expect(stored.dirty).toBe(false);
    });
  });
});
