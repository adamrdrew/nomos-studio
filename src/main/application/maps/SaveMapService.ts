import path from 'node:path';

import type { MapDocument } from '../../../shared/domain/models';
import type { MapIoError, Result } from '../../../shared/domain/results';
import type { FileSystem } from '../../infrastructure/settings/fileSystem';
import type { AppStore } from '../store/AppStore';
import type { UserNotifier } from '../ui/UserNotifier';

function toMapIoError(code: MapIoError['code'], message: string): MapIoError {
  return { kind: 'map-io-error', code, message };
}

function isWindowsStyleRenameError(error: unknown): boolean {
  const nodeError = error as NodeJS.ErrnoException;
  return nodeError.code === 'EEXIST' || nodeError.code === 'EPERM';
}

async function moveToAvailableBackupPath(fs: FileSystem, filePath: string): Promise<string> {
  for (let attemptIndex = 0; attemptIndex < 10; attemptIndex += 1) {
    const backupPath = attemptIndex === 0 ? `${filePath}.bak` : `${filePath}.bak.${attemptIndex}`;
    try {
      await fs.rename(filePath, backupPath);
      return backupPath;
    } catch (error: unknown) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === 'EEXIST') {
        continue;
      }
      throw error;
    }
  }

  throw new Error('Failed to create backup path for safe replace');
}

async function safeReplaceFile(fs: FileSystem, tmpPath: string, destinationPath: string): Promise<void> {
  try {
    await fs.rename(tmpPath, destinationPath);
    return;
  } catch (error: unknown) {
    if (!isWindowsStyleRenameError(error)) {
      throw error;
    }
  }

  const backupPath = await moveToAvailableBackupPath(fs, destinationPath);
  try {
    await fs.rename(tmpPath, destinationPath);
  } catch (error: unknown) {
    try {
      await fs.rename(backupPath, destinationPath);
    } catch (_restoreError: unknown) {
      // Best effort: keep backup rather than risk data loss.
    }
    throw error;
  }

  try {
    await fs.unlink(backupPath);
  } catch (_cleanupError: unknown) {
    // Best effort.
  }
}

export class SaveMapService {
  private readonly store: AppStore;
  private readonly fs: FileSystem;
  private readonly notifier: UserNotifier;

  public constructor(store: AppStore, fs: FileSystem, notifier: UserNotifier) {
    this.store = store;
    this.fs = fs;
    this.notifier = notifier;
  }

  public async saveCurrentDocument(): Promise<Result<MapDocument, MapIoError>> {
    const document = this.store.getState().mapDocument;
    if (document === null) {
      await this.notifier.showError('Save Failed', 'No map is currently loaded.');
      return { ok: false, error: toMapIoError('map-io/no-document', 'No map loaded') };
    }

    const filePath = document.filePath;

    let jsonText: string;
    try {
      jsonText = JSON.stringify(document.json, null, 2);
    } catch (_error: unknown) {
      await this.notifier.showError('Save Failed', 'Failed to serialize map JSON.');
      return { ok: false, error: toMapIoError('map-io/write-failed', 'Failed to serialize map JSON') };
    }

    const dirPath = path.dirname(filePath);
    const tmpPath = `${filePath}.tmp`;
    let wroteTmpFile = false;

    try {
      await this.fs.mkdir(dirPath, { recursive: true });
      await this.fs.writeFile(tmpPath, `${jsonText}\n`, 'utf8');
      wroteTmpFile = true;

      await safeReplaceFile(this.fs, tmpPath, filePath);
    } catch (_error: unknown) {
      if (wroteTmpFile) {
        try {
          await this.fs.unlink(tmpPath);
        } catch (_cleanupError: unknown) {
          // Best effort.
        }
      }
      await this.notifier.showError('Save Failed', 'Failed to write map file.');
      return { ok: false, error: toMapIoError('map-io/write-failed', 'Failed to write map file') };
    }

    const updated: MapDocument = { ...document, dirty: false };
    this.store.setMapDocument(updated);

    return { ok: true, value: updated };
  }
}
