import { isWorldPointInSector, isWorldPointInsideSectorLoop, pickSectorIdAtWorldPoint } from './map/sectorContainment';
import type { MapViewModel } from './map/mapViewModel';

describe('isWorldPointInsideSectorLoop', () => {
  it('returns true for a point inside a simple rectangular sector and false for a point outside', () => {
    const map: MapViewModel = {
      sky: null,
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 }
      ],
      sectors: [{ id: 0, floorZ: 0, floorZToggledPos: null, ceilZ: 0, floorTex: 'a', ceilTex: 'a', light: 1 }],
      walls: [
        {
          index: 0,
          v0: 0,
          v1: 1,
          frontSector: 0,
          backSector: -1,
          tex: 'a',
          endLevel: false,
          toggleSector: false,
          toggleSectorId: null,
          toggleSectorOneshot: false,
          toggleSound: null,
          toggleSoundFinish: null
        },
        {
          index: 1,
          v0: 1,
          v1: 2,
          frontSector: 0,
          backSector: -1,
          tex: 'a',
          endLevel: false,
          toggleSector: false,
          toggleSectorId: null,
          toggleSectorOneshot: false,
          toggleSound: null,
          toggleSoundFinish: null
        },
        {
          index: 2,
          v0: 2,
          v1: 3,
          frontSector: 0,
          backSector: -1,
          tex: 'a',
          endLevel: false,
          toggleSector: false,
          toggleSectorId: null,
          toggleSectorOneshot: false,
          toggleSound: null,
          toggleSoundFinish: null
        },
        {
          index: 3,
          v0: 3,
          v1: 0,
          frontSector: 0,
          backSector: -1,
          tex: 'a',
          endLevel: false,
          toggleSector: false,
          toggleSectorId: null,
          toggleSectorOneshot: false,
          toggleSound: null,
          toggleSoundFinish: null
        }
      ],
      doors: [],
      lights: [],
      particles: [],
      entities: []
    };

    expect(isWorldPointInsideSectorLoop({ x: 5, y: 5 }, map, 0)).toBe(true);
    expect(isWorldPointInsideSectorLoop({ x: 50, y: 50 }, map, 0)).toBe(false);
  });

  it('returns false when sector loop cannot be built', () => {
    const map: MapViewModel = {
      sky: null,
      vertices: [{ x: 0, y: 0 }],
      sectors: [{ id: 123, floorZ: 0, floorZToggledPos: null, ceilZ: 0, floorTex: 'a', ceilTex: 'a', light: 1 }],
      walls: [],
      doors: [],
      lights: [],
      particles: [],
      entities: []
    };

    expect(isWorldPointInsideSectorLoop({ x: 0, y: 0 }, map, 123)).toBe(false);
  });
});

describe('isWorldPointInSector', () => {
  it('treats backSector edges as part of the sector boundary', () => {
    const map: MapViewModel = {
      sky: null,
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 }
      ],
      sectors: [{ id: 7, floorZ: 0, floorZToggledPos: null, ceilZ: 0, floorTex: 'a', ceilTex: 'a', light: 1 }],
      // All walls list the sector as backSector (frontSector is some other id).
      walls: [
        {
          index: 0,
          v0: 0,
          v1: 1,
          frontSector: 999,
          backSector: 7,
          tex: 'a',
          endLevel: false,
          toggleSector: false,
          toggleSectorId: null,
          toggleSectorOneshot: false,
          toggleSound: null,
          toggleSoundFinish: null
        },
        {
          index: 1,
          v0: 1,
          v1: 2,
          frontSector: 999,
          backSector: 7,
          tex: 'a',
          endLevel: false,
          toggleSector: false,
          toggleSectorId: null,
          toggleSectorOneshot: false,
          toggleSound: null,
          toggleSoundFinish: null
        },
        {
          index: 2,
          v0: 2,
          v1: 3,
          frontSector: 999,
          backSector: 7,
          tex: 'a',
          endLevel: false,
          toggleSector: false,
          toggleSectorId: null,
          toggleSectorOneshot: false,
          toggleSound: null,
          toggleSoundFinish: null
        },
        {
          index: 3,
          v0: 3,
          v1: 0,
          frontSector: 999,
          backSector: 7,
          tex: 'a',
          endLevel: false,
          toggleSector: false,
          toggleSectorId: null,
          toggleSectorOneshot: false,
          toggleSound: null,
          toggleSoundFinish: null
        }
      ],
      doors: [],
      lights: [],
      particles: [],
      entities: []
    };

    expect(isWorldPointInSector({ x: 5, y: 5 }, map, 7)).toBe(true);
    expect(isWorldPointInSector({ x: 50, y: 50 }, map, 7)).toBe(false);
  });
});

