import { pickDefaultRoomTextures } from './pickDefaultRoomTextures';

import type { AssetIndex } from '../../../../shared/domain/models';

function assetIndex(entries: readonly string[]): AssetIndex {
  return {
    baseDir: '/assets',
    entries,
    stats: { fileCount: entries.length },
    builtAtIso: '2020-01-01T00:00:00.000Z'
  };
}

describe('pickDefaultRoomTextures', () => {
  it('returns null when assetIndex is null', () => {
    const result = pickDefaultRoomTextures({
      assetIndex: null,
      settings: { defaultWallTex: 'W.png', defaultFloorTex: 'F.png', defaultCeilTex: 'C.png' }
    });

    expect(result).toBeNull();
  });

  it('uses settings defaults when all are present and available', () => {
    const index = assetIndex([
      'Images/Textures/F.png',
      'Images/Textures/C.png',
      'Images/Textures/W.png',
      'Images/Textures/Other.png'
    ]);

    const result = pickDefaultRoomTextures({
      assetIndex: index,
      settings: { defaultWallTex: 'W.png', defaultFloorTex: 'F.png', defaultCeilTex: 'C.png' }
    });

    expect(result).toEqual({ wallTex: 'W.png', floorTex: 'F.png', ceilTex: 'C.png' });
  });

  it('falls back to the first three textures when a default is missing or invalid', () => {
    const index = assetIndex([
      'Images/Textures/A.png',
      'Images/Textures/B.png',
      'Images/Textures/C.png',
      'Images/Textures/D.png'
    ]);

    const result = pickDefaultRoomTextures({
      assetIndex: index,
      settings: { defaultWallTex: 'missing.png', defaultFloorTex: 'B.png', defaultCeilTex: 'C.png' }
    });

    expect(result).toEqual({ wallTex: 'A.png', floorTex: 'B.png', ceilTex: 'C.png' });
  });

  it('returns null when fewer than three textures are available after filtering', () => {
    const index = assetIndex(['Images/Textures/Only.png', 'Images/Textures/Two.png']);

    const result = pickDefaultRoomTextures({
      assetIndex: index,
      settings: { defaultWallTex: null, defaultFloorTex: null, defaultCeilTex: null }
    });

    expect(result).toBeNull();
  });
});
