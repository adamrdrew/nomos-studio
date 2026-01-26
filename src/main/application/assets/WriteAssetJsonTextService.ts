import path from 'node:path';

import type { AppStore } from '../store/AppStore';
import type { UserNotifier } from '../ui/UserNotifier';
import type { Result, WriteAssetError } from '../../../shared/domain/results';
import type { FileSystem } from '../../infrastructure/settings/fileSystem';

export type PathService = Readonly<{
  isAbsolute: (value: string) => boolean;
  resolve: (...segments: readonly string[]) => string;
  relative: (from: string, to: string) => string;
}>;

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

function toWriteAssetError(code: WriteAssetError['code'], message: string): WriteAssetError {
  return { kind: 'write-asset-error', code, message };
}

export class WriteAssetJsonTextService {
  public constructor(
    private readonly store: AppStore,
    private readonly pathService: PathService,
    private readonly fs: FileSystem,
    private readonly notifier: UserNotifier
  ) {}

  public async writeJsonText(relativePath: string, text: string): Promise<Result<null, WriteAssetError>> {
    const assetsDirPath = this.store.getState().settings.assetsDirPath;
    if (assetsDirPath === null || assetsDirPath.trim().length === 0) {
      await this.notifier.showError('Save Failed', 'Assets directory is not configured.');
      return {
        ok: false as const,
        error: toWriteAssetError('write-asset/missing-settings', 'Assets directory is not configured')
      };
    }

    const assetsBaseDir = assetsDirPath.trim();

    const trimmed = relativePath.trim();
    if (trimmed.length === 0) {
      await this.notifier.showError('Save Failed', 'Asset path is empty.');
      return {
        ok: false as const,
        error: toWriteAssetError('write-asset/invalid-relative-path', 'Asset path is empty')
      };
    }

    if (trimmed.includes('\u0000')) {
      await this.notifier.showError('Save Failed', 'Asset path is invalid.');
      return {
        ok: false as const,
        error: toWriteAssetError('write-asset/invalid-relative-path', 'Asset path is invalid')
      };
    }

    if (this.pathService.isAbsolute(trimmed)) {
      await this.notifier.showError('Save Failed', 'Asset path must be relative.');
      return {
        ok: false as const,
        error: toWriteAssetError('write-asset/invalid-relative-path', 'Asset path must be relative')
      };
    }

    if (!trimmed.toLowerCase().endsWith('.json')) {
      await this.notifier.showError('Save Failed', 'Only JSON files can be saved from the JSON editor.');
      return {
        ok: false as const,
        error: toWriteAssetError('write-asset/unsupported-file-type', 'Only JSON files can be saved')
      };
    }

    const destinationPath = this.pathService.resolve(assetsBaseDir, trimmed);
    const relativeToBase = this.pathService.relative(assetsBaseDir, destinationPath);

    const isTraversalOutsideBase =
      relativeToBase === '..' || relativeToBase.startsWith('../') || relativeToBase.startsWith('..\\');

    if (isTraversalOutsideBase || this.pathService.isAbsolute(relativeToBase)) {
      await this.notifier.showError('Save Failed', 'Asset path is outside the configured assets directory.');
      return {
        ok: false as const,
        error: toWriteAssetError('write-asset/outside-base-dir', 'Asset path is outside the configured assets directory')
      };
    }

    const dirPath = path.dirname(destinationPath);
    const tmpPath = `${destinationPath}.tmp`;
    let wroteTmpFile = false;

    try {
      await this.fs.mkdir(dirPath, { recursive: true });
      await this.fs.writeFile(tmpPath, `${text}\n`, 'utf8');
      wroteTmpFile = true;

      await safeReplaceFile(this.fs, tmpPath, destinationPath);
    } catch (error: unknown) {
      if (wroteTmpFile) {
        try {
          await this.fs.unlink(tmpPath);
        } catch (_cleanupError: unknown) {
          // Best effort.
        }
      }

      const message = error instanceof Error ? error.message : 'Failed to write asset file';
      await this.notifier.showError('Save Failed', 'Failed to write JSON file.');
      return {
        ok: false as const,
        error: toWriteAssetError('write-asset/write-failed', message)
      };
    }

    return { ok: true as const, value: null };
  }
}
