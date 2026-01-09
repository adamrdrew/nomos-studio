import fs from 'node:fs/promises';

import type { DirectoryEntry, DirectoryReader } from './directoryReader';

export const nodeDirectoryReader: DirectoryReader = {
  readDir: async (dirPath: string): Promise<readonly DirectoryEntry[]> => {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.map((entry) => ({ name: entry.name, isDirectory: entry.isDirectory() }));
  }
};
