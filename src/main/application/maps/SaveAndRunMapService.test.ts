import { SaveAndRunMapService } from './SaveAndRunMapService';

import type { AppStore } from '../store/AppStore';
import type { SaveMapService } from './SaveMapService';
import type { MapValidationService } from './MapValidationService';
import type { ProcessRunner } from '../../infrastructure/process/ProcessRunner';
import type { UserNotifier } from '../ui/UserNotifier';

describe('SaveAndRunMapService', () => {
  it('stops when save fails (no validation or run)', async () => {
    const store: AppStore = {
      getState: () => ({
        settings: { assetsDirPath: null, gameExecutablePath: '/game' },
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

    const saveMapService: SaveMapService = {
      saveCurrentDocument: async () => ({ ok: false, error: { kind: 'map-io-error', code: 'map-io/write-failed', message: 'nope' } })
    } as unknown as SaveMapService;

    const validator: MapValidationService = {
      validateMap: async () => {
        throw new Error('should not validate');
      }
    } as unknown as MapValidationService;

    const runner: ProcessRunner = {
      run: async () => {
        throw new Error('should not run');
      }
    };

    const notifier: UserNotifier = {
      showError: async () => {},
      showInfo: async () => {}
    };

    const service = new SaveAndRunMapService(store, saveMapService, validator, runner, notifier);

    await service.saveAndRunCurrentMap();
  });

  it('shows validation report and does not run when validation fails (invalid-map)', async () => {
    const store: AppStore = {
      getState: () => ({
        settings: { assetsDirPath: null, gameExecutablePath: '/game' },
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

    const saveMapService: SaveMapService = {
      saveCurrentDocument: async () => ({
        ok: true,
        value: {
          filePath: '/Assets/Levels/big.json',
          json: {},
          dirty: false,
          lastValidation: null,
          revision: 1
        }
      })
    } as unknown as SaveMapService;

    const validator: MapValidationService = {
      validateMap: async () => ({
        ok: false,
        error: {
          kind: 'map-validation-error',
          code: 'map-validation/invalid-map',
          message: 'Map validation failed',
          report: {
            kind: 'map-validation-error-report',
            prettyText: '{"error":"bad"}',
            rawText: '{"error":"bad"}'
          }
        }
      })
    } as unknown as MapValidationService;

    const runner: ProcessRunner = {
      run: async () => {
        throw new Error('should not run');
      }
    };

    const showError = jest.fn(async () => {});

    const notifier: UserNotifier = {
      showError,
      showInfo: async () => {}
    };

    const service = new SaveAndRunMapService(store, saveMapService, validator, runner, notifier);

    await service.saveAndRunCurrentMap();

    expect(showError).toHaveBeenCalledWith('Map validation failed', 'Map validation failed', '{"error":"bad"}');
  });

  it('shows validation error and does not run when validator fails (runner-failed)', async () => {
    const store: AppStore = {
      getState: () => ({
        settings: { assetsDirPath: null, gameExecutablePath: '/game' },
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

    const saveMapService: SaveMapService = {
      saveCurrentDocument: async () => ({
        ok: true,
        value: {
          filePath: '/Assets/Levels/big.json',
          json: {},
          dirty: false,
          lastValidation: null,
          revision: 1
        }
      })
    } as unknown as SaveMapService;

    const validator: MapValidationService = {
      validateMap: async () => ({
        ok: false,
        error: {
          kind: 'map-validation-error',
          code: 'map-validation/runner-failed',
          message: 'Failed to run map validation'
        }
      })
    } as unknown as MapValidationService;

    const runner: ProcessRunner = {
      run: async () => {
        throw new Error('should not run');
      }
    };

    const showError = jest.fn(async () => {});

    const notifier: UserNotifier = {
      showError,
      showInfo: async () => {}
    };

    const service = new SaveAndRunMapService(store, saveMapService, validator, runner, notifier);

    await service.saveAndRunCurrentMap();

    expect(showError).toHaveBeenCalledWith('Map Validation Failed', 'Failed to run map validation', undefined);
  });

  it('runs engine executable with map filename when validation succeeds', async () => {
    const store: AppStore = {
      getState: () => ({
        settings: { assetsDirPath: null, gameExecutablePath: '/game' },
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

    const saveMapService: SaveMapService = {
      saveCurrentDocument: async () => ({
        ok: true,
        value: {
          filePath: '/Users/test/Assets/Levels/big.json',
          json: {},
          dirty: false,
          lastValidation: null,
          revision: 1
        }
      })
    } as unknown as SaveMapService;

    const validator: MapValidationService = {
      validateMap: async () => ({ ok: true, value: { ok: true, validatedAtIso: '2026-01-23T00:00:00.000Z' } })
    } as unknown as MapValidationService;

    const run = jest.fn(async () => ({ exitCode: 0, stdout: '', stderr: '' }));
    const runner: ProcessRunner = { run };

    const notifier: UserNotifier = {
      showError: async () => {},
      showInfo: async () => {}
    };

    const service = new SaveAndRunMapService(store, saveMapService, validator, runner, notifier);

    await service.saveAndRunCurrentMap();

    expect(run).toHaveBeenCalledWith({ command: '/game', args: ['big.json'] });
  });

  it('shows Settings Required and does not run when game executable is missing after validation succeeds', async () => {
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

    const saveMapService: SaveMapService = {
      saveCurrentDocument: async () => ({
        ok: true,
        value: {
          filePath: '/Users/test/Assets/Levels/big.json',
          json: {},
          dirty: false,
          lastValidation: null,
          revision: 1
        }
      })
    } as unknown as SaveMapService;

    const validator: MapValidationService = {
      validateMap: async () => ({ ok: true, value: { ok: true, validatedAtIso: '2026-01-23T00:00:00.000Z' } })
    } as unknown as MapValidationService;

    const runner: ProcessRunner = {
      run: async () => {
        throw new Error('should not run');
      }
    };

    const showError = jest.fn(async () => {});

    const notifier: UserNotifier = {
      showError,
      showInfo: async () => {}
    };

    const service = new SaveAndRunMapService(store, saveMapService, validator, runner, notifier);

    await service.saveAndRunCurrentMap();

    expect(showError).toHaveBeenCalledWith(
      'Settings Required',
      'Game executable path is not set. Open Settings to configure it.'
    );
  });

  it('shows Run Failed when process runner throws', async () => {
    const store: AppStore = {
      getState: () => ({
        settings: { assetsDirPath: null, gameExecutablePath: '/game' },
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

    const saveMapService: SaveMapService = {
      saveCurrentDocument: async () => ({
        ok: true,
        value: {
          filePath: '/Users/test/Assets/Levels/big.json',
          json: {},
          dirty: false,
          lastValidation: null,
          revision: 1
        }
      })
    } as unknown as SaveMapService;

    const validator: MapValidationService = {
      validateMap: async () => ({ ok: true, value: { ok: true, validatedAtIso: '2026-01-23T00:00:00.000Z' } })
    } as unknown as MapValidationService;

    const runner: ProcessRunner = {
      run: async () => {
        throw new Error('spawn failed');
      }
    };

    const showError = jest.fn(async () => {});

    const notifier: UserNotifier = {
      showError,
      showInfo: async () => {}
    };

    const service = new SaveAndRunMapService(store, saveMapService, validator, runner, notifier);

    await service.saveAndRunCurrentMap();

    expect(showError).toHaveBeenCalledWith('Run Failed', 'Failed to run game executable.');
  });
});