describe('pickSectorIdAtWorldPoint', () => {
  it('returns null when no sectors contain the point', () => {
    const map: MapViewModel = {
      sky: null,
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 }
      ],
      sectors: [{ id: 1, floorZ: 0, floorZToggledPos: null, ceilZ: 0, floorTex: 'a', ceilTex: 'a', light: 1 }],
      walls: [
        {
          index: 0,
          v0: 0,
          v1: 1,
          frontSector: 1,
          backSector: -1,
          tex: 'a',
          endLevel: false,
          toggleSector: false,
          toggleSectorId: null,
          toggleSectorOneshot: false,
          toggleSound: null,
          toggleSoundFinish: null
        },
        {
          index: 1,
          v0: 1,
          v1: 2,
          frontSector: 1,
          backSector: -1,
          tex: 'a',
          endLevel: false,
          toggleSector: false,
          toggleSectorId: null,
          toggleSectorOneshot: false,
          toggleSound: null,
          toggleSoundFinish: null
        },
        {
          index: 2,
          v0: 2,
          v1: 3,
          frontSector: 1,
          backSector: -1,
          tex: 'a',
          endLevel: false,
          toggleSector: false,
          toggleSectorId: null,
          toggleSectorOneshot: false,
          toggleSound: null,
          toggleSoundFinish: null
        },
        {
          index: 3,
          v0: 3,
          v1: 0,
          frontSector: 1,
          backSector: -1,
          tex: 'a',
          endLevel: false,
          toggleSector: false,
          toggleSectorId: null,
          toggleSectorOneshot: false,
          toggleSound: null,
          toggleSoundFinish: null
        }
      ],
      doors: [],
      lights: [],
      particles: [],
      entities: []
    };

    expect(pickSectorIdAtWorldPoint({ x: 50, y: 50 }, map)).toBeNull();
  });

  it('returns the containing sector id for a simple case', () => {
    const map: MapViewModel = {
      sky: null,
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 }
      ],
      sectors: [{ id: 1, floorZ: 0, floorZToggledPos: null, ceilZ: 0, floorTex: 'a', ceilTex: 'a', light: 1 }],
      walls: [
        {
          index: 0,
          v0: 0,
          v1: 1,
          frontSector: 1,
          backSector: -1,
          tex: 'a',
          endLevel: false,
          toggleSector: false,
          toggleSectorId: null,
          toggleSectorOneshot: false,
          toggleSound: null,
          toggleSoundFinish: null
        },
        {
          index: 1,
          v0: 1,
          v1: 2,
          frontSector: 1,
          backSector: -1,
          tex: 'a',
          endLevel: false,
          toggleSector: false,
          toggleSectorId: null,
          toggleSectorOneshot: false,
          toggleSound: null,
          toggleSoundFinish: null
        },
        {
          index: 2,
          v0: 2,
          v1: 3,
          frontSector: 1,
          backSector: -1,
          tex: 'a',
          endLevel: false,
          toggleSector: false,
          toggleSectorId: null,
          toggleSectorOneshot: false,
          toggleSound: null,
          toggleSoundFinish: null
        },
        {
          index: 3,
          v0: 3,
          v1: 0,
          frontSector: 1,
          backSector: -1,
          tex: 'a',
          endLevel: false,
          toggleSector: false,
          toggleSectorId: null,
          toggleSectorOneshot: false,
          toggleSound: null,
          toggleSoundFinish: null
        }
      ],
      doors: [],
      lights: [],
      particles: [],
      entities: []
    };

    expect(pickSectorIdAtWorldPoint({ x: 5, y: 5 }, map)).toBe(1);
  });

  it('prefers the smallest-area containing sector when nested', () => {
    const map: MapViewModel = {
      sky: null,
      vertices: [
        // Outer square
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
        // Inner square
        { x: 3, y: 3 },
        { x: 7, y: 3 },
        { x: 7, y: 7 },
        { x: 3, y: 7 }
      ],
      sectors: [
        { id: 1, floorZ: 0, floorZToggledPos: null, ceilZ: 0, floorTex: 'a', ceilTex: 'a', light: 1 },
        { id: 2, floorZ: 0, floorZToggledPos: null, ceilZ: 0, floorTex: 'a', ceilTex: 'a', light: 1 }
      ],
      walls: [
        // Outer loop (sector 1)
        {
          index: 0,
          v0: 0,
          v1: 1,
          frontSector: 1,
          backSector: -1,
          tex: 'a',
          endLevel: false,
          toggleSector: false,
          toggleSectorId: null,
          toggleSectorOneshot: false,
          toggleSound: null,
          toggleSoundFinish: null
        },
        {
          index: 1,
          v0: 1,
          v1: 2,
          frontSector: 1,
          backSector: -1,
          tex: 'a',
          endLevel: false,
          toggleSector: false,
          toggleSectorId: null,
          toggleSectorOneshot: false,
          toggleSound: null,
          toggleSoundFinish: null
        },
        {
          index: 2,
          v0: 2,
          v1: 3,
          frontSector: 1,
          backSector: -1,
          tex: 'a',
          endLevel: false,
          toggleSector: false,
          toggleSectorId: null,
          toggleSectorOneshot: false,
          toggleSound: null,
          toggleSoundFinish: null
        },
        {
          index: 3,
          v0: 3,
          v1: 0,
          frontSector: 1,
          backSector: -1,
          tex: 'a',
          endLevel: false,
          toggleSector: false,
          toggleSectorId: null,
          toggleSectorOneshot: false,
          toggleSound: null,
          toggleSoundFinish: null
        },
        // Inner loop (sector 2)
        {
          index: 4,
          v0: 4,
          v1: 5,
          frontSector: 2,
          backSector: -1,
          tex: 'a',
          endLevel: false,
          toggleSector: false,
          toggleSectorId: null,
          toggleSectorOneshot: false,
          toggleSound: null,
          toggleSoundFinish: null
        },
        {
          index: 5,
          v0: 5,
          v1: 6,
          frontSector: 2,
          backSector: -1,
          tex: 'a',
          endLevel: false,
          toggleSector: false,
          toggleSectorId: null,
          toggleSectorOneshot: false,
          toggleSound: null,
          toggleSoundFinish: null
        },
        {
          index: 6,
          v0: 6,
          v1: 7,
          frontSector: 2,
          backSector: -1,
          tex: 'a',
          endLevel: false,
          toggleSector: false,
          toggleSectorId: null,
          toggleSectorOneshot: false,
          toggleSound: null,
          toggleSoundFinish: null
        },
        {
          index: 7,
          v0: 7,
          v1: 4,
          frontSector: 2,
          backSector: -1,
          tex: 'a',
          endLevel: false,
          toggleSector: false,
          toggleSectorId: null,
          toggleSectorOneshot: false,
          toggleSound: null,
          toggleSoundFinish: null
        }
      ],
      doors: [],
      lights: [],
      particles: [],
      entities: []
    };

    expect(pickSectorIdAtWorldPoint({ x: 5, y: 5 }, map)).toBe(2);
    expect(pickSectorIdAtWorldPoint({ x: 1, y: 1 }, map)).toBe(1);
  });

  it('breaks ties by choosing the lowest sector id when areas are equal', () => {
    const map: MapViewModel = {
      sky: null,
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 }
      ],
      sectors: [
        { id: 1, floorZ: 0, floorZToggledPos: null, ceilZ: 0, floorTex: 'a', ceilTex: 'a', light: 1 },
        { id: 2, floorZ: 0, floorZToggledPos: null, ceilZ: 0, floorTex: 'a', ceilTex: 'a', light: 1 }
      ],
      walls: [
        // Sector 1 loop
        {
          index: 0,
          v0: 0,
          v1: 1,
          frontSector: 1,
          backSector: -1,
          tex: 'a',
          endLevel: false,
          toggleSector: false,
          toggleSectorId: null,
          toggleSectorOneshot: false,
          toggleSound: null,
          toggleSoundFinish: null
        },
        {
          index: 1,
          v0: 1,
          v1: 2,
          frontSector: 1,
          backSector: -1,
          tex: 'a',
          endLevel: false,
          toggleSector: false,
          toggleSectorId: null,
          toggleSectorOneshot: false,
          toggleSound: null,
          toggleSoundFinish: null
        },
        {
          index: 2,
          v0: 2,
          v1: 3,
          frontSector: 1,
          backSector: -1,
          tex: 'a',
          endLevel: false,
          toggleSector: false,
          toggleSectorId: null,
          toggleSectorOneshot: false,
          toggleSound: null,
          toggleSoundFinish: null
        },
        {
          index: 3,
          v0: 3,
          v1: 0,
          frontSector: 1,
          backSector: -1,
          tex: 'a',
          endLevel: false,
          toggleSector: false,
          toggleSectorId: null,
          toggleSectorOneshot: false,
          toggleSound: null,
          toggleSoundFinish: null
        },
        // Sector 2 loop (duplicate geometry)
        {
          index: 4,
          v0: 0,
          v1: 1,
          frontSector: 2,
          backSector: -1,
          tex: 'a',
          endLevel: false,
          toggleSector: false,
          toggleSectorId: null,
          toggleSectorOneshot: false,
          toggleSound: null,
          toggleSoundFinish: null
        },
        {
          index: 5,
          v0: 1,
          v1: 2,
          frontSector: 2,
          backSector: -1,
          tex: 'a',
          endLevel: false,
          toggleSector: false,
          toggleSectorId: null,
          toggleSectorOneshot: false,
          toggleSound: null,
          toggleSoundFinish: null
        },
        {
          index: 6,
          v0: 2,
          v1: 3,
          frontSector: 2,
          backSector: -1,
          tex: 'a',
          endLevel: false,
          toggleSector: false,
          toggleSectorId: null,
          toggleSectorOneshot: false,
          toggleSound: null,
          toggleSoundFinish: null
        },
        {
          index: 7,
          v0: 3,
          v1: 0,
          frontSector: 2,
          backSector: -1,
          tex: 'a',
          endLevel: false,
          toggleSector: false,
          toggleSectorId: null,
          toggleSectorOneshot: false,
          toggleSound: null,
          toggleSoundFinish: null
        }
      ],
      doors: [],
      lights: [],
      particles: [],
      entities: []
    };

    expect(pickSectorIdAtWorldPoint({ x: 5, y: 5 }, map)).toBe(1);
  });

  it('can pick a sector even when its boundary walls appear only as backSector', () => {
    const map: MapViewModel = {
      sky: null,
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 }
      ],
      sectors: [{ id: 7, floorZ: 0, floorZToggledPos: null, ceilZ: 0, floorTex: 'a', ceilTex: 'a', light: 1 }],
      walls: [
        {
          index: 0,
          v0: 0,
          v1: 1,
          frontSector: 999,
          backSector: 7,
          tex: 'a',
          endLevel: false,
          toggleSector: false,
          toggleSectorId: null,
          toggleSectorOneshot: false,
          toggleSound: null,
          toggleSoundFinish: null
        },
        {
          index: 1,
          v0: 1,
          v1: 2,
          frontSector: 999,
          backSector: 7,
          tex: 'a',
          endLevel: false,
          toggleSector: false,
          toggleSectorId: null,
          toggleSectorOneshot: false,
          toggleSound: null,
          toggleSoundFinish: null
        },
        {
          index: 2,
          v0: 2,
          v1: 3,
          frontSector: 999,
          backSector: 7,
          tex: 'a',
          endLevel: false,
          toggleSector: false,
          toggleSectorId: null,
          toggleSectorOneshot: false,
          toggleSound: null,
          toggleSoundFinish: null
        },
        {
          index: 3,
          v0: 3,
          v1: 0,
          frontSector: 999,
          backSector: 7,
          tex: 'a',
          endLevel: false,
          toggleSector: false,
          toggleSectorId: null,
          toggleSectorOneshot: false,
          toggleSound: null,
          toggleSoundFinish: null
        }
      ],
      doors: [],
      lights: [],
      particles: [],
      entities: []
    };

    expect(pickSectorIdAtWorldPoint({ x: 5, y: 5 }, map)).toBe(7);
    expect(pickSectorIdAtWorldPoint({ x: 50, y: 50 }, map)).toBeNull();
  });
});
