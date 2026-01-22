import { MapCommandEngine } from './MapCommandEngine';

import type { MapDocument } from '../../../shared/domain/models';

function baseMapJson(): Record<string, unknown> {
  return {
    lights: [{ x: 1, y: 2 }],
    particles: [{ x: 3, y: 4 }],
    entities: [{ x: 5, y: 6, yaw_deg: 0, def: 'a' }],
    doors: [{ id: 'door-1', wall_index: 0, tex: 'door.png', starts_closed: false }]
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
