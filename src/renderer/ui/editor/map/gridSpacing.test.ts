import { chooseMinorGridWorldSpacing, MINOR_GRID_WORLD_SPACING_CANDIDATES } from './gridSpacing';

describe('gridSpacing', () => {
  describe('chooseMinorGridWorldSpacing', () => {
    it('returns a value from the discrete candidate set', () => {
      const spacing = chooseMinorGridWorldSpacing(1);
      expect(MINOR_GRID_WORLD_SPACING_CANDIDATES.includes(spacing as (typeof MINOR_GRID_WORLD_SPACING_CANDIDATES)[number])).toBe(
        true
      );
    });

    it('prefers the closest world spacing to ~24px minor grid spacing', () => {
      expect(chooseMinorGridWorldSpacing(2)).toBe(8);
      expect(chooseMinorGridWorldSpacing(1)).toBe(16);
      expect(chooseMinorGridWorldSpacing(0.5)).toBe(32);
      expect(chooseMinorGridWorldSpacing(0.25)).toBe(64);
    });

    it('handles extremely small or invalid scales by choosing the largest spacing', () => {
      expect(chooseMinorGridWorldSpacing(0)).toBe(256);
      expect(chooseMinorGridWorldSpacing(-10)).toBe(256);
    });
  });
});
