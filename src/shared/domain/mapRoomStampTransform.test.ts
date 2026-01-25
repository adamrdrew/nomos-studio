import { normalizePolygonToAnchor, transformStampPolygon } from './mapRoomStampTransform';

describe('mapRoomStampTransform', () => {
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

  test('transformStampPolygon applies scale then quarter-turn rotation then translation', () => {
    const localPolygon = [
      { x: -1, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 2 },
      { x: -1, y: 2 }
    ];

    const transformed = transformStampPolygon({
      localPolygon,
      at: { x: 10, y: 20 },
      rotationQuarterTurns: 1,
      scale: { x: 2, y: 3 }
    });

    // Scale: (-2,0), (2,0), (2,6), (-2,6)
    // Rotate 90° CW: (0,2), (0,-2), (6,-2), (6,2)
    // Translate by (10,20)
    expect(transformed).toEqual([
      { x: 10, y: 22 },
      { x: 10, y: 18 },
      { x: 16, y: 18 },
      { x: 16, y: 22 }
    ]);
  });
});
