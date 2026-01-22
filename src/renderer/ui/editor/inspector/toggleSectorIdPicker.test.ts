import { cancelToggleSectorIdPicker, reduceToggleSectorIdPicker } from './toggleSectorIdPicker';

describe('toggleSectorIdPicker', () => {
  it('reduce: no picker is a no-op', () => {
    const reduced = reduceToggleSectorIdPicker(null, { kind: 'sector', id: 5 });
    expect(reduced).toEqual({ nextPicker: null, pickedSectorId: null, restoreSelection: null });
  });

  it('reduce: sector selection consumes pick and restores wall selection', () => {
    const reduced = reduceToggleSectorIdPicker(
      { wallIndex: 7, wallTarget: { kind: 'wall', index: 7 } },
      { kind: 'sector', id: 123 }
    );

    expect(reduced.nextPicker).toBeNull();
    expect(reduced.pickedSectorId).toBe(123);
    expect(reduced.restoreSelection).toEqual({ kind: 'wall', index: 7 });
  });

  it('cancel: restores wall selection and clears picker', () => {
    const cancelled = cancelToggleSectorIdPicker({ wallIndex: 4, wallTarget: { kind: 'wall', index: 4 } });
    expect(cancelled.nextPicker).toBeNull();
    expect(cancelled.restoreSelection).toEqual({ kind: 'wall', index: 4 });
  });
});
