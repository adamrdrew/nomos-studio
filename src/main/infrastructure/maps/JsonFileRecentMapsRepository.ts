import path from 'node:path';

import type { FileSystem } from '../settings/fileSystem';
import type { RecentMapsRepository } from '../../application/maps/RecentMapsRepository';

export type JsonFileRecentMapsRepositoryDependencies = Readonly<{
  fs: FileSystem;
  userDataDirPath: string;
  fileName?: string;
}>;

const DEFAULT_FILE_NAME = 'recent-maps.json';

function recentMapsFilePath(dependencies: Readonly<{ userDataDirPath: string; fileName: string }>): string {
  return path.join(dependencies.userDataDirPath, dependencies.fileName);
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
      // Best effort.
    }
    throw error;
  }

  try {
    await fs.unlink(backupPath);
  } catch (_cleanupError: unknown) {
    // Best effort.
  }
}

export class JsonFileRecentMapsRepository implements RecentMapsRepository {
  private readonly fs: FileSystem;
  private readonly userDataDirPath: string;
  private readonly fileName: string;

  public constructor(dependencies: JsonFileRecentMapsRepositoryDependencies) {
    this.fs = dependencies.fs;
    this.userDataDirPath = dependencies.userDataDirPath;
    this.fileName = dependencies.fileName ?? DEFAULT_FILE_NAME;
  }

  public async loadRecentMapPaths(): Promise<readonly string[]> {
    const filePath = recentMapsFilePath({ userDataDirPath: this.userDataDirPath, fileName: this.fileName });

    let raw: string;
    try {
      raw = await this.fs.readFile(filePath, 'utf8');
    } catch (error: unknown) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === 'ENOENT') {
        return [];
      }
      return [];
    }

    if (raw.trim().length === 0) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        return [];
      }
      const allStrings = parsed.every((item) => typeof item === 'string');
      if (!allStrings) {
        return [];
      }
      return parsed as string[];
    } catch (_error: unknown) {
      return [];
    }
  }

  public async saveRecentMapPaths(recentMapPaths: readonly string[]): Promise<void> {
    const filePath = recentMapsFilePath({ userDataDirPath: this.userDataDirPath, fileName: this.fileName });
    const tmpPath = `${filePath}.tmp`;
    let wroteTmpFile = false;

    try {
      await this.fs.mkdir(this.userDataDirPath, { recursive: true });
      await this.fs.writeFile(tmpPath, `${JSON.stringify(recentMapPaths, null, 2)}\n`, 'utf8');
      wroteTmpFile = true;

      await safeReplaceFile(this.fs, tmpPath, filePath);
    } catch (_error: unknown) {
      try {
        if (wroteTmpFile) {
          await this.fs.unlink(tmpPath);
        }
      } catch (_cleanupError: unknown) {
        // Best effort.
      }
    }
  }
}
