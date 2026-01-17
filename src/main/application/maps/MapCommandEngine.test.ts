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
