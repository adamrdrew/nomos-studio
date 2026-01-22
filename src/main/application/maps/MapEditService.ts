import type { MapDocument, MapDocumentRevision } from '../../../shared/domain/models';
import type { MapEditError, Result } from '../../../shared/domain/results';
import type {
  MapEditCommand,
  MapEditHistoryInfo,
  MapEditRequest,
  MapEditResult,
  MapEditSelectionEffect,
  MapEditSelectionInput,
  MapRedoRequest,
  MapEditTargetRef,
  MapUndoRequest
} from '../../../shared/ipc/nomosIpc';
import type { AppStore } from '../store/AppStore';

import { MapCommandEngine } from './MapCommandEngine';
import type { MapEditHistoryPort, MapHistoryEntry, MapHistoryDocumentState, MapHistoryRestore } from './MapEditHistory';

type NonStaleMapEditErrorCode = Exclude<MapEditError['code'], 'map-edit/stale-revision'>;

function err(code: NonStaleMapEditErrorCode, message: string): Result<never, MapEditError> {
  return {
    ok: false,
    error: {
      kind: 'map-edit-error',
      code,
      message
    }
  };
}

function stale(baseRevision: MapDocumentRevision, currentRevision: MapDocumentRevision): Result<never, MapEditError> {
  return {
    ok: false,
    error: {
      kind: 'map-edit-error',
      code: 'map-edit/stale-revision',
      message: `Stale map revision (base=${baseRevision}, current=${currentRevision}).`,
      currentRevision
    }
  };
}

function bumpedRevision(currentRevision: MapDocumentRevision): MapDocumentRevision {
  return currentRevision + 1;
}

function selectionEffectForInput(selection: MapEditSelectionInput | undefined): MapEditSelectionEffect {
  if (selection === undefined) {
    return { kind: 'map-edit/selection/keep' };
  }
  if (selection.ref === null) {
    return { kind: 'map-edit/selection/clear', reason: 'invalidated' };
  }
  return { kind: 'map-edit/selection/set', ref: selection.ref };
}

function cloneJsonOrError(json: unknown): Result<unknown, MapEditError> {
  try {
    return { ok: true, value: structuredClone(json) };
  } catch (_error: unknown) {
    return err('map-edit/invalid-json', 'Map JSON must be cloneable.');
  }
}

function toDocumentState(document: MapDocument): Result<MapHistoryDocumentState, MapEditError> {
  const cloned = cloneJsonOrError(document.json);
  if (!cloned.ok) {
    return cloned;
  }
  return {
    ok: true,
    value: {
      json: cloned.value,
      dirty: document.dirty,
      lastValidation: document.lastValidation
    }
  };
}

function toHistoryInfo(historyInfo: MapEditHistoryInfo): MapEditHistoryInfo {
  return historyInfo;
}

export class MapEditService {
  private readonly store: AppStore;
  private readonly engine: MapCommandEngine;
  private readonly history: MapEditHistoryPort;

  public constructor(store: AppStore, engine: MapCommandEngine, history: MapEditHistoryPort) {
    this.store = store;
    this.engine = engine;
    this.history = history;
  }

  public edit(request: MapEditRequest): Result<MapEditResult, MapEditError>;
  public edit(command: MapEditCommand): Result<MapEditResult, MapEditError>;
  public edit(requestOrCommand: MapEditRequest | MapEditCommand): Result<MapEditResult, MapEditError> {
    const currentDocument = this.store.getState().mapDocument;
    if (currentDocument === null) {
      return err('map-edit/no-document', 'No map is currently open.');
    }

    const request: MapEditRequest =
      typeof (requestOrCommand as MapEditRequest).command === 'object'
        ? (requestOrCommand as MapEditRequest)
        : { baseRevision: currentDocument.revision, command: requestOrCommand as MapEditCommand };

    if (request.baseRevision !== currentDocument.revision) {
      return stale(request.baseRevision, currentDocument.revision);
    }

    const command = request.command;

    if (
      command.kind !== 'map-edit/transaction' &&
      command.kind !== 'map-edit/delete' &&
      command.kind !== 'map-edit/clone' &&
      command.kind !== 'map-edit/update-fields' &&
      command.kind !== 'map-edit/move-entity' &&
      command.kind !== 'map-edit/move-light'
    ) {
      const unknownKind = (command as unknown as { kind?: unknown }).kind;
      return err('map-edit/unsupported-target', `Unsupported map edit command kind: ${String(unknownKind)}`);
    }

    const normalizedCommand: MapEditCommand = command;

    const beforeState = toDocumentState(currentDocument);
    if (!beforeState.ok) {
      return beforeState;
    }

    const applyResult = this.engine.apply(currentDocument, normalizedCommand);
    if (!applyResult.ok) {
      return applyResult;
    }

    const nextDocument: MapDocument = {
      ...currentDocument,
      json: applyResult.value.nextJson,
      dirty: true,
      lastValidation: null,
      revision: bumpedRevision(currentDocument.revision)
    };

    const afterState = toDocumentState(nextDocument);
    if (!afterState.ok) {
      return afterState;
    }

    let selectionInput: MapEditSelectionInput | undefined;
    switch (normalizedCommand.kind) {
      case 'map-edit/transaction':
        selectionInput = normalizedCommand.selection;
        break;
      case 'map-edit/delete':
      case 'map-edit/clone':
        selectionInput = { kind: 'map-edit/selection', ref: normalizedCommand.target };
        break;
      case 'map-edit/update-fields':
      case 'map-edit/move-entity':
      case 'map-edit/move-light':
        selectionInput = undefined;
        break;
    }

    const selectionBefore = selectionEffectForInput(selectionInput);

    const selectionAfter: MapEditSelectionEffect =
      command.kind === 'map-edit/delete'
        ? { kind: 'map-edit/selection/clear', reason: 'deleted' }
        : applyResult.value.selection;

    const cloneNewRef: MapEditTargetRef | undefined =
      command.kind === 'map-edit/clone' && selectionAfter.kind === 'map-edit/selection/set'
        ? selectionAfter.ref
        : undefined;

    if (command.kind === 'map-edit/clone' && cloneNewRef === undefined) {
      return err('map-edit/invalid-json', 'Clone did not produce a new reference.');
    }

    const entryBase = {
      before: beforeState.value,
      after: afterState.value,
      selectionBefore,
      selectionAfter
    } as const;

    const label = normalizedCommand.kind === 'map-edit/transaction' ? normalizedCommand.label : undefined;
    const entry: MapHistoryEntry = label === undefined ? entryBase : { ...entryBase, label };

    this.history.recordEdit(entry);
    this.store.setMapDocument(nextDocument);

    const historyInfo = toHistoryInfo(this.history.getInfo());

    switch (command.kind) {
      case 'map-edit/transaction':
        return {
          ok: true,
          value: {
            kind: 'map-edit/applied',
            selection: selectionAfter,
            history: historyInfo
          }
        };
      case 'map-edit/clone':
        return { ok: true, value: { kind: 'map-edit/cloned', newRef: cloneNewRef! } };
      case 'map-edit/delete':
        return { ok: true, value: { kind: 'map-edit/deleted' } };
      case 'map-edit/update-fields':
      case 'map-edit/move-entity':
      case 'map-edit/move-light':
        return {
          ok: true,
          value: {
            kind: 'map-edit/applied',
            selection: selectionAfter,
            history: historyInfo
          }
        };
    }
  }

