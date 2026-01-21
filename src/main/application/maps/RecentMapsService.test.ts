import { RecentMapsService } from './RecentMapsService';
import type { RecentMapsRepository } from './RecentMapsRepository';

describe('RecentMapsService', () => {
  it('loads and normalizes (dedupe + cap)', async () => {
    const repository: RecentMapsRepository = {
      loadRecentMapPaths: async () => ['a', 'b', 'a', 'c', 'd', 'e', 'f'],
      saveRecentMapPaths: async () => {}
    };

    const service = new RecentMapsService(repository, 5);

    const result = await service.load();

    expect(result).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(service.getRecentMapPaths()).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('bumps an entry to the front and persists', async () => {
    const saved: string[][] = [];
    const repository: RecentMapsRepository = {
      loadRecentMapPaths: async () => ['a', 'b'],
      saveRecentMapPaths: async (recentMapPaths) => {
        saved.push([...recentMapPaths]);
      }
    };

    const service = new RecentMapsService(repository, 5);
    await service.load();

    const result = await service.bump('b');

    expect(result).toEqual(['b', 'a']);
    expect(saved).toEqual([['b', 'a']]);
  });

  it('caps at max entries when bumping new items', async () => {
    const repository: RecentMapsRepository = {
      loadRecentMapPaths: async () => ['1', '2', '3', '4', '5'],
      saveRecentMapPaths: async () => {}
    };

    const service = new RecentMapsService(repository, 5);
    await service.load();

    const result = await service.bump('6');

    expect(result).toEqual(['6', '1', '2', '3', '4']);
  });
});
