import type { RoomMapGeometry, Vec2 } from './mapRoomGeometry';

export type SectorBoundaryLoop = Readonly<{
  kind: 'sector-boundary-loop';

  // World-space polygon vertices (closed implicitly).
  polygon: readonly Vec2[];

  // Wall indices aligned with polygon edges:
  // wallIndices[i] corresponds to edge polygon[i] -> polygon[(i+1)%n].
  wallIndices: readonly number[];
}>;

export type SectorBoundaryLoopError = Readonly<{
  kind: 'sector-boundary-loop-error';
  reason:
    | 'no-edges'
    | 'too-few-edges'
    | 'open-loop'
    | 'ambiguous'
    | 'missing-vertex'
    | 'non-simple';
}>;

type DirectedEdge = Readonly<{ start: number; end: number; wallIndex: number }>;
type UndirectedEdge = Readonly<{ a: number; b: number; wallIndex: number }>;

const ANGLE_EPSILON = 1e-6;

function isValidVertexIndex(geometry: RoomMapGeometry, index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < geometry.vertices.length;
}

function buildDirectedEdgesForSector(geometry: RoomMapGeometry, sectorId: number): readonly DirectedEdge[] {
  const frontEdges: DirectedEdge[] = [];
  const backEdges: DirectedEdge[] = [];

  for (const wall of geometry.walls) {
    // Internal wall: both sides are the same sector, so it is not part of the sector boundary loop.
    if (wall.frontSectorId === sectorId && wall.backSectorId === sectorId) {
      continue;
    }

    if (wall.frontSectorId === sectorId) {
      frontEdges.push({ start: wall.v0, end: wall.v1, wallIndex: wall.index });
      continue;
    }

    if (wall.backSectorId === sectorId) {
      // Flip orientation so the sector boundary is traversed consistently.
      // NOTE: We only use these edges if the sector has no front edges (legacy/odd maps).
      backEdges.push({ start: wall.v1, end: wall.v0, wallIndex: wall.index });
    }
  }

  return frontEdges.length > 0 ? frontEdges : backEdges;
}

function buildUndirectedEdgesForSector(geometry: RoomMapGeometry, sectorId: number): readonly UndirectedEdge[] {
  const frontEdges: UndirectedEdge[] = [];
  const backEdges: UndirectedEdge[] = [];

  for (const wall of geometry.walls) {
    // Internal wall: both sides are the same sector, so it is not part of the sector boundary loop.
    if (wall.frontSectorId === sectorId && wall.backSectorId === sectorId) {
      continue;
    }

    if (wall.frontSectorId === sectorId) {
      frontEdges.push({ a: wall.v0, b: wall.v1, wallIndex: wall.index });
      continue;
    }

    if (wall.backSectorId === sectorId) {
      // NOTE: Only used when no front edges exist for this sector.
      backEdges.push({ a: wall.v1, b: wall.v0, wallIndex: wall.index });
    }
  }

  return frontEdges.length > 0 ? frontEdges : backEdges;
}

function cross(a: Vec2, b: Vec2): number {
  return a.x * b.y - a.y * b.x;
}

function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

function angleFromDirToDir(prevDir: Vec2, nextDir: Vec2): number {
  // Signed angle in radians in [-pi, pi].
  const angle = Math.atan2(cross(prevDir, nextDir), dot(prevDir, nextDir));

  // Normalize to [0, 2pi), with 0 meaning "continue straight".
  if (Math.abs(angle) <= ANGLE_EPSILON) {
    return 0;
  }

  return angle < 0 ? angle + Math.PI * 2 : angle;
}

