import { shouldSnapToGrid, snapWorldPointToDisplayedGrid, snapWorldPointToGrid } from './gridSnapping';

describe('gridSnapping', () => {
  describe('shouldSnapToGrid', () => {
    it('returns false when snap is disabled', () => {
      expect(shouldSnapToGrid({ isSnapToGridEnabled: false, isShiftKeyPressed: false })).toBe(false);
      expect(shouldSnapToGrid({ isSnapToGridEnabled: false, isShiftKeyPressed: true })).toBe(false);
    });

    it('returns false when Shift is held, even if snap is enabled', () => {
      expect(shouldSnapToGrid({ isSnapToGridEnabled: true, isShiftKeyPressed: true })).toBe(false);
    });

    it('returns true when snap is enabled and Shift is not held', () => {
      expect(shouldSnapToGrid({ isSnapToGridEnabled: true, isShiftKeyPressed: false })).toBe(true);
    });
  });

  describe('snapWorldPointToGrid', () => {
    it('returns the input point when spacing is invalid', () => {
      expect(snapWorldPointToGrid({ x: 1.25, y: -3.5 }, 0)).toEqual({ x: 1.25, y: -3.5 });
      expect(snapWorldPointToGrid({ x: 1.25, y: -3.5 }, Number.NaN)).toEqual({ x: 1.25, y: -3.5 });
      expect(snapWorldPointToGrid({ x: 1.25, y: -3.5 }, -1)).toEqual({ x: 1.25, y: -3.5 });
    });

    it('snaps to the nearest grid intersection', () => {
      expect(snapWorldPointToGrid({ x: 3, y: 12.1 }, 8)).toEqual({ x: 0, y: 16 });
      expect(snapWorldPointToGrid({ x: 4.1, y: 4.1 }, 8)).toEqual({ x: 8, y: 8 });
    });

    it('snaps negative coordinates symmetrically', () => {
      expect(snapWorldPointToGrid({ x: -3.9, y: -12.1 }, 8)).toEqual({ x: 0, y: -16 });
      expect(snapWorldPointToGrid({ x: -4.1, y: -4.1 }, 8)).toEqual({ x: -8, y: -8 });
    });
  });

  describe('snapWorldPointToDisplayedGrid', () => {
    it('uses the displayed minor grid spacing derived from viewScale', () => {
      // viewScale=2 => spacing 8 (target ~24px)
      expect(snapWorldPointToDisplayedGrid({ x: 9, y: 9 }, 2)).toEqual({ x: 8, y: 8 });
    });
  });
});
