import type { AssetIndex } from '../../../../shared/domain/models';

import { getTextureFileNames, getTextureFileNamesFromEntries } from './getTextureFileNames';

describe('getTextureFileNamesFromEntries', () => {
  it('returns empty when no entries match either texture prefix', () => {
    expect(getTextureFileNamesFromEntries(['Images/Sky/A.png'])).toEqual([]);
  });

  it('prefers Images/Textures/ when present, even if Assets/Images/Textures/ also has matches', () => {
    const result = getTextureFileNamesFromEntries([
      'Assets/Images/Textures/Z.png',
      'Images/Textures/B.png',
      'Images/Textures/A.png'
    ]);

    expect(result).toEqual(['A.png', 'B.png']);
  });

  it('falls back to Assets/Images/Textures/ when Images/Textures/ has no matches', () => {
    const result = getTextureFileNamesFromEntries([
      'Assets/Images/Textures/B.png',
      'Assets/Images/Textures/A.png',
      'Images/Sky/NotATexture.png'
    ]);

    expect(result).toEqual(['A.png', 'B.png']);
  });

  it('filters blank/whitespace filenames', () => {
    const result = getTextureFileNamesFromEntries([
      'Images/Textures/   ',
      'Images/Textures/A.png',
      'Images/Textures/\t',
      'Images/Textures/B.png'
    ]);

    expect(result).toEqual(['A.png', 'B.png']);
  });

  it('preserves subdirectories under the texture root (not basenames)', () => {
    const result = getTextureFileNamesFromEntries(['Images/Textures/Folder/Tile.png']);
    expect(result).toEqual(['Folder/Tile.png']);
  });
});

describe('getTextureFileNames', () => {
  it('returns empty when assetIndex is null', () => {
    expect(getTextureFileNames(null)).toEqual([]);
  });

  it('reads from AssetIndex.entries', () => {
    const assetIndex: AssetIndex = {
      baseDir: '/tmp',
      entries: ['Images/Textures/B.png', 'Images/Textures/A.png'],
      stats: { fileCount: 2 },
      builtAtIso: '2026-01-25T00:00:00.000Z'
    };

    expect(getTextureFileNames(assetIndex)).toEqual(['A.png', 'B.png']);
  });
});
