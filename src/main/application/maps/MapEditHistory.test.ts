import { MapEditHistory } from './MapEditHistory';

import type { MapDocument } from '../../../shared/domain/models';

function baseDocument(): MapDocument {
  return {
    filePath: '/maps/test.json',
    json: { a: 1 },
    dirty: false,
    lastValidation: null,
    revision: 1
  };
}

describe('MapEditHistory', () => {
  it('starts empty', () => {
    const history = new MapEditHistory();

    expect(history.getInfo()).toEqual({ canUndo: false, canRedo: false, undoDepth: 0, redoDepth: 0 });
  });

  it('disables history when maxDepth is 0 (recordEdit clears both stacks)', () => {
    const history = new MapEditHistory(0);

    history.recordEdit({
      label: 'x',
      before: { json: { a: 1 }, dirty: false, lastValidation: null },
      after: { json: { a: 2 }, dirty: true, lastValidation: null },
      selectionBefore: { kind: 'map-edit/selection/keep' },
      selectionAfter: { kind: 'map-edit/selection/keep' }
    });

    expect(history.getInfo()).toEqual({ canUndo: false, canRedo: false, undoDepth: 0, redoDepth: 0 });

    const undo = history.undo();
    expect(undo.ok).toBe(false);

    const redo = history.redo();
    expect(redo.ok).toBe(false);
  });

  it('recordEdit pushes undo and clears redo', () => {
    const history = new MapEditHistory(10);

    history.recordEdit({
      label: 'x',
      before: { json: { a: 1 }, dirty: false, lastValidation: null },
      after: { json: { a: 2 }, dirty: true, lastValidation: null },
      selectionBefore: { kind: 'map-edit/selection/clear', reason: 'invalidated' },
      selectionAfter: { kind: 'map-edit/selection/keep' }
    });

    expect(history.getInfo()).toEqual({ canUndo: true, canRedo: false, undoDepth: 1, redoDepth: 0 });

    const undoResult = history.undo();
    expect(undoResult.ok).toBe(true);
    expect(history.getInfo()).toEqual({ canUndo: false, canRedo: true, undoDepth: 0, redoDepth: 1 });

    history.recordEdit({
      label: 'y',
      before: { json: { a: 1 }, dirty: false, lastValidation: null },
      after: { json: { a: 3 }, dirty: true, lastValidation: null },
      selectionBefore: { kind: 'map-edit/selection/keep' },
      selectionAfter: { kind: 'map-edit/selection/keep' }
    });

    expect(history.getInfo()).toEqual({ canUndo: true, canRedo: false, undoDepth: 1, redoDepth: 0 });
  });

  it('undo and redo restore the stored document states', () => {
    const history = new MapEditHistory(10);

    history.recordEdit({
      before: { json: { a: 1 }, dirty: false, lastValidation: null },
      after: { json: { a: 2 }, dirty: true, lastValidation: null },
      selectionBefore: { kind: 'map-edit/selection/clear', reason: 'invalidated' },
      selectionAfter: { kind: 'map-edit/selection/keep' }
    });

    const undoResult = history.undo();
    expect(undoResult.ok).toBe(true);
    if (!undoResult.ok) {
      throw new Error('Expected success');
    }
    expect(undoResult.value.documentState).toEqual({ json: { a: 1 }, dirty: false, lastValidation: null });

    const redoResult = history.redo();
    expect(redoResult.ok).toBe(true);
    if (!redoResult.ok) {
      throw new Error('Expected success');
    }
    expect(redoResult.value.documentState).toEqual({ json: { a: 2 }, dirty: true, lastValidation: null });
  });

  it('bounds history depth', () => {
    const history = new MapEditHistory(2);

    history.recordEdit({
      before: { json: { a: 1 }, dirty: false, lastValidation: null },
      after: { json: { a: 2 }, dirty: true, lastValidation: null },
      selectionBefore: { kind: 'map-edit/selection/keep' },
      selectionAfter: { kind: 'map-edit/selection/keep' }
    });
    history.recordEdit({
      before: { json: { a: 2 }, dirty: true, lastValidation: null },
      after: { json: { a: 3 }, dirty: true, lastValidation: null },
      selectionBefore: { kind: 'map-edit/selection/keep' },
      selectionAfter: { kind: 'map-edit/selection/keep' }
    });
    history.recordEdit({
      before: { json: { a: 3 }, dirty: true, lastValidation: null },
      after: { json: { a: 4 }, dirty: true, lastValidation: null },
      selectionBefore: { kind: 'map-edit/selection/keep' },
      selectionAfter: { kind: 'map-edit/selection/keep' }
    });

    expect(history.getInfo()).toEqual({ canUndo: true, canRedo: false, undoDepth: 2, redoDepth: 0 });

    const firstUndo = history.undo();
    expect(firstUndo.ok).toBe(true);
    if (!firstUndo.ok) {
      throw new Error('Expected success');
    }
    expect(firstUndo.value.documentState.json).toEqual({ a: 3 });

    const secondUndo = history.undo();
    expect(secondUndo.ok).toBe(true);
    if (!secondUndo.ok) {
      throw new Error('Expected success');
    }
    expect(secondUndo.value.documentState.json).toEqual({ a: 2 });

    const thirdUndo = history.undo();
    expect(thirdUndo.ok).toBe(false);
  });

  it('onMapOpened clears undo/redo stacks', () => {
    const history = new MapEditHistory(10);

    history.recordEdit({
      before: { json: { a: 1 }, dirty: false, lastValidation: null },
      after: { json: { a: 2 }, dirty: true, lastValidation: null },
      selectionBefore: { kind: 'map-edit/selection/keep' },
      selectionAfter: { kind: 'map-edit/selection/keep' }
    });

    expect(history.getInfo().canUndo).toBe(true);

    history.onMapOpened(baseDocument());

    expect(history.getInfo()).toEqual({ canUndo: false, canRedo: false, undoDepth: 0, redoDepth: 0 });

    const undo = history.undo();
    expect(undo.ok).toBe(false);

    const redo = history.redo();
    expect(redo.ok).toBe(false);
  });
});
