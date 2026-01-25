import type {
  AssetIndex,
  EditorSettings,
  MapDocument,
  MapDoorVisibility,
  MapGridSettings,
  MapRenderMode,
  MapSectorSurface
} from '../../../shared/domain/models';
import type { AssetIndexError } from '../../../shared/domain/results';

export type AppState = Readonly<{
  settings: EditorSettings;
  assetIndex: AssetIndex | null;
  assetIndexError: AssetIndexError | null;
  recentMapPaths: readonly string[];
  mapDocument: MapDocument | null;
  mapRenderMode: MapRenderMode;
  mapSectorSurface: MapSectorSurface;
  mapGridSettings: MapGridSettings;
  mapHighlightPortals: boolean;
  mapHighlightToggleWalls: boolean;
  mapDoorVisibility: MapDoorVisibility;
}>;

export type AppStoreListener = (state: AppState) => void;

function defaultSettings(): EditorSettings {
  return {
    assetsDirPath: null,
    gameExecutablePath: null,
    defaultSky: null,
    defaultSoundfont: null,
    defaultBgmusic: null,
    defaultWallTex: null,
    defaultFloorTex: null,
    defaultCeilTex: null
  };
}

const MIN_GRID_OPACITY = 0.1;
const MAX_GRID_OPACITY = 0.8;

function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

function clampGridOpacity(opacity: number): number {
  if (!Number.isFinite(opacity)) {
    return MIN_GRID_OPACITY;
  }

  return Math.min(MAX_GRID_OPACITY, Math.max(MIN_GRID_OPACITY, opacity));
}

function defaultMapGridSettings(): MapGridSettings {
  return {
    isGridVisible: true,
    gridOpacity: 0.3,
    isSnapToGridEnabled: true
  };
}

export class AppStore {
  private state: AppState = {
    settings: defaultSettings(),
    assetIndex: null,
    assetIndexError: null,
    recentMapPaths: [],
    mapDocument: null,
    mapRenderMode: 'textured',
    mapSectorSurface: 'floor',
    mapGridSettings: defaultMapGridSettings(),
    mapHighlightPortals: false,
    mapHighlightToggleWalls: false,
    mapDoorVisibility: 'visible'
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

  public setRecentMapPaths(recentMapPaths: readonly string[]): void {
    this.state = { ...this.state, recentMapPaths };
    this.emit();
  }

  public setMapRenderMode(mapRenderMode: MapRenderMode): void {
    this.state = { ...this.state, mapRenderMode };
    this.emit();
  }

  public setMapSectorSurface(mapSectorSurface: MapSectorSurface): void {
    this.state = { ...this.state, mapSectorSurface };
    this.emit();
  }

  public toggleMapSectorSurface(): void {
    this.setMapSectorSurface(this.state.mapSectorSurface === 'floor' ? 'ceiling' : 'floor');
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
      mapGridSettings: {
        ...this.state.mapGridSettings,
        gridOpacity: roundToTenth(clampGridOpacity(gridOpacity))
      }
    };
    this.emit();
  }

  public setMapSnapToGridIsEnabled(isSnapToGridEnabled: boolean): void {
    this.state = {
      ...this.state,
      mapGridSettings: {
        ...this.state.mapGridSettings,
        isSnapToGridEnabled
      }
    };
    this.emit();
  }

  public toggleMapSnapToGrid(): void {
    this.setMapSnapToGridIsEnabled(!this.state.mapGridSettings.isSnapToGridEnabled);
  }

  public setMapHighlightPortals(isEnabled: boolean): void {
    this.state = { ...this.state, mapHighlightPortals: isEnabled };
    this.emit();
  }

  public toggleMapHighlightPortals(): void {
    this.setMapHighlightPortals(!this.state.mapHighlightPortals);
  }

  public setMapHighlightToggleWalls(isEnabled: boolean): void {
    this.state = { ...this.state, mapHighlightToggleWalls: isEnabled };
    this.emit();
  }

  public toggleMapHighlightToggleWalls(): void {
    this.setMapHighlightToggleWalls(!this.state.mapHighlightToggleWalls);
  }

  public setMapDoorVisibility(visibility: MapDoorVisibility): void {
    this.state = { ...this.state, mapDoorVisibility: visibility };
    this.emit();
  }

  public toggleMapDoorVisibility(): void {
    this.setMapDoorVisibility(this.state.mapDoorVisibility === 'visible' ? 'hidden' : 'visible');
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}
