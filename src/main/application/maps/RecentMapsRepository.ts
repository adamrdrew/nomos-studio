export type RecentMapsRepository = Readonly<{
  loadRecentMapPaths: () => Promise<readonly string[]>;
  saveRecentMapPaths: (recentMapPaths: readonly string[]) => Promise<void>;
}>;
