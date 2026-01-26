import fs from 'node:fs/promises';

import type { TextFileReader } from '../../application/assets/ReadAssetJsonTextService';

export const nodeTextFileReader: TextFileReader = {
  readFileText: async (absolutePath: string) => fs.readFile(absolutePath, { encoding: 'utf8' })
};
