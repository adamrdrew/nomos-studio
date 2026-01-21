import type { AppStore } from '../store/AppStore';
import type { SaveMapService } from './SaveMapService';
import type { UserPrompter } from '../ui/UserPrompter';

export type UnsavedChangesGuardResult = Readonly<{ proceeded: boolean }>;

export class UnsavedChangesGuard {
  private readonly store: AppStore;
  private readonly prompter: UserPrompter;
  private readonly saveMapService: SaveMapService;

  public constructor(store: AppStore, prompter: UserPrompter, saveMapService: SaveMapService) {
    this.store = store;
    this.prompter = prompter;
    this.saveMapService = saveMapService;
  }

  public async runGuarded(action: () => Promise<void>): Promise<UnsavedChangesGuardResult> {
    const document = this.store.getState().mapDocument;
    if (document === null || document.dirty === false) {
      await action();
      return { proceeded: true };
    }

    const choice = await this.prompter.confirmUnsavedChanges({ filePath: document.filePath });

    if (choice === 'cancel') {
      return { proceeded: false };
    }

    if (choice === 'dont-save') {
      await action();
      return { proceeded: true };
    }

    const saveResult = await this.saveMapService.saveCurrentDocument();
    if (!saveResult.ok) {
      return { proceeded: false };
    }

    await action();
    return { proceeded: true };
  }
}
