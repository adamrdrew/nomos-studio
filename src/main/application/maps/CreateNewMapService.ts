import type { AppStore } from '../store/AppStore';

import type { MapDocument } from '../../../shared/domain/models';
import type { Result } from '../../../shared/domain/results';
import type { MapEditHistoryPort } from './MapEditHistory';

export type NewMapDialogPort = Readonly<{
  promptForNewMapPath: () => Promise<Result<string | null, { message: string }>>;
}>;

export type UnsavedChangesGuardPort = Readonly<{
  runGuarded: (action: () => Promise<void>) => Promise<Readonly<{ proceeded: boolean }>>;
}>;

export type RecentMapsPort = Readonly<{
  bump: (mapPath: string) => Promise<readonly string[]>;
}>;

export type NewMapResponse = Result<MapDocument | null, { message: string }>;

function createEmptyMapJson(): unknown {
  return {
    vertices: [],
    sectors: [],
    walls: [],
    doors: [],
    lights: [],
    particles: [],
    entities: []
  };
}

export class CreateNewMapService {
  private readonly store: AppStore;
  private readonly dialog: NewMapDialogPort;
  private readonly history: MapEditHistoryPort;
  private readonly recentMaps: RecentMapsPort;
  private readonly guard: UnsavedChangesGuardPort;

  public constructor(
    store: AppStore,
    dialog: NewMapDialogPort,
    history: MapEditHistoryPort,
    recentMaps: RecentMapsPort,
    guard: UnsavedChangesGuardPort
  ) {
    this.store = store;
    this.dialog = dialog;
    this.history = history;
    this.recentMaps = recentMaps;
    this.guard = guard;
  }

  public async createNewMap(): Promise<NewMapResponse> {
    let dialogError: { message: string } | null = null;
    let createdDocument: MapDocument | null = null;

    const guarded = await this.guard.runGuarded(async () => {
      const pickResult = await this.dialog.promptForNewMapPath();
      if (!pickResult.ok) {
        dialogError = pickResult.error;
        return;
      }

      const destinationPath = pickResult.value;
      if (destinationPath === null) {
        return;
      }

      createdDocument = {
        filePath: destinationPath,
        json: createEmptyMapJson(),
        dirty: true,
        lastValidation: null,
        revision: 1
      };

      this.history.clear();
      this.store.setMapDocument(createdDocument);
      this.store.setRecentMapPaths(await this.recentMaps.bump(destinationPath));
    });

    if (!guarded.proceeded) {
      return { ok: true, value: null };
    }

    if (dialogError !== null) {
      return { ok: false, error: dialogError };
    }

    return { ok: true, value: createdDocument };
  }
}
