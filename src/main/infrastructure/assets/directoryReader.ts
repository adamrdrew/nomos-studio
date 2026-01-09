export type DirectoryEntry = Readonly<{
  name: string;
  isDirectory: boolean;
}>;

export type DirectoryReader = Readonly<{
  readDir: (dirPath: string) => Promise<readonly DirectoryEntry[]>;
}>;
