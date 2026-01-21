import type { RecentMapsRepository } from './RecentMapsRepository';

export class RecentMapsService {
  private readonly maxEntries: number;
  private recentMapPaths: readonly string[];

  public constructor(repository: RecentMapsRepository, maxEntries = 5) {
    this.repository = repository;
    this.maxEntries = maxEntries;
    this.recentMapPaths = [];
  }

  private readonly repository: RecentMapsRepository;

  public getRecentMapPaths(): readonly string[] {
    return this.recentMapPaths;
  }

  public async load(): Promise<readonly string[]> {
    const loaded = await this.repository.loadRecentMapPaths();
    const normalized = this.normalizeList(loaded);
    this.recentMapPaths = normalized;
    return this.recentMapPaths;
  }

  public async bump(mapPath: string): Promise<readonly string[]> {
    const next = this.normalizeList([mapPath, ...this.recentMapPaths.filter((existing) => existing !== mapPath)]);
    this.recentMapPaths = next;

    try {
      await this.repository.saveRecentMapPaths(this.recentMapPaths);
    } catch (_error: unknown) {
      // Best effort.
    }

    return this.recentMapPaths;
  }

  private normalizeList(paths: readonly string[]): readonly string[] {
    const unique: string[] = [];
    const seen = new Set<string>();

    for (const candidate of paths) {
      if (typeof candidate !== 'string') {
        continue;
      }
      if (seen.has(candidate)) {
        continue;
      }
      seen.add(candidate);
      unique.push(candidate);
      if (unique.length >= this.maxEntries) {
        break;
      }
    }

    return unique;
  }
}
