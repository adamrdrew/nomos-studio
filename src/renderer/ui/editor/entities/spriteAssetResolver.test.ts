import { resolveSpriteAssetRelativePath } from './spriteAssetResolver';

import type { AssetIndex } from '../../../../shared/domain/models';

function assetIndex(entries: readonly string[]): AssetIndex {
  return {
    baseDir: '/tmp/assets',
    entries,
    stats: { fileCount: entries.length },
    builtAtIso: '2020-01-01T00:00:00.000Z'
  };
}

describe('resolveSpriteAssetRelativePath', () => {
  test('returns null when assetIndex is null', () => {
    expect(resolveSpriteAssetRelativePath({ assetIndex: null, spriteFileName: 'a.png' })).toBeNull();
  });

  test('returns null when spriteFileName is empty/whitespace', () => {
    expect(resolveSpriteAssetRelativePath({ assetIndex: assetIndex([]), spriteFileName: '' })).toBeNull();
    expect(resolveSpriteAssetRelativePath({ assetIndex: assetIndex([]), spriteFileName: '   ' })).toBeNull();
  });

  test('prefers Images/Sprites prefix when exact path exists', () => {
    const index = assetIndex(['Images/Sprites/red_key.png', 'Assets/Images/Sprites/red_key.png']);
    expect(resolveSpriteAssetRelativePath({ assetIndex: index, spriteFileName: 'red_key.png' })).toBe('Images/Sprites/red_key.png');
  });

  test('falls back to Assets/Images/Sprites when Images/Sprites does not exist', () => {
    const index = assetIndex(['Assets/Images/Sprites/red_key.png']);
    expect(resolveSpriteAssetRelativePath({ assetIndex: index, spriteFileName: 'red_key.png' })).toBe(
      'Assets/Images/Sprites/red_key.png'
    );
  });

  test('falls back to lexicographically smallest basename match when prefixed paths do not exist', () => {
    const index = assetIndex([
      'Images/Other/red_key.png',
      'Assets/Images/Whatever/red_key.png',
      'Z/red_key.png',
      'A/red_key.png'
    ]);

    expect(resolveSpriteAssetRelativePath({ assetIndex: index, spriteFileName: 'red_key.png' })).toBe('A/red_key.png');
  });

  test('returns null when there are no matches', () => {
    const index = assetIndex(['Images/Textures/x.png']);
    expect(resolveSpriteAssetRelativePath({ assetIndex: index, spriteFileName: 'red_key.png' })).toBeNull();
  });
});
