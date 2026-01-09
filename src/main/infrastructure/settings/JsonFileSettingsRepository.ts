import path from 'node:path';

import type { EditorSettings } from '../../../shared/domain/models';
import type { Result, SettingsError } from '../../../shared/domain/results';
import type { FileSystem } from './fileSystem';
import { decodeSettingsFile, encodeSettingsFile } from './settingsCodec';

export type JsonFileSettingsRepositoryDependencies = Readonly<{
  fs: FileSystem;
  userDataDirPath: string;
  fileName?: string;
}>;

const DEFAULT_FILE_NAME = 'nomos-settings.json';

function defaultSettings(): EditorSettings {
  return {
    assetsDirPath: null,
    gameExecutablePath: null
  };
}

function settingsFilePath(dependencies: Readonly<{ userDataDirPath: string; fileName: string }>): string {
  return path.join(dependencies.userDataDirPath, dependencies.fileName);
}

function toSettingsError(
  code: SettingsError['code'],
  message: string
): SettingsError {
  return {
    kind: 'settings-error',
    code,
    message
  };
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

export class JsonFileSettingsRepository {
  private readonly fs: FileSystem;
  private readonly userDataDirPath: string;
  private readonly fileName: string;

  public constructor(dependencies: JsonFileSettingsRepositoryDependencies) {
    this.fs = dependencies.fs;
    this.userDataDirPath = dependencies.userDataDirPath;
    this.fileName = dependencies.fileName ?? DEFAULT_FILE_NAME;
  }

  public async loadSettings(): Promise<Result<EditorSettings, SettingsError>> {
    const filePath = settingsFilePath({
      userDataDirPath: this.userDataDirPath,
      fileName: this.fileName
    });

    try {
      const raw = await this.fs.readFile(filePath, 'utf8');

      const decoded = decodeSettingsFile(raw);
      if (!decoded.ok) {
        return decoded;
      }

      return { ok: true, value: decoded.value.settings };
    } catch (error: unknown) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === 'ENOENT') {
        return { ok: true, value: defaultSettings() };
      }
      return {
        ok: false,
        error: toSettingsError('settings/read-failed', 'Failed to read settings')
      };
    }
  }

  public async saveSettings(settings: EditorSettings): Promise<Result<void, SettingsError>> {
    const filePath = settingsFilePath({
      userDataDirPath: this.userDataDirPath,
      fileName: this.fileName
    });

    const tmpPath = `${filePath}.tmp`;
    let wroteTmpFile = false;

    try {
      await this.fs.mkdir(this.userDataDirPath, { recursive: true });

      let unknownFields: Record<string, unknown> = {};
      let existingVersion: number | null = null;
      try {
        const existingRaw = await this.fs.readFile(filePath, 'utf8');
        const decodedExisting = decodeSettingsFile(existingRaw);
        if (decodedExisting.ok) {
          unknownFields = { ...(decodedExisting.value.unknownFields as Record<string, unknown>) };
          existingVersion = decodedExisting.value.version;
        }
      } catch (_readExistingError: unknown) {
        // Best effort: if we can't read/parse an existing file, we still allow saving.
      }

      const fileObject = encodeSettingsFile({
        version: existingVersion,
        settings,
        unknownFields
      });

      const json = JSON.stringify(fileObject, null, 2);

      await this.fs.writeFile(tmpPath, json, 'utf8');
      wroteTmpFile = true;

      await safeReplaceFile(this.fs, tmpPath, filePath);

      return { ok: true, value: undefined };
    } catch (_error: unknown) {
      try {
        if (wroteTmpFile) {
          await this.fs.unlink(tmpPath);
        }
      } catch (_cleanupError: unknown) {
        // Best effort.
      }
      return {
        ok: false,
        error: toSettingsError('settings/write-failed', 'Failed to write settings')
      };
    }
  }
}
