import fs from 'node:fs/promises';

import type { BinaryFileReader } from '../../application/assets/ReadAssetFileBytesService';

export const nodeBinaryFileReader: BinaryFileReader = {
  readFileBytes: async (absolutePath: string) => fs.readFile(absolutePath)
};
