import { computePolygonAnchor, computePolygonBounds, normalizePolygonToAnchor, transformStampPolygon } from './mapRoomStampTransform';

describe('mapRoomStampTransform', () => {
  test('computePolygonBounds returns null for empty polygons', () => {
    expect(computePolygonBounds([])).toBeNull();
  });

  test('computePolygonBounds returns null when coordinates are non-finite', () => {
    expect(computePolygonBounds([{ x: Number.NaN, y: 0 }])).toBeNull();
    expect(computePolygonBounds([{ x: 0, y: Number.POSITIVE_INFINITY }])).toBeNull();
  });

  test('computePolygonAnchor returns null for empty polygons', () => {
    expect(computePolygonAnchor([])).toBeNull();
  });

  test('computePolygonAnchor returns the bounding-box center for non-empty polygons', () => {
    const polygon = [
      { x: -2, y: 5 },
      { x: 8, y: 1 },
      { x: 3, y: 9 }
    ];

    expect(computePolygonAnchor(polygon)).toEqual({ x: 3, y: 5 });
  });

  test('normalizePolygonToAnchor uses bounding-box center as anchor', () => {
    const polygon = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 }
    ];

    const normalized = normalizePolygonToAnchor(polygon);
    if (normalized === null) {
      throw new Error('Expected normalized result');
    }

    expect(normalized.anchor).toEqual({ x: 5, y: 5 });
    expect(normalized.localPolygon).toEqual([
      { x: -5, y: -5 },
      { x: 5, y: -5 },
      { x: 5, y: 5 },
      { x: -5, y: 5 }
    ]);
  });

  test('transformStampPolygon applies scale then quarter-turn rotation then translation (rotationQuarterTurns=0)', () => {
    const localPolygon = [
      { x: 1, y: 2 },
      { x: -1, y: 2 },
      { x: -1, y: -2 }
    ];

    const transformed = transformStampPolygon({
      localPolygon,
      at: { x: 10, y: 20 },
      rotationQuarterTurns: 0,
      scale: { x: 2, y: 3 }
    });

    // Scale: (2,6), (-2,6), (-2,-6)
    // Rotate 0°: same
    // Translate by (10,20)
    expect(transformed).toEqual([
      { x: 12, y: 26 },
      { x: 8, y: 26 },
      { x: 8, y: 14 }
    ]);
  });

  test('transformStampPolygon applies quarter-turn rotation 90° clockwise (rotationQuarterTurns=1)', () => {
    const localPolygon = [
      { x: 1, y: 2 },
      { x: -1, y: 2 },
      { x: -1, y: -2 }
    ];

    const transformed = transformStampPolygon({
      localPolygon,
      at: { x: 10, y: 20 },
      rotationQuarterTurns: 1,
      scale: { x: 2, y: 3 }
    });

    // Scale: (2,6), (-2,6), (-2,-6)
    // Rotate 90° CW: (6,-2), (6,2), (-6,2)
    // Translate by (10,20)
    expect(transformed).toEqual([
      { x: 16, y: 18 },
      { x: 16, y: 22 },
      { x: 4, y: 22 }
    ]);
  });

  test('transformStampPolygon applies quarter-turn rotation 180° (rotationQuarterTurns=2)', () => {
    const localPolygon = [
      { x: 1, y: 2 },
      { x: -1, y: 2 },
      { x: -1, y: -2 }
    ];

    const transformed = transformStampPolygon({
      localPolygon,
      at: { x: 10, y: 20 },
      rotationQuarterTurns: 2,
      scale: { x: 2, y: 3 }
    });

    // Scale: (2,6), (-2,6), (-2,-6)
    // Rotate 180°: (-2,-6), (2,-6), (2,6)
    // Translate by (10,20)
    expect(transformed).toEqual([
      { x: 8, y: 14 },
      { x: 12, y: 14 },
      { x: 12, y: 26 }
    ]);
  });

  test('transformStampPolygon applies quarter-turn rotation 270° clockwise (rotationQuarterTurns=3)', () => {
    const localPolygon = [
      { x: 1, y: 2 },
      { x: -1, y: 2 },
      { x: -1, y: -2 }
    ];

    const transformed = transformStampPolygon({
      localPolygon,
      at: { x: 10, y: 20 },
      rotationQuarterTurns: 3,
      scale: { x: 2, y: 3 }
    });

    // Scale: (2,6), (-2,6), (-2,-6)
    // Rotate 270° CW: (-6,2), (-6,-2), (6,-2)
    // Translate by (10,20)
    expect(transformed).toEqual([
      { x: 4, y: 22 },
      { x: 4, y: 18 },
      { x: 16, y: 18 }
    ]);
  });
});
