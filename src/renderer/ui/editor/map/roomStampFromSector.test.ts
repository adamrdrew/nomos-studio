import type { MapViewModel } from './mapViewModel';

import { buildRoomStampFromSector } from './roomStampFromSector';

const wallDefaults = {
  endLevel: false,
  toggleSector: false,
  toggleSectorId: null,
  toggleSectorOneshot: false,
  toggleSound: null,
  toggleSoundFinish: null
} as const;

describe('roomStampFromSector', () => {
  it('buildRoomStampFromSector: returns a stamp with polygon and aligned wall props', () => {
    const map: MapViewModel = {
      sky: null,
      vertices: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 3 },
        { x: 0, y: 3 }
      ],
      sectors: [
        {
          id: 1,
          floorZ: 0,
          floorZToggledPos: null,
          ceilZ: 4,
          floorTex: 'F.PNG',
          ceilTex: 'C.PNG',
          light: 1
        }
      ],
      walls: [
        { index: 0, v0: 0, v1: 1, frontSector: 1, backSector: -1, tex: 'W0.PNG', ...wallDefaults },
        { index: 1, v0: 1, v1: 2, frontSector: 1, backSector: -1, tex: 'W1.PNG', ...wallDefaults },
        { index: 2, v0: 2, v1: 3, frontSector: 1, backSector: -1, tex: 'W2.PNG', ...wallDefaults },
        { index: 3, v0: 3, v1: 0, frontSector: 1, backSector: -1, tex: 'W3.PNG', ...wallDefaults }
      ],
      doors: [],
      lights: [],
      particles: [],
      entities: []
    };

    const stamp = buildRoomStampFromSector(map, 1);

    expect(stamp.ok).toBe(true);
    if (!stamp.ok) {
      throw new Error('Expected success');
    }

    expect(stamp.value.polygon).toHaveLength(4);
    expect(stamp.value.wallProps).toHaveLength(4);
    expect(stamp.value.wallProps.map((p) => p.tex)).toEqual(['W0.PNG', 'W1.PNG', 'W2.PNG', 'W3.PNG']);
    expect(stamp.value.sectorProps).toEqual({
      floorZ: 0,
      floorZToggledPos: null,
      ceilZ: 4,
      floorTex: 'F.PNG',
      ceilTex: 'C.PNG',
      light: 1
    });
  });

  it('buildRoomStampFromSector: returns missing-sector when the sector does not exist', () => {
    const map: MapViewModel = {
      sky: null,
      vertices: [],
      sectors: [],
      walls: [],
      doors: [],
      lights: [],
      particles: [],
      entities: []
    };

    const stamp = buildRoomStampFromSector(map, 123);

    expect(stamp.ok).toBe(false);
    if (stamp.ok) {
      throw new Error('Expected failure');
    }
    expect(stamp.error).toEqual({ kind: 'room-stamp-from-sector-error', reason: 'missing-sector' });
  });

  it('buildRoomStampFromSector: returns missing-wall when the loop refers to a missing wall index', () => {
    const map: MapViewModel = {
      sky: null,
      vertices: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 3 },
        { x: 0, y: 3 }
      ],
      sectors: [
        {
          id: 1,
          floorZ: 0,
          floorZToggledPos: null,
          ceilZ: 4,
          floorTex: 'F.PNG',
          ceilTex: 'C.PNG',
          light: 1
        }
      ],
      walls: [
        // Intentionally omit wall index 2.
        { index: 0, v0: 0, v1: 1, frontSector: 1, backSector: -1, tex: 'W0.PNG', ...wallDefaults },
        { index: 1, v0: 1, v1: 2, frontSector: 1, backSector: -1, tex: 'W1.PNG', ...wallDefaults },
        { index: 3, v0: 3, v1: 0, frontSector: 1, backSector: -1, tex: 'W3.PNG', ...wallDefaults }
      ],
      doors: [],
      lights: [],
      particles: [],
      entities: []
    };

    const stamp = buildRoomStampFromSector(map, 1);

    expect(stamp.ok).toBe(false);
    if (stamp.ok) {
      throw new Error('Expected failure');
    }
    // Removing a boundary wall makes the loop open; loop extraction fails before we can map wall props.
    expect(stamp.error).toEqual({ kind: 'room-stamp-from-sector-error', reason: 'open-loop' });
  });
});
