import { useNomosStore } from './nomosStore';

describe('useNomosStore selection', () => {
  afterEach(() => {
    useNomosStore.setState({ mapSelection: null });
  });

  it("defaults mapSectorSurface to 'floor'", () => {
    expect(useNomosStore.getState().mapSectorSurface).toBe('floor');
  });

  it('defaults mapSelection to null', () => {
    expect(useNomosStore.getState().mapSelection).toBeNull();
  });

  it('setMapSelection updates selection', () => {
    useNomosStore.getState().setMapSelection({ kind: 'wall', index: 3 });
    expect(useNomosStore.getState().mapSelection).toEqual({ kind: 'wall', index: 3 });

    useNomosStore.getState().setMapSelection(null);
    expect(useNomosStore.getState().mapSelection).toBeNull();
  });

  it('applyMapSelectionEffect keep preserves selection', () => {
    useNomosStore.getState().setMapSelection({ kind: 'door', id: 'd1' });

    useNomosStore.getState().applyMapSelectionEffect({ kind: 'map-edit/selection/keep' });

    expect(useNomosStore.getState().mapSelection).toEqual({ kind: 'door', id: 'd1' });
  });

  it('applyMapSelectionEffect clear sets selection to null', () => {
    useNomosStore.getState().setMapSelection({ kind: 'light', index: 2 });

    useNomosStore.getState().applyMapSelectionEffect({ kind: 'map-edit/selection/clear', reason: 'deleted' });

    expect(useNomosStore.getState().mapSelection).toBeNull();
  });

  it('applyMapSelectionEffect set sets selection to the target ref', () => {
    useNomosStore.getState().setMapSelection(null);

    useNomosStore.getState().applyMapSelectionEffect({
      kind: 'map-edit/selection/set',
      ref: { kind: 'entity', index: 7 }
    });

    expect(useNomosStore.getState().mapSelection).toEqual({ kind: 'entity', index: 7 });
  });

  it('applyMapSelectionEffect remap updates selection when it matches from', () => {
    useNomosStore.getState().setMapSelection({ kind: 'particle', index: 1 });

    useNomosStore.getState().applyMapSelectionEffect({
      kind: 'map-edit/selection/remap',
      from: { kind: 'particle', index: 1 },
      to: { kind: 'particle', index: 2 }
    });

    expect(useNomosStore.getState().mapSelection).toEqual({ kind: 'particle', index: 2 });
  });

  it('applyMapSelectionEffect remap does not change selection when it does not match from', () => {
    useNomosStore.getState().setMapSelection({ kind: 'particle', index: 3 });

    useNomosStore.getState().applyMapSelectionEffect({
      kind: 'map-edit/selection/remap',
      from: { kind: 'particle', index: 1 },
      to: { kind: 'particle', index: 2 }
    });

    expect(useNomosStore.getState().mapSelection).toEqual({ kind: 'particle', index: 3 });
  });
});
