import type { AssetIndex, EditorSettings, MapDocument, MapRenderMode } from '../../../shared/domain/models';
import type { AssetIndexError } from '../../../shared/domain/results';

export type AppState = Readonly<{
  settings: EditorSettings;
  assetIndex: AssetIndex | null;
  assetIndexError: AssetIndexError | null;
  mapDocument: MapDocument | null;
  mapRenderMode: MapRenderMode;
}>;

export type AppStoreListener = (state: AppState) => void;

function defaultSettings(): EditorSettings {
  return { assetsDirPath: null, gameExecutablePath: null };
}

export class AppStore {
  private state: AppState = {
    settings: defaultSettings(),
    assetIndex: null,
    assetIndexError: null,
    mapDocument: null,
    mapRenderMode: 'wireframe'
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

  private emit(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}
