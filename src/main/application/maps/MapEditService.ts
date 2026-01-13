import type { MapDocument } from '../../../shared/domain/models';
import type { MapEditError, Result } from '../../../shared/domain/results';
import type {
  MapEditCommand,
  MapEditHistoryInfo,
  MapEditResult,
  MapEditSelectionEffect,
  MapEditSelectionInput
} from '../../../shared/ipc/nomosIpc';
import type { AppStore } from '../store/AppStore';

import { MapCommandEngine } from './MapCommandEngine';
import type { MapEditHistoryPort, MapHistoryEntry, MapHistoryDocumentState, MapHistoryRestore } from './MapEditHistory';

function err(code: MapEditError['code'], message: string): Result<never, MapEditError> {
  return {
    ok: false,
    error: {
      kind: 'map-edit-error',
      code,
      message
    }
  };
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

  public edit(command: MapEditCommand): Result<MapEditResult, MapEditError> {
    const currentDocument = this.store.getState().mapDocument;
    if (currentDocument === null) {
      return err('map-edit/no-document', 'No map is currently open.');
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
      lastValidation: null
    };

    const afterState = toDocumentState(nextDocument);
    if (!afterState.ok) {
      return afterState;
    }

    const selectionInput: MapEditSelectionInput | undefined =
      normalizedCommand.kind === 'map-edit/transaction'
        ? normalizedCommand.selection
        : command.kind === 'map-edit/delete' || command.kind === 'map-edit/clone'
          ? { kind: 'map-edit/selection', ref: command.target }
          : undefined;

    const selectionBefore = selectionEffectForInput(selectionInput);

    const selectionAfter: MapEditSelectionEffect =
      command.kind === 'map-edit/delete'
        ? { kind: 'map-edit/selection/clear', reason: 'deleted' }
        : applyResult.value.selection;

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

    if (command.kind === 'map-edit/transaction') {
      return {
        ok: true,
        value: {
          kind: 'map-edit/applied',
          selection: selectionAfter,
          history: historyInfo
        }
      };
    }

    if (command.kind === 'map-edit/clone') {
      if (selectionAfter.kind === 'map-edit/selection/set') {
        return { ok: true, value: { kind: 'map-edit/cloned', newRef: selectionAfter.ref } };
      }
      return err('map-edit/invalid-json', 'Clone did not produce a new reference.');
    }

    if (command.kind === 'map-edit/delete') {
      return { ok: true, value: { kind: 'map-edit/deleted' } };
    }

    const unknownKind = (command as unknown as { kind?: unknown }).kind;
    return err('map-edit/unsupported-target', `Unsupported map edit command kind: ${String(unknownKind)}`);
  }

  public undo(request: Readonly<{ steps?: number }> = {}): Result<MapEditResult, MapEditError> {
    const currentDocument = this.store.getState().mapDocument;
    if (currentDocument === null) {
      return err('map-edit/no-document', 'No map is currently open.');
    }

    const requestedSteps = request.steps;
    const steps =
      requestedSteps === undefined || !Number.isFinite(requestedSteps) || requestedSteps < 1
        ? 1
        : Math.floor(requestedSteps);

    let restore: MapHistoryRestore | undefined;
    for (let stepIndex = 0; stepIndex < steps; stepIndex++) {
      const undoResult = this.history.undo();
      if (!undoResult.ok) {
        return undoResult;
      }
      restore = undoResult.value;
    }

    if (restore === undefined) {
      return err('map-edit/not-found', 'Nothing to undo.');
    }

    const nextDocument: MapDocument = {
      filePath: currentDocument.filePath,
      json: restore.documentState.json,
      dirty: restore.documentState.dirty,
      lastValidation: restore.documentState.lastValidation
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

  public redo(request: Readonly<{ steps?: number }> = {}): Result<MapEditResult, MapEditError> {
    const currentDocument = this.store.getState().mapDocument;
    if (currentDocument === null) {
      return err('map-edit/no-document', 'No map is currently open.');
    }

    const requestedSteps = request.steps;
    const steps =
      requestedSteps === undefined || !Number.isFinite(requestedSteps) || requestedSteps < 1
        ? 1
        : Math.floor(requestedSteps);

    let restore: MapHistoryRestore | undefined;
    for (let stepIndex = 0; stepIndex < steps; stepIndex++) {
      const redoResult = this.history.redo();
      if (!redoResult.ok) {
        return redoResult;
      }
      restore = redoResult.value;
    }

    if (restore === undefined) {
      return err('map-edit/not-found', 'Nothing to redo.');
    }

    const nextDocument: MapDocument = {
      filePath: currentDocument.filePath,
      json: restore.documentState.json,
      dirty: restore.documentState.dirty,
      lastValidation: restore.documentState.lastValidation
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
