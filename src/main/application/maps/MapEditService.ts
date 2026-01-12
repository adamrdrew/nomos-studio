import type { MapDocument } from '../../../shared/domain/models';
import type { MapEditError, Result } from '../../../shared/domain/results';
import type { MapEditCommand, MapEditResult, MapEditTargetRef } from '../../../shared/ipc/nomosIpc';
import type { AppStore } from '../store/AppStore';

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function asArray(value: unknown, context: string): Result<unknown[], MapEditError> {
  if (!Array.isArray(value)) {
    return err('map-edit/invalid-json', `${context} must be an array`);
  }
  return { ok: true, value };
}

function asRecord(value: unknown, context: string): Result<Record<string, unknown>, MapEditError> {
  if (!isRecord(value)) {
    return err('map-edit/invalid-json', `${context} must be an object`);
  }
  return { ok: true, value };
}

function asXyRecord(value: unknown, context: string): Result<Record<string, unknown>, MapEditError> {
  const record = asRecord(value, context);
  if (!record.ok) {
    return record;
  }

  const x = record.value['x'];
  const y = record.value['y'];

  if (!isFiniteNumber(x) || !isFiniteNumber(y)) {
    return err('map-edit/invalid-json', `${context} must have finite number x/y`);
  }

  return record;
}

function ensureUniqueDoorId(existingIds: ReadonlySet<string>, baseId: string): string {
  const baseCandidate = `${baseId}-copy`;
  if (!existingIds.has(baseCandidate)) {
    return baseCandidate;
  }

  let suffix = 2;
  // Deterministic, collision-safe: baseId-copy-2, baseId-copy-3, ...
  while (existingIds.has(`${baseId}-copy-${suffix}`)) {
    suffix += 1;
  }

  return `${baseId}-copy-${suffix}`;
}

export class MapEditService {
  private readonly store: AppStore;

  public constructor(store: AppStore) {
    this.store = store;
  }

  public edit(command: MapEditCommand): Result<MapEditResult, MapEditError> {
    const currentDocument = this.store.getState().mapDocument;
    if (currentDocument === null) {
      return err('map-edit/no-document', 'No map is currently open.');
    }

    if (!isRecord(currentDocument.json)) {
      return err('map-edit/invalid-json', 'Map JSON must be an object.');
    }

    const json = currentDocument.json;

    const result = this.applyEditToJson(json, command);
    if (!result.ok) {
      return result;
    }

    const nextDocument: MapDocument = {
      ...currentDocument,
      json: result.value.nextJson,
      dirty: true
    };

    this.store.setMapDocument(nextDocument);

    return { ok: true, value: result.value.result };
  }

  private applyEditToJson(
    json: Record<string, unknown>,
    command: MapEditCommand
  ): Result<Readonly<{ nextJson: Record<string, unknown>; result: MapEditResult }>, MapEditError> {
    const CLONE_OFFSET = { x: 16, y: 16 } as const;

    switch (command.kind) {
      case 'map-edit/delete':
        return this.deleteFromJson(json, command.target);
      case 'map-edit/clone':
        return this.cloneInJson(json, command.target, CLONE_OFFSET);
      default: {
        const unknownKind = (command as unknown as { kind?: unknown }).kind;
        return err('map-edit/unsupported-target', `Unsupported map edit command kind: ${String(unknownKind)}`);
      }
    }
  }

  private deleteFromJson(
    json: Record<string, unknown>,
    target: MapEditTargetRef
  ): Result<Readonly<{ nextJson: Record<string, unknown>; result: MapEditResult }>, MapEditError> {
    switch (target.kind) {
      case 'light':
        return this.deleteIndexed(json, 'lights', target.index);
      case 'particle':
        return this.deleteIndexed(json, 'particles', target.index);
      case 'entity':
        return this.deleteIndexed(json, 'entities', target.index);
      case 'door':
        return this.deleteDoorById(json, target.id);
      default: {
        const unknownKind = (target as unknown as { kind?: unknown }).kind;
        return err('map-edit/unsupported-target', `Unsupported map edit target kind: ${String(unknownKind)}`);
      }
    }
  }

  private cloneInJson(
    json: Record<string, unknown>,
    target: MapEditTargetRef,
    cloneOffset: Readonly<{ x: number; y: number }>
  ): Result<Readonly<{ nextJson: Record<string, unknown>; result: MapEditResult }>, MapEditError> {
    switch (target.kind) {
      case 'light':
        return this.cloneIndexedWithOffset(json, 'lights', target.index, cloneOffset);
      case 'particle':
        return this.cloneIndexedWithOffset(json, 'particles', target.index, cloneOffset);
      case 'entity':
        return this.cloneIndexedWithOffset(json, 'entities', target.index, cloneOffset);
      case 'door':
        return this.cloneDoorById(json, target.id);
      default: {
        const unknownKind = (target as unknown as { kind?: unknown }).kind;
        return err('map-edit/unsupported-target', `Unsupported map edit target kind: ${String(unknownKind)}`);
      }
    }
  }

