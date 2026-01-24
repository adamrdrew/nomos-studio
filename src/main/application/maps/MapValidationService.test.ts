import { MapValidationService } from './MapValidationService';
import type { AppStore } from '../store/AppStore';
import type { ProcessRunner } from '../../infrastructure/process/ProcessRunner';

describe('MapValidationService', () => {
  it('returns missing-settings when game executable is not set', async () => {
    const store: AppStore = {
      getState: () => ({
        settings: {
          assetsDirPath: null,
          gameExecutablePath: null,
          defaultSky: null,
          defaultSoundfont: null,
          defaultBgmusic: null,
          defaultWallTex: null,
          defaultFloorTex: null,
          defaultCeilTex: null
        },
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

    const runner: ProcessRunner = {
      run: async () => {
        throw new Error('should not run');
      }
    };

    const service = new MapValidationService(store, runner, () => '2026-01-09T00:00:00.000Z');

    const result = await service.validateMap('/maps/test.json');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('map-validation/missing-settings');
    }
  });

  it('returns ok when exit code is 0', async () => {
    const store: AppStore = {
      getState: () => ({
        settings: {
          assetsDirPath: null,
          gameExecutablePath: '/game',
          defaultSky: null,
          defaultSoundfont: null,
          defaultBgmusic: null,
          defaultWallTex: null,
          defaultFloorTex: null,
          defaultCeilTex: null
        },
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

    const runner: ProcessRunner = {
      run: async () => ({ exitCode: 0, stdout: '', stderr: '' })
    };

    const service = new MapValidationService(store, runner, () => '2026-01-09T00:00:00.000Z');

    const result = await service.validateMap('relative/map.json');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.ok).toBe(true);
      expect(result.value.validatedAtIso).toBe('2026-01-09T00:00:00.000Z');
    }
  });

  it('pretty-prints JSON error report when validation fails', async () => {
    const store: AppStore = {
      getState: () => ({
        settings: {
          assetsDirPath: null,
          gameExecutablePath: '/game',
          defaultSky: null,
          defaultSoundfont: null,
          defaultBgmusic: null,
          defaultWallTex: null,
          defaultFloorTex: null,
          defaultCeilTex: null
        },
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

    const runner: ProcessRunner = {
      run: async () => ({ exitCode: 2, stdout: '{"error":"bad"}', stderr: '' })
    };

    const service = new MapValidationService(store, runner, () => '2026-01-09T00:00:00.000Z');

    const result = await service.validateMap('/maps/test.json');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('map-validation/invalid-map');
      expect(result.error.report?.prettyText).toBe(JSON.stringify({ error: 'bad' }, null, 2));
    }
  });

  it('falls back to raw output when JSON parsing fails', async () => {
    const store: AppStore = {
      getState: () => ({
        settings: {
          assetsDirPath: null,
          gameExecutablePath: '/game',
          defaultSky: null,
          defaultSoundfont: null,
          defaultBgmusic: null,
          defaultWallTex: null,
          defaultFloorTex: null,
          defaultCeilTex: null
        },
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

    const runner: ProcessRunner = {
      run: async () => ({ exitCode: 1, stdout: 'not-json', stderr: '' })
    };

    const service = new MapValidationService(store, runner, () => '2026-01-09T00:00:00.000Z');

    const result = await service.validateMap('/maps/test.json');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.report?.prettyText).toBe('not-json');
      expect(result.error.report?.rawText).toBe('not-json');
    }
  });

  it('returns runner-failed when process runner throws', async () => {
    const store: AppStore = {
      getState: () => ({
        settings: {
          assetsDirPath: null,
          gameExecutablePath: '/game',
          defaultSky: null,
          defaultSoundfont: null,
          defaultBgmusic: null,
          defaultWallTex: null,
          defaultFloorTex: null,
          defaultCeilTex: null
        },
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

    const runner: ProcessRunner = {
      run: async () => {
        throw new Error('spawn failed');
      }
    };

    const service = new MapValidationService(store, runner, () => '2026-01-09T00:00:00.000Z');

    const result = await service.validateMap('/maps/test.json');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('map-validation/runner-failed');
    }
  });

  it('uses stderr when stdout is empty on validation failure', async () => {
    const store: AppStore = {
      getState: () => ({
        settings: {
          assetsDirPath: null,
          gameExecutablePath: '/game',
          defaultSky: null,
          defaultSoundfont: null,
          defaultBgmusic: null,
          defaultWallTex: null,
          defaultFloorTex: null,
          defaultCeilTex: null
        },
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

    const runner: ProcessRunner = {
      run: async () => ({ exitCode: 1, stdout: '', stderr: '{"error":"from-stderr"}' })
    };

    const service = new MapValidationService(store, runner, () => '2026-01-09T00:00:00.000Z');

    const result = await service.validateMap('/maps/test.json');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.report?.prettyText).toBe(JSON.stringify({ error: 'from-stderr' }, null, 2));
      expect(result.error.report?.rawText).toBe('{"error":"from-stderr"}');
    }
  });

  it('returns empty report text when validator produces no output', async () => {
    const store: AppStore = {
      getState: () => ({
        settings: {
          assetsDirPath: null,
          gameExecutablePath: '/game',
          defaultSky: null,
          defaultSoundfont: null,
          defaultBgmusic: null,
          defaultWallTex: null,
          defaultFloorTex: null,
          defaultCeilTex: null
        },
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

    const runner: ProcessRunner = {
      run: async () => ({ exitCode: 1, stdout: '   ', stderr: '   ' })
    };

    const service = new MapValidationService(store, runner, () => '2026-01-09T00:00:00.000Z');

    const result = await service.validateMap('/maps/test.json');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.report?.prettyText).toBe('');
      expect(result.error.report?.rawText).toBe('');
    }
  });
});
