type FsPromisesModule = typeof import('node:fs/promises');

jest.mock('node:fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
  rename: jest.fn(),
  unlink: jest.fn(),
  mkdir: jest.fn()
}));

import fs from 'node:fs/promises';

import { nodeFileSystem } from './nodeFileSystem';

describe('nodeFileSystem', () => {
  it('forwards readFile with encoding options', async () => {
    const mockedFs = fs as unknown as jest.Mocked<FsPromisesModule>;
    mockedFs.readFile.mockResolvedValue('hello' as unknown as Awaited<ReturnType<FsPromisesModule['readFile']>>);

    const result = await nodeFileSystem.readFile('/file.txt', 'utf8');

    expect(mockedFs.readFile).toHaveBeenCalledWith('/file.txt', { encoding: 'utf8' });
    expect(result).toBe('hello');
  });

  it('forwards writeFile with encoding options', async () => {
    const mockedFs = fs as unknown as jest.Mocked<FsPromisesModule>;

    await nodeFileSystem.writeFile('/file.txt', 'data', 'utf8');

    expect(mockedFs.writeFile).toHaveBeenCalledWith('/file.txt', 'data', { encoding: 'utf8' });
  });

  it('forwards rename/unlink/mkdir', async () => {
    const mockedFs = fs as unknown as jest.Mocked<FsPromisesModule>;

    await nodeFileSystem.rename('/a', '/b');
    await nodeFileSystem.unlink('/b');
    await nodeFileSystem.mkdir('/dir', { recursive: true });

    expect(mockedFs.rename).toHaveBeenCalledWith('/a', '/b');
    expect(mockedFs.unlink).toHaveBeenCalledWith('/b');
    expect(mockedFs.mkdir).toHaveBeenCalledWith('/dir', { recursive: true });
  });
});