function chooseNextEdge(args: Readonly<{
  geometry: RoomMapGeometry;
  currentVertexIndex: number;
  prevVertexIndex: number;
  candidates: readonly Readonly<{ edge: DirectedEdge; index: number }>[],
}>):
  | Readonly<{ edge: DirectedEdge; index: number }>
  | SectorBoundaryLoopError {
  const curr = args.geometry.vertices[args.currentVertexIndex];
  const prev = args.geometry.vertices[args.prevVertexIndex];
  if (!curr || !prev) {
    return { kind: 'sector-boundary-loop-error', reason: 'missing-vertex' };
  }

  const prevDir = sub(curr, prev);

  const filtered = args.candidates.filter((entry) => entry.edge.end !== args.prevVertexIndex);
  const usable = filtered.length > 0 ? filtered : args.candidates;

  let best: Readonly<{ entry: Readonly<{ edge: DirectedEdge; index: number }>; angle: number }> | null = null;
  let tie = false;

  for (const entry of usable) {
    const next = args.geometry.vertices[entry.edge.end];
    if (!next) {
      return { kind: 'sector-boundary-loop-error', reason: 'missing-vertex' };
    }

    const nextDir = sub(next, curr);
    const angle = angleFromDirToDir(prevDir, nextDir);

    if (best === null || angle < best.angle - ANGLE_EPSILON) {
      best = { entry, angle };
      tie = false;
      continue;
    }

    if (Math.abs(angle - best.angle) <= ANGLE_EPSILON) {
      tie = true;
    }
  }

  if (best === null) {
    return { kind: 'sector-boundary-loop-error', reason: 'open-loop' };
  }
  if (tie) {
    return { kind: 'sector-boundary-loop-error', reason: 'ambiguous' };
  }

  return best.entry;
}

function extractSingleSectorBoundaryLoopUndirected(geometry: RoomMapGeometry, sectorId: number):
  | SectorBoundaryLoop
  | SectorBoundaryLoopError {
  const edges = buildUndirectedEdgesForSector(geometry, sectorId);
  if (edges.length === 0) {
    return { kind: 'sector-boundary-loop-error', reason: 'no-edges' };
  }
  if (edges.length < 3) {
    return { kind: 'sector-boundary-loop-error', reason: 'too-few-edges' };
  }

  const remaining: UndirectedEdge[] = [...edges];
  remaining.sort((a, b) => {
    const a0 = Math.min(a.a, a.b);
    const a1 = Math.max(a.a, a.b);
    const b0 = Math.min(b.a, b.b);
    const b1 = Math.max(b.a, b.b);
    if (a0 !== b0) return a0 - b0;
    if (a1 !== b1) return a1 - b1;
    return a.wallIndex - b.wallIndex;
  });

  const first = remaining.shift();
  if (!first) {
    return { kind: 'sector-boundary-loop-error', reason: 'no-edges' };
  }

  const startVertexIndex = first.a;
  const polygonVertexIndices: number[] = [first.a, first.b];
  const wallIndices: number[] = [first.wallIndex];
  let currentVertexIndex = first.b;

  const visited = new Set<number>();
  visited.add(startVertexIndex);

  for (let steps = 0; steps < edges.length + 4; steps += 1) {
    if (currentVertexIndex === startVertexIndex && polygonVertexIndices.length > 2) {
      break;
    }

    const nextIndex = remaining.findIndex((edge) => edge.a === currentVertexIndex || edge.b === currentVertexIndex);
    if (nextIndex < 0) {
      return { kind: 'sector-boundary-loop-error', reason: 'open-loop' };
    }

    const next = remaining.splice(nextIndex, 1)[0];
    if (!next) {
      return { kind: 'sector-boundary-loop-error', reason: 'open-loop' };
    }

    const nextVertexIndex = next.a === currentVertexIndex ? next.b : next.a;

    if (nextVertexIndex !== startVertexIndex && visited.has(nextVertexIndex)) {
      return { kind: 'sector-boundary-loop-error', reason: 'non-simple' };
    }

    visited.add(currentVertexIndex);
    polygonVertexIndices.push(nextVertexIndex);
    wallIndices.push(next.wallIndex);
    currentVertexIndex = nextVertexIndex;
  }

  if (polygonVertexIndices.length < 4 || polygonVertexIndices[0] !== polygonVertexIndices[polygonVertexIndices.length - 1]) {
    return { kind: 'sector-boundary-loop-error', reason: 'open-loop' };
  }

  polygonVertexIndices.pop();

  if (remaining.length > 0) {
    return { kind: 'sector-boundary-loop-error', reason: 'ambiguous' };
  }

  for (const vertexIndex of polygonVertexIndices) {
    if (!isValidVertexIndex(geometry, vertexIndex)) {
      return { kind: 'sector-boundary-loop-error', reason: 'missing-vertex' };
    }
  }

  const polygon: Vec2[] = polygonVertexIndices.map((vertexIndex) => geometry.vertices[vertexIndex]!);

  if (polygon.length !== wallIndices.length) {
    return { kind: 'sector-boundary-loop-error', reason: 'open-loop' };
  }

  return { kind: 'sector-boundary-loop', polygon, wallIndices };
}

