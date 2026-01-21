import type { MapViewModel } from './mapViewModel';

export type WallStripPoint = Readonly<{ x: number; y: number }>;

export type WallStripPolygon = Readonly<{
  wallIndex: number;
  points: readonly WallStripPoint[]; // clockwise or counter-clockwise
}>;

export type ComputeWallStripsOptions = Readonly<{
  miterLimit?: number;
  parallelEpsilon?: number;
  minSegmentLength?: number;
}>;

type Vec2 = Readonly<{ x: number; y: number }>;

type DirectedSegment = Readonly<{
  wallIndex: number;
  startVertexIndex: number;
  endVertexIndex: number;
  start: Vec2;
  end: Vec2;
}>;

const DEFAULT_MITER_LIMIT = 4.0;
const DEFAULT_PARALLEL_EPSILON = 1e-6;
const DEFAULT_MIN_SEGMENT_LENGTH = 1e-4;

function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

function mul(a: Vec2, scalar: number): Vec2 {
  return { x: a.x * scalar, y: a.y * scalar };
}

function cross(a: Vec2, b: Vec2): number {
  return a.x * b.y - a.y * b.x;
}

function length(a: Vec2): number {
  return Math.hypot(a.x, a.y);
}

function normalize(a: Vec2): Vec2 | null {
  const len = length(a);
  if (len <= 0.00000001) {
    return null;
  }
  return { x: a.x / len, y: a.y / len };
}

