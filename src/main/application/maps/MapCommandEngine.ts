import type { MapDocument } from '../../../shared/domain/models';
import type { MapEditError, Result } from '../../../shared/domain/results';
import { ROOM_CREATION_DEFAULTS } from '../../../shared/domain/mapRoomCreation';
import {
  computeAdjacentPortalPlan,
  computeRoomPolygon,
  doesPolygonIntersectWalls,
  findEnclosingSectorIdForPolygon
} from '../../../shared/domain/mapRoomGeometry';
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

function isUnsetValue(value: unknown): value is Readonly<{ kind: 'map-edit/unset' }> {
  return isRecord(value) && value['kind'] === 'map-edit/unset';
}

function isUpdateFieldsValue(value: unknown): value is string | number | boolean | null | Readonly<{ kind: 'map-edit/unset' }> {
  return isPrimitiveValue(value) || isUnsetValue(value);
}

function validateUpdateFieldsSet(set: Readonly<Record<string, unknown>>): Result<null, MapEditError> {
  for (const [key, value] of Object.entries(set)) {
    if (key.trim().length === 0) {
      return err('map-edit/invalid-json', 'update-fields.set must not contain empty keys');
    }
    if (!isUpdateFieldsValue(value)) {
      return err(
        'map-edit/invalid-json',
        `update-fields.set["${key}"] must be a JSON primitive (or {kind:'map-edit/unset'})`
      );
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

function createNewDoorId(existingIds: ReadonlySet<string>): string {
  let suffix = 1;
  while (existingIds.has(`door-${suffix}`)) {
    suffix += 1;
  }
  return `door-${suffix}`;
}

function targetEquals(a: MapEditTargetRef | null, b: MapEditTargetRef | null): boolean {
  if (a === null || b === null) {
    return a === b;
  }
  if (a.kind !== b.kind) {
    return false;
  }

  switch (a.kind) {
    case 'map':
      return true;
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
      case 'map-edit/create-door': {
        const createResult = this.createDoorAtPortalWallIndex(json, command.atWallIndex);
        if (!createResult.ok) {
          return createResult;
        }

        return {
          ok: true,
          value: {
            nextJson: createResult.value.nextJson,
            selection: { kind: 'map-edit/selection/set', ref: createResult.value.newRef },
            nextSelection: createResult.value.newRef
          }
        };
      }
      case 'map-edit/create-room': {
        const createResult = this.createRoomInJson(json, command.request as unknown);
        if (!createResult.ok) {
          return createResult;
        }

        return {
          ok: true,
          value: {
            nextJson: createResult.value.nextJson,
            selection: { kind: 'map-edit/selection/set', ref: { kind: 'sector', id: createResult.value.newSectorId } },
            nextSelection: { kind: 'sector', id: createResult.value.newSectorId }
          }
        };
      }
      case 'map-edit/set-sector-wall-tex': {
        const sectorId = command.sectorId;
        if (!Number.isFinite(sectorId) || !Number.isInteger(sectorId) || sectorId < 0) {
          return err('map-edit/invalid-json', 'set-sector-wall-tex.sectorId must be a non-negative integer');
        }

        const tex = command.tex.trim();
        if (tex.length === 0) {
          return err('map-edit/invalid-json', 'set-sector-wall-tex.tex must be a non-empty string');
        }

        const walls = asArray(json['walls'], 'walls');
        if (!walls.ok) {
          return walls;
        }

        for (const wall of walls.value) {
          if (!isRecord(wall)) {
            continue;
          }

          const frontSector = wall['front_sector'];
          if (typeof frontSector !== 'number' || !Number.isFinite(frontSector) || !Number.isInteger(frontSector)) {
            continue;
          }

          if (frontSector === sectorId) {
            wall['tex'] = tex;
          }
        }

        return {
          ok: true,
          value: {
            nextJson: json,
            selection: { kind: 'map-edit/selection/keep' },
            nextSelection: currentSelection ?? null
          }
        };
      }
      case 'map-edit/set-player-start': {
        const x = command.playerStart.x;
        const y = command.playerStart.y;
        const angleDeg = command.playerStart.angleDeg;
        if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(angleDeg)) {
          return err('map-edit/invalid-json', 'set-player-start.playerStart must have finite number x/y/angleDeg');
        }

        json['player_start'] = {
          x,
          y,
          angle_deg: angleDeg
        };

        return {
          ok: true,
          value: {
            nextJson: json,
            selection: { kind: 'map-edit/selection/keep' },
            nextSelection: currentSelection ?? null
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
      case 'map-edit/move-light': {
        const toX = command.to.x;
        const toY = command.to.y;
        if (!isFiniteNumber(toX) || !isFiniteNumber(toY)) {
          return err('map-edit/invalid-json', 'move-light.to must have finite number x/y');
        }

        const moveResult = this.moveLightInJson(json, command.target.index, { x: toX, y: toY });
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

  private createDoorAtPortalWallIndex(
    json: Record<string, unknown>,
    atWallIndex: number
  ): Result<Readonly<{ nextJson: Record<string, unknown>; newRef: MapEditTargetRef }>, MapEditError> {
    if (!Number.isInteger(atWallIndex) || atWallIndex < 0) {
      return err('map-edit/not-found', `No wall entry exists at index ${atWallIndex}.`);
    }

    const walls = asArray(json['walls'], 'walls');
    if (!walls.ok) {
      return walls;
    }

    const wall = walls.value[atWallIndex];
    if (wall === undefined) {
      return err('map-edit/not-found', `No wall entry exists at index ${atWallIndex}.`);
    }

    const wallRecord = asRecord(wall, `walls[${atWallIndex}]`);
    if (!wallRecord.ok) {
      return wallRecord;
    }

    const backSector = wallRecord.value['back_sector'];
    if (typeof backSector !== 'number' || !Number.isFinite(backSector) || !Number.isInteger(backSector)) {
      return err('map-edit/invalid-json', `walls[${atWallIndex}].back_sector must be an integer`);
    }

    if (backSector <= -1) {
      return err('map-edit/not-a-portal', `Wall at index ${atWallIndex} is not a portal.`);
    }

    const doorsRaw = json['doors'];
    const doors = doorsRaw === undefined ? ({ ok: true, value: [] as unknown[] } as const) : asArray(doorsRaw, 'doors');
    if (!doors.ok) {
      return doors;
    }

    for (let doorIndex = 0; doorIndex < doors.value.length; doorIndex += 1) {
      const candidate = doors.value[doorIndex];
      if (!isRecord(candidate)) {
        continue;
      }
      if (candidate['wall_index'] === atWallIndex) {
        return err('map-edit/door-already-exists', `A door already exists at wall_index ${atWallIndex}.`);
      }
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

    const nextId = createNewDoorId(existingIds);

    const nextDoor: Record<string, unknown> = {
      id: nextId,
      wall_index: atWallIndex,
      starts_closed: true
    };

    const nextDoors = doors.value.concat([nextDoor]);

    return { ok: true, value: { nextJson: { ...json, doors: nextDoors }, newRef: { kind: 'door', id: nextId } } };
  }

  private updateFieldsInJson(
    json: Record<string, unknown>,
    target: MapEditTargetRef,
    set: Readonly<Record<string, unknown>>
  ): Result<Record<string, unknown>, MapEditError> {
    switch (target.kind) {
      case 'map':
        return this.updateFieldsMapRoot(json, set);
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

  private createRoomInJson(
    json: Record<string, unknown>,
    request: unknown
  ): Result<Readonly<{ nextJson: Record<string, unknown>; newSectorId: number }>, MapEditError> {
    if (!isRecord(request)) {
      return err('map-edit/create-room/invalid-request', 'create-room.request must be an object');
    }

    const template = request['template'];
    if (template !== 'rectangle' && template !== 'square' && template !== 'triangle') {
      return err('map-edit/create-room/invalid-request', 'create-room.request.template must be rectangle|square|triangle');
    }
    const templateValue = template as 'rectangle' | 'square' | 'triangle';

    const centerRecord = asXyRecord(request['center'], 'create-room.request.center');
    if (!centerRecord.ok) {
      return centerRecord;
    }
    const center = { x: centerRecord.value['x'] as number, y: centerRecord.value['y'] as number };

    const sizeRaw = request['size'];
    const sizeRecord = asRecord(sizeRaw, 'create-room.request.size');
    if (!sizeRecord.ok) {
      return sizeRecord;
    }
    const width = sizeRecord.value['width'];
    const height = sizeRecord.value['height'];
    if (!isFiniteNumber(width) || !isFiniteNumber(height)) {
      return err('map-edit/create-room/invalid-request', 'create-room.request.size.width/height must be finite numbers');
    }
    if (!(width >= ROOM_CREATION_DEFAULTS.minSizeWorld) || !(height >= ROOM_CREATION_DEFAULTS.minSizeWorld)) {
      return err('map-edit/create-room/invalid-size', `create-room.request.size must be >= ${ROOM_CREATION_DEFAULTS.minSizeWorld}`);
    }

    const rotationQuarterTurnsRaw = request['rotationQuarterTurns'];
    if (!Number.isInteger(rotationQuarterTurnsRaw)) {
      return err('map-edit/create-room/invalid-request', 'create-room.request.rotationQuarterTurns must be an integer 0..3');
    }
    const rotationQuarterTurns = rotationQuarterTurnsRaw as number;
    if (rotationQuarterTurns < 0 || rotationQuarterTurns > 3) {
      return err('map-edit/create-room/invalid-request', 'create-room.request.rotationQuarterTurns must be an integer 0..3');
    }
    const rotationQuarterTurnsValue = rotationQuarterTurns as 0 | 1 | 2 | 3;

    const defaultsRecord = asRecord(request['defaults'], 'create-room.request.defaults');
    if (!defaultsRecord.ok) {
      return defaultsRecord;
    }

    const wallTex = defaultsRecord.value['wallTex'];
    const floorTex = defaultsRecord.value['floorTex'];
    const ceilTex = defaultsRecord.value['ceilTex'];
    if (
      typeof wallTex !== 'string' ||
      wallTex.trim().length === 0 ||
      typeof floorTex !== 'string' ||
      floorTex.trim().length === 0 ||
      typeof ceilTex !== 'string' ||
      ceilTex.trim().length === 0
    ) {
      return err('map-edit/create-room/not-enough-textures', 'create-room.request.defaults must include non-empty wallTex/floorTex/ceilTex');
    }

    const floorZ = defaultsRecord.value['floorZ'];
    const ceilZ = defaultsRecord.value['ceilZ'];
    const light = defaultsRecord.value['light'];
    if (!isFiniteNumber(floorZ) || !isFiniteNumber(ceilZ) || !isFiniteNumber(light)) {
      return err('map-edit/create-room/invalid-request', 'create-room.request.defaults floorZ/ceilZ/light must be finite numbers');
    }
    if (!(ceilZ > floorZ)) {
      return err('map-edit/create-room/invalid-request', 'create-room.request.defaults ceilZ must be > floorZ');
    }

    const placementRecord = asRecord(request['placement'], 'create-room.request.placement');
    if (!placementRecord.ok) {
      return placementRecord;
    }

    const placementKind = placementRecord.value['kind'];
    if (
      placementKind !== 'room-placement/nested' &&
      placementKind !== 'room-placement/adjacent' &&
      placementKind !== 'room-placement/seed'
    ) {
      return err(
        'map-edit/create-room/invalid-request',
        'create-room.request.placement.kind must be room-placement/nested|room-placement/adjacent|room-placement/seed'
      );
    }
    const placementKindValue = placementKind as 'room-placement/nested' | 'room-placement/adjacent' | 'room-placement/seed';

    const verticesRaw = asArray(json['vertices'], 'vertices');
    if (!verticesRaw.ok) {
      return verticesRaw;
    }
    const wallsRaw = asArray(json['walls'], 'walls');
    if (!wallsRaw.ok) {
      return wallsRaw;
    }
    const sectorsRaw = asArray(json['sectors'], 'sectors');
    if (!sectorsRaw.ok) {
      return sectorsRaw;
    }

    const parsedVertices: { x: number; y: number }[] = [];
    for (let vertexIndex = 0; vertexIndex < verticesRaw.value.length; vertexIndex += 1) {
      const vertex = asRecord(verticesRaw.value[vertexIndex], `vertices[${vertexIndex}]`);
      if (!vertex.ok) {
        return vertex;
      }
      const x = vertex.value['x'];
      const y = vertex.value['y'];
      if (!isFiniteNumber(x) || !isFiniteNumber(y)) {
        return err('map-edit/invalid-json', `vertices[${vertexIndex}].x/y must be finite numbers`);
      }
      parsedVertices.push({ x, y });
    }

    const sectorIds: number[] = [];
    let maxSectorId = Number.NEGATIVE_INFINITY;
    for (let sectorIndex = 0; sectorIndex < sectorsRaw.value.length; sectorIndex += 1) {
      const sector = asRecord(sectorsRaw.value[sectorIndex], `sectors[${sectorIndex}]`);
      if (!sector.ok) {
        return sector;
      }
      const id = sector.value['id'];
      if (!Number.isInteger(id)) {
        return err('map-edit/invalid-json', `sectors[${sectorIndex}].id must be an integer`);
      }
      const sectorId = id as number;
      sectorIds.push(sectorId);
      maxSectorId = Math.max(maxSectorId, sectorId);
    }

    const parsedWalls: {
      index: number;
      v0: number;
      v1: number;
      frontSectorId: number;
      backSectorId: number;
    }[] = [];
    for (let wallIndex = 0; wallIndex < wallsRaw.value.length; wallIndex += 1) {
      const wall = asRecord(wallsRaw.value[wallIndex], `walls[${wallIndex}]`);
      if (!wall.ok) {
        return wall;
      }
      const v0 = wall.value['v0'];
      const v1 = wall.value['v1'];
      const frontSector = wall.value['front_sector'];
      const backSector = wall.value['back_sector'];
      const tex = wall.value['tex'];

      if (!Number.isInteger(v0) || !Number.isInteger(v1)) {
        return err('map-edit/invalid-json', `walls[${wallIndex}].v0/v1 must be integers`);
      }
      const v0Index = v0 as number;
      const v1Index = v1 as number;
      if (v0Index < 0 || v0Index >= parsedVertices.length || v1Index < 0 || v1Index >= parsedVertices.length) {
        return err('map-edit/invalid-json', `walls[${wallIndex}].v0/v1 must be in range`);
      }
      if (!Number.isInteger(frontSector) || !Number.isInteger(backSector)) {
        return err('map-edit/invalid-json', `walls[${wallIndex}].front_sector/back_sector must be integers`);
      }
      if (typeof tex !== 'string' || tex.trim().length === 0) {
        return err('map-edit/invalid-json', `walls[${wallIndex}].tex must be a non-empty string`);
      }

      parsedWalls.push({
        index: wallIndex,
        v0: v0Index,
        v1: v1Index,
        frontSectorId: frontSector as number,
        backSectorId: backSector as number
      });
    }

    const geometry = {
      vertices: parsedVertices,
      walls: parsedWalls,
      sectorIds
    };

    const polygon = computeRoomPolygon({
      template: templateValue,
      center,
      size: { width, height },
      rotationQuarterTurns: rotationQuarterTurnsValue
    });

    if (!Number.isFinite(maxSectorId) && placementKindValue !== 'room-placement/seed') {
      return err('map-edit/invalid-json', 'sectors must not be empty');
    }

    const newSectorId = Number.isFinite(maxSectorId) ? maxSectorId + 1 : 0;

    const nextVertices = verticesRaw.value.slice();
    const nextWalls = wallsRaw.value.slice();
    const nextSectors = sectorsRaw.value.slice();

    const addVertex = (point: { x: number; y: number }): number => {
      nextVertices.push({ x: point.x, y: point.y });
      return nextVertices.length - 1;
    };

    const addWall = (wallRecord: Record<string, unknown>): void => {
      nextWalls.push(wallRecord);
    };

    if (placementKindValue === 'room-placement/seed') {
      if (wallsRaw.value.length !== 0 || sectorsRaw.value.length !== 0) {
        return err(
          'map-edit/create-room/invalid-request',
          'create-room.request.placement.kind=room-placement/seed is only allowed when the map has no sectors/walls'
        );
      }

      nextSectors.push({
        id: newSectorId,
        floor_z: floorZ,
        ceil_z: ceilZ,
        floor_tex: floorTex,
        ceil_tex: ceilTex,
        light
      });

      const roomVertexIndices = polygon.map((p) => addVertex(p));
      for (let edgeIndex = 0; edgeIndex < roomVertexIndices.length; edgeIndex += 1) {
        const v0 = roomVertexIndices[edgeIndex];
        const v1 = roomVertexIndices[(edgeIndex + 1) % roomVertexIndices.length];
        if (v0 === undefined || v1 === undefined) {
          return err('map-edit/invalid-json', 'Failed to create seed room walls (internal indexing error)');
        }
        addWall({ v0, v1, front_sector: newSectorId, back_sector: -1, tex: wallTex });
      }

      return { ok: true, value: { nextJson: { ...json, vertices: nextVertices, walls: nextWalls, sectors: nextSectors }, newSectorId } };
    }

    if (placementKindValue === 'room-placement/nested') {
      const enclosingSectorId = placementRecord.value['enclosingSectorId'];
      if (!Number.isInteger(enclosingSectorId)) {
        return err('map-edit/create-room/invalid-request', 'create-room.request.placement.enclosingSectorId must be an integer');
      }
      const enclosingSectorIdValue = enclosingSectorId as number;

      const enclosing = findEnclosingSectorIdForPolygon(geometry, polygon);
      if (enclosing === null || enclosing !== enclosingSectorIdValue) {
        return err('map-edit/create-room/not-inside-any-sector', 'Requested nested room is not fully inside the enclosing sector');
      }

      if (doesPolygonIntersectWalls({ geometry, polygon })) {
        return err('map-edit/create-room/intersects-walls', 'Requested nested room intersects existing walls');
      }

      nextSectors.push({
        id: newSectorId,
        floor_z: floorZ,
        ceil_z: ceilZ,
        floor_tex: floorTex,
        ceil_tex: ceilTex,
        light
      });

      const roomVertexIndices = polygon.map((p) => addVertex(p));
      for (let edgeIndex = 0; edgeIndex < roomVertexIndices.length; edgeIndex += 1) {
        const v0 = roomVertexIndices[edgeIndex];
        const v1 = roomVertexIndices[(edgeIndex + 1) % roomVertexIndices.length];
        if (v0 === undefined || v1 === undefined) {
          return err('map-edit/invalid-json', 'Failed to create nested room walls (internal indexing error)');
        }
        addWall({ v0, v1, front_sector: newSectorId, back_sector: enclosingSectorIdValue, tex: wallTex });
      }

      return { ok: true, value: { nextJson: { ...json, vertices: nextVertices, walls: nextWalls, sectors: nextSectors }, newSectorId } };
    }

    // Adjacent placement
    const targetWallIndex = placementRecord.value['targetWallIndex'];
    const snapDistancePx = placementRecord.value['snapDistancePx'];
    if (!Number.isInteger(targetWallIndex)) {
      return err('map-edit/create-room/invalid-request', 'create-room.request.placement.targetWallIndex must be a non-negative integer');
    }
    const targetWallIndexValue = targetWallIndex as number;
    if (targetWallIndexValue < 0) {
      return err('map-edit/create-room/invalid-request', 'create-room.request.placement.targetWallIndex must be a non-negative integer');
    }
    if (!isFiniteNumber(snapDistancePx) || snapDistancePx < 0) {
      return err('map-edit/create-room/invalid-request', 'create-room.request.placement.snapDistancePx must be a finite non-negative number');
    }
    if (snapDistancePx > ROOM_CREATION_DEFAULTS.snapThresholdPx) {
      return err(
        'map-edit/create-room/adjacent-too-far',
        `Adjacent snap distance exceeded threshold (${snapDistancePx} > ${ROOM_CREATION_DEFAULTS.snapThresholdPx})`
      );
    }

    const targetWall = parsedWalls[targetWallIndexValue];
    if (!targetWall) {
      return err('map-edit/create-room/invalid-request', `No wall exists at targetWallIndex ${targetWallIndexValue}`);
    }
    if (targetWall.backSectorId > -1) {
      return err('map-edit/create-room/invalid-request', 'Target wall must be a solid wall (back_sector must be -1)');
    }

    const doorsRaw = json['doors'];
    if (doorsRaw !== undefined) {
      const doors = asArray(doorsRaw, 'doors');
      if (!doors.ok) {
        return doors;
      }
      for (const candidate of doors.value) {
        if (!isRecord(candidate)) {
          continue;
        }
        if (candidate['wall_index'] === targetWallIndexValue) {
          return err('map-edit/create-room/invalid-request', `Cannot join to wall_index ${targetWallIndexValue} because a door is already bound to it.`);
        }
      }
    }

    const enclosing = findEnclosingSectorIdForPolygon(geometry, polygon);
    if (enclosing !== null) {
      return err('map-edit/create-room/invalid-request', 'Adjacent room request is actually nested inside an existing sector');
    }

    const plan = computeAdjacentPortalPlan({ geometry, polygon, targetWallIndex: targetWallIndexValue });
    if (plan.kind === 'room-adjacent-portal-plan-error') {
      return err(
        plan.reason === 'invalid-wall-index'
          ? 'map-edit/create-room/invalid-request'
          : 'map-edit/create-room/non-collinear',
        `Adjacent portal planning failed (${plan.reason}).`
      );
    }

    const snappedPolygon = plan.snappedPolygon;

    if (
      doesPolygonIntersectWalls({
        geometry,
        polygon: snappedPolygon,
        ignoredWallIndices: new Set([targetWallIndexValue]),
        allowEndpointTouch: true
      })
    ) {
      return err('map-edit/create-room/intersects-walls', 'Requested adjacent room intersects existing walls');
    }

    nextSectors.push({
      id: newSectorId,
      floor_z: floorZ,
      ceil_z: ceilZ,
      floor_tex: floorTex,
      ceil_tex: ceilTex,
      light
    });

    // Split existing wall at portal endpoints; keep the original wall index as the portal segment.
    const targetWallRecord = asRecord(nextWalls[targetWallIndexValue], `walls[${targetWallIndexValue}]`);
    if (!targetWallRecord.ok) {
      return targetWallRecord;
    }

    const originalV0 = targetWall.v0;
    const originalV1 = targetWall.v1;
    const originalV0Point = parsedVertices[originalV0];
    const originalV1Point = parsedVertices[originalV1];
    if (!originalV0Point || !originalV1Point) {
      return err('map-edit/invalid-json', `walls[${targetWallIndex}] has invalid v0/v1`);
    }

    const epsilon = 1e-6;
    const isSamePoint = (a: Readonly<{ x: number; y: number }>, b: Readonly<{ x: number; y: number }>): boolean => {
      return Math.abs(a.x - b.x) <= epsilon && Math.abs(a.y - b.y) <= epsilon;
    };

    // Add portal endpoints as shared vertices used by both the existing wall split and the new room portal wall.
    // Reuse existing wall endpoints when the portal aligns exactly, to avoid degenerate segments.
    const portalAIndex =
      isSamePoint(plan.portalA, originalV0Point) ? originalV0 : isSamePoint(plan.portalA, originalV1Point) ? originalV1 : addVertex(plan.portalA);
    const portalBIndex =
      isSamePoint(plan.portalB, originalV0Point) ? originalV0 : isSamePoint(plan.portalB, originalV1Point) ? originalV1 : addVertex(plan.portalB);

    const axis: 'x' | 'y' = plan.orientation === 'horizontal' ? 'x' : 'y';
    const increasing = originalV0Point[axis] <= originalV1Point[axis];
    const portalStartIndex = increasing ? portalAIndex : portalBIndex;
    const portalEndIndex = increasing ? portalBIndex : portalAIndex;

    const baseWall: Record<string, unknown> = { ...targetWallRecord.value };

    const addSplitSegment = (v0: number, v1: number): void => {
      if (v0 === v1) {
        return;
      }
      addWall({ ...baseWall, v0, v1, back_sector: -1 });
    };

    // Before segment
    if (originalV0 !== portalStartIndex) {
      addSplitSegment(originalV0, portalStartIndex);
    }
    // After segment
    if (portalEndIndex !== originalV1) {
      addSplitSegment(portalEndIndex, originalV1);
    }

    // Update the original wall in place to become the portal segment.
    nextWalls[targetWallIndexValue] = { ...baseWall, v0: portalStartIndex, v1: portalEndIndex, back_sector: newSectorId };

    // Add new room vertices for corners. If a corner coincides with a portal endpoint, reuse that vertex index.
    const roomCornerVertexIndices = snappedPolygon.map((p) => {
      if (isSamePoint(p, plan.portalA)) {
        return portalAIndex;
      }
      if (isSamePoint(p, plan.portalB)) {
        return portalBIndex;
      }
      return addVertex(p);
    });

    // Add room walls; split the chosen edge to include the portal segment sharing endpoints.
    for (let edgeIndex = 0; edgeIndex < roomCornerVertexIndices.length; edgeIndex += 1) {
      const corner0 = roomCornerVertexIndices[edgeIndex];
      const corner1 = roomCornerVertexIndices[(edgeIndex + 1) % roomCornerVertexIndices.length];

      if (corner0 === undefined || corner1 === undefined) {
        return err('map-edit/invalid-json', 'Failed to create adjacent room walls (internal indexing error)');
      }

      if (edgeIndex !== plan.polygonEdgeIndex) {
        addWall({ v0: corner0, v1: corner1, front_sector: newSectorId, back_sector: -1, tex: wallTex });
        continue;
      }

      const c0 = nextVertices[corner0] as unknown;
      const c1 = nextVertices[corner1] as unknown;
      const c0Rec = asXyRecord(c0, `vertices[${corner0}]`);
      if (!c0Rec.ok) {
        return c0Rec;
      }
      const c1Rec = asXyRecord(c1, `vertices[${corner1}]`);
      if (!c1Rec.ok) {
        return c1Rec;
      }

      const c0p = { x: c0Rec.value['x'] as number, y: c0Rec.value['y'] as number };
      const c1p = { x: c1Rec.value['x'] as number, y: c1Rec.value['y'] as number };
      const edgeIncreasing = c0p[axis] <= c1p[axis];
      const portalEdgeStart = edgeIncreasing ? portalAIndex : portalBIndex;
      const portalEdgeEnd = edgeIncreasing ? portalBIndex : portalAIndex;

      const addRoomEdgeSegment = (v0: number, v1: number, backSector: number): void => {
        if (v0 === v1) {
          return;
        }
        addWall({ v0, v1, front_sector: newSectorId, back_sector: backSector, tex: wallTex });
      };

      if (corner0 !== portalEdgeStart) {
        addRoomEdgeSegment(corner0, portalEdgeStart, -1);
      }
      addRoomEdgeSegment(portalEdgeStart, portalEdgeEnd, targetWall.frontSectorId);
      if (portalEdgeEnd !== corner1) {
        addRoomEdgeSegment(portalEdgeEnd, corner1, -1);
      }
    }

    return { ok: true, value: { nextJson: { ...json, vertices: nextVertices, walls: nextWalls, sectors: nextSectors }, newSectorId } };
  }

  private updateFieldsMapRoot(
    json: Record<string, unknown>,
    set: Readonly<Record<string, unknown>>
  ): Result<Record<string, unknown>, MapEditError> {
    const nextJson: Record<string, unknown> = { ...json };
    for (const [key, value] of Object.entries(set)) {
      if (isUnsetValue(value)) {
        delete nextJson[key];
        continue;
      }
      nextJson[key] = value;
    }
    return { ok: true, value: nextJson };
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
      if (isUnsetValue(value)) {
        delete nextEntry[key];
        continue;
      }
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
      if (isUnsetValue(value)) {
        delete nextSector[key];
        continue;
      }
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
      if (isUnsetValue(value)) {
        delete nextDoor[key];
        continue;
      }
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

  private moveLightInJson(
    json: Record<string, unknown>,
    index: number,
    to: Readonly<{ x: number; y: number }>
  ): Result<Record<string, unknown>, MapEditError> {
    if (!Number.isInteger(index) || index < 0) {
      return err('map-edit/not-found', `No lights entry exists at index ${index}.`);
    }

    const lights = asArray(json['lights'], 'lights');
    if (!lights.ok) {
      return lights;
    }

    const source = lights.value[index];
    if (source === undefined) {
      return err('map-edit/not-found', `No lights entry exists at index ${index}.`);
    }

    const sourceRecord = asXyRecord(source, `lights[${index}]`);
    if (!sourceRecord.ok) {
      return sourceRecord;
    }

    const nextEntry: Record<string, unknown> = {
      ...sourceRecord.value,
      x: to.x,
      y: to.y
    };

    const nextLights = lights.value.slice();
    nextLights[index] = nextEntry;

    return { ok: true, value: { ...json, lights: nextLights } };
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
