type FsPromisesModule = typeof import('node:fs/promises');

jest.mock('node:fs/promises', () => ({
  readdir: jest.fn()
}));

import fs from 'node:fs/promises';

import { nodeDirectoryReader } from './nodeDirectoryReader';

describe('nodeDirectoryReader', () => {
  it('reads directory entries with file types and maps them to DirectoryEntry', async () => {
    const mockedFs = fs as unknown as jest.Mocked<FsPromisesModule>;

    mockedFs.readdir.mockResolvedValue([
      { name: 'a.txt', isDirectory: () => false },
      { name: 'textures', isDirectory: () => true }
    ] as unknown as Awaited<ReturnType<FsPromisesModule['readdir']>>);

    const result = await nodeDirectoryReader.readDir('/assets');

    expect(mockedFs.readdir).toHaveBeenCalledWith('/assets', { withFileTypes: true });
    expect(result).toEqual([
      { name: 'a.txt', isDirectory: false },
      { name: 'textures', isDirectory: true }
    ]);
  });
});
