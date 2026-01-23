import { parseEntityDefDisplayModel } from './entityDefParser';

describe('parseEntityDefDisplayModel', () => {
  it('returns error when the root is not an object', () => {
    const result = parseEntityDefDisplayModel(null);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('entity-def/invalid-shape');
    }
  });

  it('returns error when name is missing/empty', () => {
    const result = parseEntityDefDisplayModel({ name: '  ' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('entity-def/missing-name');
    }
  });

  it('returns error when sprite.file.name is missing', () => {
    const result = parseEntityDefDisplayModel({ name: 'imp', sprite: {} });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('entity-def/missing-sprite-file-name');
    }
  });

  it('returns error when frame dimensions are missing', () => {
    const result = parseEntityDefDisplayModel({
      name: 'imp',
      sprite: { file: { name: 'imp.png' }, frames: {} }
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('entity-def/missing-frame-dimensions');
    }
  });

  it('returns error when frame dimensions are non-positive', () => {
    const result = parseEntityDefDisplayModel({
      name: 'imp',
      sprite: { file: { name: 'imp.png' }, frames: { dimensions: { x: 0, y: 16 } } }
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('entity-def/invalid-frame-dimensions');
    }
  });

  it('parses the minimal display model on success', () => {
    const result = parseEntityDefDisplayModel({
      name: 'Imp',
      sprite: {
        file: { name: 'imp.png' },
        frames: { dimensions: { x: 32, y: 48 } }
      }
    });

    expect(result).toEqual({
      ok: true,
      value: {
        entityName: 'Imp',
        spriteFileName: 'imp.png',
        frameWidthPx: 32,
        frameHeightPx: 48
      }
    });
  });
});
