import { useNomosStore } from './nomosStore';

describe('useNomosStore selection', () => {
  afterEach(() => {
    useNomosStore.setState({ mapSelection: null });
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
});