function signedPolygonArea(points: readonly Vec2[]): number {
  if (points.length < 3) {
    return 0;
  }

  let sum = 0;
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    if (!a || !b) {
      continue;
    }
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

function leftNormal(unitDir: Vec2): Vec2 {
  return { x: -unitDir.y, y: unitDir.x };
}

function lineIntersection(p: Vec2, dirP: Vec2, q: Vec2, dirQ: Vec2, parallelEpsilon: number): Vec2 | null {
  const denom = cross(dirP, dirQ);
  if (Math.abs(denom) < parallelEpsilon) {
    return null;
  }

  const t = cross(sub(q, p), dirQ) / denom;
  return add(p, mul(dirP, t));
}

function buildSectorLoop(map: MapViewModel, sectorId: number): readonly number[] | null {
  const edges = map.walls
    .filter((wall) => wall.frontSector === sectorId)
    .map((wall) => ({ a: wall.v0, b: wall.v1 }));

  if (edges.length === 0) {
    return null;
  }

  const remaining = [...edges];
  const first = remaining.shift();
  if (!first) {
    return null;
  }

  const loop: number[] = [first.a, first.b];
  const start = loop[0];
  if (start === undefined) {
    return null;
  }

  let current = first.b;
  for (let steps = 0; steps < edges.length + 4; steps += 1) {
    if (current === loop[0] && loop.length > 2) {
      break;
    }

    const nextIndex = remaining.findIndex((edge) => edge.a === current || edge.b === current);
    if (nextIndex < 0) {
      break;
    }

    const next = remaining.splice(nextIndex, 1)[0];
    if (!next) {
      break;
    }

    const nextVertex = next.a === current ? next.b : next.a;
    loop.push(nextVertex);
    current = nextVertex;
  }

  if (loop.length < 4) {
    return null;
  }
  if (loop[0] !== loop[loop.length - 1]) {
    loop.push(start);
  }

  return loop;
}

function findWallIndexForEdge(map: MapViewModel, sectorId: number, a: number, b: number): number | null {
  for (const wall of map.walls) {
    if (wall.frontSector !== sectorId) {
      continue;
    }

    const matches = (wall.v0 === a && wall.v1 === b) || (wall.v0 === b && wall.v1 === a);
    if (matches) {
      return wall.index;
    }
  }
  return null;
}

function computeCappedStripPolygon(
  start: Vec2,
  end: Vec2,
  wallIndex: number,
  thicknessWorld: number,
  minSegmentLength: number
): WallStripPolygon | null {
  const delta = sub(end, start);
  const segLen = length(delta);
  if (segLen <= minSegmentLength) {
    return null;
  }

  const unitDir = normalize(delta);
  if (unitDir === null) {
    return null;
  }

  const half = thicknessWorld / 2;
  const n = leftNormal(unitDir);
  const startLeft = add(start, mul(n, half));
  const startRight = sub(start, mul(n, half));
  const endLeft = add(end, mul(n, half));
  const endRight = sub(end, mul(n, half));

  return {
    wallIndex,
    points: [startLeft, endLeft, endRight, startRight]
  };
}

function computeOneSidedCappedStripPolygon(
  start: Vec2,
  end: Vec2,
  wallIndex: number,
  thicknessWorld: number,
  inwardNormalSign: 1 | -1,
  minSegmentLength: number
): WallStripPolygon | null {
  const delta = sub(end, start);
  const segLen = length(delta);
  if (segLen <= minSegmentLength) {
    return null;
  }

  const unitDir = normalize(delta);
  if (unitDir === null) {
    return null;
  }

  const inward = mul(leftNormal(unitDir), inwardNormalSign);

  const startOffset = add(start, mul(inward, thicknessWorld));
  const endOffset = add(end, mul(inward, thicknessWorld));

  return {
    wallIndex,
    points: [start, end, endOffset, startOffset]
  };
}

function computeJoinPointForSide(params: {
  vertex: Vec2;
  prevDir: Vec2;
  nextDir: Vec2;
  prevNormal: Vec2;
  nextNormal: Vec2;
  offsetDistance: number;
  miterLimit: number;
  parallelEpsilon: number;
}): Vec2 {
  const { vertex, prevDir, nextDir, prevNormal, nextNormal, offsetDistance, miterLimit, parallelEpsilon } = params;

  const prevOffsetPoint = add(vertex, mul(prevNormal, offsetDistance));
  const nextOffsetPoint = add(vertex, mul(nextNormal, offsetDistance));

  const intersection = lineIntersection(prevOffsetPoint, prevDir, nextOffsetPoint, nextDir, parallelEpsilon);
  if (intersection !== null) {
    const miterDistance = length(sub(intersection, vertex));
    if (Number.isFinite(miterDistance) && miterDistance <= miterLimit * offsetDistance) {
      return intersection;
    }
  }

  // Fallback ("bevel" in the Phase definition): pick a bounded join point along the normal bisector.
  const normalSum = add(prevNormal, nextNormal);
  const bisector = normalize(normalSum) ?? prevNormal;
  return add(vertex, mul(bisector, miterLimit * offsetDistance));
}

function computeJoinedPolygonsForSector(
  map: MapViewModel,
  sectorId: number,
  thicknessWorld: number,
  options: Required<ComputeWallStripsOptions>
): readonly WallStripPolygon[] {
  const loop = buildSectorLoop(map, sectorId);
  if (loop === null || loop.length < 4) {
    return [];
  }

  const loopPoints: Vec2[] = [];
  for (let index = 0; index < loop.length - 1; index += 1) {
    const vertexIndex = loop[index];
    if (vertexIndex === undefined) {
      continue;
    }
    const vertex = map.vertices[vertexIndex];
    if (!vertex) {
      continue;
    }
    loopPoints.push({ x: vertex.x, y: vertex.y });
  }
  if (loopPoints.length < 3) {
    return [];
  }

  // Determine loop orientation; interior is on the left for CCW, right for CW.
  const area = signedPolygonArea(loopPoints);
  const inwardNormalSign: 1 | -1 = area >= 0 ? 1 : -1;

  const segments: DirectedSegment[] = [];
  for (let index = 0; index < loop.length - 1; index += 1) {
    const a = loop[index];
    const b = loop[index + 1];
    if (a === undefined || b === undefined) {
      continue;
    }

    const wallIndex = findWallIndexForEdge(map, sectorId, a, b);
    if (wallIndex === null) {
      continue;
    }

    const vA = map.vertices[a];
    const vB = map.vertices[b];
    if (!vA || !vB) {
      continue;
    }

    segments.push({
      wallIndex,
      startVertexIndex: a,
      endVertexIndex: b,
      start: { x: vA.x, y: vA.y },
      end: { x: vB.x, y: vB.y }
    });
  }

  if (segments.length < 3) {
    return [];
  }

  for (let index = 0; index < segments.length; index += 1) {
    const current = segments[index];
    const next = segments[(index + 1) % segments.length];
    if (!current || !next) {
      return [];
    }
    if (current.endVertexIndex !== next.startVertexIndex) {
      return [];
    }
  }

  // Compute shared join points for the offset-side edge only.
  const joinOffsetByVertex = new Map<number, Vec2>();

  for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex += 1) {
    const prev = segments[(segmentIndex - 1 + segments.length) % segments.length];
    const next = segments[segmentIndex];

    if (!prev || !next) {
      continue;
    }

    const vertexIndex = next.startVertexIndex;
    if (prev.endVertexIndex !== vertexIndex) {
      continue;
    }
    if (joinOffsetByVertex.has(vertexIndex)) {
      continue;
    }

    const vertex = map.vertices[vertexIndex];
    if (!vertex) {
      continue;
    }

    const prevDelta = sub(prev.end, prev.start);
    const nextDelta = sub(next.end, next.start);
    const prevLen = length(prevDelta);
    const nextLen = length(nextDelta);
    if (prevLen <= options.minSegmentLength || nextLen <= options.minSegmentLength) {
      continue;
    }

    const prevDir = normalize(prevDelta);
    const nextDir = normalize(nextDelta);
    if (prevDir === null || nextDir === null) {
      continue;
    }

    const isNearParallel = Math.abs(cross(prevDir, nextDir)) < options.parallelEpsilon;

    const prevInward = mul(leftNormal(prevDir), inwardNormalSign);
    const nextInward = mul(leftNormal(nextDir), inwardNormalSign);

    const vertexVec: Vec2 = { x: vertex.x, y: vertex.y };

    if (isNearParallel) {
      const inwardSum = add(prevInward, nextInward);
      const inwardBisector = normalize(inwardSum) ?? prevInward;
      joinOffsetByVertex.set(vertexIndex, add(vertexVec, mul(inwardBisector, thicknessWorld)));
      continue;
    }

    joinOffsetByVertex.set(
      vertexIndex,
      computeJoinPointForSide({
        vertex: vertexVec,
        prevDir,
        nextDir,
        prevNormal: prevInward,
        nextNormal: nextInward,
        offsetDistance: thicknessWorld,
        miterLimit: options.miterLimit,
        parallelEpsilon: options.parallelEpsilon
      })
    );
  }

  const polygons: WallStripPolygon[] = [];
  for (const segment of segments) {
    const startOffset = joinOffsetByVertex.get(segment.startVertexIndex);
    const endOffset = joinOffsetByVertex.get(segment.endVertexIndex);

    if (startOffset && endOffset) {
      polygons.push({
        wallIndex: segment.wallIndex,
        points: [segment.start, segment.end, endOffset, startOffset]
      });
      continue;
    }

    const fallback = computeOneSidedCappedStripPolygon(
      segment.start,
      segment.end,
      segment.wallIndex,
      thicknessWorld,
      inwardNormalSign,
      options.minSegmentLength
    );
    if (fallback) {
      polygons.push(fallback);
    }
  }

  return polygons;
}

