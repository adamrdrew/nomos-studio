import { pickMapSelection } from './mapPicking';
import type { MapViewModel } from './mapViewModel';
import type { WallStripPolygon } from './wallStripGeometry';

describe('pickMapSelection', () => {
  test('marker hit beats door/wall/sector', () => {
    const map: MapViewModel = {
      sky: null,
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 }
      ],
      sectors: [{ id: 1, floorZ: 0, ceilZ: 4, floorTex: 'F.PNG', ceilTex: 'C.PNG', light: 1 }],
      walls: [
        { index: 0, v0: 0, v1: 1, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { index: 1, v0: 1, v1: 2, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { index: 2, v0: 2, v1: 3, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { index: 3, v0: 3, v1: 0, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false }
      ],
      doors: [
        {
          id: 'door-1',
          wallIndex: 0,
          tex: 'D.PNG',
          startsClosed: false,
          requiredItem: null,
          requiredItemMissingMessage: null
        }
      ],
      lights: [],
      particles: [],
      entities: [{ index: 0, x: 5, y: 0, defName: 'player', yawDeg: 0 }]
    };

    const selection = pickMapSelection({
      worldPoint: { x: 5, y: 0.05 },
      viewScale: 1,
      map,
      renderMode: 'wireframe'
    });

    expect(selection).toEqual({ kind: 'entity', index: 0 });
  });

  test('door hit beats wall/sector', () => {
    const map: MapViewModel = {
      sky: null,
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 }
      ],
      sectors: [{ id: 1, floorZ: 0, ceilZ: 4, floorTex: 'F.PNG', ceilTex: 'C.PNG', light: 1 }],
      walls: [
        { index: 0, v0: 0, v1: 1, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { index: 1, v0: 1, v1: 2, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { index: 2, v0: 2, v1: 3, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { index: 3, v0: 3, v1: 0, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false }
      ],
      doors: [
        {
          id: 'door-1',
          wallIndex: 0,
          tex: 'D.PNG',
          startsClosed: false,
          requiredItem: null,
          requiredItemMissingMessage: null
        }
      ],
      lights: [],
      particles: [],
      entities: []
    };

    const selection = pickMapSelection({
      worldPoint: { x: 5, y: 0.01 },
      viewScale: 1,
      map,
      renderMode: 'wireframe'
    });

    expect(selection).toEqual({ kind: 'door', id: 'door-1' });
  });

  test('wall hit beats sector', () => {
    const map: MapViewModel = {
      sky: null,
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 }
      ],
      sectors: [{ id: 1, floorZ: 0, ceilZ: 4, floorTex: 'F.PNG', ceilTex: 'C.PNG', light: 1 }],
      walls: [
        { index: 0, v0: 0, v1: 1, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { index: 1, v0: 1, v1: 2, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { index: 2, v0: 2, v1: 3, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { index: 3, v0: 3, v1: 0, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false }
      ],
      doors: [],
      lights: [],
      particles: [],
      entities: []
    };

    const selection = pickMapSelection({
      worldPoint: { x: 5, y: 0.05 },
      viewScale: 1,
      map,
      renderMode: 'wireframe'
    });

    expect(selection).toEqual({ kind: 'wall', index: 0 });
  });

  test('sector hit occurs when nothing else qualifies', () => {
    const map: MapViewModel = {
      sky: null,
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 }
      ],
      sectors: [{ id: 1, floorZ: 0, ceilZ: 4, floorTex: 'F.PNG', ceilTex: 'C.PNG', light: 1 }],
      walls: [
        { index: 0, v0: 0, v1: 1, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { index: 1, v0: 1, v1: 2, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { index: 2, v0: 2, v1: 3, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { index: 3, v0: 3, v1: 0, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false }
      ],
      doors: [],
      lights: [],
      particles: [],
      entities: []
    };

    const selection = pickMapSelection({
      worldPoint: { x: 5, y: 5 },
      viewScale: 10,
      map,
      renderMode: 'wireframe'
    });

    expect(selection).toEqual({ kind: 'sector', id: 1 });
  });

  test('nested sectors: point inside inner sector picks inner sector (regression)', () => {
    const map: MapViewModel = {
      sky: null,
      vertices: [
        // Outer square (sector 1)
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
        // Inner square (sector 2)
        { x: 3, y: 3 },
        { x: 7, y: 3 },
        { x: 7, y: 7 },
        { x: 3, y: 7 }
      ],
      sectors: [
        { id: 1, floorZ: 0, ceilZ: 4, floorTex: 'F1.PNG', ceilTex: 'C1.PNG', light: 1 },
        { id: 2, floorZ: 0, ceilZ: 4, floorTex: 'F2.PNG', ceilTex: 'C2.PNG', light: 1 }
      ],
      walls: [
        // Outer loop (sector 1)
        { index: 0, v0: 0, v1: 1, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { index: 1, v0: 1, v1: 2, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { index: 2, v0: 2, v1: 3, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { index: 3, v0: 3, v1: 0, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        // Inner loop (sector 2)
        { index: 4, v0: 4, v1: 5, frontSector: 2, backSector: -1, tex: 'W.PNG', endLevel: false },
        { index: 5, v0: 5, v1: 6, frontSector: 2, backSector: -1, tex: 'W.PNG', endLevel: false },
        { index: 6, v0: 6, v1: 7, frontSector: 2, backSector: -1, tex: 'W.PNG', endLevel: false },
        { index: 7, v0: 7, v1: 4, frontSector: 2, backSector: -1, tex: 'W.PNG', endLevel: false }
      ],
      doors: [],
      lights: [],
      particles: [],
      entities: []
    };

    const selection = pickMapSelection({
      worldPoint: { x: 5, y: 5 },
      viewScale: 10,
      map,
      renderMode: 'wireframe'
    });

    expect(selection).toEqual({ kind: 'sector', id: 2 });
  });

  test('nested sectors: point in outer-only area still picks outer sector', () => {
    const map: MapViewModel = {
      sky: null,
      vertices: [
        // Outer square (sector 1)
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
        // Inner square (sector 2)
        { x: 3, y: 3 },
        { x: 7, y: 3 },
        { x: 7, y: 7 },
        { x: 3, y: 7 }
      ],
      sectors: [
        { id: 1, floorZ: 0, ceilZ: 4, floorTex: 'F1.PNG', ceilTex: 'C1.PNG', light: 1 },
        { id: 2, floorZ: 0, ceilZ: 4, floorTex: 'F2.PNG', ceilTex: 'C2.PNG', light: 1 }
      ],
      walls: [
        // Outer loop (sector 1)
        { index: 0, v0: 0, v1: 1, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { index: 1, v0: 1, v1: 2, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { index: 2, v0: 2, v1: 3, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { index: 3, v0: 3, v1: 0, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        // Inner loop (sector 2)
        { index: 4, v0: 4, v1: 5, frontSector: 2, backSector: -1, tex: 'W.PNG', endLevel: false },
        { index: 5, v0: 5, v1: 6, frontSector: 2, backSector: -1, tex: 'W.PNG', endLevel: false },
        { index: 6, v0: 6, v1: 7, frontSector: 2, backSector: -1, tex: 'W.PNG', endLevel: false },
        { index: 7, v0: 7, v1: 4, frontSector: 2, backSector: -1, tex: 'W.PNG', endLevel: false }
      ],
      doors: [],
      lights: [],
      particles: [],
      entities: []
    };

    const selection = pickMapSelection({
      worldPoint: { x: 1.5, y: 1.5 },
      viewScale: 10,
      map,
      renderMode: 'wireframe'
    });

    expect(selection).toEqual({ kind: 'sector', id: 1 });
  });

  test('nested sectors: if containing sector areas tie, lowest sector id wins', () => {
    const map: MapViewModel = {
      sky: null,
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 }
      ],
      sectors: [
        { id: 1, floorZ: 0, ceilZ: 4, floorTex: 'F1.PNG', ceilTex: 'C1.PNG', light: 1 },
        { id: 2, floorZ: 0, ceilZ: 4, floorTex: 'F2.PNG', ceilTex: 'C2.PNG', light: 1 }
      ],
      walls: [
        // Identical geometry duplicated across two sector ids.
        { index: 0, v0: 0, v1: 1, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { index: 1, v0: 1, v1: 2, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { index: 2, v0: 2, v1: 3, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { index: 3, v0: 3, v1: 0, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { index: 4, v0: 0, v1: 1, frontSector: 2, backSector: -1, tex: 'W.PNG', endLevel: false },
        { index: 5, v0: 1, v1: 2, frontSector: 2, backSector: -1, tex: 'W.PNG', endLevel: false },
        { index: 6, v0: 2, v1: 3, frontSector: 2, backSector: -1, tex: 'W.PNG', endLevel: false },
        { index: 7, v0: 3, v1: 0, frontSector: 2, backSector: -1, tex: 'W.PNG', endLevel: false }
      ],
      doors: [],
      lights: [],
      particles: [],
      entities: []
    };

    const selection = pickMapSelection({
      worldPoint: { x: 5, y: 5 },
      viewScale: 10,
      map,
      renderMode: 'wireframe'
    });

    expect(selection).toEqual({ kind: 'sector', id: 1 });
  });

  test('nested sectors: marker priority still beats sector picking (non-regression)', () => {
    const map: MapViewModel = {
      sky: null,
      vertices: [
        // Outer square (sector 1)
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
        // Inner square (sector 2)
        { x: 3, y: 3 },
        { x: 7, y: 3 },
        { x: 7, y: 7 },
        { x: 3, y: 7 }
      ],
      sectors: [
        { id: 1, floorZ: 0, ceilZ: 4, floorTex: 'F1.PNG', ceilTex: 'C1.PNG', light: 1 },
        { id: 2, floorZ: 0, ceilZ: 4, floorTex: 'F2.PNG', ceilTex: 'C2.PNG', light: 1 }
      ],
      walls: [
        // Outer loop (sector 1)
        { index: 0, v0: 0, v1: 1, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { index: 1, v0: 1, v1: 2, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { index: 2, v0: 2, v1: 3, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { index: 3, v0: 3, v1: 0, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        // Inner loop (sector 2)
        { index: 4, v0: 4, v1: 5, frontSector: 2, backSector: -1, tex: 'W.PNG', endLevel: false },
        { index: 5, v0: 5, v1: 6, frontSector: 2, backSector: -1, tex: 'W.PNG', endLevel: false },
        { index: 6, v0: 6, v1: 7, frontSector: 2, backSector: -1, tex: 'W.PNG', endLevel: false },
        { index: 7, v0: 7, v1: 4, frontSector: 2, backSector: -1, tex: 'W.PNG', endLevel: false }
      ],
      doors: [],
      lights: [],
      particles: [],
      entities: [{ index: 0, x: 5, y: 5, defName: 'player', yawDeg: 0 }]
    };

    const selection = pickMapSelection({
      worldPoint: { x: 5, y: 5 },
      viewScale: 10,
      map,
      renderMode: 'wireframe'
    });

    expect(selection).toEqual({ kind: 'entity', index: 0 });
  });

  test('multiple walls: closest wall wins', () => {
    const map: MapViewModel = {
      sky: null,
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
        { x: 0, y: 1 },
        { x: 10, y: 1 }
      ],
      sectors: [{ id: 1, floorZ: 0, ceilZ: 4, floorTex: 'F.PNG', ceilTex: 'C.PNG', light: 1 }],
      walls: [
        { index: 0, v0: 0, v1: 1, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { index: 4, v0: 4, v1: 5, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { index: 1, v0: 1, v1: 2, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { index: 2, v0: 2, v1: 3, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { index: 3, v0: 3, v1: 0, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false }
      ],
      doors: [],
      lights: [],
      particles: [],
      entities: []
    };

    const selection = pickMapSelection({
      worldPoint: { x: 5, y: 0.7 },
      viewScale: 10,
      map,
      renderMode: 'wireframe'
    });

    expect(selection).toEqual({ kind: 'wall', index: 4 });
  });

  test('textured mode: clicking inside the rendered wall strip selects wall even when centerline distance exceeds threshold (regression)', () => {
    const map: MapViewModel = {
      sky: null,
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 }
      ],
      sectors: [{ id: 1, floorZ: 0, ceilZ: 4, floorTex: 'F.PNG', ceilTex: 'C.PNG', light: 1 }],
      walls: [
        { index: 0, v0: 0, v1: 1, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { index: 1, v0: 1, v1: 2, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { index: 2, v0: 2, v1: 3, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { index: 3, v0: 3, v1: 0, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false }
      ],
      doors: [],
      lights: [],
      particles: [],
      entities: []
    };

    // Wall strip polygon around wall index 0: (0,0)->(10,0) extruded upward by 0.2 world units.
    const texturedWallPolygons: readonly WallStripPolygon[] = [
      {
        wallIndex: 0,
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 0.2 },
          { x: 0, y: 0.2 }
        ]
      }
    ];

    // At scale 64, centerline distance 0.18 world is 11.52px > 10px; without polygon hit, this would fall through to sector.
    const selection = pickMapSelection({
      worldPoint: { x: 5, y: 0.18 },
      viewScale: 64,
      map,
      renderMode: 'textured',
      texturedWallPolygons
    });

    expect(selection).toEqual({ kind: 'wall', index: 0 });
  });

  test('particle marker hit is selectable (marker priority band)', () => {
    const map: MapViewModel = {
      sky: null,
      vertices: [],
      sectors: [],
      walls: [],
      doors: [],
      lights: [],
      particles: [{ index: 0, x: 5, y: 5 }],
      entities: []
    };

    const selection = pickMapSelection({
      worldPoint: { x: 5.05, y: 5 },
      viewScale: 1,
      map,
      renderMode: 'wireframe'
    });

    expect(selection).toEqual({ kind: 'particle', index: 0 });
  });

  test('light marker hit is selectable (marker priority band)', () => {
    const map: MapViewModel = {
      sky: null,
      vertices: [],
      sectors: [],
      walls: [],
      doors: [],
      lights: [{ index: 0, x: 2, y: 3, radius: 1, intensity: 1, color: { r: 255, g: 255, b: 255 } }],
      particles: [],
      entities: []
    };

    const selection = pickMapSelection({
      worldPoint: { x: 2.05, y: 3 },
      viewScale: 1,
      map,
      renderMode: 'wireframe'
    });

    expect(selection).toEqual({ kind: 'light', index: 0 });
  });

  test('textured mode without strip polygons still picks walls by centerline threshold', () => {
    const map: MapViewModel = {
      sky: null,
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 }
      ],
      sectors: [{ id: 1, floorZ: 0, ceilZ: 4, floorTex: 'F.PNG', ceilTex: 'C.PNG', light: 1 }],
      walls: [
        { index: 0, v0: 0, v1: 1, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { index: 1, v0: 1, v1: 2, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { index: 2, v0: 2, v1: 3, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { index: 3, v0: 3, v1: 0, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false }
      ],
      doors: [],
      lights: [],
      particles: [],
      entities: []
    };

    const selection = pickMapSelection({
      worldPoint: { x: 5, y: 0.05 },
      viewScale: 1,
      map,
      renderMode: 'textured'
    });

    expect(selection).toEqual({ kind: 'wall', index: 0 });
  });

  test('door referencing missing wall index is skipped safely', () => {
    const map: MapViewModel = {
      sky: null,
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 }
      ],
      sectors: [{ id: 1, floorZ: 0, ceilZ: 4, floorTex: 'F.PNG', ceilTex: 'C.PNG', light: 1 }],
      walls: [
        { index: 0, v0: 0, v1: 1, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { index: 1, v0: 1, v1: 2, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { index: 2, v0: 2, v1: 3, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { index: 3, v0: 3, v1: 0, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false }
      ],
      doors: [
        {
          id: 'door-missing-wall',
          wallIndex: 999,
          tex: 'D.PNG',
          startsClosed: false,
          requiredItem: null,
          requiredItemMissingMessage: null
        }
      ],
      lights: [],
      particles: [],
      entities: []
    };

    const selection = pickMapSelection({
      worldPoint: { x: 5, y: 0.05 },
      viewScale: 1,
      map,
      renderMode: 'wireframe'
    });

    expect(selection).toEqual({ kind: 'wall', index: 0 });
  });

  test('door referencing a wall with missing vertices is skipped safely (sector still selectable)', () => {
    const map: MapViewModel = {
      sky: null,
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 }
      ],
      sectors: [{ id: 1, floorZ: 0, ceilZ: 4, floorTex: 'F.PNG', ceilTex: 'C.PNG', light: 1 }],
      walls: [
        { index: 0, v0: 0, v1: 1, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { index: 1, v0: 1, v1: 2, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { index: 2, v0: 2, v1: 3, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { index: 3, v0: 3, v1: 0, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { index: 4, v0: 999, v1: 1, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false }
      ],
      doors: [
        {
          id: 'door-invalid-vertices',
          wallIndex: 4,
          tex: 'D.PNG',
          startsClosed: false,
          requiredItem: null,
          requiredItemMissingMessage: null
        }
      ],
      lights: [],
      particles: [],
      entities: []
    };

    const selection = pickMapSelection({
      worldPoint: { x: 5, y: 5 },
      viewScale: 10,
      map,
      renderMode: 'wireframe'
    });

    expect(selection).toEqual({ kind: 'sector', id: 1 });
  });

  test('returns null when point is not inside any sector and no other candidates qualify', () => {
    const map: MapViewModel = {
      sky: null,
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 }
      ],
      sectors: [{ id: 1, floorZ: 0, ceilZ: 4, floorTex: 'F.PNG', ceilTex: 'C.PNG', light: 1 }],
      walls: [
        { index: 0, v0: 0, v1: 1, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { index: 1, v0: 1, v1: 2, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { index: 2, v0: 2, v1: 3, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { index: 3, v0: 3, v1: 0, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false }
      ],
      doors: [],
      lights: [],
      particles: [],
      entities: []
    };

    const selection = pickMapSelection({
      worldPoint: { x: 20, y: 20 },
      viewScale: 10,
      map,
      renderMode: 'wireframe'
    });

    expect(selection).toBeNull();
  });
});
