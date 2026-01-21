import { routeAssetDoubleClick } from './assetActionRouter';

describe('routeAssetDoubleClick', () => {
  it('routes Levels/*.json (case-insensitive) to open-map-in-editor', () => {
    const action = routeAssetDoubleClick('Levels/MyLevel.JSON');

    expect(action).toEqual({ kind: 'open-map-in-editor', relativePath: 'Levels/MyLevel.JSON' });
  });

  it('routes non-Levels assets to open-via-os', () => {
    const action = routeAssetDoubleClick('Textures/wall.png');

    expect(action).toEqual({ kind: 'open-via-os', relativePath: 'Textures/wall.png' });
  });

  it('normalizes Windows path separators to forward slashes', () => {
    const action = routeAssetDoubleClick('Levels\\a.json');

    expect(action).toEqual({ kind: 'open-map-in-editor', relativePath: 'Levels/a.json' });
  });

  it('trims whitespace before routing', () => {
    const action = routeAssetDoubleClick('   Levels/a.json   ');

    expect(action).toEqual({ kind: 'open-map-in-editor', relativePath: 'Levels/a.json' });
  });
});
