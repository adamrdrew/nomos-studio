import type { RoomMapGeometry } from './mapRoomGeometry';
import { extractSingleSectorBoundaryLoop } from './mapSectorBoundary';

function makeGeometry(args: {
  vertices: readonly { x: number; y: number }[];
  walls: readonly { index: number; v0: number; v1: number; frontSectorId: number; backSectorId: number }[];
  sectorIds: readonly number[];
}): RoomMapGeometry {
  return {
    vertices: args.vertices,
    walls: args.walls,
    sectorIds: args.sectorIds
  };
}

describe('extractSingleSectorBoundaryLoop', () => {
  test('extracts a rectangular loop from frontSector edges', () => {
    const geometry = makeGeometry({
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 }
      ],
      sectorIds: [7],
      walls: [
        { index: 0, v0: 0, v1: 1, frontSectorId: 7, backSectorId: -1 },
        { index: 1, v0: 1, v1: 2, frontSectorId: 7, backSectorId: -1 },
        { index: 2, v0: 2, v1: 3, frontSectorId: 7, backSectorId: -1 },
        { index: 3, v0: 3, v1: 0, frontSectorId: 7, backSectorId: -1 }
      ]
    });

    const result = extractSingleSectorBoundaryLoop(geometry, 7);
    if (result.kind !== 'sector-boundary-loop') {
      throw new Error(`Expected loop, got error: ${result.reason}`);
    }

    expect(result.polygon).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 }
    ]);
    expect(result.wallIndices).toEqual([0, 1, 2, 3]);
  });

  test('extracts a concave loop', () => {
    // L-shape:
    // (0,0)->(6,0)->(6,2)->(2,2)->(2,6)->(0,6)
    const geometry = makeGeometry({
      vertices: [
        { x: 0, y: 0 },
        { x: 6, y: 0 },
        { x: 6, y: 2 },
        { x: 2, y: 2 },
        { x: 2, y: 6 },
        { x: 0, y: 6 }
      ],
      sectorIds: [1],
      walls: [
        { index: 0, v0: 0, v1: 1, frontSectorId: 1, backSectorId: -1 },
        { index: 1, v0: 1, v1: 2, frontSectorId: 1, backSectorId: -1 },
        { index: 2, v0: 2, v1: 3, frontSectorId: 1, backSectorId: -1 },
        { index: 3, v0: 3, v1: 4, frontSectorId: 1, backSectorId: -1 },
        { index: 4, v0: 4, v1: 5, frontSectorId: 1, backSectorId: -1 },
        { index: 5, v0: 5, v1: 0, frontSectorId: 1, backSectorId: -1 }
      ]
    });

    const result = extractSingleSectorBoundaryLoop(geometry, 1);
    if (result.kind !== 'sector-boundary-loop') {
      throw new Error(`Expected loop, got error: ${result.reason}`);
    }

    expect(result.polygon).toEqual([
      { x: 0, y: 0 },
      { x: 6, y: 0 },
      { x: 6, y: 2 },
      { x: 2, y: 2 },
      { x: 2, y: 6 },
      { x: 0, y: 6 }
    ]);
    expect(result.wallIndices).toEqual([0, 1, 2, 3, 4, 5]);
  });

  test('can extract a loop even when some boundary walls have reversed vertex ordering', () => {
    const geometry = makeGeometry({
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 }
      ],
      sectorIds: [7],
      walls: [
        { index: 0, v0: 0, v1: 1, frontSectorId: 7, backSectorId: -1 },
        // Reversed compared to the others (would break a directed loop walker).
        { index: 1, v0: 2, v1: 1, frontSectorId: 7, backSectorId: -1 },
        { index: 2, v0: 2, v1: 3, frontSectorId: 7, backSectorId: -1 },
        { index: 3, v0: 3, v1: 0, frontSectorId: 7, backSectorId: -1 }
      ]
    });

    const result = extractSingleSectorBoundaryLoop(geometry, 7);
    if (result.kind !== 'sector-boundary-loop') {
      throw new Error(`Expected loop, got error: ${result.reason}`);
    }

    expect(result.polygon).toHaveLength(4);
    expect(new Set(result.wallIndices)).toEqual(new Set([0, 1, 2, 3]));
  });

  test('prefers frontSector edges when portal twin walls exist (avoids open-loop)', () => {
    // Two sectors share a portal edge represented by two wall records:
    // - sector 1 wall: front=1, back=2
    // - sector 2 wall: front=2, back=1
    // For sector 1 boundary extraction, we must not include the sector 2 wall via backSector==1,
    // otherwise the edge is double-counted and the loop walk can fail.
    const geometry = makeGeometry({
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 }
      ],
      sectorIds: [1, 2],
      walls: [
        // Sector 1 loop
        { index: 0, v0: 0, v1: 1, frontSectorId: 1, backSectorId: -1 },
        // Portal wall (shared edge) for sector 1
        { index: 1, v0: 1, v1: 2, frontSectorId: 1, backSectorId: 2 },
        { index: 2, v0: 2, v1: 3, frontSectorId: 1, backSectorId: -1 },
        { index: 3, v0: 3, v1: 0, frontSectorId: 1, backSectorId: -1 },
        // Twin portal wall for sector 2 (would be included by backSectorId===1 if not careful)
        { index: 99, v0: 2, v1: 1, frontSectorId: 2, backSectorId: 1 }
      ]
    });

    const result = extractSingleSectorBoundaryLoop(geometry, 1);
    if (result.kind !== 'sector-boundary-loop') {
      throw new Error(`Expected loop, got error: ${result.reason}`);
    }

    expect(result.polygon).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 }
    ]);
    expect(result.wallIndices).toEqual([0, 1, 2, 3]);
  });

  test('extracts a loop when the sector is only referenced as backSector', () => {
    const geometry = makeGeometry({
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 }
      ],
      sectorIds: [7],
      walls: [
        // Note: these edges are oriented for frontSector=999, but backSector=7.
        { index: 0, v0: 1, v1: 0, frontSectorId: 999, backSectorId: 7 },
        { index: 1, v0: 2, v1: 1, frontSectorId: 999, backSectorId: 7 },
        { index: 2, v0: 3, v1: 2, frontSectorId: 999, backSectorId: 7 },
        { index: 3, v0: 0, v1: 3, frontSectorId: 999, backSectorId: 7 }
      ]
    });

    const result = extractSingleSectorBoundaryLoop(geometry, 7);
    if (result.kind !== 'sector-boundary-loop') {
      throw new Error(`Expected loop, got error: ${result.reason}`);
    }

    expect(result.polygon).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 }
    ]);
  });

  test('ignores internal walls where frontSectorId and backSectorId are the same sector', () => {
    const geometry = makeGeometry({
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 }
      ],
      sectorIds: [7],
      walls: [
        { index: 0, v0: 0, v1: 1, frontSectorId: 7, backSectorId: -1 },
        { index: 1, v0: 1, v1: 2, frontSectorId: 7, backSectorId: -1 },
        { index: 2, v0: 2, v1: 3, frontSectorId: 7, backSectorId: -1 },
        { index: 3, v0: 3, v1: 0, frontSectorId: 7, backSectorId: -1 },
        // Diagonal internal wall inside the same sector: should be ignored for boundary extraction.
        { index: 9, v0: 0, v1: 2, frontSectorId: 7, backSectorId: 7 }
      ]
    });

    const result = extractSingleSectorBoundaryLoop(geometry, 7);
    if (result.kind !== 'sector-boundary-loop') {
      throw new Error(`Expected loop, got error: ${result.reason}`);
    }

    expect(result.polygon).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 }
    ]);
    expect(result.wallIndices).toEqual([0, 1, 2, 3]);
  });

  test('returns ambiguous when multiple next edges match the current vertex', () => {
    const geometry = makeGeometry({
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
        { x: -10, y: 0 }
      ],
      sectorIds: [1],
      walls: [
        // Two edges start at vertex 1, causing ambiguity on the first step.
        { index: 0, v0: 0, v1: 1, frontSectorId: 1, backSectorId: -1 },
        { index: 1, v0: 1, v1: 2, frontSectorId: 1, backSectorId: -1 },
        { index: 2, v0: 1, v1: 4, frontSectorId: 1, backSectorId: -1 },
        { index: 3, v0: 2, v1: 3, frontSectorId: 1, backSectorId: -1 },
        { index: 4, v0: 3, v1: 0, frontSectorId: 1, backSectorId: -1 }
      ]
    });

    const result = extractSingleSectorBoundaryLoop(geometry, 1);
    expect(result.kind).toBe('sector-boundary-loop-error');
    if (result.kind === 'sector-boundary-loop-error') {
      expect(result.reason).toBe('ambiguous');
    }
  });
});
