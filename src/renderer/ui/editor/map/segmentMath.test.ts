import { closestPointOnSegment, isPointNearSegmentEndpoints } from './segmentMath';

describe('segmentMath', () => {
  describe('closestPointOnSegment', () => {
    it('projects to interior for a point above the segment', () => {
      const result = closestPointOnSegment({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 10, y: 0 });
      expect(result).toEqual({ x: 3, y: 0 });
    });

    it('clamps to v0 when the projection is before the segment', () => {
      const result = closestPointOnSegment({ x: -5, y: 2 }, { x: 0, y: 0 }, { x: 10, y: 0 });
      expect(result).toEqual({ x: 0, y: 0 });
    });

    it('clamps to v1 when the projection is after the segment', () => {
      const result = closestPointOnSegment({ x: 20, y: -1 }, { x: 0, y: 0 }, { x: 10, y: 0 });
      expect(result).toEqual({ x: 10, y: 0 });
    });

    it('returns v0 for a zero-length segment', () => {
      const result = closestPointOnSegment({ x: 9, y: 9 }, { x: 1, y: 2 }, { x: 1, y: 2 });
      expect(result).toEqual({ x: 1, y: 2 });
    });
  });

  describe('isPointNearSegmentEndpoints', () => {
    it('returns true when the point is near v0', () => {
      expect(isPointNearSegmentEndpoints({ x: 0.2, y: 0.1 }, { x: 0, y: 0 }, { x: 10, y: 0 }, 0.5)).toBe(true);
    });

    it('returns true when the point is near v1', () => {
      expect(isPointNearSegmentEndpoints({ x: 9.9, y: 0.1 }, { x: 0, y: 0 }, { x: 10, y: 0 }, 0.5)).toBe(true);
    });

    it('returns false when the point is not near either endpoint', () => {
      expect(isPointNearSegmentEndpoints({ x: 5, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }, 0.5)).toBe(false);
    });
  });
});
