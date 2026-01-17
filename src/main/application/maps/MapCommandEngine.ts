import type { MapDocument } from '../../../shared/domain/models';
import type { MapEditError, Result } from '../../../shared/domain/results';
import type {
  MapEditAtomicCommand,
  MapEditCommand,
  MapEditSelectionEffect,
  MapEditSelectionInput,
  MapEditTargetRef
} from '../../../shared/ipc/nomosIpc';

type NonStaleMapEditErrorCode = Exclude<MapEditError['code'], 'map-edit/stale-revision'>;

function err(
  code: NonStaleMapEditErrorCode,
  message: string,
  extras?: Partial<Omit<MapEditError, 'kind' | 'code' | 'message'>>
): Result<never, MapEditError> {
  return {
    ok: false,
    error: {
      kind: 'map-edit-error',
      code,
      message,
      ...extras
    }
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPrimitiveValue(value: unknown): value is string | number | boolean | null {
  if (value === null) {
    return true;
  }
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

function validateUpdateFieldsSet(set: Readonly<Record<string, unknown>>): Result<null, MapEditError> {
  for (const [key, value] of Object.entries(set)) {
    if (key.trim().length === 0) {
      return err('map-edit/invalid-json', 'update-fields.set must not contain empty keys');
    }
    if (!isPrimitiveValue(value)) {
      return err('map-edit/invalid-json', `update-fields.set["${key}"] must be a JSON primitive`);
    }
    if (typeof value === 'number' && !Number.isFinite(value)) {
      return err('map-edit/invalid-json', `update-fields.set["${key}"] must be a finite number`);
    }
  }
  return { ok: true, value: null };
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
  while (existingIds.has(`${baseId}-copy-${suffix}`)) {
    suffix += 1;
  }

  return `${baseId}-copy-${suffix}`;
}

function targetEquals(a: MapEditTargetRef | null, b: MapEditTargetRef | null): boolean {
  if (a === null || b === null) {
    return a === b;
  }
  if (a.kind !== b.kind) {
    return false;
  }

  switch (a.kind) {
    case 'door':
      return a.id === (b as typeof a).id;
    case 'light':
    case 'particle':
    case 'entity':
    case 'wall':
      return a.index === (b as typeof a).index;
    case 'sector':
      return a.id === (b as typeof a).id;
  }
}

export type MapCommandEngineApplyResult = Readonly<{
  nextJson: Record<string, unknown>;
  selection: MapEditSelectionEffect;
  label?: string;
}>;

const MAX_TRANSACTION_COMMANDS = 100;
const CLONE_OFFSET = { x: 16, y: 16 } as const;

export class MapCommandEngine {
  public apply(document: MapDocument, command: MapEditCommand): Result<MapCommandEngineApplyResult, MapEditError> {
    const initialJson = document.json;

    if (!isRecord(initialJson)) {
      return err('map-edit/invalid-json', 'Map JSON must be an object.');
    }

    let workingJson: Record<string, unknown>;
    try {
      workingJson = structuredClone(initialJson);
    } catch (_error: unknown) {
      return err('map-edit/invalid-json', 'Map JSON must be cloneable.');
    }

    if (command.kind !== 'map-edit/transaction') {
      const atomicResult = this.applyAtomic(workingJson, command);
      if (!atomicResult.ok) {
        return atomicResult;
      }

      return {
        ok: true,
        value: {
          nextJson: atomicResult.value.nextJson,
          selection: atomicResult.value.selection
        }
      };
    }

    if (command.commands.length === 0) {
      return err('map-edit/transaction-empty', 'Transaction must contain at least one command.');
    }

    if (command.commands.length > MAX_TRANSACTION_COMMANDS) {
      return err('map-edit/transaction-too-large', `Transaction exceeds max command count (${MAX_TRANSACTION_COMMANDS}).`);
    }

    const selectionState = this.initialSelection(command.selection);
    let currentSelection = selectionState;
    let lastSelectionEffect: MapEditSelectionEffect = { kind: 'map-edit/selection/keep' };

    for (let stepIndex = 0; stepIndex < command.commands.length; stepIndex += 1) {
      const step = command.commands[stepIndex];
      if (step === undefined) {
        return err('map-edit/transaction-step-failed', 'Transaction step was undefined.', { stepIndex });
      }
      const stepResult = this.applyAtomic(workingJson, step, currentSelection);
      if (!stepResult.ok) {
        return err('map-edit/transaction-step-failed', 'Transaction step failed.', { stepIndex, cause: stepResult.error });
      }

      workingJson = stepResult.value.nextJson;
      currentSelection = stepResult.value.nextSelection;
      lastSelectionEffect = stepResult.value.selection;
    }

    return {
      ok: true,
      value: {
        nextJson: workingJson,
        selection: lastSelectionEffect,
        ...(command.label !== undefined ? { label: command.label } : {})
      }
    };
  }

  private initialSelection(selection: MapEditSelectionInput | undefined): MapEditTargetRef | null {
    if (selection === undefined) {
      return null;
    }
    return selection.ref;
  }

  private applyAtomic(
    json: Record<string, unknown>,
    command: MapEditAtomicCommand,
    currentSelection?: MapEditTargetRef | null
  ): Result<
    Readonly<{
      nextJson: Record<string, unknown>;
      selection: MapEditSelectionEffect;
      nextSelection: MapEditTargetRef | null;
    }>,
    MapEditError
  > {
    switch (command.kind) {
      case 'map-edit/delete': {
        const deleteResult = this.deleteFromJson(json, command.target);
        if (!deleteResult.ok) {
          return deleteResult;
        }

        const hadSelectionInput = currentSelection !== undefined;
        const selectionWasDeleted = hadSelectionInput && targetEquals(currentSelection ?? null, command.target);

        return {
          ok: true,
          value: {
            nextJson: deleteResult.value,
            selection: selectionWasDeleted
              ? { kind: 'map-edit/selection/clear', reason: 'deleted' }
              : { kind: 'map-edit/selection/keep' },
            nextSelection: selectionWasDeleted ? null : (currentSelection ?? null)
          }
        };
      }
      case 'map-edit/clone': {
        const cloneResult = this.cloneInJson(json, command.target);
        if (!cloneResult.ok) {
          return cloneResult;
        }

        return {
          ok: true,
          value: {
            nextJson: cloneResult.value.nextJson,
            selection: { kind: 'map-edit/selection/set', ref: cloneResult.value.newRef },
            nextSelection: cloneResult.value.newRef
          }
        };
      }
      case 'map-edit/update-fields': {
        const validateSet = validateUpdateFieldsSet(command.set as unknown as Record<string, unknown>);
        if (!validateSet.ok) {
          return validateSet;
        }

        const updateResult = this.updateFieldsInJson(json, command.target, command.set as unknown as Record<string, unknown>);
        if (!updateResult.ok) {
          return updateResult;
        }

        return {
          ok: true,
          value: {
            nextJson: updateResult.value,
            selection: { kind: 'map-edit/selection/keep' },
            nextSelection: currentSelection ?? null
          }
        };
      }
      case 'map-edit/move-entity': {
        const toX = command.to.x;
        const toY = command.to.y;
        if (!isFiniteNumber(toX) || !isFiniteNumber(toY)) {
          return err('map-edit/invalid-json', 'move-entity.to must have finite number x/y');
        }

        const moveResult = this.moveEntityInJson(json, command.target.index, { x: toX, y: toY });
        if (!moveResult.ok) {
          return moveResult;
        }

        return {
          ok: true,
          value: {
            nextJson: moveResult.value,
            selection: { kind: 'map-edit/selection/keep' },
            nextSelection: currentSelection ?? null
          }
        };
      }
      default: {
        const unknownKind = (command as unknown as { kind?: unknown }).kind;
        return err('map-edit/unsupported-target', `Unsupported map edit command kind: ${String(unknownKind)}`);
      }
    }
  }

  private updateFieldsInJson(
    json: Record<string, unknown>,
    target: MapEditTargetRef,
    set: Readonly<Record<string, unknown>>
  ): Result<Record<string, unknown>, MapEditError> {
    switch (target.kind) {
      case 'light':
        return this.updateFieldsIndexed(json, 'lights', target.index, set);
      case 'particle':
        return this.updateFieldsIndexed(json, 'particles', target.index, set);
      case 'entity':
        return this.updateFieldsIndexed(json, 'entities', target.index, set);
      case 'door':
        return this.updateFieldsDoorById(json, target.id, set);
      case 'wall':
        return this.updateFieldsIndexed(json, 'walls', target.index, set);
      case 'sector':
        return this.updateFieldsSectorById(json, target.id, set);
      default: {
        const unknownKind = (target as unknown as { kind?: unknown }).kind;
        return err('map-edit/unsupported-target', `Unsupported map edit target kind: ${String(unknownKind)}`);
      }
    }
  }

  private updateFieldsIndexed(
    json: Record<string, unknown>,
    collectionKey: 'lights' | 'particles' | 'entities' | 'walls',
    index: number,
    set: Readonly<Record<string, unknown>>
  ): Result<Record<string, unknown>, MapEditError> {
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

    const sourceRecord = asRecord(source, `${collectionKey}[${index}]`);
    if (!sourceRecord.ok) {
      return sourceRecord;
    }

    const nextEntry: Record<string, unknown> = { ...sourceRecord.value };
    for (const [key, value] of Object.entries(set)) {
      nextEntry[key] = value;
    }

    const nextArray = raw.value.slice();
    nextArray[index] = nextEntry;

    return { ok: true, value: { ...json, [collectionKey]: nextArray } };
  }

  private updateFieldsSectorById(
    json: Record<string, unknown>,
    id: number,
    set: Readonly<Record<string, unknown>>
  ): Result<Record<string, unknown>, MapEditError> {
    if (!Number.isInteger(id)) {
      return err('map-edit/invalid-json', 'sector id must be an integer');
    }

    const sectors = asArray(json['sectors'], 'sectors');
    if (!sectors.ok) {
      return sectors;
    }

    const index = sectors.value.findIndex((candidate) => {
      if (!isRecord(candidate)) {
        return false;
      }
      return candidate['id'] === id;
    });

    if (index < 0) {
      return err('map-edit/not-found', `No sector exists with id ${id}.`);
    }

    const source = sectors.value[index];
    const sourceRecord = asRecord(source, `sectors[${index}]`);
    if (!sourceRecord.ok) {
      return sourceRecord;
    }

    const nextSector: Record<string, unknown> = { ...sourceRecord.value };
    for (const [key, value] of Object.entries(set)) {
      nextSector[key] = value;
    }

    const nextSectors = sectors.value.slice();
    nextSectors[index] = nextSector;

    return { ok: true, value: { ...json, sectors: nextSectors } };
  }

  private updateFieldsDoorById(
    json: Record<string, unknown>,
    id: string,
    set: Readonly<Record<string, unknown>>
  ): Result<Record<string, unknown>, MapEditError> {
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

    const source = doors.value[index];
    const sourceRecord = asRecord(source, `doors[${index}]`);
    if (!sourceRecord.ok) {
      return sourceRecord;
    }

    const nextDoor: Record<string, unknown> = { ...sourceRecord.value };
    for (const [key, value] of Object.entries(set)) {
      nextDoor[key] = value;
    }

    const nextDoors = doors.value.slice();
    nextDoors[index] = nextDoor;

    return { ok: true, value: { ...json, doors: nextDoors } };
  }

  private moveEntityInJson(
    json: Record<string, unknown>,
    index: number,
    to: Readonly<{ x: number; y: number }>
  ): Result<Record<string, unknown>, MapEditError> {
    if (!Number.isInteger(index) || index < 0) {
      return err('map-edit/not-found', `No entities entry exists at index ${index}.`);
    }

    const entities = asArray(json['entities'], 'entities');
    if (!entities.ok) {
      return entities;
    }

    const source = entities.value[index];
    if (source === undefined) {
      return err('map-edit/not-found', `No entities entry exists at index ${index}.`);
    }

    const sourceRecord = asXyRecord(source, `entities[${index}]`);
    if (!sourceRecord.ok) {
      return sourceRecord;
    }

    const nextEntry: Record<string, unknown> = {
      ...sourceRecord.value,
      x: to.x,
      y: to.y
    };

    const nextEntities = entities.value.slice();
    nextEntities[index] = nextEntry;

    return { ok: true, value: { ...json, entities: nextEntities } };
  }

  private deleteFromJson(json: Record<string, unknown>, target: MapEditTargetRef): Result<Record<string, unknown>, MapEditError> {
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
    target: MapEditTargetRef
  ): Result<Readonly<{ nextJson: Record<string, unknown>; newRef: MapEditTargetRef }>, MapEditError> {
    switch (target.kind) {
      case 'light':
        return this.cloneIndexedWithOffset(json, 'lights', target.index, CLONE_OFFSET);
      case 'particle':
        return this.cloneIndexedWithOffset(json, 'particles', target.index, CLONE_OFFSET);
      case 'entity':
        return this.cloneIndexedWithOffset(json, 'entities', target.index, CLONE_OFFSET);
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
  ): Result<Record<string, unknown>, MapEditError> {
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

    return { ok: true, value: { ...json, [collectionKey]: nextArray } };
  }

  private cloneIndexedWithOffset(
    json: Record<string, unknown>,
    collectionKey: 'lights' | 'particles' | 'entities',
    index: number,
    cloneOffset: Readonly<{ x: number; y: number }>
  ): Result<Readonly<{ nextJson: Record<string, unknown>; newRef: MapEditTargetRef }>, MapEditError> {
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
        newRef: { kind: newKind, index: newIndex }
      }
    };
  }

  private deleteDoorById(json: Record<string, unknown>, id: string): Result<Record<string, unknown>, MapEditError> {
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

    return { ok: true, value: { ...json, doors: nextDoors } };
  }

  private cloneDoorById(
    json: Record<string, unknown>,
    id: string
  ): Result<Readonly<{ nextJson: Record<string, unknown>; newRef: MapEditTargetRef }>, MapEditError> {
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

    return { ok: true, value: { nextJson: { ...json, doors: nextDoors }, newRef: { kind: 'door', id: nextId } } };
  }
}
