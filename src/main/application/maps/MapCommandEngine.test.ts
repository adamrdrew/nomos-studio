import { MapCommandEngine } from './MapCommandEngine';

import type { MapDocument } from '../../../shared/domain/models';
import type { CreateRoomRequest } from '../../../shared/domain/mapRoomCreation';
import type { StampRoomRequest } from '../../../shared/domain/mapRoomStamp';
import type { MapEditCommand } from '../../../shared/ipc/nomosIpc';

function baseMapJson(): Record<string, unknown> {
  return {
    lights: [{ x: 1, y: 2 }],
    particles: [{ x: 3, y: 4 }],
    entities: [{ x: 5, y: 6, yaw_deg: 0, def: 'a' }],
    doors: [{ id: 'door-1', wall_index: 0, tex: 'door.png', starts_closed: false }]
  };
}

function baseMapJsonForDoorCreation(args: { walls: unknown; doors?: unknown }): Record<string, unknown> {
  return {
    walls: args.walls,
    ...(args.doors === undefined ? {} : { doors: args.doors })
  };
}

function baseMapJsonForRoomCreation(): Record<string, unknown> {
  return {
    vertices: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 }
    ],
    sectors: [
      {
        id: 1,
        floor_z: 0,
        ceil_z: 4,
        floor_tex: 'FLOOR.PNG',
        ceil_tex: 'CEIL.PNG',
        light: 1
      }
    ],
    walls: [
      { v0: 0, v1: 1, front_sector: 1, back_sector: -1, tex: 'WALL.PNG' },
      { v0: 1, v1: 2, front_sector: 1, back_sector: -1, tex: 'WALL.PNG' },
      { v0: 2, v1: 3, front_sector: 1, back_sector: -1, tex: 'WALL.PNG' },
      { v0: 3, v1: 0, front_sector: 1, back_sector: -1, tex: 'WALL.PNG' }
    ]
  };
}

function baseCreateRoomDefaults(): Record<string, unknown> {
  return {
    wallTex: 'WALL.PNG',
    floorTex: 'FLOOR.PNG',
    ceilTex: 'CEIL.PNG',
    floorZ: 0,
    ceilZ: 4,
    light: 1
  };
}

function baseStampWallProps(tex: string): StampRoomRequest['wallProps'][number] {
  return {
    tex,
    endLevel: false,
    toggleSector: false,
    toggleSectorId: null,
    toggleSectorOneshot: false,
    toggleSound: null,
    toggleSoundFinish: null
  };
}

function baseStampSectorProps(): StampRoomRequest['sectorProps'] {
  return {
    floorZ: 0,
    floorZToggledPos: null,
    ceilZ: 4,
    floorTex: 'FLOOR.PNG',
    ceilTex: 'CEIL.PNG',
    light: 1
  };
}

function baseDocument(json: unknown): MapDocument {
  return {
    filePath: '/maps/test.json',
    json,
    dirty: false,
    lastValidation: null,
    revision: 1
  };
}

