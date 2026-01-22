import { decodeMapViewModel } from './mapDecoder';

describe('decodeMapViewModel', () => {
  it('decodes optional root sky as null when absent', () => {
    const json = {
      vertices: [{ x: 0, y: 0 }],
      sectors: [{ id: 1, floor_z: 0, ceil_z: 4, floor_tex: 'floor.png', ceil_tex: 'ceil.png', light: 1 }],
      walls: [{ v0: 0, v1: 0, front_sector: 1, back_sector: -1, tex: 'wall.png' }]
    };

    const result = decodeMapViewModel(json);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.sky).toBeNull();
  });

  it('decodes optional root sky as null when empty', () => {
    const json = {
      sky: '   ',
      vertices: [{ x: 0, y: 0 }],
      sectors: [{ id: 1, floor_z: 0, ceil_z: 4, floor_tex: 'floor.png', ceil_tex: 'ceil.png', light: 1 }],
      walls: [{ v0: 0, v1: 0, front_sector: 1, back_sector: -1, tex: 'wall.png' }]
    };

    const result = decodeMapViewModel(json);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.sky).toBeNull();
  });

  it('decodes optional root sky when set', () => {
    const json = {
      sky: 'overcast.png',
      vertices: [{ x: 0, y: 0 }],
      sectors: [{ id: 1, floor_z: 0, ceil_z: 4, floor_tex: 'floor.png', ceil_tex: 'ceil.png', light: 1 }],
      walls: [{ v0: 0, v1: 0, front_sector: 1, back_sector: -1, tex: 'wall.png' }]
    };

    const result = decodeMapViewModel(json);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.sky).toBe('overcast.png');
  });

  it('decodes required keys (vertices, sectors, walls) and optional keys', () => {
    const json = {
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 }
      ],
      sectors: [
        {
          id: 1,
          floor_z: 0,
          ceil_z: 4,
          floor_tex: 'floor.png',
          ceil_tex: 'ceil.png',
          light: 1
        }
      ],
      walls: [
        {
          v0: 0,
          v1: 1,
          front_sector: 1,
          back_sector: -1,
          tex: 'wall.png',
          end_level: true
        }
      ],
      doors: [
        {
          id: 'door-1',
          wall_index: 0,
          tex: 'door.png',
          starts_closed: false,
          required_item: 'orange_key',
          required_item_missing_message: 'The door is locked.'
        }
      ],
      lights: [{ x: 2, y: 3, radius: 5, intensity: 0.8, color: '#3366cc' }],
      particles: [{ x: 4, y: 5 }],
      entities: [{ x: 6, y: 7, yaw_deg: 90, def: 'player' }]
    };

    const result = decodeMapViewModel(json);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.vertices).toHaveLength(3);
    expect(result.value.sectors).toHaveLength(1);
    expect(result.value.walls).toHaveLength(1);
    expect(result.value.doors).toHaveLength(1);
    expect(result.value.lights).toHaveLength(1);
    expect(result.value.particles).toHaveLength(1);
    expect(result.value.entities).toHaveLength(1);

    expect(result.value.sky).toBeNull();

    const door0 = result.value.doors[0];
    expect(door0).toBeDefined();
    if (!door0) {
      return;
    }
    expect(door0.requiredItem).toBe('orange_key');
    expect(door0.requiredItemMissingMessage).toBe('The door is locked.');

    const wall0 = result.value.walls[0];
    expect(wall0).toBeDefined();
    if (!wall0) {
      return;
    }
    expect(wall0.index).toBe(0);

    const light0 = result.value.lights[0];
    expect(light0).toBeDefined();
    if (!light0) {
      return;
    }
    expect(light0.color).toEqual({ r: 0x33, g: 0x66, b: 0xcc });
  });

  it('defaults optional arrays to empty and optional booleans to expected defaults', () => {
    const json = {
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 }
      ],
      sectors: [
        {
          id: 1,
          floor_z: 0,
          ceil_z: 4,
          floor_tex: 'floor.png',
          ceil_tex: 'ceil.png',
          light: 1
        }
      ],
      walls: [
        {
          v0: 0,
          v1: 1,
          front_sector: 1,
          back_sector: -1,
          tex: 'wall.png'
        }
      ]
    };

    const result = decodeMapViewModel(json);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.doors).toEqual([]);
    expect(result.value.lights).toEqual([]);
    expect(result.value.particles).toEqual([]);
    expect(result.value.entities).toEqual([]);
    expect(result.value.sky).toBeNull();

    const sector0 = result.value.sectors[0];
    expect(sector0).toBeDefined();
    if (!sector0) {
      return;
    }
    expect(sector0.floorZToggledPos).toBeNull();

    const wall0 = result.value.walls[0];
    expect(wall0).toBeDefined();
    if (!wall0) {
      return;
    }
    expect(wall0.endLevel).toBe(false);
    expect(wall0.toggleSector).toBe(false);
    expect(wall0.toggleSectorId).toBeNull();
    expect(wall0.toggleSectorOneshot).toBe(false);
    expect(wall0.toggleSound).toBeNull();
    expect(wall0.toggleSoundFinish).toBeNull();
  });

  it('defaults optional door required-item fields to null when missing', () => {
    const json = {
      vertices: [{ x: 0, y: 0 }],
      sectors: [{ id: 1, floor_z: 0, ceil_z: 4, floor_tex: 'floor.png', ceil_tex: 'ceil.png', light: 1 }],
      walls: [{ v0: 0, v1: 0, front_sector: 1, back_sector: -1, tex: 'wall.png' }],
      doors: [{ id: 'door-1', wall_index: 0, tex: 'door.png', starts_closed: true }]
    };

    const result = decodeMapViewModel(json);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.doors).toHaveLength(1);
    expect(result.value.sky).toBeNull();
    const door0 = result.value.doors[0];
    expect(door0).toBeDefined();
    if (!door0) {
      return;
    }
    expect(door0.requiredItem).toBeNull();
    expect(door0.requiredItemMissingMessage).toBeNull();
  });

  it('fails when top-level is not an object', () => {
    const result = decodeMapViewModel('nope');
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.kind).toBe('map-decode-error');
  });

  it('fails when required keys are missing', () => {
    const result = decodeMapViewModel({ vertices: [], walls: [] });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.message).toContain('sectors');
  });

  it('fails when optional keys are present but not arrays', () => {
    const json = {
      vertices: [{ x: 0, y: 0 }],
      sectors: [{ id: 1, floor_z: 0, ceil_z: 4, floor_tex: 'a', ceil_tex: 'b', light: 1 }],
      walls: [{ v0: 0, v1: 0, front_sector: 1, back_sector: -1, tex: 'wall.png' }],
      lights: 'not-an-array'
    };

    const result = decodeMapViewModel(json);

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.message).toContain('lights');
  });

  it('fails when a wall uses non-integer vertex indices', () => {
    const json = {
      vertices: [{ x: 0, y: 0 }],
      sectors: [{ id: 1, floor_z: 0, ceil_z: 4, floor_tex: 'a', ceil_tex: 'b', light: 1 }],
      walls: [{ v0: 0.1, v1: 0, front_sector: 1, back_sector: -1, tex: 'wall.png' }]
    };

    const result = decodeMapViewModel(json);

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.message).toContain('integer');
  });

  it('accepts legacy {r,g,b} color objects in 0..1 range', () => {
    const json = {
      vertices: [
        { x: 0, y: 0 },
        { x: 1, y: 0 }
      ],
      sectors: [{ id: 1, floor_z: 0, ceil_z: 1, floor_tex: 'a', ceil_tex: 'b', light: 1 }],
      walls: [{ v0: 0, v1: 1, front_sector: 1, back_sector: -1, tex: 'wall.png' }],
      lights: [{ x: 0, y: 0, radius: 1, intensity: 1, color: { r: 0.5, g: 0.25, b: 1 } }]
    };

    const result = decodeMapViewModel(json);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const light0 = result.value.lights[0];
    expect(light0).toBeDefined();
    if (!light0) {
      return;
    }
    expect(light0.color).toEqual({ r: 127.5, g: 63.75, b: 255 });
  });

  it('accepts brightness as a fallback for intensity', () => {
    const json = {
      vertices: [
        { x: 0, y: 0 },
        { x: 1, y: 0 }
      ],
      sectors: [{ id: 1, floor_z: 0, ceil_z: 1, floor_tex: 'a', ceil_tex: 'b', light: 1 }],
      walls: [{ v0: 0, v1: 1, front_sector: 1, back_sector: -1, tex: 'wall.png' }],
      lights: [{ x: 0, y: 0, radius: 1, brightness: 0.25, color: '#ffffff' }]
    };

    const result = decodeMapViewModel(json);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const light0 = result.value.lights[0];
    expect(light0).toBeDefined();
    if (!light0) {
      return;
    }
    expect(light0.intensity).toBe(0.25);
  });

  it('fails when light color is an invalid hex string', () => {
    const json = {
      vertices: [
        { x: 0, y: 0 },
        { x: 1, y: 0 }
      ],
      sectors: [{ id: 1, floor_z: 0, ceil_z: 1, floor_tex: 'a', ceil_tex: 'b', light: 1 }],
      walls: [{ v0: 0, v1: 1, front_sector: 1, back_sector: -1, tex: 'wall.png' }],
      lights: [{ x: 0, y: 0, radius: 1, intensity: 1, color: '#ffff' }]
    };

    const result = decodeMapViewModel(json);

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.message).toContain('hex');
  });
});