  private deleteIndexed(
    json: Record<string, unknown>,
    collectionKey: 'lights' | 'particles' | 'entities',
    index: number
  ): Result<Readonly<{ nextJson: Record<string, unknown>; result: MapEditResult }>, MapEditError> {
    if (!Number.isInteger(index) || index < 0) {
      return err('map-edit/not-found', `No ${collectionKey} entry exists at index ${index}.`);
    }

    const raw = asArray(json[collectionKey], collectionKey);
    if (!raw.ok) {
      return raw;
    }

    if (index >= raw.value.length) {
      return err('map-edit/not-found', `No ${collectionKey} entry exists at index ${index}.`);
    }

    const nextArray = raw.value.slice(0, index).concat(raw.value.slice(index + 1));

    return {
      ok: true,
      value: {
        nextJson: { ...json, [collectionKey]: nextArray },
        result: { kind: 'map-edit/deleted' }
      }
    };
  }

  private cloneIndexedWithOffset(
    json: Record<string, unknown>,
    collectionKey: 'lights' | 'particles' | 'entities',
    index: number,
    cloneOffset: Readonly<{ x: number; y: number }>
  ): Result<Readonly<{ nextJson: Record<string, unknown>; result: MapEditResult }>, MapEditError> {
    if (!Number.isInteger(index) || index < 0) {
      return err('map-edit/not-found', `No ${collectionKey} entry exists at index ${index}.`);
    }

    const raw = asArray(json[collectionKey], collectionKey);
    if (!raw.ok) {
      return raw;
    }

    const source = raw.value[index];
    if (source === undefined) {
      return err('map-edit/not-found', `No ${collectionKey} entry exists at index ${index}.`);
    }

    const sourceRecord = asXyRecord(source, `${collectionKey}[${index}]`);
    if (!sourceRecord.ok) {
      return sourceRecord;
    }

    const nextEntry: Record<string, unknown> = {
      ...sourceRecord.value,
      x: (sourceRecord.value['x'] as number) + cloneOffset.x,
      y: (sourceRecord.value['y'] as number) + cloneOffset.y
    };

    const nextArray = raw.value.concat([nextEntry]);
    const newIndex = nextArray.length - 1;

    const newKind: MapEditTargetRef['kind'] = (
      {
        lights: 'light',
        particles: 'particle',
        entities: 'entity'
      } as const
    )[collectionKey];

    return {
      ok: true,
      value: {
        nextJson: { ...json, [collectionKey]: nextArray },
        result: {
          kind: 'map-edit/cloned',
          newRef: { kind: newKind, index: newIndex }
        }
      }
    };
  }

  private deleteDoorById(
    json: Record<string, unknown>,
    id: string
  ): Result<Readonly<{ nextJson: Record<string, unknown>; result: MapEditResult }>, MapEditError> {
    const doors = asArray(json['doors'], 'doors');
    if (!doors.ok) {
      return doors;
    }

    const index = doors.value.findIndex((candidate) => {
      if (!isRecord(candidate)) {
        return false;
      }
      return candidate['id'] === id;
    });

    if (index < 0) {
      return err('map-edit/not-found', `No door exists with id "${id}".`);
    }

    const nextDoors = doors.value.slice(0, index).concat(doors.value.slice(index + 1));

    return {
      ok: true,
      value: {
        nextJson: { ...json, doors: nextDoors },
        result: { kind: 'map-edit/deleted' }
      }
    };
  }

  private cloneDoorById(
    json: Record<string, unknown>,
    id: string
  ): Result<Readonly<{ nextJson: Record<string, unknown>; result: MapEditResult }>, MapEditError> {
    const doors = asArray(json['doors'], 'doors');
    if (!doors.ok) {
      return doors;
    }

    let sourceDoorIndex = -1;
    let sourceDoor: Record<string, unknown> | null = null;
    for (let index = 0; index < doors.value.length; index += 1) {
      const candidate = doors.value[index];
      if (!isRecord(candidate)) {
        continue;
      }
      if (candidate['id'] === id) {
        sourceDoorIndex = index;
        sourceDoor = candidate;
        break;
      }
    }

    if (sourceDoor === null) {
      return err('map-edit/not-found', `No door exists with id "${id}".`);
    }

    const sourceId = sourceDoor['id'];
    if (typeof sourceId !== 'string' || sourceId.trim().length === 0) {
      return err('map-edit/invalid-json', `doors[${sourceDoorIndex}].id must be a non-empty string`);
    }

    const existingIds = new Set<string>();
    for (const candidate of doors.value) {
      if (!isRecord(candidate)) {
        continue;
      }
      const candidateId = candidate['id'];
      if (typeof candidateId === 'string' && candidateId.trim().length > 0) {
        existingIds.add(candidateId);
      }
    }

    const nextId = ensureUniqueDoorId(existingIds, sourceId);

    const nextDoor: Record<string, unknown> = {
      ...sourceDoor,
      id: nextId
    };

    const nextDoors = doors.value.concat([nextDoor]);

    return {
      ok: true,
      value: {
        nextJson: { ...json, doors: nextDoors },
        result: {
          kind: 'map-edit/cloned',
          newRef: { kind: 'door', id: nextId }
        }
      }
    };
  }
}