describe('MapCommandEngine', () => {
  it('returns invalid-json when document json is not an object', () => {
    const engine = new MapCommandEngine();

    const result = engine.apply(baseDocument([]), {
      kind: 'map-edit/transaction',
      commands: [{ kind: 'map-edit/delete', target: { kind: 'light', index: 0 } }]
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected failure');
    }
    expect(result.error.code).toBe('map-edit/invalid-json');
  });

  it('returns invalid-json when document json is an object but is not cloneable', () => {
    const engine = new MapCommandEngine();

    const nonCloneableJson = { bad: () => {} };

    const result = engine.apply(baseDocument(nonCloneableJson), {
      kind: 'map-edit/delete',
      target: { kind: 'light', index: 0 }
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected failure');
    }
    expect(result.error.code).toBe('map-edit/invalid-json');
  });

  it('returns transaction-empty when transaction has no commands', () => {
    const engine = new MapCommandEngine();

    const result = engine.apply(baseDocument(baseMapJson()), {
      kind: 'map-edit/transaction',
      commands: []
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected failure');
    }
    expect(result.error.code).toBe('map-edit/transaction-empty');
  });

  it('returns transaction-too-large when transaction exceeds command limit', () => {
    const engine = new MapCommandEngine();

    const commands = Array.from({ length: 101 }, () => ({
      kind: 'map-edit/delete' as const,
      target: { kind: 'light' as const, index: 0 }
    }));

    const result = engine.apply(baseDocument(baseMapJson()), {
      kind: 'map-edit/transaction',
      commands
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected failure');
    }
    expect(result.error.code).toBe('map-edit/transaction-too-large');
  });

  it('returns transaction-step-failed when a transaction command array contains an undefined step', () => {
    const engine = new MapCommandEngine();

    const result = engine.apply(
      baseDocument(baseMapJson()),
      {
        kind: 'map-edit/transaction',
        commands: [undefined]
      } as unknown as Parameters<MapCommandEngine['apply']>[1]
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected failure');
    }
    expect(result.error.code).toBe('map-edit/transaction-step-failed');
    if (result.error.code !== 'map-edit/transaction-step-failed') {
      throw new Error('Expected transaction-step-failed');
    }
    expect(result.error.stepIndex).toBe(0);
  });

  it('applies a single atomic command (non-transaction path)', () => {
    const engine = new MapCommandEngine();

    const result = engine.apply(baseDocument(baseMapJson()), {
      kind: 'map-edit/delete',
      target: { kind: 'light', index: 0 }
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected success');
    }

    expect(result.value.selection).toEqual({ kind: 'map-edit/selection/keep' });
    expect((result.value.nextJson['lights'] as unknown[]).length).toBe(0);
  });

  it('returns the underlying atomic error for a failing non-transaction command', () => {
    const engine = new MapCommandEngine();

    const result = engine.apply(baseDocument(baseMapJson()), {
      kind: 'map-edit/delete',
      target: { kind: 'light', index: 99 }
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected failure');
    }
    expect(result.error.code).toBe('map-edit/not-found');
  });

  describe('set-player-start', () => {
    it('writes player_start onto the map root JSON and keeps selection', () => {
      const engine = new MapCommandEngine();

      const result = engine.apply(baseDocument(baseMapJson()), {
        kind: 'map-edit/set-player-start',
        playerStart: { x: 12.5, y: -3.25, angleDeg: 90 }
      } as unknown as MapEditCommand);

      expect(result.ok).toBe(true);
      if (!result.ok) {
        throw new Error(`Expected success, got: ${result.error.code} ${result.error.message ?? ''}`);
      }

      expect(result.value.selection).toEqual({ kind: 'map-edit/selection/keep' });
      expect(result.value.nextJson['player_start']).toEqual({ x: 12.5, y: -3.25, angle_deg: 90 });
    });

    it('rejects non-finite payload numbers', () => {
      const engine = new MapCommandEngine();

      const result = engine.apply(baseDocument(baseMapJson()), {
        kind: 'map-edit/set-player-start',
        playerStart: { x: 1, y: 2, angleDeg: Number.POSITIVE_INFINITY }
      } as unknown as MapEditCommand);

      expect(result.ok).toBe(false);
      if (result.ok) {
        throw new Error('Expected failure');
      }
      expect(result.error.code).toBe('map-edit/invalid-json');
    });
  });

  describe('set-sector-wall-tex', () => {
    it('updates tex for all walls where front_sector matches sectorId and keeps selection', () => {
      const engine = new MapCommandEngine();

      const result = engine.apply(
        baseDocument({
          walls: [
            { v0: 1, v1: 2, front_sector: 10, back_sector: -1, tex: 'a.png' },
            { v0: 2, v1: 3, front_sector: 10, back_sector: 11, tex: 'a.png' },
            { v0: 3, v1: 4, front_sector: 99, back_sector: -1, tex: 'keep.png' },
            { v0: 4, v1: 5, front_sector: 10, back_sector: null, tex: 'a.png' }
          ]
        }),
        {
          kind: 'map-edit/set-sector-wall-tex',
          sectorId: 10,
          tex: '  b.png  '
        }
      );

      expect(result.ok).toBe(true);
      if (!result.ok) {
        throw new Error(`Expected success, got: ${result.error.code} ${result.error.message ?? ''}`);
      }

      expect(result.value.selection).toEqual({ kind: 'map-edit/selection/keep' });
      expect(result.value.nextJson['walls']).toEqual([
        { v0: 1, v1: 2, front_sector: 10, back_sector: -1, tex: 'b.png' },
        { v0: 2, v1: 3, front_sector: 10, back_sector: 11, tex: 'b.png' },
        { v0: 3, v1: 4, front_sector: 99, back_sector: -1, tex: 'keep.png' },
        { v0: 4, v1: 5, front_sector: 10, back_sector: null, tex: 'b.png' }
      ]);
    });

    it('succeeds as a no-op when there are zero matching walls', () => {
      const engine = new MapCommandEngine();

      const result = engine.apply(
        baseDocument({ walls: [{ v0: 1, v1: 2, front_sector: 1, back_sector: -1, tex: 'keep.png' }] }),
        {
          kind: 'map-edit/set-sector-wall-tex',
          sectorId: 999,
          tex: 'b.png'
        }
      );

      expect(result.ok).toBe(true);
      if (!result.ok) {
        throw new Error('Expected success');
      }

      expect(result.value.selection).toEqual({ kind: 'map-edit/selection/keep' });
      expect(result.value.nextJson['walls']).toEqual([{ v0: 1, v1: 2, front_sector: 1, back_sector: -1, tex: 'keep.png' }]);
    });

    it('ignores malformed wall entries and still updates matching walls', () => {
      const engine = new MapCommandEngine();

      const result = engine.apply(
        baseDocument({
          walls: [
            null,
            123,
            'not-a-wall',
            { v0: 0, v1: 1, front_sector: 10, back_sector: -1, tex: 'a.png' },
            { v0: 1, v1: 2, front_sector: '10', back_sector: -1, tex: 'keep.png' },
            { v0: 2, v1: 3, front_sector: Number.NaN, back_sector: -1, tex: 'keep.png' },
            { v0: 3, v1: 4, front_sector: 10.5, back_sector: -1, tex: 'keep.png' },
            { v0: 4, v1: 5, front_sector: 99, back_sector: -1, tex: 'keep.png' },
            { v0: 5, v1: 6, front_sector: 10, back_sector: -1, tex: 'a.png' }
          ]
        }),
        {
          kind: 'map-edit/set-sector-wall-tex',
          sectorId: 10,
          tex: 'b.png'
        }
      );

      expect(result.ok).toBe(true);
      if (!result.ok) {
        throw new Error('Expected success');
      }

      expect(result.value.selection).toEqual({ kind: 'map-edit/selection/keep' });
      expect(result.value.nextJson['walls']).toEqual([
        null,
        123,
        'not-a-wall',
        { v0: 0, v1: 1, front_sector: 10, back_sector: -1, tex: 'b.png' },
        { v0: 1, v1: 2, front_sector: '10', back_sector: -1, tex: 'keep.png' },
        { v0: 2, v1: 3, front_sector: Number.NaN, back_sector: -1, tex: 'keep.png' },
        { v0: 3, v1: 4, front_sector: 10.5, back_sector: -1, tex: 'keep.png' },
        { v0: 4, v1: 5, front_sector: 99, back_sector: -1, tex: 'keep.png' },
        { v0: 5, v1: 6, front_sector: 10, back_sector: -1, tex: 'b.png' }
      ]);
    });

    it('returns invalid-json when walls is missing or not an array', () => {
      const engine = new MapCommandEngine();

      const missingWalls = engine.apply(baseDocument(baseMapJson()), {
        kind: 'map-edit/set-sector-wall-tex',
        sectorId: 10,
        tex: 'b.png'
      });

      expect(missingWalls.ok).toBe(false);
      if (missingWalls.ok) {
        throw new Error('Expected failure');
      }
      expect(missingWalls.error.code).toBe('map-edit/invalid-json');

      const nonArrayWalls = engine.apply(
        baseDocument({
          walls: {}
        }),
        {
          kind: 'map-edit/set-sector-wall-tex',
          sectorId: 10,
          tex: 'b.png'
        }
      );

      expect(nonArrayWalls.ok).toBe(false);
      if (nonArrayWalls.ok) {
        throw new Error('Expected failure');
      }
      expect(nonArrayWalls.error.code).toBe('map-edit/invalid-json');
    });

    it('returns invalid-json when sectorId is not a non-negative integer', () => {
      const engine = new MapCommandEngine();

      const invalidSectorIds = [Number.POSITIVE_INFINITY, -1, 1.5];
      for (const sectorId of invalidSectorIds) {
        const result = engine.apply(baseDocument({ walls: [] }), {
          kind: 'map-edit/set-sector-wall-tex',
          sectorId,
          tex: 'b.png'
        } as unknown as MapEditCommand);

        expect(result.ok).toBe(false);
        if (result.ok) {
          throw new Error('Expected failure');
        }
        expect(result.error.code).toBe('map-edit/invalid-json');
      }
    });

    it('returns invalid-json when tex is empty or whitespace-only', () => {
      const engine = new MapCommandEngine();

      const invalidTextures = ['', '   '];
      for (const tex of invalidTextures) {
        const result = engine.apply(baseDocument({ walls: [] }), {
          kind: 'map-edit/set-sector-wall-tex',
          sectorId: 10,
          tex
        } as unknown as MapEditCommand);

        expect(result.ok).toBe(false);
        if (result.ok) {
          throw new Error('Expected failure');
        }
        expect(result.error.code).toBe('map-edit/invalid-json');
      }
    });
  });

  describe('create-entity', () => {
    it('creates entities array when missing, appends a placement, and selects the new entity', () => {
      const engine = new MapCommandEngine();

      const result = engine.apply(baseDocument({ lights: [], particles: [] }), {
        kind: 'map-edit/create-entity',
        at: { x: 10, y: 20 },
        def: 'Imp'
      });

      expect(result.ok).toBe(true);
      if (!result.ok) {
        throw new Error(`Expected success, got: ${result.error.code} ${result.error.message ?? ''}`);
      }

      expect(result.value.selection).toEqual({ kind: 'map-edit/selection/set', ref: { kind: 'entity', index: 0 } });
      expect(result.value.nextJson['entities']).toEqual([{ x: 10, y: 20, def: 'Imp', yaw_deg: 0 }]);
    });

    it('appends to an existing entities array and selects the appended index', () => {
      const engine = new MapCommandEngine();

      const result = engine.apply(baseDocument(baseMapJson()), {
        kind: 'map-edit/create-entity',
        at: { x: -1.5, y: 2.25 },
        def: 'Shambler',
        yawDeg: 90
      });

      expect(result.ok).toBe(true);
      if (!result.ok) {
        throw new Error(`Expected success, got: ${result.error.code} ${result.error.message ?? ''}`);
      }

      expect(result.value.selection).toEqual({ kind: 'map-edit/selection/set', ref: { kind: 'entity', index: 1 } });

      const entities = result.value.nextJson['entities'];
      expect(Array.isArray(entities)).toBe(true);
      if (!Array.isArray(entities)) {
        throw new Error('Expected entities to be an array');
      }
      expect(entities.length).toBe(2);
      expect(entities[1]).toEqual({ x: -1.5, y: 2.25, def: 'Shambler', yaw_deg: 90 });
    });

    it('rejects non-finite x/y', () => {
      const engine = new MapCommandEngine();

      const result = engine.apply(baseDocument(baseMapJson()), {
        kind: 'map-edit/create-entity',
        at: { x: Number.POSITIVE_INFINITY, y: 1 },
        def: 'Imp'
      });

      expect(result.ok).toBe(false);
      if (result.ok) {
        throw new Error('Expected failure');
      }
      expect(result.error.code).toBe('map-edit/invalid-json');
    });

    it('rejects empty def', () => {
      const engine = new MapCommandEngine();

      const result = engine.apply(baseDocument(baseMapJson()), {
        kind: 'map-edit/create-entity',
        at: { x: 1, y: 2 },
        def: '   '
      });

      expect(result.ok).toBe(false);
      if (result.ok) {
        throw new Error('Expected failure');
      }
      expect(result.error.code).toBe('map-edit/invalid-json');
    });

    it('rejects non-finite yawDeg when provided', () => {
      const engine = new MapCommandEngine();

      const result = engine.apply(baseDocument(baseMapJson()), {
        kind: 'map-edit/create-entity',
        at: { x: 1, y: 2 },
        def: 'Imp',
        yawDeg: Number.NaN
      });

      expect(result.ok).toBe(false);
      if (result.ok) {
        throw new Error('Expected failure');
      }
      expect(result.error.code).toBe('map-edit/invalid-json');
    });

    it('rejects invalid json when entities exists but is not an array', () => {
      const engine = new MapCommandEngine();

      const result = engine.apply(baseDocument({ entities: {} }), {
        kind: 'map-edit/create-entity',
        at: { x: 1, y: 2 },
        def: 'Imp'
      });

      expect(result.ok).toBe(false);
      if (result.ok) {
        throw new Error('Expected failure');
      }
      expect(result.error.code).toBe('map-edit/invalid-json');
    });
  });

  describe('create-room', () => {
    it('still allows creating additional rooms after an adjacent join that uses the full target wall as the portal', () => {
      const engine = new MapCommandEngine();

      // Start with a single 10x10 sector (id=1) bounded by 4 walls.
      const json1 = baseMapJsonForRoomCreation();

      // Create an adjacent room below wall 0 (the bottom wall y=0), wide enough that the overlap covers the full wall.
      const result2 = engine.apply(baseDocument(json1), {
        kind: 'map-edit/create-room',
        request: {
          template: 'rectangle',
          // Exact alignment: top edge lies on y=0 and spans x=0..10
          center: { x: 5, y: -1 },
          size: { width: 10, height: 2 },
          rotationQuarterTurns: 0,
          defaults: baseCreateRoomDefaults(),
          placement: { kind: 'room-placement/adjacent', targetWallIndex: 0, snapDistancePx: 10 }
        } as unknown as CreateRoomRequest
      } as unknown as MapEditCommand);

      if (!result2.ok) {
        throw new Error(`Expected adjacent create-room success, got: ${result2.error.code} ${result2.error.message ?? ''}`);
      }

      // Now create a nested room inside the newly created sector (id=2).
      const result3 = engine.apply(baseDocument(result2.value.nextJson), {
        kind: 'map-edit/create-room',
        request: {
          template: 'square',
          center: { x: 5, y: -1 },
          size: { width: 1.5, height: 1.5 },
          rotationQuarterTurns: 0,
          defaults: baseCreateRoomDefaults(),
          placement: { kind: 'room-placement/nested', enclosingSectorId: 2 }
        } as unknown as CreateRoomRequest
      } as unknown as MapEditCommand);

      expect(result3.ok).toBe(true);
    });

    it('creates a seed room on an empty map and selects the new sector', () => {
      const engine = new MapCommandEngine();

      const result = engine.apply(
        baseDocument({ vertices: [], sectors: [], walls: [] }),
        {
          kind: 'map-edit/create-room',
          request: {
            template: 'rectangle',
            center: { x: 5, y: 5 },
            size: { width: 4, height: 4 },
            rotationQuarterTurns: 0,
            defaults: baseCreateRoomDefaults(),
            placement: { kind: 'room-placement/seed' }
          } as unknown as CreateRoomRequest
        } as unknown as MapEditCommand
      );

      expect(result.ok).toBe(true);
      if (!result.ok) {
        throw new Error('Expected success');
      }

      expect(result.value.selection.kind).toBe('map-edit/selection/set');
      if (result.value.selection.kind !== 'map-edit/selection/set') {
        throw new Error('Expected selection/set');
      }
      expect(result.value.selection.ref).toEqual({ kind: 'sector', id: 0 });

      const next = result.value.nextJson;
      expect((next['sectors'] as unknown[]).length).toBe(1);
      expect((next['walls'] as unknown[]).length).toBe(4);
      expect((next['vertices'] as unknown[]).length).toBe(4);

      const walls = next['walls'] as Record<string, unknown>[];
      for (const wall of walls) {
        expect(wall['front_sector']).toBe(0);
        expect(wall['back_sector']).toBe(-1);
        expect(wall['tex']).toBe('WALL.PNG');
      }
    });

    it('allocates sector ids starting at 0 and then increments (seed then nested)', () => {
      const engine = new MapCommandEngine();

      const seedResult = engine.apply(
        baseDocument({ vertices: [], sectors: [], walls: [] }),
        {
          kind: 'map-edit/create-room',
          request: {
            template: 'rectangle',
            center: { x: 5, y: 5 },
            size: { width: 4, height: 4 },
            rotationQuarterTurns: 0,
            defaults: baseCreateRoomDefaults(),
            placement: { kind: 'room-placement/seed' }
          } as unknown as CreateRoomRequest
        } as unknown as MapEditCommand
      );

      expect(seedResult.ok).toBe(true);
      if (!seedResult.ok) {
        throw new Error('Expected seed create-room success');
      }

      expect(seedResult.value.selection.kind).toBe('map-edit/selection/set');
      if (seedResult.value.selection.kind !== 'map-edit/selection/set') {
        throw new Error('Expected selection/set');
      }
      expect(seedResult.value.selection.ref).toEqual({ kind: 'sector', id: 0 });

      const nestedResult = engine.apply(baseDocument(seedResult.value.nextJson), {
        kind: 'map-edit/create-room',
        request: {
          template: 'square',
          center: { x: 5, y: 5 },
          size: { width: 1.5, height: 1.5 },
          rotationQuarterTurns: 0,
          defaults: baseCreateRoomDefaults(),
          placement: { kind: 'room-placement/nested', enclosingSectorId: 0 }
        } as unknown as CreateRoomRequest
      } as unknown as MapEditCommand);

      expect(nestedResult.ok).toBe(true);
      if (!nestedResult.ok) {
        throw new Error(`Expected nested create-room success, got: ${nestedResult.error.code} ${nestedResult.error.message ?? ''}`);
      }

      expect(nestedResult.value.selection.kind).toBe('map-edit/selection/set');
      if (nestedResult.value.selection.kind !== 'map-edit/selection/set') {
        throw new Error('Expected selection/set');
      }
      expect(nestedResult.value.selection.ref).toEqual({ kind: 'sector', id: 1 });

      const next = nestedResult.value.nextJson;
      expect((next['sectors'] as unknown[]).length).toBe(2);
    });

    it('rejects seed placement when the map is not empty', () => {
      const engine = new MapCommandEngine();
      const json = baseMapJsonForRoomCreation();

      const result = engine.apply(baseDocument(json), {
        kind: 'map-edit/create-room',
        request: {
          template: 'rectangle',
          center: { x: 5, y: 5 },
          size: { width: 4, height: 4 },
          rotationQuarterTurns: 0,
          defaults: baseCreateRoomDefaults(),
          placement: { kind: 'room-placement/seed' }
        } as unknown as CreateRoomRequest
      } as unknown as MapEditCommand);

      expect(result.ok).toBe(false);
      if (result.ok) {
        throw new Error('Expected failure');
      }
      expect(result.error.code).toBe('map-edit/create-room/invalid-request');
    });

    it('creates a nested rectangle room and selects the new sector', () => {
      const engine = new MapCommandEngine();
      const json = baseMapJsonForRoomCreation();

      const result = engine.apply(baseDocument(json), {
        kind: 'map-edit/create-room',
        request: {
          template: 'rectangle',
          center: { x: 5, y: 5 },
          size: { width: 4, height: 4 },
          rotationQuarterTurns: 0,
          defaults: baseCreateRoomDefaults(),
          placement: { kind: 'room-placement/nested', enclosingSectorId: 1 }
        } as unknown as CreateRoomRequest
      } as unknown as MapEditCommand);

      expect(result.ok).toBe(true);
      if (!result.ok) {
        throw new Error('Expected success');
      }

      expect(result.value.selection.kind).toBe('map-edit/selection/set');
      if (result.value.selection.kind !== 'map-edit/selection/set') {
        throw new Error('Expected selection/set');
      }
      expect(result.value.selection.ref).toEqual({ kind: 'sector', id: 2 });

      const next = result.value.nextJson;
      expect((next['sectors'] as unknown[]).length).toBe(2);

      const walls = next['walls'] as unknown[];
      expect(walls.length).toBe(8);
      const newWalls = walls.slice(4) as Record<string, unknown>[];
      for (const wall of newWalls) {
        expect(wall['front_sector']).toBe(2);
        expect(wall['back_sector']).toBe(1);
        expect(wall['tex']).toBe('WALL.PNG');
      }
    });

    it('creates an adjacent room joined by a portal without reordering existing walls', () => {
      const engine = new MapCommandEngine();
      const json = baseMapJsonForRoomCreation();
      const originalWalls = (json['walls'] as unknown[]).map((w) => ({ ...(w as Record<string, unknown>) }));

      const result = engine.apply(baseDocument(json), {
        kind: 'map-edit/create-room',
        request: {
          template: 'rectangle',
          center: { x: 5, y: -1.1 },
          size: { width: 6, height: 2 },
          rotationQuarterTurns: 0,
          defaults: baseCreateRoomDefaults(),
          placement: { kind: 'room-placement/adjacent', targetWallIndex: 0, snapDistancePx: 10 }
        } as unknown as CreateRoomRequest
      } as unknown as MapEditCommand);

      expect(result.ok).toBe(true);
      if (!result.ok) {
        throw new Error('Expected success');
      }

      const nextWalls = result.value.nextJson['walls'] as unknown[];
      // Wall splitting depends on whether the planned portal endpoints align with existing vertices.
      // In the common case where the portal coincides with a room edge, we should still end up with at least
      // the original 4 walls plus the 4 new room walls.
      expect(nextWalls.length).toBeGreaterThanOrEqual(8);

      // Indices 1..3 should remain the same walls.
      expect(nextWalls[1]).toEqual(originalWalls[1]);
      expect(nextWalls[2]).toEqual(originalWalls[2]);
      expect(nextWalls[3]).toEqual(originalWalls[3]);

      // Index 0 becomes the portal wall to the new sector.
      const wall0 = nextWalls[0] as Record<string, unknown>;
      expect(wall0['front_sector']).toBe(1);
      expect(wall0['back_sector']).toBe(2);

      // New room should contain a portal segment back to sector 1.
      const roomPortalCount = nextWalls.filter((w) => {
        if (typeof w !== 'object' || w === null) {
          return false;
        }
        const rec = w as Record<string, unknown>;
        return rec['front_sector'] === 2 && rec['back_sector'] === 1;
      }).length;
      expect(roomPortalCount).toBeGreaterThanOrEqual(1);
    });

    it('rejects invalid json when vertices/walls/sectors are missing', () => {
      const engine = new MapCommandEngine();

      const result = engine.apply(baseDocument({}), {
        kind: 'map-edit/create-room',
        request: {
          template: 'rectangle',
          center: { x: 5, y: 5 },
          size: { width: 4, height: 4 },
          rotationQuarterTurns: 0,
          defaults: baseCreateRoomDefaults(),
          placement: { kind: 'room-placement/nested', enclosingSectorId: 1 }
        } as unknown as CreateRoomRequest
      } as unknown as MapEditCommand);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('map-edit/invalid-json');
      }
    });

    it('rejects invalid size', () => {
      const engine = new MapCommandEngine();
      const json = baseMapJsonForRoomCreation();

      const result = engine.apply(baseDocument(json), {
        kind: 'map-edit/create-room',
        request: {
          template: 'rectangle',
          center: { x: 5, y: 5 },
          size: { width: 0.5, height: 0.5 },
          rotationQuarterTurns: 0,
          defaults: baseCreateRoomDefaults(),
          placement: { kind: 'room-placement/nested', enclosingSectorId: 1 }
        } as unknown as CreateRoomRequest
      } as unknown as MapEditCommand);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('map-edit/create-room/invalid-size');
      }
    });

    it('rejects create-room when defaults do not include enough textures', () => {
      const engine = new MapCommandEngine();
      const json = baseMapJsonForRoomCreation();
      const before = JSON.parse(JSON.stringify(json)) as unknown;

      const result = engine.apply(baseDocument(json), {
        kind: 'map-edit/create-room',
        request: {
          template: 'rectangle',
          center: { x: 5, y: 5 },
          size: { width: 4, height: 4 },
          rotationQuarterTurns: 0,
          defaults: {
            ...baseCreateRoomDefaults(),
            wallTex: '',
            floorTex: 'FLOOR.PNG',
            ceilTex: 'CEIL.PNG'
          },
          placement: { kind: 'room-placement/nested', enclosingSectorId: 1 }
        } as unknown as CreateRoomRequest
      } as unknown as MapEditCommand);

      expect(result.ok).toBe(false);
      if (result.ok) {
        throw new Error('Expected failure');
      }
      expect(result.error.code).toBe('map-edit/create-room/not-enough-textures');
      expect(json).toEqual(before);
    });

    it('rejects nested placement when the room is not fully inside the requested enclosing sector', () => {
      const engine = new MapCommandEngine();
      const json = baseMapJsonForRoomCreation();
      const before = JSON.parse(JSON.stringify(json)) as unknown;

      // Center far outside the sector 0..10 bounds.
      const result = engine.apply(baseDocument(json), {
        kind: 'map-edit/create-room',
        request: {
          template: 'rectangle',
          center: { x: 50, y: 50 },
          size: { width: 4, height: 4 },
          rotationQuarterTurns: 0,
          defaults: baseCreateRoomDefaults(),
          placement: { kind: 'room-placement/nested', enclosingSectorId: 1 }
        } as unknown as CreateRoomRequest
      } as unknown as MapEditCommand);

      expect(result.ok).toBe(false);
      if (result.ok) {
        throw new Error('Expected failure');
      }
      expect(result.error.code).toBe('map-edit/create-room/not-inside-any-sector');
      expect(json).toEqual(before);
    });

    it('rejects adjacent placement when snapDistancePx exceeds threshold', () => {
      const engine = new MapCommandEngine();
      const json = baseMapJsonForRoomCreation();

      const result = engine.apply(baseDocument(json), {
        kind: 'map-edit/create-room',
        request: {
          template: 'rectangle',
          center: { x: 5, y: -1.1 },
          size: { width: 6, height: 2 },
          rotationQuarterTurns: 0,
          defaults: baseCreateRoomDefaults(),
          placement: { kind: 'room-placement/adjacent', targetWallIndex: 0, snapDistancePx: 13 }
        } as unknown as CreateRoomRequest
      } as unknown as MapEditCommand);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('map-edit/create-room/adjacent-too-far');
      }
    });

    it('rejects nested placement when the room intersects existing walls', () => {
      const engine = new MapCommandEngine();
      const json: Record<string, unknown> = {
        vertices: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 },
          { x: 5, y: 0 },
          { x: 5, y: 10 }
        ],
        sectors: [
          {
            id: 1,
            floor_z: 0,
            ceil_z: 4,
            floor_tex: 'FLOOR.PNG',
            ceil_tex: 'CEIL.PNG',
            light: 1
          }
        ],
        walls: [
          { v0: 0, v1: 1, front_sector: 1, back_sector: -1, tex: 'WALL.PNG' },
          { v0: 1, v1: 2, front_sector: 1, back_sector: -1, tex: 'WALL.PNG' },
          { v0: 2, v1: 3, front_sector: 1, back_sector: -1, tex: 'WALL.PNG' },
          { v0: 3, v1: 0, front_sector: 1, back_sector: -1, tex: 'WALL.PNG' },
          { v0: 4, v1: 5, front_sector: 999, back_sector: -1, tex: 'WALL.PNG' }
        ]
      };

      const result = engine.apply(baseDocument(json), {
        kind: 'map-edit/create-room',
        request: {
          template: 'rectangle',
          center: { x: 5, y: 5 },
          size: { width: 6, height: 2 },
          rotationQuarterTurns: 0,
          defaults: baseCreateRoomDefaults(),
          placement: { kind: 'room-placement/nested', enclosingSectorId: 1 }
        } as unknown as CreateRoomRequest
      } as unknown as MapEditCommand);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('map-edit/create-room/intersects-walls');
      }
    });

    it('rejects adjacent placement when target wall is non-collinear with room edges', () => {
      const engine = new MapCommandEngine();
      const json: Record<string, unknown> = {
        vertices: [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
          { x: 10, y: 0 }
        ],
        sectors: [
          {
            id: 1,
            floor_z: 0,
            ceil_z: 4,
            floor_tex: 'FLOOR.PNG',
            ceil_tex: 'CEIL.PNG',
            light: 1
          }
        ],
        walls: [{ v0: 0, v1: 1, front_sector: 1, back_sector: -1, tex: 'WALL.PNG' }]
      };

      const result = engine.apply(baseDocument(json), {
        kind: 'map-edit/create-room',
        request: {
          template: 'rectangle',
          center: { x: 5, y: -1.1 },
          size: { width: 6, height: 2 },
          rotationQuarterTurns: 0,
          defaults: baseCreateRoomDefaults(),
          placement: { kind: 'room-placement/adjacent', targetWallIndex: 0, snapDistancePx: 10 }
        } as unknown as CreateRoomRequest
      } as unknown as MapEditCommand);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('map-edit/create-room/non-collinear');
      }
    });

    it('rejects adjacent placement when a door is already bound to the target wall_index', () => {
      const engine = new MapCommandEngine();
      const json: Record<string, unknown> = {
        ...baseMapJsonForRoomCreation(),
        doors: [{ wall_index: 0 }]
      };
      const before = JSON.parse(JSON.stringify(json)) as unknown;

      const result = engine.apply(baseDocument(json), {
        kind: 'map-edit/create-room',
        request: {
          template: 'rectangle',
          center: { x: 5, y: -1.1 },
          size: { width: 6, height: 2 },
          rotationQuarterTurns: 0,
          defaults: baseCreateRoomDefaults(),
          placement: { kind: 'room-placement/adjacent', targetWallIndex: 0, snapDistancePx: 10 }
        } as unknown as CreateRoomRequest
      } as unknown as MapEditCommand);

      expect(result.ok).toBe(false);
      if (result.ok) {
        throw new Error('Expected failure');
      }
      expect(result.error.code).toBe('map-edit/create-room/invalid-request');
      expect(json).toEqual(before);
    });
  });

  describe('stamp-room', () => {
    it('creates a nested concave stamped room, copies properties, and selects the new sector', () => {
      const engine = new MapCommandEngine();
      const json = baseMapJsonForRoomCreation();

      const polygon = [
        { x: 2, y: 2 },
        { x: 8, y: 2 },
        { x: 8, y: 4 },
        { x: 4, y: 4 },
        { x: 4, y: 8 },
        { x: 2, y: 8 }
      ];

      const wallProps: StampRoomRequest['wallProps'] = ['A.PNG', 'B.PNG', 'C.PNG', 'D.PNG', 'E.PNG', 'F.PNG'].map((tex, index) => {
        const base = baseStampWallProps(tex);
        if (index !== 0) {
          return base;
        }
        return {
          ...base,
          endLevel: true,
          toggleSector: true,
          toggleSectorId: 123,
          toggleSectorOneshot: true,
          toggleSound: 'sound.wav',
          toggleSoundFinish: 'finish.wav'
        };
      });

      const request: StampRoomRequest = {
        polygon,
        wallProps,
        sectorProps: {
          ...baseStampSectorProps(),
          floorZToggledPos: 7
        },
        placement: { kind: 'room-placement/nested', enclosingSectorId: 1 }
      };

      const result = engine.apply(baseDocument(json), {
        kind: 'map-edit/stamp-room',
        request
      } as unknown as MapEditCommand);

      expect(result.ok).toBe(true);
      if (!result.ok) {
        throw new Error(`Expected success, got: ${result.error.code} ${result.error.message ?? ''}`);
      }

      expect(result.value.selection.kind).toBe('map-edit/selection/set');
      if (result.value.selection.kind !== 'map-edit/selection/set') {
        throw new Error('Expected selection/set');
      }
      expect(result.value.selection.ref).toEqual({ kind: 'sector', id: 2 });

      const next = result.value.nextJson;
      expect((next['sectors'] as unknown[]).length).toBe(2);
      const sectors = next['sectors'] as Record<string, unknown>[];
      const newSector = sectors.find((s) => s['id'] === 2);
      if (!newSector) {
        throw new Error('Expected sector id=2');
      }
      expect(newSector['floor_z']).toBe(0);
      expect(newSector['ceil_z']).toBe(4);
      expect(newSector['floor_tex']).toBe('FLOOR.PNG');
      expect(newSector['ceil_tex']).toBe('CEIL.PNG');
      expect(newSector['light']).toBe(1);
      expect(newSector['floor_z_toggled_pos']).toBe(7);

      const walls = next['walls'] as Record<string, unknown>[];
      expect(walls.length).toBe(4 + polygon.length);
      const newWalls = walls.slice(4);
      for (let i = 0; i < newWalls.length; i += 1) {
        const w = newWalls[i];
        if (!w) {
          throw new Error(`Expected wall at index ${i}`);
        }
        expect(w['front_sector']).toBe(2);
        expect(w['back_sector']).toBe(1);
        expect(w['tex']).toBe(wallProps[i]?.tex);
      }

      const w0 = newWalls[0];
      if (!w0) {
        throw new Error('Expected first new wall');
      }
      expect(w0['end_level']).toBe(true);
      expect(w0['toggle_sector']).toBe(true);
      expect(w0['toggle_sector_id']).toBe(123);
      expect(w0['toggle_sector_oneshot']).toBe(true);
      expect(w0['toggle_sound']).toBe('sound.wav');
      expect(w0['toggle_sound_finish']).toBe('finish.wav');
    });

    it('creates an adjacent stamped room joined by a portal without reordering existing walls', () => {
      const engine = new MapCommandEngine();
      const json = baseMapJsonForRoomCreation();
      const originalWalls = (json['walls'] as unknown[]).map((w) => ({ ...(w as Record<string, unknown>) }));

      const polygon = [
        { x: 2, y: 0 },
        { x: 8, y: 0 },
        { x: 8, y: -2 },
        { x: 2, y: -2 }
      ];

      const wallProps: StampRoomRequest['wallProps'] = ['TOP.PNG', 'RIGHT.PNG', 'BOTTOM.PNG', 'LEFT.PNG'].map((tex) => baseStampWallProps(tex));

      const request: StampRoomRequest = {
        polygon,
        wallProps,
        sectorProps: baseStampSectorProps(),
        placement: { kind: 'room-placement/adjacent', targetWallIndex: 0, snapDistancePx: 10 }
      };

      const result = engine.apply(baseDocument(json), {
        kind: 'map-edit/stamp-room',
        request
      } as unknown as MapEditCommand);

      expect(result.ok).toBe(true);
      if (!result.ok) {
        throw new Error(`Expected success, got: ${result.error.code} ${result.error.message ?? ''}`);
      }

      const nextWalls = result.value.nextJson['walls'] as unknown[];
      expect(nextWalls.length).toBeGreaterThanOrEqual(8);

      expect(nextWalls[1]).toEqual(originalWalls[1]);
      expect(nextWalls[2]).toEqual(originalWalls[2]);
      expect(nextWalls[3]).toEqual(originalWalls[3]);

      const wall0 = nextWalls[0] as Record<string, unknown>;
      expect(wall0['front_sector']).toBe(1);
      expect(wall0['back_sector']).toBe(2);

      const roomPortalCount = nextWalls.filter((w) => {
        if (typeof w !== 'object' || w === null) {
          return false;
        }
        const rec = w as Record<string, unknown>;
        return rec['front_sector'] === 2 && rec['back_sector'] === 1;
      }).length;
      expect(roomPortalCount).toBeGreaterThanOrEqual(1);

      const roomPortalWall = nextWalls.find((w) => {
        if (typeof w !== 'object' || w === null) {
          return false;
        }
        const rec = w as Record<string, unknown>;
        return rec['front_sector'] === 2 && rec['back_sector'] === 1;
      }) as Record<string, unknown> | undefined;
      expect(roomPortalWall?.['tex']).toBe('TOP.PNG');
    });

    it('accepts empty texture strings in the stamp payload (for compatibility with existing authored maps)', () => {
      const engine = new MapCommandEngine();
      const json = baseMapJsonForRoomCreation();

      const polygon = [
        { x: 2, y: 2 },
        { x: 8, y: 2 },
        { x: 8, y: 8 },
        { x: 2, y: 8 }
      ];

      const wallProps: StampRoomRequest['wallProps'] = polygon.map(() => ({
        ...baseStampWallProps('WALL.PNG'),
        tex: ''
      }));

      const request: StampRoomRequest = {
        polygon,
        wallProps,
        sectorProps: {
          ...baseStampSectorProps(),
          floorTex: '',
          ceilTex: ''
        },
        placement: { kind: 'room-placement/nested', enclosingSectorId: 1 }
      };

      const result = engine.apply(baseDocument(json), {
        kind: 'map-edit/stamp-room',
        request
      } as unknown as MapEditCommand);

      expect(result.ok).toBe(true);
      if (!result.ok) {
        throw new Error(`Expected success, got: ${result.error.code} ${result.error.message ?? ''}`);
      }
    });

    it('omits optional wall fields when their values are default/null', () => {
      const engine = new MapCommandEngine();
      const json = baseMapJsonForRoomCreation();

      const polygon = [
        { x: 2, y: 2 },
        { x: 8, y: 2 },
        { x: 8, y: 8 },
        { x: 2, y: 8 }
      ];

      const wallProps: StampRoomRequest['wallProps'] = ['A.PNG', 'B.PNG', 'C.PNG', 'D.PNG'].map((tex) => baseStampWallProps(tex));

      const request: StampRoomRequest = {
        polygon,
        wallProps,
        sectorProps: baseStampSectorProps(),
        placement: { kind: 'room-placement/nested', enclosingSectorId: 1 }
      };

      const result = engine.apply(baseDocument(json), {
        kind: 'map-edit/stamp-room',
        request
      } as unknown as MapEditCommand);

      expect(result.ok).toBe(true);
      if (!result.ok) {
        throw new Error(`Expected success, got: ${result.error.code} ${result.error.message ?? ''}`);
      }

      const walls = result.value.nextJson['walls'] as Record<string, unknown>[];
      const newWalls = walls.slice(4);
      expect(newWalls).toHaveLength(4);

      const first = newWalls[0];
      if (!first) {
        throw new Error('Expected first new wall');
      }

      expect(first['tex']).toBe('A.PNG');
      expect(first['end_level']).toBeUndefined();
      expect(first['toggle_sector']).toBeUndefined();
      expect(first['toggle_sector_id']).toBeUndefined();
      expect(first['toggle_sector_oneshot']).toBeUndefined();
      expect(first['toggle_sound']).toBeUndefined();
      expect(first['toggle_sound_finish']).toBeUndefined();
    });

    it('rejects malformed payload when wallProps count does not match polygon edge count', () => {
      const engine = new MapCommandEngine();
      const json = baseMapJsonForRoomCreation();

      const result = engine.apply(baseDocument(json), {
        kind: 'map-edit/stamp-room',
        request: {
          polygon: [
            { x: 2, y: 2 },
            { x: 8, y: 2 },
            { x: 8, y: 8 },
            { x: 2, y: 8 }
          ],
          wallProps: [baseStampWallProps('A.PNG'), baseStampWallProps('B.PNG'), baseStampWallProps('C.PNG')],
          sectorProps: baseStampSectorProps(),
          placement: { kind: 'room-placement/nested', enclosingSectorId: 1 }
        }
      } as unknown as MapEditCommand);

      expect(result.ok).toBe(false);
      if (result.ok) {
        throw new Error('Expected failure');
      }
      expect(result.error.code).toBe('map-edit/stamp-room/invalid-request');
    });

    it('rejects nested placement when the stamped room intersects existing walls', () => {
      const engine = new MapCommandEngine();
      const json: Record<string, unknown> = {
        vertices: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 },
          { x: 5, y: 0 },
          { x: 5, y: 10 }
        ],
        sectors: [
          {
            id: 1,
            floor_z: 0,
            ceil_z: 4,
            floor_tex: 'FLOOR.PNG',
            ceil_tex: 'CEIL.PNG',
            light: 1
          }
        ],
        walls: [
          { v0: 0, v1: 1, front_sector: 1, back_sector: -1, tex: 'WALL.PNG' },
          { v0: 1, v1: 2, front_sector: 1, back_sector: -1, tex: 'WALL.PNG' },
          { v0: 2, v1: 3, front_sector: 1, back_sector: -1, tex: 'WALL.PNG' },
          { v0: 3, v1: 0, front_sector: 1, back_sector: -1, tex: 'WALL.PNG' },
          { v0: 4, v1: 5, front_sector: 999, back_sector: -1, tex: 'WALL.PNG' }
        ]
      };

      const polygon = [
        { x: 4, y: 2 },
        { x: 6, y: 2 },
        { x: 6, y: 8 },
        { x: 4, y: 8 }
      ];

      const result = engine.apply(baseDocument(json), {
        kind: 'map-edit/stamp-room',
        request: {
          polygon,
          wallProps: polygon.map((_, i) => baseStampWallProps(`W${i}.PNG`)),
          sectorProps: baseStampSectorProps(),
          placement: { kind: 'room-placement/nested', enclosingSectorId: 1 }
        }
      } as unknown as MapEditCommand);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('map-edit/stamp-room/intersects-walls');
      }
    });

    it('rejects adjacent placement when snapDistancePx exceeds threshold', () => {
      const engine = new MapCommandEngine();
      const json = baseMapJsonForRoomCreation();

      const polygon = [
        { x: 2, y: 0 },
        { x: 8, y: 0 },
        { x: 8, y: -2 },
        { x: 2, y: -2 }
      ];

      const result = engine.apply(baseDocument(json), {
        kind: 'map-edit/stamp-room',
        request: {
          polygon,
          wallProps: polygon.map((_, i) => baseStampWallProps(`W${i}.PNG`)),
          sectorProps: baseStampSectorProps(),
          placement: { kind: 'room-placement/adjacent', targetWallIndex: 0, snapDistancePx: 13 }
        }
      } as unknown as MapEditCommand);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('map-edit/stamp-room/adjacent-too-far');
      }
    });

    it('rejects adjacent placement when target wall does not exist', () => {
      const engine = new MapCommandEngine();
      const json = baseMapJsonForRoomCreation();

      const polygon = [
        { x: 2, y: 0 },
        { x: 8, y: 0 },
        { x: 8, y: -2 },
        { x: 2, y: -2 }
      ];

      const result = engine.apply(baseDocument(json), {
        kind: 'map-edit/stamp-room',
        request: {
          polygon,
          wallProps: polygon.map((_, i) => baseStampWallProps(`W${i}.PNG`)),
          sectorProps: baseStampSectorProps(),
          placement: { kind: 'room-placement/adjacent', targetWallIndex: 999, snapDistancePx: 10 }
        }
      } as unknown as MapEditCommand);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('map-edit/stamp-room/no-snap-target');
      }
    });

    it('rejects adjacent placement when target wall is non-collinear with room edges', () => {
      const engine = new MapCommandEngine();
      const json: Record<string, unknown> = {
        vertices: [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
          { x: 10, y: 0 }
        ],
        sectors: [
          {
            id: 1,
            floor_z: 0,
            ceil_z: 4,
            floor_tex: 'FLOOR.PNG',
            ceil_tex: 'CEIL.PNG',
            light: 1
          }
        ],
        walls: [{ v0: 0, v1: 1, front_sector: 1, back_sector: -1, tex: 'WALL.PNG' }]
      };

      const polygon = [
        { x: 2, y: 0 },
        { x: 8, y: 0 },
        { x: 8, y: -2 },
        { x: 2, y: -2 }
      ];

      const result = engine.apply(baseDocument(json), {
        kind: 'map-edit/stamp-room',
        request: {
          polygon,
          wallProps: polygon.map((_, i) => baseStampWallProps(`W${i}.PNG`)),
          sectorProps: baseStampSectorProps(),
          placement: { kind: 'room-placement/adjacent', targetWallIndex: 0, snapDistancePx: 10 }
        }
      } as unknown as MapEditCommand);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('map-edit/stamp-room/non-collinear');
      }
    });
  });

  it('deletes a particle by index', () => {
    const engine = new MapCommandEngine();

    const result = engine.apply(baseDocument(baseMapJson()), {
      kind: 'map-edit/delete',
      target: { kind: 'particle', index: 0 }
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected success');
    }

    expect(result.value.selection).toEqual({ kind: 'map-edit/selection/keep' });
    expect((result.value.nextJson['particles'] as unknown[]).length).toBe(0);
  });

  it('deletes an entity by index', () => {
    const engine = new MapCommandEngine();

    const result = engine.apply(baseDocument(baseMapJson()), {
      kind: 'map-edit/delete',
      target: { kind: 'entity', index: 0 }
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected success');
    }

    expect(result.value.selection).toEqual({ kind: 'map-edit/selection/keep' });
    expect((result.value.nextJson['entities'] as unknown[]).length).toBe(0);
  });

  it('deletes a door by id', () => {
    const engine = new MapCommandEngine();

    const result = engine.apply(baseDocument(baseMapJson()), {
      kind: 'map-edit/delete',
      target: { kind: 'door', id: 'door-1' }
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected success');
    }

    expect(result.value.selection).toEqual({ kind: 'map-edit/selection/keep' });
    expect((result.value.nextJson['doors'] as unknown[]).length).toBe(0);
  });

  it('clones a light and returns selection set to the new ref', () => {
    const engine = new MapCommandEngine();

    const result = engine.apply(baseDocument(baseMapJson()), {
      kind: 'map-edit/clone',
      target: { kind: 'light', index: 0 }
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected success');
    }

    expect(result.value.selection.kind).toBe('map-edit/selection/set');
    if (result.value.selection.kind !== 'map-edit/selection/set') {
      throw new Error('Expected selection/set');
    }
    expect(result.value.selection.ref).toEqual({ kind: 'light', index: 1 });
  });

  it('clones an entity and returns selection set to the new ref', () => {
    const engine = new MapCommandEngine();

    const result = engine.apply(baseDocument(baseMapJson()), {
      kind: 'map-edit/clone',
      target: { kind: 'entity', index: 0 }
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected success');
    }

    expect(result.value.selection.kind).toBe('map-edit/selection/set');
    if (result.value.selection.kind !== 'map-edit/selection/set') {
      throw new Error('Expected selection/set');
    }
    expect(result.value.selection.ref).toEqual({ kind: 'entity', index: 1 });
  });

  it('clones a door and returns selection set to the new ref', () => {
    const engine = new MapCommandEngine();

    const result = engine.apply(baseDocument(baseMapJson()), {
      kind: 'map-edit/clone',
      target: { kind: 'door', id: 'door-1' }
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected success');
    }

    expect(result.value.selection.kind).toBe('map-edit/selection/set');
    if (result.value.selection.kind !== 'map-edit/selection/set') {
      throw new Error('Expected selection/set');
    }

    expect(result.value.selection.ref.kind).toBe('door');
    if (result.value.selection.ref.kind !== 'door') {
      throw new Error('Expected door ref');
    }
    expect(result.value.selection.ref.id).toBe('door-1-copy');
  });

  it('updates fields on a light by index', () => {
    const engine = new MapCommandEngine();

    const result = engine.apply(baseDocument(baseMapJson()), {
      kind: 'map-edit/update-fields',
      target: { kind: 'light', index: 0 },
      set: { x: 10, y: 20, radius: 99, enabled: true }
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected success');
    }

    expect(result.value.selection).toEqual({ kind: 'map-edit/selection/keep' });

    const lights = result.value.nextJson['lights'] as unknown[];
    expect(lights.length).toBe(1);
    expect(lights[0]).toEqual({ x: 10, y: 20, radius: 99, enabled: true });
  });

  it('updates fields on a particle by index', () => {
    const engine = new MapCommandEngine();

    const result = engine.apply(baseDocument(baseMapJson()), {
      kind: 'map-edit/update-fields',
      target: { kind: 'particle', index: 0 },
      set: { x: 12, y: 34 }
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected success');
    }

    const particles = result.value.nextJson['particles'] as unknown[];
    expect(particles[0]).toEqual({ x: 12, y: 34 });
  });

  it('updates fields on an entity by index', () => {
    const engine = new MapCommandEngine();

    const result = engine.apply(baseDocument(baseMapJson()), {
      kind: 'map-edit/update-fields',
      target: { kind: 'entity', index: 0 },
      set: { x: 7, y: 8, yaw_deg: 90, def: 'b' }
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected success');
    }

    const entities = result.value.nextJson['entities'] as unknown[];
    expect(entities[0]).toEqual({ x: 7, y: 8, yaw_deg: 90, def: 'b' });
  });

  it('update-fields supports unsetting a key via {kind:"map-edit/unset"}', () => {
    const engine = new MapCommandEngine();

    const result = engine.apply(baseDocument(baseMapJson()), {
      kind: 'map-edit/update-fields',
      target: { kind: 'entity', index: 0 },
      set: { def: { kind: 'map-edit/unset' } }
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected success');
    }

    const entities = result.value.nextJson['entities'] as unknown[];
    expect(entities[0]).toEqual({ x: 5, y: 6, yaw_deg: 0 });
  });

  it('update-fields rejects object values other than {kind:"map-edit/unset"}', () => {
    const engine = new MapCommandEngine();

    // Cast to bypass compile-time checks; runtime validation should reject this.
    const invalidCommand = {
      kind: 'map-edit/update-fields',
      target: { kind: 'entity', index: 0 },
      set: { def: { kind: 'not-a-real-kind' } }
    } as unknown as MapEditCommand;

    const result = engine.apply(baseDocument(baseMapJson()), invalidCommand);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected failure');
    }
    expect(result.error.code).toBe('map-edit/invalid-json');
  });

  it('updates fields on a door by id', () => {
    const engine = new MapCommandEngine();

    const result = engine.apply(baseDocument(baseMapJson()), {
      kind: 'map-edit/update-fields',
      target: { kind: 'door', id: 'door-1' },
      set: {
        tex: 'next.png',
        starts_closed: true,
        required_item: 'orange_key',
        required_item_missing_message: 'The door is locked. You need the orange key.'
      }
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected success');
    }

    const doors = result.value.nextJson['doors'] as unknown[];
    expect(doors.length).toBe(1);
    expect(doors[0]).toEqual({
      id: 'door-1',
      wall_index: 0,
      tex: 'next.png',
      starts_closed: true,
      required_item: 'orange_key',
      required_item_missing_message: 'The door is locked. You need the orange key.'
    });
  });

  it('updates fields on the map root', () => {
    const engine = new MapCommandEngine();

    const result = engine.apply(
      baseDocument({
        ...baseMapJson(),
        bgmusic: 'OLD.MID',
        soundfont: 'old.sf2',
        name: 'OLD_NAME',
        sky: 'old.png'
      }),
      {
        kind: 'map-edit/update-fields',
        target: { kind: 'map' },
        set: {
          bgmusic: 'COOLSONG.MID',
          soundfont: 'hl4mgm.sf2',
          name: 'E1M1_STRESS_TEST',
          sky: 'purple.png'
        }
      }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected success');
    }

    expect(result.value.selection).toEqual({ kind: 'map-edit/selection/keep' });
    expect(result.value.nextJson).toEqual({
      ...baseMapJson(),
      bgmusic: 'COOLSONG.MID',
      soundfont: 'hl4mgm.sf2',
      name: 'E1M1_STRESS_TEST',
      sky: 'purple.png'
    });
  });

  it('allows update-fields on the map root to set an unchanged value', () => {
    const engine = new MapCommandEngine();

    const result = engine.apply(
      baseDocument({
        ...baseMapJson(),
        name: 'UNCHANGED'
      }),
      {
        kind: 'map-edit/update-fields',
        target: { kind: 'map' },
        set: { name: 'UNCHANGED' }
      }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected success');
    }

    expect((result.value.nextJson as Record<string, unknown>)['name']).toBe('UNCHANGED');
  });

  it('updates fields on a wall by index', () => {
    const engine = new MapCommandEngine();

    const result = engine.apply(
      baseDocument({
        walls: [{ v0: 1, v1: 2, front_sector: 10, back_sector: null, tex: 'a.png', end_level: false }]
      }),
      {
        kind: 'map-edit/update-fields',
        target: { kind: 'wall', index: 0 },
        set: { tex: 'b.png', end_level: true }
      }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected success');
    }

    const walls = result.value.nextJson['walls'] as unknown[];
    expect(walls.length).toBe(1);
    expect(walls[0]).toEqual({ v0: 1, v1: 2, front_sector: 10, back_sector: null, tex: 'b.png', end_level: true });
  });

  it('allows update-fields set values to be null', () => {
    const engine = new MapCommandEngine();

    const result = engine.apply(
      baseDocument({
        walls: [{ v0: 1, v1: 2, front_sector: 10, back_sector: 11, tex: 'a.png', end_level: false }]
      }),
      {
        kind: 'map-edit/update-fields',
        target: { kind: 'wall', index: 0 },
        set: { back_sector: null }
      }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected success');
    }

    const walls = result.value.nextJson['walls'] as unknown[];
    expect(walls.length).toBe(1);
    expect(walls[0]).toEqual({ v0: 1, v1: 2, front_sector: 10, back_sector: null, tex: 'a.png', end_level: false });
  });

  it('updates fields on a sector by id', () => {
    const engine = new MapCommandEngine();

    const result = engine.apply(
      baseDocument({
        sectors: [
          { id: 1, floor_z: 0, ceil_z: 4, light: 1, floor_tex: 'a.png', ceil_tex: 'b.png' },
          { id: 2, floor_z: 1, ceil_z: 5, light: 2, floor_tex: 'c.png', ceil_tex: 'd.png' }
        ]
      }),
      {
        kind: 'map-edit/update-fields',
        target: { kind: 'sector', id: 2 },
        set: { floor_z: 10, ceil_z: 20, light: 0.5 }
      }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected success');
    }

    const sectors = result.value.nextJson['sectors'] as unknown[];
    expect(sectors).toEqual([
      { id: 1, floor_z: 0, ceil_z: 4, light: 1, floor_tex: 'a.png', ceil_tex: 'b.png' },
      { id: 2, floor_z: 10, ceil_z: 20, light: 0.5, floor_tex: 'c.png', ceil_tex: 'd.png' }
    ]);
  });

  it('update-fields allows setting sector ceil_tex to SKY (and back to a texture)', () => {
    const engine = new MapCommandEngine();

    const base = baseDocument({
      sectors: [{ id: 1, floor_z: 0, ceil_z: 4, light: 1, floor_tex: 'floor.png', ceil_tex: 'ceil.png' }]
    });

    const toSky = engine.apply(base, {
      kind: 'map-edit/update-fields',
      target: { kind: 'sector', id: 1 },
      set: { ceil_tex: 'SKY' }
    });

    expect(toSky.ok).toBe(true);
    if (!toSky.ok) {
      throw new Error('Expected success');
    }

    expect(toSky.value.selection).toEqual({ kind: 'map-edit/selection/keep' });
    expect(toSky.value.nextJson['sectors']).toEqual([
      { id: 1, floor_z: 0, ceil_z: 4, light: 1, floor_tex: 'floor.png', ceil_tex: 'SKY' }
    ]);

    const backToTexture = engine.apply(baseDocument(toSky.value.nextJson), {
      kind: 'map-edit/update-fields',
      target: { kind: 'sector', id: 1 },
      set: { ceil_tex: 'other.png' }
    });

    expect(backToTexture.ok).toBe(true);
    if (!backToTexture.ok) {
      throw new Error('Expected success');
    }

    expect(backToTexture.value.nextJson['sectors']).toEqual([
      { id: 1, floor_z: 0, ceil_z: 4, light: 1, floor_tex: 'floor.png', ceil_tex: 'other.png' }
    ]);
  });

  it('returns invalid-json when update-fields target collection is missing or not an array', () => {
    const engine = new MapCommandEngine();

    const result = engine.apply(baseDocument({ lights: {}, particles: [], entities: [], doors: [] }), {
      kind: 'map-edit/update-fields',
      target: { kind: 'light', index: 0 },
      set: { x: 1 }
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected failure');
    }
    expect(result.error.code).toBe('map-edit/invalid-json');
  });

  it('returns invalid-json when update-fields set contains an empty key', () => {
    const engine = new MapCommandEngine();

    const result = engine.apply(baseDocument(baseMapJson()), {
      kind: 'map-edit/update-fields',
      target: { kind: 'light', index: 0 },
      set: { '': 1 }
    } as unknown as Parameters<MapCommandEngine['apply']>[1]);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected failure');
    }
    expect(result.error.code).toBe('map-edit/invalid-json');
  });

  it('returns invalid-json when update-fields set contains a whitespace-only key', () => {
    const engine = new MapCommandEngine();

    const result = engine.apply(baseDocument(baseMapJson()), {
      kind: 'map-edit/update-fields',
      target: { kind: 'light', index: 0 },
      set: { '   ': 1 }
    } as unknown as Parameters<MapCommandEngine['apply']>[1]);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected failure');
    }
    expect(result.error.code).toBe('map-edit/invalid-json');
  });

  it('returns not-found when update-fields target index does not exist', () => {
    const engine = new MapCommandEngine();

    const result = engine.apply(baseDocument(baseMapJson()), {
      kind: 'map-edit/update-fields',
      target: { kind: 'light', index: 99 },
      set: { x: 1 }
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected failure');
    }
    expect(result.error.code).toBe('map-edit/not-found');
  });

  it('returns not-found when update-fields target index is not an integer', () => {
    const engine = new MapCommandEngine();

    const result = engine.apply(baseDocument(baseMapJson()), {
      kind: 'map-edit/update-fields',
      target: { kind: 'light', index: 1.5 },
      set: { x: 1 }
    } as unknown as Parameters<MapCommandEngine['apply']>[1]);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected failure');
    }
    expect(result.error.code).toBe('map-edit/not-found');
  });

  it('returns not-found when update-fields wall index does not exist', () => {
    const engine = new MapCommandEngine();

    const result = engine.apply(baseDocument({ walls: [{ v0: 1, v1: 2 }] }), {
      kind: 'map-edit/update-fields',
      target: { kind: 'wall', index: 99 },
      set: { tex: 'x.png' }
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected failure');
    }
    expect(result.error.code).toBe('map-edit/not-found');
  });

  it('returns invalid-json when update-fields door target collection is not an array', () => {
    const engine = new MapCommandEngine();

    const result = engine.apply(baseDocument({ doors: {} }), {
      kind: 'map-edit/update-fields',
      target: { kind: 'door', id: 'door-1' },
      set: { tex: 'x.png' }
    } as unknown as Parameters<MapCommandEngine['apply']>[1]);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected failure');
    }
    expect(result.error.code).toBe('map-edit/invalid-json');
  });

  it('returns not-found when update-fields sector id does not exist', () => {
    const engine = new MapCommandEngine();

    const result = engine.apply(baseDocument({ sectors: [{ id: 1, floor_z: 0 }] }), {
      kind: 'map-edit/update-fields',
      target: { kind: 'sector', id: 99 },
      set: { floor_z: 1 }
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected failure');
    }
    expect(result.error.code).toBe('map-edit/not-found');
  });

  it('returns invalid-json when update-fields sector target collection is not an array', () => {
    const engine = new MapCommandEngine();

    const result = engine.apply(baseDocument({ sectors: {} }), {
      kind: 'map-edit/update-fields',
      target: { kind: 'sector', id: 1 },
      set: { floor_z: 1 }
    } as unknown as Parameters<MapCommandEngine['apply']>[1]);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected failure');
    }
    expect(result.error.code).toBe('map-edit/invalid-json');
  });

  it('returns invalid-json when update-fields sector id is not an integer', () => {
    const engine = new MapCommandEngine();

    const result = engine.apply(baseDocument({ sectors: [{ id: 1, floor_z: 0 }] }), {
      kind: 'map-edit/update-fields',
      target: { kind: 'sector', id: 1.5 },
      set: { floor_z: 1 }
    } as unknown as Parameters<MapCommandEngine['apply']>[1]);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected failure');
    }
    expect(result.error.code).toBe('map-edit/invalid-json');
  });

  it('returns invalid-json when update-fields target entry is not an object', () => {
    const engine = new MapCommandEngine();

    const result = engine.apply(baseDocument({ lights: [3], particles: [], entities: [], doors: [] }), {
      kind: 'map-edit/update-fields',
      target: { kind: 'light', index: 0 },
      set: { x: 1 }
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected failure');
    }
    expect(result.error.code).toBe('map-edit/invalid-json');
  });

  it('returns invalid-json when update-fields set contains a non-finite number', () => {
    const engine = new MapCommandEngine();

    const result = engine.apply(baseDocument(baseMapJson()), {
      kind: 'map-edit/update-fields',
      target: { kind: 'light', index: 0 },
      set: { x: Number.NaN }
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected failure');
    }
    expect(result.error.code).toBe('map-edit/invalid-json');
  });

  it('returns invalid-json when update-fields set contains a non-primitive value', () => {
    const engine = new MapCommandEngine();

    const result = engine.apply(baseDocument(baseMapJson()), {
      kind: 'map-edit/update-fields',
      target: { kind: 'light', index: 0 },
      set: { x: { nested: true } }
    } as unknown as Parameters<MapCommandEngine['apply']>[1]);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected failure');
    }
    expect(result.error.code).toBe('map-edit/invalid-json');
  });

  it('moves an entity by index, preserving other fields', () => {
    const engine = new MapCommandEngine();

    const result = engine.apply(baseDocument(baseMapJson()), {
      kind: 'map-edit/move-entity',
      target: { kind: 'entity', index: 0 },
      to: { x: 10, y: 20 }
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected success');
    }

    expect(result.value.selection).toEqual({ kind: 'map-edit/selection/keep' });
    expect((result.value.nextJson['entities'] as unknown[])[0]).toEqual({ x: 10, y: 20, yaw_deg: 0, def: 'a' });
  });

  it('returns invalid-json when move-entity target has non-finite to.x/to.y', () => {
    const engine = new MapCommandEngine();

    const result = engine.apply(baseDocument(baseMapJson()), {
      kind: 'map-edit/move-entity',
      target: { kind: 'entity', index: 0 },
      to: { x: Number.NaN, y: 1 }
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected failure');
    }
    expect(result.error.code).toBe('map-edit/invalid-json');
  });

  it('returns invalid-json when entities is missing or not an array (move-entity)', () => {
    const engine = new MapCommandEngine();

    const missingEntities = { ...baseMapJson() } as Record<string, unknown>;
    delete missingEntities['entities'];

    const missing = engine.apply(baseDocument(missingEntities), {
      kind: 'map-edit/move-entity',
      target: { kind: 'entity', index: 0 },
      to: { x: 10, y: 20 }
    });

    expect(missing.ok).toBe(false);
    if (missing.ok) {
      throw new Error('Expected failure');
    }
    expect(missing.error.code).toBe('map-edit/invalid-json');

    const notArray = engine.apply(baseDocument({ ...baseMapJson(), entities: {} }), {
      kind: 'map-edit/move-entity',
      target: { kind: 'entity', index: 0 },
      to: { x: 10, y: 20 }
    });

    expect(notArray.ok).toBe(false);
    if (notArray.ok) {
      throw new Error('Expected failure');
    }
    expect(notArray.error.code).toBe('map-edit/invalid-json');
  });

  it('returns not-found when move-entity index is out of range', () => {
    const engine = new MapCommandEngine();

    const result = engine.apply(baseDocument(baseMapJson()), {
      kind: 'map-edit/move-entity',
      target: { kind: 'entity', index: 99 },
      to: { x: 10, y: 20 }
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected failure');
    }
    expect(result.error.code).toBe('map-edit/not-found');
  });

  it('returns invalid-json when move-entity source entry is not an object or has invalid x/y', () => {
    const engine = new MapCommandEngine();

    const notObject = engine.apply(baseDocument({ ...baseMapJson(), entities: [null] }), {
      kind: 'map-edit/move-entity',
      target: { kind: 'entity', index: 0 },
      to: { x: 10, y: 20 }
    });

    expect(notObject.ok).toBe(false);
    if (notObject.ok) {
      throw new Error('Expected failure');
    }
    expect(notObject.error.code).toBe('map-edit/invalid-json');

    const invalidXy = engine.apply(baseDocument({ ...baseMapJson(), entities: [{ x: 'nope', y: 2 }] }), {
      kind: 'map-edit/move-entity',
      target: { kind: 'entity', index: 0 },
      to: { x: 10, y: 20 }
    });

    expect(invalidXy.ok).toBe(false);
    if (invalidXy.ok) {
      throw new Error('Expected failure');
    }
    expect(invalidXy.error.code).toBe('map-edit/invalid-json');
  });

  it('moves a light by index, preserving other fields', () => {
    const engine = new MapCommandEngine();

    const result = engine.apply(baseDocument(baseMapJson()), {
      kind: 'map-edit/move-light',
      target: { kind: 'light', index: 0 },
      to: { x: 10, y: 20 }
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected success');
    }

    expect(result.value.selection).toEqual({ kind: 'map-edit/selection/keep' });
    expect((result.value.nextJson['lights'] as unknown[])[0]).toEqual({ x: 10, y: 20 });
  });

  it('returns invalid-json when move-light target has non-finite to.x/to.y', () => {
    const engine = new MapCommandEngine();

    const result = engine.apply(baseDocument(baseMapJson()), {
      kind: 'map-edit/move-light',
      target: { kind: 'light', index: 0 },
      to: { x: Number.NaN, y: 1 }
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected failure');
    }
    expect(result.error.code).toBe('map-edit/invalid-json');
  });

  it('returns invalid-json when lights is missing or not an array (move-light)', () => {
    const engine = new MapCommandEngine();

    const missingLights = { ...baseMapJson() } as Record<string, unknown>;
    delete missingLights['lights'];

    const missing = engine.apply(baseDocument(missingLights), {
      kind: 'map-edit/move-light',
      target: { kind: 'light', index: 0 },
      to: { x: 10, y: 20 }
    });

    expect(missing.ok).toBe(false);
    if (missing.ok) {
      throw new Error('Expected failure');
    }
    expect(missing.error.code).toBe('map-edit/invalid-json');

    const notArray = engine.apply(baseDocument({ ...baseMapJson(), lights: {} }), {
      kind: 'map-edit/move-light',
      target: { kind: 'light', index: 0 },
      to: { x: 10, y: 20 }
    });

    expect(notArray.ok).toBe(false);
    if (notArray.ok) {
      throw new Error('Expected failure');
    }
    expect(notArray.error.code).toBe('map-edit/invalid-json');
  });

  it('returns not-found when move-light index is out of range', () => {
    const engine = new MapCommandEngine();

    const result = engine.apply(baseDocument(baseMapJson()), {
      kind: 'map-edit/move-light',
      target: { kind: 'light', index: 99 },
      to: { x: 10, y: 20 }
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected failure');
    }
    expect(result.error.code).toBe('map-edit/not-found');
  });

  it('returns invalid-json when move-light source entry is not an object or has invalid x/y', () => {
    const engine = new MapCommandEngine();

    const notObject = engine.apply(baseDocument({ ...baseMapJson(), lights: [null] }), {
      kind: 'map-edit/move-light',
      target: { kind: 'light', index: 0 },
      to: { x: 10, y: 20 }
    });

    expect(notObject.ok).toBe(false);
    if (notObject.ok) {
      throw new Error('Expected failure');
    }
    expect(notObject.error.code).toBe('map-edit/invalid-json');

    const invalidXy = engine.apply(baseDocument({ ...baseMapJson(), lights: [{ x: 'nope', y: 2 }] }), {
      kind: 'map-edit/move-light',
      target: { kind: 'light', index: 0 },
      to: { x: 10, y: 20 }
    });

    expect(invalidXy.ok).toBe(false);
    if (invalidXy.ok) {
      throw new Error('Expected failure');
    }
    expect(invalidXy.error.code).toBe('map-edit/invalid-json');
  });

  it('returns not-found when move-light index is negative', () => {
    const engine = new MapCommandEngine();

    const result = engine.apply(baseDocument(baseMapJson()), {
      kind: 'map-edit/move-light',
      target: { kind: 'light', index: -1 },
      to: { x: 10, y: 20 }
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected failure');
    }
    expect(result.error.code).toBe('map-edit/not-found');
  });

  it('returns not-found when move-light index is not an integer', () => {
    const engine = new MapCommandEngine();

    const result = engine.apply(baseDocument(baseMapJson()), {
      kind: 'map-edit/move-light',
      target: { kind: 'light', index: 0.5 },
      to: { x: 10, y: 20 }
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected failure');
    }
    expect(result.error.code).toBe('map-edit/not-found');
  });

  it('returns not-found when move-entity index is negative', () => {
    const engine = new MapCommandEngine();

    const result = engine.apply(baseDocument(baseMapJson()), {
      kind: 'map-edit/move-entity',
      target: { kind: 'entity', index: -1 },
      to: { x: 10, y: 20 }
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected failure');
    }
    expect(result.error.code).toBe('map-edit/not-found');
  });

  it('returns not-found when move-entity index is not an integer', () => {
    const engine = new MapCommandEngine();

    const result = engine.apply(baseDocument(baseMapJson()), {
      kind: 'map-edit/move-entity',
      target: { kind: 'entity', index: 0.5 },
      to: { x: 10, y: 20 }
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected failure');
    }
    expect(result.error.code).toBe('map-edit/not-found');
  });

  it('returns unsupported-target for an unknown map-edit command kind', () => {
    const engine = new MapCommandEngine();

    const result = engine.apply(
      baseDocument(baseMapJson()),
      { kind: 'map-edit/unknown' } as unknown as Parameters<MapCommandEngine['apply']>[1]
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected failure');
    }
    expect(result.error.code).toBe('map-edit/unsupported-target');
  });

  it('returns unsupported-target for an unknown delete target kind', () => {
    const engine = new MapCommandEngine();

    const result = engine.apply(baseDocument(baseMapJson()), {
      kind: 'map-edit/delete',
      target: { kind: 'unknown' }
    } as unknown as Parameters<MapCommandEngine['apply']>[1]);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected failure');
    }
    expect(result.error.code).toBe('map-edit/unsupported-target');
  });

  it('omits label when transaction label is undefined and includes it when present', () => {
    const engine = new MapCommandEngine();

    const withoutLabel = engine.apply(baseDocument(baseMapJson()), {
      kind: 'map-edit/transaction',
      commands: [{ kind: 'map-edit/delete', target: { kind: 'light', index: 0 } }]
    });

    expect(withoutLabel.ok).toBe(true);
    if (!withoutLabel.ok) {
      throw new Error('Expected success');
    }
    expect(Object.prototype.hasOwnProperty.call(withoutLabel.value, 'label')).toBe(false);

    const withLabel = engine.apply(baseDocument(baseMapJson()), {
      kind: 'map-edit/transaction',
      label: 'Delete Light',
      commands: [{ kind: 'map-edit/delete', target: { kind: 'light', index: 0 } }]
    });

    expect(withLabel.ok).toBe(true);
    if (!withLabel.ok) {
      throw new Error('Expected success');
    }
    expect(Object.prototype.hasOwnProperty.call(withLabel.value, 'label')).toBe(true);
    expect(withLabel.value.label).toBe('Delete Light');
  });

  it('applies a transaction atomically and returns selection clear when deleting the selected target', () => {
    const engine = new MapCommandEngine();

    const result = engine.apply(baseDocument(baseMapJson()), {
      kind: 'map-edit/transaction',
      commands: [{ kind: 'map-edit/delete', target: { kind: 'light', index: 0 } }],
      selection: { kind: 'map-edit/selection', ref: { kind: 'light', index: 0 } }
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected success');
    }

    expect(result.value.selection).toEqual({ kind: 'map-edit/selection/clear', reason: 'deleted' });
    expect((result.value.nextJson['lights'] as unknown[]).length).toBe(0);
  });

  it('returns selection clear when deleting the selected particle by index', () => {
    const engine = new MapCommandEngine();

    const result = engine.apply(baseDocument(baseMapJson()), {
      kind: 'map-edit/transaction',
      commands: [{ kind: 'map-edit/delete', target: { kind: 'particle', index: 0 } }],
      selection: { kind: 'map-edit/selection', ref: { kind: 'particle', index: 0 } }
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected success');
    }

    expect(result.value.selection).toEqual({ kind: 'map-edit/selection/clear', reason: 'deleted' });
    expect((result.value.nextJson['particles'] as unknown[]).length).toBe(0);
  });

  it('returns selection clear when deleting the selected door by id', () => {
    const engine = new MapCommandEngine();

    const result = engine.apply(baseDocument(baseMapJson()), {
      kind: 'map-edit/transaction',
      commands: [{ kind: 'map-edit/delete', target: { kind: 'door', id: 'door-1' } }],
      selection: { kind: 'map-edit/selection', ref: { kind: 'door', id: 'door-1' } }
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected success');
    }

    expect(result.value.selection).toEqual({ kind: 'map-edit/selection/clear', reason: 'deleted' });
    expect((result.value.nextJson['doors'] as unknown[]).length).toBe(0);
  });

  it('keeps selection when deleting with an explicit null selection ref', () => {
    const engine = new MapCommandEngine();

    const result = engine.apply(baseDocument(baseMapJson()), {
      kind: 'map-edit/transaction',
      commands: [{ kind: 'map-edit/delete', target: { kind: 'light', index: 0 } }],
      selection: { kind: 'map-edit/selection', ref: null }
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected success');
    }

    expect(result.value.selection).toEqual({ kind: 'map-edit/selection/keep' });
    expect((result.value.nextJson['lights'] as unknown[]).length).toBe(0);
  });

  it('keeps selection when deleting and the selected ref kind does not match the delete target kind', () => {
    const engine = new MapCommandEngine();

    const result = engine.apply(baseDocument(baseMapJson()), {
      kind: 'map-edit/transaction',
      commands: [{ kind: 'map-edit/delete', target: { kind: 'light', index: 0 } }],
      selection: { kind: 'map-edit/selection', ref: { kind: 'particle', index: 0 } }
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected success');
    }

    expect(result.value.selection).toEqual({ kind: 'map-edit/selection/keep' });
    expect((result.value.nextJson['lights'] as unknown[]).length).toBe(0);
  });

  it('applies a clone and returns selection set to the new ref', () => {
    const engine = new MapCommandEngine();

    const result = engine.apply(baseDocument(baseMapJson()), {
      kind: 'map-edit/transaction',
      commands: [{ kind: 'map-edit/clone', target: { kind: 'particle', index: 0 } }],
      selection: { kind: 'map-edit/selection', ref: { kind: 'particle', index: 0 } }
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected success');
    }

    expect(result.value.selection.kind).toBe('map-edit/selection/set');
    if (result.value.selection.kind !== 'map-edit/selection/set') {
      throw new Error('Expected selection/set');
    }

    expect(result.value.selection.ref).toEqual({ kind: 'particle', index: 1 });
  });

  it('ensures cloned door ids are unique by incrementing the copy suffix', () => {
    const engine = new MapCommandEngine();

    const json = {
      ...baseMapJson(),
      doors: [{ id: 'door-1', wall_index: 0, tex: 'door.png', starts_closed: false }]
    };

    const result = engine.apply(baseDocument(json), {
      kind: 'map-edit/transaction',
      commands: [
        { kind: 'map-edit/clone', target: { kind: 'door', id: 'door-1' } },
        { kind: 'map-edit/clone', target: { kind: 'door', id: 'door-1' } },
        { kind: 'map-edit/clone', target: { kind: 'door', id: 'door-1' } }
      ]
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected success');
    }

    const doors = result.value.nextJson['doors'] as unknown as ReadonlyArray<Readonly<{ id: string }>>;
    const ids = doors.map(door => door.id);
    expect(ids).toContain('door-1');
    expect(ids).toContain('door-1-copy');
    expect(ids).toContain('door-1-copy-2');
    expect(ids).toContain('door-1-copy-3');
  });

  describe('map-edit/create-door', () => {
    it('creates a door on a portal wall and selects it (doors missing -> treated as empty)', () => {
      const engine = new MapCommandEngine();

      const json = baseMapJsonForDoorCreation({ walls: [{ back_sector: 0 }] });

      const result = engine.apply(baseDocument(json), { kind: 'map-edit/create-door', atWallIndex: 0 });

      expect(result.ok).toBe(true);
      if (!result.ok) {
        throw new Error('Expected success');
      }

      expect(result.value.selection).toEqual({
        kind: 'map-edit/selection/set',
        ref: { kind: 'door', id: 'door-1' }
      });

      const doors = result.value.nextJson['doors'] as unknown as ReadonlyArray<Record<string, unknown>>;
      expect(doors.length).toBe(1);
      const firstDoor = doors[0];
      if (firstDoor === undefined) {
        throw new Error('Expected door entry');
      }
      expect(firstDoor).toMatchObject({ id: 'door-1', wall_index: 0, starts_closed: true });
      expect('tex' in firstDoor).toBe(false);
    });

    it('returns not-found when wall index is out of bounds', () => {
      const engine = new MapCommandEngine();

      const json = baseMapJsonForDoorCreation({ walls: [{ back_sector: 0 }], doors: [] });
      const result = engine.apply(baseDocument(json), { kind: 'map-edit/create-door', atWallIndex: 1 });

      expect(result.ok).toBe(false);
      if (result.ok) {
        throw new Error('Expected failure');
      }
      expect(result.error.code).toBe('map-edit/not-found');
    });

    it('returns not-found when wall index is not an integer', () => {
      const engine = new MapCommandEngine();

      const json = baseMapJsonForDoorCreation({ walls: [{ back_sector: 0 }], doors: [] });
      const result = engine.apply(baseDocument(json), {
        kind: 'map-edit/create-door',
        atWallIndex: 0.5
      } as unknown as MapEditCommand);

      expect(result.ok).toBe(false);
      if (result.ok) {
        throw new Error('Expected failure');
      }
      expect(result.error.code).toBe('map-edit/not-found');
    });

    it('returns not-a-portal when wall back_sector indicates no backing sector', () => {
      const engine = new MapCommandEngine();

      const json = baseMapJsonForDoorCreation({ walls: [{ back_sector: -1 }], doors: [] });
      const result = engine.apply(baseDocument(json), { kind: 'map-edit/create-door', atWallIndex: 0 });

      expect(result.ok).toBe(false);
      if (result.ok) {
        throw new Error('Expected failure');
      }
      expect(result.error.code).toBe('map-edit/not-a-portal');
    });

    it('returns door-already-exists when a door already exists at wall_index', () => {
      const engine = new MapCommandEngine();

      const json = baseMapJsonForDoorCreation({
        walls: [{ back_sector: 0 }],
        doors: [{ id: 'door-1', wall_index: 0, tex: 'door.png', starts_closed: false }]
      });

      const result = engine.apply(baseDocument(json), { kind: 'map-edit/create-door', atWallIndex: 0 });

      expect(result.ok).toBe(false);
      if (result.ok) {
        throw new Error('Expected failure');
      }
      expect(result.error.code).toBe('map-edit/door-already-exists');
    });

    it('returns invalid-json when doors is present but not an array', () => {
      const engine = new MapCommandEngine();

      const json = baseMapJsonForDoorCreation({ walls: [{ back_sector: 0 }], doors: {} });
      const result = engine.apply(baseDocument(json), { kind: 'map-edit/create-door', atWallIndex: 0 });

      expect(result.ok).toBe(false);
      if (result.ok) {
        throw new Error('Expected failure');
      }
      expect(result.error.code).toBe('map-edit/invalid-json');
    });

    it('returns invalid-json when walls entry is not an object', () => {
      const engine = new MapCommandEngine();

      const json = baseMapJsonForDoorCreation({ walls: [123], doors: [] });
      const result = engine.apply(baseDocument(json), { kind: 'map-edit/create-door', atWallIndex: 0 });

      expect(result.ok).toBe(false);
      if (result.ok) {
        throw new Error('Expected failure');
      }
      expect(result.error.code).toBe('map-edit/invalid-json');
    });

    it('returns invalid-json when walls[].back_sector is not an integer', () => {
      const engine = new MapCommandEngine();

      const json = baseMapJsonForDoorCreation({ walls: [{ back_sector: '0' }], doors: [] });
      const result = engine.apply(baseDocument(json), { kind: 'map-edit/create-door', atWallIndex: 0 });

      expect(result.ok).toBe(false);
      if (result.ok) {
        throw new Error('Expected failure');
      }
      expect(result.error.code).toBe('map-edit/invalid-json');
    });
  });

  it('returns transaction-step-failed and does not partially apply when a later step fails', () => {
    const engine = new MapCommandEngine();

    const result = engine.apply(baseDocument(baseMapJson()), {
      kind: 'map-edit/transaction',
      commands: [
        { kind: 'map-edit/delete', target: { kind: 'entity', index: 0 } },
        { kind: 'map-edit/delete', target: { kind: 'entity', index: 99 } }
      ],
      selection: { kind: 'map-edit/selection', ref: { kind: 'entity', index: 0 } }
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected failure');
    }

    expect(result.error.code).toBe('map-edit/transaction-step-failed');
    if (result.error.code !== 'map-edit/transaction-step-failed') {
      throw new Error('Expected transaction-step-failed');
    }
    expect(result.error.stepIndex).toBe(1);
    expect(result.error.cause?.code).toBe('map-edit/not-found');
  });
});
