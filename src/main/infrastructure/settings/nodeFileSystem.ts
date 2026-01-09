import fs from 'node:fs/promises';

import type { FileSystem } from './fileSystem';

export const nodeFileSystem: FileSystem = {
  readFile: async (filePath, encoding) => fs.readFile(filePath, { encoding }),
  writeFile: async (filePath, data, encoding) => fs.writeFile(filePath, data, { encoding }),
  rename: async (oldPath, newPath) => fs.rename(oldPath, newPath),
  unlink: async (filePath) => fs.unlink(filePath),
  mkdir: async (dirPath, options) => {
    await fs.mkdir(dirPath, options);
  }
};
