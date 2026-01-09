export type FileSystem = Readonly<{
  readFile: (filePath: string, encoding: 'utf8') => Promise<string>;
  writeFile: (filePath: string, data: string, encoding: 'utf8') => Promise<void>;
  rename: (oldPath: string, newPath: string) => Promise<void>;
  unlink: (filePath: string) => Promise<void>;
  mkdir: (dirPath: string, options: Readonly<{ recursive: boolean }>) => Promise<void>;
}>;
