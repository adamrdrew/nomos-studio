import type { MapDocument, MapValidationRecord } from '../../../shared/domain/models';
import type { MapEditError, Result } from '../../../shared/domain/results';
import type { MapEditHistoryInfo, MapEditSelectionEffect } from '../../../shared/ipc/nomosIpc';

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

export type MapHistoryDocumentState = Readonly<{
  json: unknown;
  dirty: boolean;
  lastValidation: MapValidationRecord | null;
}>;

export type MapHistoryEntry = Readonly<{
  label?: string;
  before: MapHistoryDocumentState;
  after: MapHistoryDocumentState;
  selectionBefore: MapEditSelectionEffect;
  selectionAfter: MapEditSelectionEffect;
}>;

export type MapHistoryRestore = Readonly<{
  documentState: MapHistoryDocumentState;
  selection: MapEditSelectionEffect;
}>;

export type MapEditHistoryPort = Readonly<{
  clear: () => void;
  onMapOpened: (document: MapDocument) => void;
  recordEdit: (entry: MapHistoryEntry) => void;
  getInfo: () => MapEditHistoryInfo;
  undo: () => Result<MapHistoryRestore, MapEditError>;
  redo: () => Result<MapHistoryRestore, MapEditError>;
}>;

export class MapEditHistory implements MapEditHistoryPort {
  private readonly maxDepth: number;
  private undoStack: MapHistoryEntry[] = [];
  private redoStack: MapHistoryEntry[] = [];

  public constructor(maxDepth = 100) {
    this.maxDepth = Math.max(0, maxDepth);
  }

  public clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public onMapOpened(_document: MapDocument): void {
    this.clear();
  }

  public recordEdit(entry: MapHistoryEntry): void {
    if (this.maxDepth === 0) {
      this.redoStack = [];
      this.undoStack = [];
      return;
    }

    this.undoStack = this.undoStack.concat([entry]);
    this.redoStack = [];

    if (this.undoStack.length > this.maxDepth) {
      this.undoStack = this.undoStack.slice(this.undoStack.length - this.maxDepth);
    }
  }

  public getInfo(): MapEditHistoryInfo {
    return {
      canUndo: this.undoStack.length > 0,
      canRedo: this.redoStack.length > 0,
      undoDepth: this.undoStack.length,
      redoDepth: this.redoStack.length
    };
  }

  public undo(): Result<MapHistoryRestore, MapEditError> {
    const entry = this.undoStack[this.undoStack.length - 1];
    if (entry === undefined) {
      return err('map-edit/not-found', 'Nothing to undo.');
    }

    this.undoStack = this.undoStack.slice(0, this.undoStack.length - 1);
    this.redoStack = this.redoStack.concat([entry]);

    return {
      ok: true,
      value: {
        documentState: entry.before,
        selection: entry.selectionBefore
      }
    };
  }

  public redo(): Result<MapHistoryRestore, MapEditError> {
    const entry = this.redoStack[this.redoStack.length - 1];
    if (entry === undefined) {
      return err('map-edit/not-found', 'Nothing to redo.');
    }

    this.redoStack = this.redoStack.slice(0, this.redoStack.length - 1);
    this.undoStack = this.undoStack.concat([entry]);

    return {
      ok: true,
      value: {
        documentState: entry.after,
        selection: entry.selectionAfter
      }
    };
  }
}