export function extractSingleSectorBoundaryLoop(geometry: RoomMapGeometry, sectorId: number):
  | SectorBoundaryLoop
  | SectorBoundaryLoopError {
  const fallback = (): SectorBoundaryLoop | SectorBoundaryLoopError => extractSingleSectorBoundaryLoopUndirected(geometry, sectorId);

  const edges = buildDirectedEdgesForSector(geometry, sectorId);
  if (edges.length === 0) {
    return { kind: 'sector-boundary-loop-error', reason: 'no-edges' };
  }
  if (edges.length < 3) {
    return { kind: 'sector-boundary-loop-error', reason: 'too-few-edges' };
  }

  // Walk a single loop by matching edge.start -> current.
  // Pick a deterministic starting edge to keep traversal stable.
  const remaining: DirectedEdge[] = [...edges];
  remaining.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    if (a.end !== b.end) return a.end - b.end;
    return a.wallIndex - b.wallIndex;
  });

  const first = remaining.shift();
  if (!first) {
    return { kind: 'sector-boundary-loop-error', reason: 'no-edges' };
  }

  const startVertexIndex = first.start;
  const polygonVertexIndices: number[] = [first.start, first.end];
  const wallIndices: number[] = [first.wallIndex];
  let currentVertexIndex = first.end;

  // Track visited vertices (excluding the final closure back to start).
  const visited = new Set<number>();
  visited.add(first.start);

  for (let steps = 0; steps < edges.length + 4; steps += 1) {
    if (currentVertexIndex === startVertexIndex && polygonVertexIndices.length > 2) {
      break;
    }

    // Find candidate edges whose start matches the current vertex.
    const candidates = remaining
      .map((edge, index) => ({ edge, index }))
      .filter((entry) => entry.edge.start === currentVertexIndex);

    if (candidates.length === 0) {
      return fallback();
    }

    const choice =
      candidates.length === 1
        ? candidates[0]!
        : chooseNextEdge({
            geometry,
            currentVertexIndex,
            prevVertexIndex: polygonVertexIndices[polygonVertexIndices.length - 2]!,
            candidates
          });

    if ('kind' in choice) {
      // If the directed walk fails due to inconsistent wall orientation, fall back
      // to an undirected walk that can still recover a single boundary loop.
      if (choice.reason === 'open-loop' || choice.reason === 'ambiguous' || choice.reason === 'non-simple') {
        return fallback();
      }
      return choice;
    }

    const { edge: nextEdge, index: nextIndex } = choice;
    remaining.splice(nextIndex, 1);

    const nextVertexIndex = nextEdge.end;

    // Detect non-simple loops (revisiting a vertex before closing).
    if (nextVertexIndex !== startVertexIndex && visited.has(nextVertexIndex)) {
      return fallback();
    }

    visited.add(currentVertexIndex);
    polygonVertexIndices.push(nextVertexIndex);
    wallIndices.push(nextEdge.wallIndex);
    currentVertexIndex = nextVertexIndex;
  }

  // Must close back to start.
  if (polygonVertexIndices.length < 4 || polygonVertexIndices[0] !== polygonVertexIndices[polygonVertexIndices.length - 1]) {
    return fallback();
  }

  // Drop repeated last vertex for implicit closure.
  polygonVertexIndices.pop();

  // If there are leftover edges, this sector does not form a single simple loop.
  if (remaining.length > 0) {
    return fallback();
  }

  // Validate vertex indices exist.
  for (const vertexIndex of polygonVertexIndices) {
    if (!isValidVertexIndex(geometry, vertexIndex)) {
      return { kind: 'sector-boundary-loop-error', reason: 'missing-vertex' };
    }
  }

  const polygon: Vec2[] = polygonVertexIndices.map((vertexIndex) => geometry.vertices[vertexIndex]!);

  if (polygon.length !== wallIndices.length) {
    // If we built a closed polygon correctly, these should match.
    return { kind: 'sector-boundary-loop-error', reason: 'open-loop' };
  }

  return { kind: 'sector-boundary-loop', polygon, wallIndices };
}
