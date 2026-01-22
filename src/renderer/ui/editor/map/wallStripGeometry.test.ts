import { computeTexturedWallStripPolygons } from './wallStripGeometry';
import type { MapViewModel } from './mapViewModel';

type Point = Readonly<{ x: number; y: number }>;

const wallDefaults = {
  toggleSector: false,
  toggleSectorId: null,
  toggleSectorOneshot: false,
  toggleSound: null,
  toggleSoundFinish: null
} as const;

const sectorDefaults = {
  floorZToggledPos: null
} as const;

function expectPointClose(actual: Point, expected: Point, epsilon = 1e-6): void {
  expect(Math.abs(actual.x - expected.x)).toBeLessThanOrEqual(epsilon);
  expect(Math.abs(actual.y - expected.y)).toBeLessThanOrEqual(epsilon);
}

function expectPointsMatch(a: Point, b: Point, epsilon = 1e-6): void {
  expect(Math.abs(a.x - b.x)).toBeLessThanOrEqual(epsilon);
  expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(epsilon);
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

describe('computeTexturedWallStripPolygons', () => {
  test('CW loop winding: inward offset flips to the right side of directed edges', () => {
    // CW square: (0,0)->(0,10)->(10,10)->(10,0)->(0,0)
    const map: MapViewModel = {
      sky: null,
      vertices: [
        { x: 0, y: 0 },
        { x: 0, y: 10 },
        { x: 10, y: 10 },
        { x: 10, y: 0 }
      ],
      sectors: [{ ...sectorDefaults, id: 1, floorZ: 0, ceilZ: 4, floorTex: 'F.PNG', ceilTex: 'C.PNG', light: 1 }],
      walls: [
        { ...wallDefaults, index: 0, v0: 0, v1: 1, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { ...wallDefaults, index: 1, v0: 1, v1: 2, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { ...wallDefaults, index: 2, v0: 2, v1: 3, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { ...wallDefaults, index: 3, v0: 3, v1: 0, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false }
      ],
      doors: [],
      lights: [],
      particles: [],
      entities: []
    };

    const thickness = 2;
    const polys = computeTexturedWallStripPolygons(map, thickness);
    const byIndex = new Map(polys.map((p) => [p.wallIndex, p] as const));

    const w0 = byIndex.get(0);
    expect(w0).toBeTruthy();

    // w0 is (0,0)->(0,10). For a CW loop, the interior is on the RIGHT side of the directed edge,
    // so the one-sided offset edge should have positive X.
    expectPointClose(w0!.points[0]!, { x: 0, y: 0 });
    expectPointClose(w0!.points[1]!, { x: 0, y: 10 });

    const offsetA = w0!.points[2]!;
    const offsetB = w0!.points[3]!;
    expect(offsetA.x).toBeGreaterThan(0.5);
    expect(offsetB.x).toBeGreaterThan(0.5);
  });

  test('square loop: adjacent walls share join points (no corner gaps)', () => {
    const map: MapViewModel = {
      sky: null,
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 }
      ],
      sectors: [{ ...sectorDefaults, id: 1, floorZ: 0, ceilZ: 4, floorTex: 'F.PNG', ceilTex: 'C.PNG', light: 1 }],
      walls: [
        { ...wallDefaults, index: 0, v0: 0, v1: 1, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { ...wallDefaults, index: 1, v0: 1, v1: 2, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { ...wallDefaults, index: 2, v0: 2, v1: 3, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { ...wallDefaults, index: 3, v0: 3, v1: 0, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false }
      ],
      doors: [],
      lights: [],
      particles: [],
      entities: []
    };

    const polys = computeTexturedWallStripPolygons(map, 2);
    const byIndex = new Map(polys.map((p) => [p.wallIndex, p] as const));

    const w0 = byIndex.get(0);
    const w1 = byIndex.get(1);
    const w2 = byIndex.get(2);
    const w3 = byIndex.get(3);

    expect(w0).toBeTruthy();
    expect(w1).toBeTruthy();
    expect(w2).toBeTruthy();
    expect(w3).toBeTruthy();

    // End of w0 (vertex 1) should match start of w1.
    expectPointsMatch(w0!.points[1]!, w1!.points[0]!);
    expectPointsMatch(w0!.points[2]!, w1!.points[3]!);

    // End of w1 (vertex 2) should match start of w2.
    expectPointsMatch(w1!.points[1]!, w2!.points[0]!);
    expectPointsMatch(w1!.points[2]!, w2!.points[3]!);

    // End of w2 (vertex 3) should match start of w3.
    expectPointsMatch(w2!.points[1]!, w3!.points[0]!);
    expectPointsMatch(w2!.points[2]!, w3!.points[3]!);

    // End of w3 (vertex 0) should match start of w0.
    expectPointsMatch(w3!.points[1]!, w0!.points[0]!);
    expectPointsMatch(w3!.points[2]!, w0!.points[3]!);
  });

  test('concave loop: join points are finite and shared at the concave corner', () => {
    // L-shape: concave vertex at (6,2)
    const map: MapViewModel = {
      sky: null,
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 6 },
        { x: 6, y: 6 },
        { x: 6, y: 2 },
        { x: 0, y: 2 }
      ],
      sectors: [{ ...sectorDefaults, id: 1, floorZ: 0, ceilZ: 4, floorTex: 'F.PNG', ceilTex: 'C.PNG', light: 1 }],
      walls: [
        { ...wallDefaults, index: 0, v0: 0, v1: 1, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { ...wallDefaults, index: 1, v0: 1, v1: 2, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { ...wallDefaults, index: 2, v0: 2, v1: 3, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { ...wallDefaults, index: 3, v0: 3, v1: 4, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { ...wallDefaults, index: 4, v0: 4, v1: 5, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { ...wallDefaults, index: 5, v0: 5, v1: 0, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false }
      ],
      doors: [],
      lights: [],
      particles: [],
      entities: []
    };

    const polys = computeTexturedWallStripPolygons(map, 2);
    const byIndex = new Map(polys.map((p) => [p.wallIndex, p] as const));

    const w3 = byIndex.get(3); // edge (6,6)->(6,2)
    const w4 = byIndex.get(4); // edge (6,2)->(0,2)

    expect(w3).toBeTruthy();
    expect(w4).toBeTruthy();

    // Shared vertex is vertex index 4 (6,2).
    // End of w3 should match start of w4.
    expectPointsMatch(w3!.points[1]!, w4!.points[0]!);
    expectPointsMatch(w3!.points[2]!, w4!.points[3]!);

    for (const poly of polys) {
      for (const pt of poly.points) {
        expect(Number.isFinite(pt.x)).toBe(true);
        expect(Number.isFinite(pt.y)).toBe(true);
        // Sanity bound: should not explode for this small map.
        expect(Math.abs(pt.x)).toBeLessThan(1000);
        expect(Math.abs(pt.y)).toBeLessThan(1000);
      }
    }
  });

  test('near-collinear corner: join stays near the vertex (no numeric explosion)', () => {
    // Slight bend at vertex 1.
    const map: MapViewModel = {
      sky: null,
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 20, y: 0.00001 },
        { x: 20, y: 10 },
        { x: 0, y: 10 }
      ],
      sectors: [{ ...sectorDefaults, id: 1, floorZ: 0, ceilZ: 4, floorTex: 'F.PNG', ceilTex: 'C.PNG', light: 1 }],
      walls: [
        { ...wallDefaults, index: 0, v0: 0, v1: 1, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { ...wallDefaults, index: 1, v0: 1, v1: 2, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { ...wallDefaults, index: 2, v0: 2, v1: 3, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { ...wallDefaults, index: 3, v0: 3, v1: 4, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { ...wallDefaults, index: 4, v0: 4, v1: 0, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false }
      ],
      doors: [],
      lights: [],
      particles: [],
      entities: []
    };

    const thickness = 2;
    const half = thickness / 2;
    const polys = computeTexturedWallStripPolygons(map, thickness, { parallelEpsilon: 1e-3 });
    const byIndex = new Map(polys.map((p) => [p.wallIndex, p] as const));

    const w0 = byIndex.get(0);
    const w1 = byIndex.get(1);

    expect(w0).toBeTruthy();
    expect(w1).toBeTruthy();

    // Shared vertex is vertex 1.
    const v = map.vertices[1]!;

    // At least one of the shared join points should be close to the vertex by ~half thickness.
    const dA = distance(w0!.points[1]!, v);
    const dB = distance(w0!.points[2]!, v);
    const dC = distance(w1!.points[0]!, v);
    const dD = distance(w1!.points[3]!, v);

    const max = Math.max(dA, dB, dC, dD);
    expect(max).toBeLessThanOrEqual(10 * half);
  });

  test('degenerate wall: zero-length segment is skipped', () => {
    const map: MapViewModel = {
      sky: null,
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 }
      ],
      sectors: [{ ...sectorDefaults, id: 1, floorZ: 0, ceilZ: 4, floorTex: 'F.PNG', ceilTex: 'C.PNG', light: 1 }],
      walls: [
        { ...wallDefaults, index: 0, v0: 0, v1: 1, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        // Degenerate (v2 -> v2) not part of sector loop.
        { ...wallDefaults, index: 99, v0: 2, v1: 2, frontSector: 999, backSector: -1, tex: 'W.PNG', endLevel: false },
        { ...wallDefaults, index: 1, v0: 1, v1: 2, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { ...wallDefaults, index: 2, v0: 2, v1: 3, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { ...wallDefaults, index: 3, v0: 3, v1: 0, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false }
      ],
      doors: [],
      lights: [],
      particles: [],
      entities: []
    };

    const polys = computeTexturedWallStripPolygons(map, 2);
    const indices = new Set(polys.map((p) => p.wallIndex));
    expect(indices.has(99)).toBe(false);
  });

  test('miter limit: acute corner clamps join distance', () => {
    const map: MapViewModel = {
      sky: null,
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 20, y: 1 },
        { x: 20, y: 10 },
        { x: 0, y: 10 }
      ],
      sectors: [{ ...sectorDefaults, id: 1, floorZ: 0, ceilZ: 4, floorTex: 'F.PNG', ceilTex: 'C.PNG', light: 1 }],
      walls: [
        { ...wallDefaults, index: 0, v0: 0, v1: 1, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { ...wallDefaults, index: 1, v0: 1, v1: 2, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { ...wallDefaults, index: 2, v0: 2, v1: 3, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { ...wallDefaults, index: 3, v0: 3, v1: 4, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { ...wallDefaults, index: 4, v0: 4, v1: 0, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false }
      ],
      doors: [],
      lights: [],
      particles: [],
      entities: []
    };

    const thickness = 2;
    const miterLimit = 1.5;

    const polys = computeTexturedWallStripPolygons(map, thickness, { miterLimit });
    const byIndex = new Map(polys.map((p) => [p.wallIndex, p] as const));

    const w0 = byIndex.get(0);
    const w1 = byIndex.get(1);
    expect(w0).toBeTruthy();
    expect(w1).toBeTruthy();

    // Acute vertex is vertex 1.
    const v = map.vertices[1]!;

    // For one-sided strips the "join" is on the offset edge only.
    const distances = [distance(w0!.points[2]!, v), distance(w1!.points[3]!, v)];

    const max = Math.max(...distances);
    expect(max).toBeLessThanOrEqual(miterLimit * thickness + 1e-3);
  });

  test('thickness <= 0: returns empty', () => {
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

    expect(computeTexturedWallStripPolygons(map, 0)).toEqual([]);
    expect(computeTexturedWallStripPolygons(map, -1)).toEqual([]);
  });

  test('simple capped strip fallback emits a quad', () => {
    const map: MapViewModel = {
      sky: null,
      vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
      sectors: [],
      walls: [{ ...wallDefaults, index: 0, v0: 0, v1: 1, frontSector: 123, backSector: -1, tex: 'W.PNG', endLevel: false }],
      doors: [],
      lights: [],
      particles: [],
      entities: []
    };

    const polys = computeTexturedWallStripPolygons(map, 2);
    expect(polys).toHaveLength(1);
    expect(polys[0]!.points).toHaveLength(4);

    // Expect symmetry around the centerline.
    expectPointClose(polys[0]!.points[0]!, { x: 0, y: 1 });
    expectPointClose(polys[0]!.points[3]!, { x: 0, y: -1 });
    expectPointClose(polys[0]!.points[1]!, { x: 10, y: 1 });
    expectPointClose(polys[0]!.points[2]!, { x: 10, y: -1 });
  });

  test('adjacent sectors (duplicated shared boundary walls): offset strips go to opposite sides', () => {
    // Two adjacent CCW rooms sharing the boundary x=10.
    // Sector 1 (left): (0,0)->(10,0)->(10,10)->(0,10)
    // Sector 2 (right): (10,0)->(20,0)->(20,10)->(10,10)
    // Shared boundary is represented by two walls (one per sector) with opposite directions.
    const map: MapViewModel = {
      sky: null,
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
        { x: 20, y: 0 },
        { x: 20, y: 10 }
      ],
      sectors: [
        { ...sectorDefaults, id: 1, floorZ: 0, ceilZ: 4, floorTex: 'F.PNG', ceilTex: 'C.PNG', light: 1 },
        { ...sectorDefaults, id: 2, floorZ: 0, ceilZ: 4, floorTex: 'F.PNG', ceilTex: 'C.PNG', light: 1 }
      ],
      walls: [
        // Sector 1 boundary.
        { ...wallDefaults, index: 0, v0: 0, v1: 1, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { ...wallDefaults, index: 1, v0: 1, v1: 2, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false }, // shared (up)
        { ...wallDefaults, index: 2, v0: 2, v1: 3, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },
        { ...wallDefaults, index: 3, v0: 3, v1: 0, frontSector: 1, backSector: -1, tex: 'W.PNG', endLevel: false },

        // Sector 2 boundary.
        { ...wallDefaults, index: 4, v0: 1, v1: 4, frontSector: 2, backSector: -1, tex: 'W.PNG', endLevel: false },
        { ...wallDefaults, index: 5, v0: 4, v1: 5, frontSector: 2, backSector: -1, tex: 'W.PNG', endLevel: false },
        { ...wallDefaults, index: 6, v0: 5, v1: 2, frontSector: 2, backSector: -1, tex: 'W.PNG', endLevel: false },
        { ...wallDefaults, index: 7, v0: 2, v1: 1, frontSector: 2, backSector: -1, tex: 'W.PNG', endLevel: false } // shared (down)
      ],
      doors: [],
      lights: [],
      particles: [],
      entities: []
    };

    const thickness = 2;
    const polys = computeTexturedWallStripPolygons(map, thickness);
    const byIndex = new Map(polys.map((p) => [p.wallIndex, p] as const));

    const sharedLeft = byIndex.get(1);
    const sharedRight = byIndex.get(7);
    expect(sharedLeft).toBeTruthy();
    expect(sharedRight).toBeTruthy();

    // Both centerlines lie on x=10.
    expectPointClose(sharedLeft!.points[0]!, { x: 10, y: 0 });
    expectPointClose(sharedLeft!.points[1]!, { x: 10, y: 10 });
    expectPointClose(sharedRight!.points[0]!, { x: 10, y: 10 });
    expectPointClose(sharedRight!.points[1]!, { x: 10, y: 0 });

    // Offset edges should go into each sector interior:
    // - left sector interior is x < 10
    // - right sector interior is x > 10
    const leftOffsets = [sharedLeft!.points[2]!, sharedLeft!.points[3]!];
    const rightOffsets = [sharedRight!.points[2]!, sharedRight!.points[3]!];

    for (const point of leftOffsets) {
      expect(point.x).toBeLessThan(9.5);
    }
    for (const point of rightOffsets) {
      expect(point.x).toBeGreaterThan(10.5);
    }
  });
});
