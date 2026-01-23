import { resolveSectorSurfaceTexture } from './resolveSectorSurfaceTexture';

describe('resolveSectorSurfaceTexture', () => {
  it('resolves floor surface to the sector floorTex', () => {
    const resolved = resolveSectorSurfaceTexture({
      surface: 'floor',
      sector: { floorTex: 'floor.png', ceilTex: 'ceil.png' },
      mapSky: 'red.png'
    });

    expect(resolved).toEqual({ resolvedTextureKey: 'floor.png', isSkyFill: false });
  });

  it('resolves SKY ceiling to Images/Sky/<mapSky> when mapSky is set', () => {
    const resolved = resolveSectorSurfaceTexture({
      surface: 'ceiling',
      sector: { floorTex: 'floor.png', ceilTex: 'SKY' },
      mapSky: 'red.png'
    });

    expect(resolved).toEqual({ resolvedTextureKey: 'Images/Sky/red.png', isSkyFill: true });
  });

  it('resolves SKY ceiling to null when mapSky is missing', () => {
    const resolved = resolveSectorSurfaceTexture({
      surface: 'ceiling',
      sector: { floorTex: 'floor.png', ceilTex: '  sky  ' },
      mapSky: null
    });

    expect(resolved).toEqual({ resolvedTextureKey: null, isSkyFill: true });
  });

  it('resolves non-SKY ceiling to the sector ceilTex', () => {
    const resolved = resolveSectorSurfaceTexture({
      surface: 'ceiling',
      sector: { floorTex: 'floor.png', ceilTex: 'ceil.png' },
      mapSky: 'red.png'
    });

    expect(resolved).toEqual({ resolvedTextureKey: 'ceil.png', isSkyFill: false });
  });
});
