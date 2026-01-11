import type { AssetIndex, EditorSettings, MapDocument, MapGridSettings, MapRenderMode } from '../../../shared/domain/models';
import type { AssetIndexError } from '../../../shared/domain/results';

export type AppState = Readonly<{
  settings: EditorSettings;
  assetIndex: AssetIndex | null;
  assetIndexError: AssetIndexError | null;
  mapDocument: MapDocument | null;
  mapRenderMode: MapRenderMode;
  mapGridSettings: MapGridSettings;
}>;

export type AppStoreListener = (state: AppState) => void;

function defaultSettings(): EditorSettings {
  return { assetsDirPath: null, gameExecutablePath: null };
}

const MIN_GRID_OPACITY = 0.1;
const MAX_GRID_OPACITY = 0.8;

function clampGridOpacity(opacity: number): number {
  if (!Number.isFinite(opacity)) {
    return MIN_GRID_OPACITY;
  }

  return Math.min(MAX_GRID_OPACITY, Math.max(MIN_GRID_OPACITY, opacity));
}

function defaultMapGridSettings(): MapGridSettings {
  return {
    isGridVisible: true,
    gridOpacity: 0.35
  };
}

export class AppStore {
  private state: AppState = {
    settings: defaultSettings(),
    assetIndex: null,
    assetIndexError: null,
    mapDocument: null,
    mapRenderMode: 'wireframe',
    mapGridSettings: defaultMapGridSettings()
  };

  private readonly listeners = new Set<AppStoreListener>();

  public getState(): AppState {
    return this.state;
  }

  public subscribe(listener: AppStoreListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public setSettings(settings: EditorSettings): void {
    this.state = { ...this.state, settings };
    this.emit();
  }

  public setAssetIndex(assetIndex: AssetIndex): void {
    this.state = { ...this.state, assetIndex, assetIndexError: null };
    this.emit();
  }

  public setAssetIndexError(error: AssetIndexError): void {
    this.state = { ...this.state, assetIndex: null, assetIndexError: error };
    this.emit();
  }

  public setMapDocument(mapDocument: MapDocument | null): void {
    this.state = { ...this.state, mapDocument };
    this.emit();
  }

  public setMapRenderMode(mapRenderMode: MapRenderMode): void {
    this.state = { ...this.state, mapRenderMode };
    this.emit();
  }

  public setMapGridIsVisible(isGridVisible: boolean): void {
    this.state = {
      ...this.state,
      mapGridSettings: { ...this.state.mapGridSettings, isGridVisible }
    };
    this.emit();
  }

  public setMapGridOpacity(gridOpacity: number): void {
    this.state = {
      ...this.state,
      mapGridSettings: { ...this.state.mapGridSettings, gridOpacity: clampGridOpacity(gridOpacity) }
    };
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}