export function computeTexturedWallStripPolygons(
  map: MapViewModel,
  thicknessWorld: number,
  options: ComputeWallStripsOptions = {}
): readonly WallStripPolygon[] {
  const resolved: Required<ComputeWallStripsOptions> = {
    miterLimit: options.miterLimit ?? DEFAULT_MITER_LIMIT,
    parallelEpsilon: options.parallelEpsilon ?? DEFAULT_PARALLEL_EPSILON,
    minSegmentLength: options.minSegmentLength ?? DEFAULT_MIN_SEGMENT_LENGTH
  };

  if (!Number.isFinite(thicknessWorld) || thicknessWorld <= 0) {
    return [];
  }

  const byWallIndex = new Map<number, WallStripPolygon>();

  // Primary: compute join-aware polygons from each sector boundary loop.
  for (const sector of map.sectors) {
    const polys = computeJoinedPolygonsForSector(map, sector.id, thicknessWorld, resolved);
    for (const poly of polys) {
      if (!byWallIndex.has(poly.wallIndex)) {
        byWallIndex.set(poly.wallIndex, poly);
      }
    }
  }

  // Fallback: any remaining walls that were not part of a computable loop.
  for (const wall of map.walls) {
    if (byWallIndex.has(wall.index)) {
      continue;
    }

    const v0 = map.vertices[wall.v0];
    const v1 = map.vertices[wall.v1];
    if (!v0 || !v1) {
      continue;
    }

    const poly = computeCappedStripPolygon(
      { x: v0.x, y: v0.y },
      { x: v1.x, y: v1.y },
      wall.index,
      thicknessWorld,
      resolved.minSegmentLength
    );

    if (poly) {
      byWallIndex.set(wall.index, poly);
    }
  }

  return [...byWallIndex.values()];
}