  public undo(request: MapUndoRequest): Result<MapEditResult, MapEditError>;
  public undo(request?: Readonly<{ steps?: number }>): Result<MapEditResult, MapEditError>;
  public undo(request: MapUndoRequest | Readonly<{ steps?: number }> = {}): Result<MapEditResult, MapEditError> {
    const currentDocument = this.store.getState().mapDocument;
    if (currentDocument === null) {
      return err('map-edit/no-document', 'No map is currently open.');
    }

    const baseRevision =
      'baseRevision' in request ? (request as MapUndoRequest).baseRevision : currentDocument.revision;
    if (baseRevision !== currentDocument.revision) {
      return stale(baseRevision, currentDocument.revision);
    }

    const requestedSteps = request.steps;
    const steps =
      requestedSteps === undefined || !Number.isFinite(requestedSteps) || requestedSteps < 1
        ? 1
        : Math.floor(requestedSteps);

    const firstUndo = this.history.undo();
    if (!firstUndo.ok) {
      return firstUndo;
    }

    let restore: MapHistoryRestore = firstUndo.value;
    for (let stepIndex = 1; stepIndex < steps; stepIndex++) {
      const undoResult = this.history.undo();
      if (!undoResult.ok) {
        return undoResult;
      }
      restore = undoResult.value;
    }

    const nextDocument: MapDocument = {
      filePath: currentDocument.filePath,
      json: restore.documentState.json,
      dirty: restore.documentState.dirty,
      lastValidation: restore.documentState.lastValidation,
      revision: bumpedRevision(currentDocument.revision)
    };

    this.store.setMapDocument(nextDocument);

    return {
      ok: true,
      value: {
        kind: 'map-edit/applied',
        selection: restore.selection,
        history: toHistoryInfo(this.history.getInfo())
      }
    };
  }

  public redo(request: MapRedoRequest): Result<MapEditResult, MapEditError>;
  public redo(request?: Readonly<{ steps?: number }>): Result<MapEditResult, MapEditError>;
  public redo(request: MapRedoRequest | Readonly<{ steps?: number }> = {}): Result<MapEditResult, MapEditError> {
    const currentDocument = this.store.getState().mapDocument;
    if (currentDocument === null) {
      return err('map-edit/no-document', 'No map is currently open.');
    }

    const baseRevision =
      'baseRevision' in request ? (request as MapRedoRequest).baseRevision : currentDocument.revision;
    if (baseRevision !== currentDocument.revision) {
      return stale(baseRevision, currentDocument.revision);
    }

    const requestedSteps = request.steps;
    const steps =
      requestedSteps === undefined || !Number.isFinite(requestedSteps) || requestedSteps < 1
        ? 1
        : Math.floor(requestedSteps);

    const firstRedo = this.history.redo();
    if (!firstRedo.ok) {
      return firstRedo;
    }

    let restore: MapHistoryRestore = firstRedo.value;
    for (let stepIndex = 1; stepIndex < steps; stepIndex++) {
      const redoResult = this.history.redo();
      if (!redoResult.ok) {
        return redoResult;
      }
      restore = redoResult.value;
    }

    const nextDocument: MapDocument = {
      filePath: currentDocument.filePath,
      json: restore.documentState.json,
      dirty: restore.documentState.dirty,
      lastValidation: restore.documentState.lastValidation,
      revision: bumpedRevision(currentDocument.revision)
    };

    this.store.setMapDocument(nextDocument);

    return {
      ok: true,
      value: {
        kind: 'map-edit/applied',
        selection: restore.selection,
        history: toHistoryInfo(this.history.getInfo())
      }
    };
  }
}
