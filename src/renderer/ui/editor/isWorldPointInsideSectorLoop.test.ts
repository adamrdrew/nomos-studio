import { isWorldPointInSector, isWorldPointInsideSectorLoop } from './map/sectorContainment';
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
