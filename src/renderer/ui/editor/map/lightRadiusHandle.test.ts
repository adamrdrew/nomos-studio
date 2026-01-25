import {
  computeLightRadiusFromWorldPoint,
  computeLightRadiusHandleWorldPoint,
  isWorldPointOnLightRadiusHandle
} from './lightRadiusHandle';

describe('lightRadiusHandle', () => {
  describe('computeLightRadiusHandleWorldPoint', () => {
    it('places the handle at (x + radius, y) for a finite radius', () => {
      expect(computeLightRadiusHandleWorldPoint({ center: { x: 10, y: 20 }, radius: 5 })).toEqual({ x: 15, y: 20 });
    });

    it('clamps negative radius to 0', () => {
      expect(computeLightRadiusHandleWorldPoint({ center: { x: 10, y: 20 }, radius: -5 })).toEqual({ x: 10, y: 20 });
    });

    it('treats non-finite radius as 0', () => {
      expect(computeLightRadiusHandleWorldPoint({ center: { x: 10, y: 20 }, radius: Number.NaN })).toEqual({ x: 10, y: 20 });
    });
  });

  describe('isWorldPointOnLightRadiusHandle', () => {
    it('returns true when worldPoint is within hit radius of the handle', () => {
      expect(
        isWorldPointOnLightRadiusHandle({
          center: { x: 0, y: 0 },
          radius: 10,
          worldPoint: { x: 10, y: 0 },
          viewScale: 1,
          hitRadiusPx: 2
        })
      ).toBe(true);

      expect(
        isWorldPointOnLightRadiusHandle({
          center: { x: 0, y: 0 },
          radius: 10,
          worldPoint: { x: 11.9, y: 0 },
          viewScale: 1,
          hitRadiusPx: 2
        })
      ).toBe(true);
    });

    it('returns false when worldPoint is outside hit radius of the handle', () => {
      expect(
        isWorldPointOnLightRadiusHandle({
          center: { x: 0, y: 0 },
          radius: 10,
          worldPoint: { x: 12.1, y: 0 },
          viewScale: 1,
          hitRadiusPx: 2
        })
      ).toBe(false);
    });

    it('uses viewScale to convert hitRadiusPx to world units', () => {
      // When zoomed in (scale=2), the same pixel hit radius is smaller in world units.
      expect(
        isWorldPointOnLightRadiusHandle({
          center: { x: 0, y: 0 },
          radius: 10,
          worldPoint: { x: 11.1, y: 0 },
          viewScale: 2,
          hitRadiusPx: 2
        })
      ).toBe(false);

      expect(
        isWorldPointOnLightRadiusHandle({
          center: { x: 0, y: 0 },
          radius: 10,
          worldPoint: { x: 10.9, y: 0 },
          viewScale: 2,
          hitRadiusPx: 2
        })
      ).toBe(true);
    });

    it('treats negative hitRadiusPx as 0', () => {
      expect(
        isWorldPointOnLightRadiusHandle({
          center: { x: 0, y: 0 },
          radius: 10,
          worldPoint: { x: 10, y: 0 },
          viewScale: 1,
          hitRadiusPx: -1
        })
      ).toBe(true);

      expect(
        isWorldPointOnLightRadiusHandle({
          center: { x: 0, y: 0 },
          radius: 10,
          worldPoint: { x: 10.0001, y: 0 },
          viewScale: 1,
          hitRadiusPx: -1
        })
      ).toBe(false);
    });

    it('guards non-finite viewScale', () => {
      expect(
        isWorldPointOnLightRadiusHandle({
          center: { x: 0, y: 0 },
          radius: 10,
          worldPoint: { x: 10, y: 0 },
          viewScale: Number.NaN,
          hitRadiusPx: 10
        })
      ).toBe(true);
    });
  });

  describe('computeLightRadiusFromWorldPoint', () => {
    it('returns the euclidean distance from center to worldPoint', () => {
      expect(computeLightRadiusFromWorldPoint({ center: { x: 0, y: 0 }, worldPoint: { x: 3, y: 4 } })).toBe(5);
    });

    it('clamps to >= 0', () => {
      expect(computeLightRadiusFromWorldPoint({ center: { x: 1, y: 1 }, worldPoint: { x: 1, y: 1 } })).toBe(0);
    });

    it('returns 0 for non-finite intermediate values', () => {
      expect(computeLightRadiusFromWorldPoint({ center: { x: Number.NaN, y: 0 }, worldPoint: { x: 0, y: 0 } })).toBe(0);
    });
  });
});
