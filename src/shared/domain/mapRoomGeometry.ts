import type { RoomRotationQuarterTurns, RoomTemplate } from './mapRoomCreation';

export type Vec2 = Readonly<{ x: number; y: number }>;

export type RoomMapWall = Readonly<{
  index: number;
  v0: number;
  v1: number;
  frontSectorId: number;
  backSectorId: number;
}>;

export type RoomMapGeometry = Readonly<{
  vertices: readonly Vec2[];
  walls: readonly RoomMapWall[];
  sectorIds: readonly number[];
}>;

export type RoomPolygon = readonly Vec2[];

export type Segment = Readonly<{ a: Vec2; b: Vec2 }>;

export type WallOrientation = 'horizontal' | 'vertical' | 'other';

export type AdjacentPortalPlan = Readonly<{
  kind: 'room-adjacent-portal-plan';
  targetWallIndex: number;
  targetWallFrontSectorId: number;
  orientation: Exclude<WallOrientation, 'other'>;
  polygonEdgeIndex: number;
  snappedPolygon: RoomPolygon;
  portalA: Vec2;
  portalB: Vec2;
}>;

export type AdjacentPortalPlanError = Readonly<{
  kind: 'room-adjacent-portal-plan-error';
  reason: 'invalid-wall-index' | 'non-collinear' | 'no-overlap';
}>;

export type RoomPlacementValidity =
  | Readonly<{ ok: true; kind: 'room-valid/nested'; enclosingSectorId: number }>
  | Readonly<{ ok: true; kind: 'room-valid/adjacent'; targetWallIndex: number; snapDistancePx: number }>
  | Readonly<{ ok: true; kind: 'room-valid/seed' }>
  | Readonly<{ ok: false; kind: 'room-invalid'; reason:
        | 'invalid-size'
        | 'intersects-walls'
        | 'not-inside-any-sector'
        | 'adjacent-too-far'
        | 'no-snap-target'
  | 'non-collinear'
        | 'ambiguous'
    }>

const DEFAULT_EPSILON = 1e-6;

function rotateQuarterTurns(point: Vec2, quarterTurns: RoomRotationQuarterTurns): Vec2 {
  const turns = ((quarterTurns % 4) + 4) % 4;
  if (turns === 0) {
    return point;
  }
  if (turns === 1) {
    // 90° clockwise: (x,y) -> (y,-x)
    return { x: point.y, y: -point.x };
  }
  if (turns === 2) {
    return { x: -point.x, y: -point.y };
  }
  // turns === 3
  return { x: -point.y, y: point.x };
}

export function computeRoomPolygon(args: Readonly<{
  template: RoomTemplate;
  center: Vec2;
  size: Readonly<{ width: number; height: number }>;
  rotationQuarterTurns: RoomRotationQuarterTurns;
}>): RoomPolygon {
  const w = args.size.width;
  const h = args.size.height;

  const local: Vec2[] = (() => {
    if (args.template === 'rectangle' || args.template === 'square') {
      const halfW = w / 2;
      const halfH = h / 2;
      return [
        { x: -halfW, y: -halfH },
        { x: halfW, y: -halfH },
        { x: halfW, y: halfH },
        { x: -halfW, y: halfH }
      ];
    }

    // triangle: isosceles with base on +Y and apex on -Y
    const halfW = w / 2;
    const halfH = h / 2;
    return [
      { x: -halfW, y: halfH },
      { x: halfW, y: halfH },
      { x: 0, y: -halfH }
    ];
  })();

  const out: Vec2[] = [];
  for (const p of local) {
    const rotated = rotateQuarterTurns(p, args.rotationQuarterTurns);
    out.push({ x: rotated.x + args.center.x, y: rotated.y + args.center.y });
  }

  return out;
}

export function polygonEdges(polygon: RoomPolygon): readonly Segment[] {
  if (polygon.length < 2) {
    return [];
  }
  const edges: Segment[] = [];
  for (let index = 0; index < polygon.length; index += 1) {
    const a = polygon[index];
    const b = polygon[(index + 1) % polygon.length];
    if (!a || !b) {
      continue;
    }
    edges.push({ a, b });
  }
  return edges;
}

function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

function cross(a: Vec2, b: Vec2): number {
  return a.x * b.y - a.y * b.x;
}

function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

function lengthSquared(a: Vec2): number {
  return a.x * a.x + a.y * a.y;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function wallOrientation(a: Vec2, b: Vec2, epsilon: number): WallOrientation {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dy) <= epsilon && Math.abs(dx) > epsilon) {
    return 'horizontal';
  }
  if (Math.abs(dx) <= epsilon && Math.abs(dy) > epsilon) {
    return 'vertical';
  }
  return 'other';
}

function translatePolygon(polygon: RoomPolygon, delta: Vec2): RoomPolygon {
  return polygon.map((p) => ({ x: p.x + delta.x, y: p.y + delta.y }));
}

function segmentIntervalOnAxis(seg: Segment, axis: 'x' | 'y'): Readonly<{ min: number; max: number }> {
  const a = seg.a[axis];
  const b = seg.b[axis];
  return { min: Math.min(a, b), max: Math.max(a, b) };
}

function overlapInterval(a: Readonly<{ min: number; max: number }>, b: Readonly<{ min: number; max: number }>):
  Readonly<{ min: number; max: number }> | null {
  const min = Math.max(a.min, b.min);
  const max = Math.min(a.max, b.max);
  // Accept zero-length overlap (endpoints coincide) as valid
  if (max < min) {
    return null;
  }
  return { min, max };
}

export function computeAdjacentPortalPlan(args: Readonly<{
  geometry: RoomMapGeometry;
  polygon: RoomPolygon;
  targetWallIndex: number;
  epsilon?: number;
}>): AdjacentPortalPlan | AdjacentPortalPlanError {
  const epsilon = args.epsilon ?? DEFAULT_EPSILON;

  const wall = args.geometry.walls[args.targetWallIndex];
  if (!wall) {
    return { kind: 'room-adjacent-portal-plan-error', reason: 'invalid-wall-index' };
  }

  const w0 = args.geometry.vertices[wall.v0];
  const w1 = args.geometry.vertices[wall.v1];
  if (!w0 || !w1) {
    return { kind: 'room-adjacent-portal-plan-error', reason: 'invalid-wall-index' };
  }

  const wallAxisOrientation = wallOrientation(w0, w1, epsilon);
  if (wallAxisOrientation === 'other') {
    return { kind: 'room-adjacent-portal-plan-error', reason: 'non-collinear' };
  }
  const axis: 'x' | 'y' = wallAxisOrientation === 'horizontal' ? 'x' : 'y';
  const wallInterval = segmentIntervalOnAxis({ a: w0, b: w1 }, axis);


  // Generalize: allow any polygon edge that is parallel to the wall (not just axis-aligned),
  // and select the closest such edge for snapping.
  const edges = polygonEdges(args.polygon);
  if (edges.length === 0) {
    return { kind: 'room-adjacent-portal-plan-error', reason: 'no-overlap' };
  }

  // Compute wall direction vector
  const wallDir = sub(w1, w0);
  const wallLen = Math.sqrt(lengthSquared(wallDir));
  if (wallLen < epsilon) {
    return { kind: 'room-adjacent-portal-plan-error', reason: 'invalid-wall-index' };
  }
  const wallNorm = { x: wallDir.x / wallLen, y: wallDir.y / wallLen };

  // Find the polygon edge most parallel to the wall (dot product near ±1),
  // closest in perpendicular distance, and with a positive overlap interval on the wall axis.
  let best: { edgeIndex: number; dist: number; overlapLen: number } | null = null;
  for (let edgeIndex = 0; edgeIndex < edges.length; edgeIndex += 1) {
    const edge = edges[edgeIndex];
    if (!edge) continue;
    const edgeDir = sub(edge.b, edge.a);
    const edgeLen = Math.sqrt(lengthSquared(edgeDir));
    if (edgeLen < epsilon) continue;
    const edgeNorm = { x: edgeDir.x / edgeLen, y: edgeDir.y / edgeLen };
    // Check parallelism (dot product near ±1). Increase tolerance to allow nearly parallel edges.
    const dotVal = Math.abs(dot(wallNorm, edgeNorm));
    if (dotVal < 0.995) continue;

    const edgeInterval = segmentIntervalOnAxis(edge, axis);
    const overlap = overlapInterval(wallInterval, edgeInterval);
    if (overlap === null) continue;
    const overlapLen = overlap.max - overlap.min;
    if (overlapLen <= epsilon) continue;

    // Compute perpendicular distance from edge to wall
    // For horizontal/vertical, use y/x diff; for general, use cross product
    const perpDist = Math.abs(cross(wallDir, sub(edge.a, w0)) / wallLen);
    if (best === null || perpDist < best.dist - epsilon || (Math.abs(perpDist - best.dist) <= epsilon && overlapLen > best.overlapLen)) {
      best = { edgeIndex, dist: perpDist, overlapLen };
    }
  }

  if (best === null) {
    return { kind: 'room-adjacent-portal-plan-error', reason: 'non-collinear' };
  }

  const chosen = edges[best.edgeIndex];
  if (!chosen) {
    return { kind: 'room-adjacent-portal-plan-error', reason: 'no-overlap' };
  }

  // Snap chosen edge to wall by translating along perpendicular direction
  // Compute offset from chosen.a to w0 projected onto wall normal
  const offset = sub(w0, chosen.a);
  // For parallel edges, offset along perpendicular direction only
  const perp = { x: -wallNorm.y, y: wallNorm.x };
  const perpAmount = dot(offset, perp);
  const delta = { x: perp.x * perpAmount, y: perp.y * perpAmount };

  const snappedPolygon = translatePolygon(args.polygon, delta);
  const snappedEdges = polygonEdges(snappedPolygon);
  const snappedEdge = snappedEdges[best.edgeIndex];
  if (!snappedEdge) {
    return { kind: 'room-adjacent-portal-plan-error', reason: 'no-overlap' };
  }

  // Compute overlap interval along wall direction
  const edgeInterval = segmentIntervalOnAxis(snappedEdge, axis);
  const overlap = overlapInterval(wallInterval, edgeInterval);
  // Accept any valid overlap interval for portal creation, including cases where the edge is equal to or longer than the wall, or endpoints coincide
  if (overlap === null || overlap.min >= overlap.max) {
    return { kind: 'room-adjacent-portal-plan-error', reason: 'no-overlap' };
  }

  // Always set portal endpoints to the overlap interval, regardless of relative lengths
  const portalA: Vec2 = axis === 'x' ? { x: overlap.min, y: w0.y } : { x: w0.x, y: overlap.min };
  const portalB: Vec2 = axis === 'x' ? { x: overlap.max, y: w0.y } : { x: w0.x, y: overlap.max };

  // Only allow 'horizontal' or 'vertical' orientation in AdjacentPortalPlan
  const orientation = wallOrientation(w0, w1, epsilon);
  const allowedOrientation: 'horizontal' | 'vertical' = orientation === 'horizontal' ? 'horizontal' : 'vertical';
  return {
    kind: 'room-adjacent-portal-plan',
    targetWallIndex: wall.index,
    targetWallFrontSectorId: wall.frontSectorId,
    orientation: allowedOrientation,
    polygonEdgeIndex: best.edgeIndex,
    snappedPolygon,
    portalA,
    portalB
  };
}

export function distancePointToSegment(worldPoint: Vec2, a: Vec2, b: Vec2): number {
  const ab = sub(b, a);
  const ap = sub(worldPoint, a);
  const abLen2 = lengthSquared(ab);
  if (abLen2 <= 0) {
    const d = sub(worldPoint, a);
    return Math.sqrt(lengthSquared(d));
  }
  const t = clamp01(dot(ap, ab) / abLen2);
  const closest: Vec2 = { x: a.x + t * ab.x, y: a.y + t * ab.y };
  const d = sub(worldPoint, closest);
  return Math.sqrt(lengthSquared(d));
}

function isPointOnSegment(p: Vec2, a: Vec2, b: Vec2, epsilon: number): boolean {
  const ab = sub(b, a);
  const ap = sub(p, a);
  if (Math.abs(cross(ab, ap)) > epsilon) {
    return false;
  }

  const dotp = dot(ap, ab);
  if (dotp < -epsilon) {
    return false;
  }
  const abLen2 = lengthSquared(ab);
  if (dotp > abLen2 + epsilon) {
    return false;
  }
  return true;
}

// Returns true if segments intersect or overlap, including touching at endpoints.
export function segmentsIntersect(a0: Vec2, a1: Vec2, b0: Vec2, b1: Vec2, epsilon = DEFAULT_EPSILON): boolean {
  const a = sub(a1, a0);
  const b = sub(b1, b0);

  const c1 = cross(a, sub(b0, a0));
  const c2 = cross(a, sub(b1, a0));
  const c3 = cross(b, sub(a0, b0));
  const c4 = cross(b, sub(a1, b0));

  const abStraddle = (c1 > epsilon && c2 < -epsilon) || (c1 < -epsilon && c2 > epsilon);
  const baStraddle = (c3 > epsilon && c4 < -epsilon) || (c3 < -epsilon && c4 > epsilon);
  if (abStraddle && baStraddle) {
    return true;
  }

  // Collinear/touching checks.
  if (Math.abs(c1) <= epsilon && isPointOnSegment(b0, a0, a1, epsilon)) {
    return true;
  }
  if (Math.abs(c2) <= epsilon && isPointOnSegment(b1, a0, a1, epsilon)) {
    return true;
  }
  if (Math.abs(c3) <= epsilon && isPointOnSegment(a0, b0, b1, epsilon)) {
    return true;
  }
  if (Math.abs(c4) <= epsilon && isPointOnSegment(a1, b0, b1, epsilon)) {
    return true;
  }

  return false;
}

export function doesPolygonIntersectWalls(args: Readonly<{
  geometry: RoomMapGeometry;
  polygon: RoomPolygon;
  ignoredWallIndices?: ReadonlySet<number>;
  allowEndpointTouch?: boolean;
  epsilon?: number;
}>): boolean {
  const epsilon = args.epsilon ?? DEFAULT_EPSILON;
  const polygonSegs = polygonEdges(args.polygon);

  const isCollinear = (a0: Vec2, a1: Vec2, b0: Vec2, b1: Vec2): boolean => {
    const a = sub(a1, a0);
    return Math.abs(cross(a, sub(b0, a0))) <= epsilon && Math.abs(cross(a, sub(b1, a0))) <= epsilon;
  };

  const isEndpointTouchOrCollinearCoincident = (a0: Vec2, a1: Vec2, b0: Vec2, b1: Vec2): boolean => {
    // Allow if any endpoint lies on the other segment (including T-junction touches),
    // or if segments are collinear and their intervals overlap.
    if (isPointOnSegment(a0, b0, b1, epsilon)) return true;
    if (isPointOnSegment(a1, b0, b1, epsilon)) return true;
    if (isPointOnSegment(b0, a0, a1, epsilon)) return true;
    if (isPointOnSegment(b1, a0, a1, epsilon)) return true;

    if (isCollinear(a0, a1, b0, b1)) {
      const axis: 'x' | 'y' = Math.abs(a1.x - a0.x) >= Math.abs(a1.y - a0.y) ? 'x' : 'y';
      const aMin = Math.min(a0[axis], a1[axis]);
      const aMax = Math.max(a0[axis], a1[axis]);
      const bMin = Math.min(b0[axis], b1[axis]);
      const bMax = Math.max(b0[axis], b1[axis]);
      const overlapMin = Math.max(aMin, bMin);
      const overlapMax = Math.min(aMax, bMax);
      const overlapLen = overlapMax - overlapMin;
      return overlapLen >= -epsilon;
    }

    return false;
  };

  for (const wall of args.geometry.walls) {
    if (args.ignoredWallIndices?.has(wall.index)) {
      continue;
    }

    const v0 = args.geometry.vertices[wall.v0];
    const v1 = args.geometry.vertices[wall.v1];
    if (!v0 || !v1) {
      continue;
    }

    for (const seg of polygonSegs) {
      if (segmentsIntersect(seg.a, seg.b, v0, v1, epsilon)) {
        if (args.allowEndpointTouch && isEndpointTouchOrCollinearCoincident(seg.a, seg.b, v0, v1)) {
          continue;
        }
        return true;
      }
    }
  }

  return false;
}

export function pointInSector(worldPoint: Vec2, geometry: RoomMapGeometry, sectorId: number): boolean {
  let crossings = 0;

  for (const wall of geometry.walls) {
    if (wall.frontSectorId !== sectorId) {
      continue;
    }

    const v0 = geometry.vertices[wall.v0];
    const v1 = geometry.vertices[wall.v1];
    if (!v0 || !v1) {
      continue;
    }

    const straddles = (v0.y > worldPoint.y) !== (v1.y > worldPoint.y);
    if (!straddles) {
      continue;
    }

    const xAtY = v0.x + ((worldPoint.y - v0.y) * (v1.x - v0.x)) / (v1.y - v0.y);
    if (xAtY === worldPoint.x) {
      return true;
    }

    if (xAtY > worldPoint.x) {
      crossings += 1;
    }
  }

  return crossings % 2 === 1;
}

function computeSectorAbsArea2(geometry: RoomMapGeometry, sectorId: number): number | null {
  let sum = 0;
  let sawEdge = false;

  for (const wall of geometry.walls) {
    if (wall.frontSectorId !== sectorId) {
      continue;
    }

    const v0 = geometry.vertices[wall.v0];
    const v1 = geometry.vertices[wall.v1];
    if (!v0 || !v1) {
      continue;
    }

    sawEdge = true;
    sum += v0.x * v1.y - v1.x * v0.y;
  }

  if (!sawEdge) {
    return null;
  }

  return Math.abs(sum);
}

export function findEnclosingSectorIdForPolygon(geometry: RoomMapGeometry, polygon: RoomPolygon): number | null {
  const candidates: { sectorId: number; area2: number; }[] = [];

  for (const sectorId of geometry.sectorIds) {
    let allInside = true;
    for (const p of polygon) {
      if (!pointInSector(p, geometry, sectorId)) {
        allInside = false;
        break;
      }
    }
    if (!allInside) {
      continue;
    }

    const area2 = computeSectorAbsArea2(geometry, sectorId);
    candidates.push({ sectorId, area2: area2 ?? Number.POSITIVE_INFINITY });
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => a.area2 - b.area2 || a.sectorId - b.sectorId);
  return candidates[0]?.sectorId ?? null;
}

export function findNearestWallWithinThresholdPx(args: Readonly<{
  geometry: RoomMapGeometry;
  worldPoint: Vec2;
  viewScale: number;
  thresholdPx: number;
}>): Readonly<{ wallIndex: number; distancePx: number }> | null {
  const safeScale = Math.max(0.0001, args.viewScale);

  let best: { wallIndex: number; distancePx: number } | null = null;

  for (const wall of args.geometry.walls) {
    const v0 = args.geometry.vertices[wall.v0];
    const v1 = args.geometry.vertices[wall.v1];
    if (!v0 || !v1) {
      continue;
    }

    const dWorld = distancePointToSegment(args.worldPoint, v0, v1);
    const dPx = dWorld * safeScale;

    if (dPx > args.thresholdPx) {
      continue;
    }

    if (best === null || dPx < best.distancePx) {
      best = { wallIndex: wall.index, distancePx: dPx };
    }
  }

  return best;
}

function distanceSegmentToSegment(a0: Vec2, a1: Vec2, b0: Vec2, b1: Vec2): number {
  if (segmentsIntersect(a0, a1, b0, b1)) {
    return 0;
  }

  const d0 = distancePointToSegment(a0, b0, b1);
  const d1 = distancePointToSegment(a1, b0, b1);
  const d2 = distancePointToSegment(b0, a0, a1);
  const d3 = distancePointToSegment(b1, a0, a1);
  return Math.min(d0, d1, d2, d3);
}

export function findNearestWallToPolygonWithinThresholdPx(args: Readonly<{
  geometry: RoomMapGeometry;
  polygon: RoomPolygon;
  viewScale: number;
  thresholdPx: number;
}>): Readonly<{ wallIndex: number; distancePx: number }> | null {
  const safeScale = Math.max(0.0001, args.viewScale);
  const polygonSegs = polygonEdges(args.polygon);

  if (polygonSegs.length === 0) {
    return null;
  }

  let best: { wallIndex: number; distancePx: number } | null = null;

  for (const wall of args.geometry.walls) {
    const v0 = args.geometry.vertices[wall.v0];
    const v1 = args.geometry.vertices[wall.v1];
    if (!v0 || !v1) {
      continue;
    }

    let bestWallWorld = Number.POSITIVE_INFINITY;
    for (const seg of polygonSegs) {
      const dWorld = distanceSegmentToSegment(seg.a, seg.b, v0, v1);
      if (dWorld < bestWallWorld) {
        bestWallWorld = dWorld;
      }
    }

    const dPx = bestWallWorld * safeScale;
    if (dPx > args.thresholdPx) {
      continue;
    }

    if (best === null || dPx < best.distancePx) {
      best = { wallIndex: wall.index, distancePx: dPx };
    }
  }

  return best;
}

function findNearestEligibleWallToPolygonWithinThresholdPx(args: Readonly<{
  geometry: RoomMapGeometry;
  polygon: RoomPolygon;
  viewScale: number;
  thresholdPx: number;
  epsilon?: number;
}>): Readonly<{ wallIndex: number; distancePx: number }> | null {
  const epsilon = args.epsilon ?? DEFAULT_EPSILON;
  const safeScale = Math.max(0.0001, args.viewScale);
  const polygonSegs = polygonEdges(args.polygon);

  if (polygonSegs.length === 0) {
    return null;
  }

  let best: { wallIndex: number; distancePx: number } | null = null;

  for (const wall of args.geometry.walls) {
    // Adjacent joins only support snapping to solid, axis-aligned walls.
    if (wall.backSectorId > -1) {
      continue;
    }

    const v0 = args.geometry.vertices[wall.v0];
    const v1 = args.geometry.vertices[wall.v1];
    if (!v0 || !v1) {
      continue;
    }

    const wallAxisOrientation = wallOrientation(v0, v1, epsilon);
    if (wallAxisOrientation === 'other') {
      continue;
    }

    const axis: 'x' | 'y' = wallAxisOrientation === 'horizontal' ? 'x' : 'y';
    const wallInterval = segmentIntervalOnAxis({ a: v0, b: v1 }, axis);

    let bestPerpWorld = Number.POSITIVE_INFINITY;
    let sawOverlappingParallelEdge = false;

    for (const seg of polygonSegs) {
      const segAxisOrientation = wallOrientation(seg.a, seg.b, epsilon);
      if (segAxisOrientation !== wallAxisOrientation) {
        continue;
      }

      const segInterval = segmentIntervalOnAxis(seg, axis);
      const overlap = overlapInterval(wallInterval, segInterval);
      if (overlap === null) {
        continue;
      }

      const overlapLen = overlap.max - overlap.min;
      if (overlapLen <= epsilon) {
        continue;
      }

      sawOverlappingParallelEdge = true;

      const perpWorld = wallAxisOrientation === 'horizontal' ? Math.abs(seg.a.y - v0.y) : Math.abs(seg.a.x - v0.x);
      if (perpWorld < bestPerpWorld) {
        bestPerpWorld = perpWorld;
      }
    }

    if (!sawOverlappingParallelEdge) {
      continue;
    }

    const dPx = bestPerpWorld * safeScale;
    if (dPx > args.thresholdPx) {
      continue;
    }

    if (best === null || dPx < best.distancePx) {
      best = { wallIndex: wall.index, distancePx: dPx };
    }
  }

  return best;
}

export function computeRoomPlacementValidity(args: Readonly<{
  geometry: RoomMapGeometry;
  polygon: RoomPolygon;
  viewScale: number;
  snapThresholdPx: number;
  minSizeWorld: number;
}>): RoomPlacementValidity {
  // Basic polygon sanity: enforce min size by bounding box.
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const p of args.polygon) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const width = maxX - minX;
  const height = maxY - minY;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < args.minSizeWorld || height < args.minSizeWorld) {
    return { ok: false, kind: 'room-invalid', reason: 'invalid-size' };
  }

  const isEmptyMap = args.geometry.walls.length === 0 && args.geometry.sectorIds.length === 0;
  if (isEmptyMap) {
    return { ok: true, kind: 'room-valid/seed' };
  }

  const enclosing = findEnclosingSectorIdForPolygon(args.geometry, args.polygon);
  if (enclosing !== null) {
    // Nested placement: strict intersection check (touching counts as intersection).
    if (doesPolygonIntersectWalls({ geometry: args.geometry, polygon: args.polygon })) {
      return { ok: false, kind: 'room-invalid', reason: 'intersects-walls' };
    }
    return { ok: true, kind: 'room-valid/nested', enclosingSectorId: enclosing };
  }

  // Not nested: allow only if close enough to some eligible wall (adjacent creation).
  const nearest = findNearestEligibleWallToPolygonWithinThresholdPx({
    geometry: args.geometry,
    polygon: args.polygon,
    viewScale: args.viewScale,
    thresholdPx: args.snapThresholdPx
  });

  if (nearest === null) {
    return { ok: false, kind: 'room-invalid', reason: 'no-snap-target' };
  }

  // If the candidate polygon currently crosses the snap target wall line and there is no
  // unique closest parallel edge to snap, reject as an ambiguous intersection.
  {
    const epsilon = DEFAULT_EPSILON;
    const wall = args.geometry.walls[nearest.wallIndex];
    if (wall) {
      const w0 = args.geometry.vertices[wall.v0];
      const w1 = args.geometry.vertices[wall.v1];
      if (w0 && w1) {
        const wallAxisOrientation = wallOrientation(w0, w1, epsilon);
        if (wallAxisOrientation === 'horizontal' || wallAxisOrientation === 'vertical') {
          const wallCoord = wallAxisOrientation === 'horizontal' ? w0.y : w0.x;
          const signed = (p: Vec2): number => (wallAxisOrientation === 'horizontal' ? p.y - wallCoord : p.x - wallCoord);
          const hasPositive = args.polygon.some((p) => signed(p) > epsilon);
          const hasNegative = args.polygon.some((p) => signed(p) < -epsilon);
          const crossesWallLine = hasPositive && hasNegative;

          if (crossesWallLine) {
            const axis: 'x' | 'y' = wallAxisOrientation === 'horizontal' ? 'x' : 'y';
            const wallInterval = segmentIntervalOnAxis({ a: w0, b: w1 }, axis);
            const polygonSegs = polygonEdges(args.polygon);

            let bestAbsDist = Number.POSITIVE_INFINITY;
            let bestCount = 0;
            for (const seg of polygonSegs) {
              const segAxisOrientation = wallOrientation(seg.a, seg.b, epsilon);
              if (segAxisOrientation !== wallAxisOrientation) {
                continue;
              }

              const segInterval = segmentIntervalOnAxis(seg, axis);
              const overlap = overlapInterval(wallInterval, segInterval);
              if (overlap === null) {
                continue;
              }
              const overlapLen = overlap.max - overlap.min;
              if (overlapLen <= epsilon) {
                continue;
              }

              const segCoord = wallAxisOrientation === 'horizontal' ? seg.a.y : seg.a.x;
              const absDist = Math.abs(segCoord - wallCoord);
              if (absDist < bestAbsDist - epsilon) {
                bestAbsDist = absDist;
                bestCount = 1;
              } else if (Math.abs(absDist - bestAbsDist) <= epsilon) {
                bestCount += 1;
              }
            }

            if (bestCount > 1) {
              return { ok: false, kind: 'room-invalid', reason: 'intersects-walls' };
            }
          }
        }
      }
    }
  }

  const plan = computeAdjacentPortalPlan({ geometry: args.geometry, polygon: args.polygon, targetWallIndex: nearest.wallIndex });
  if (plan.kind === 'room-adjacent-portal-plan-error') {
    return {
      ok: false,
      kind: 'room-invalid',
      reason: plan.reason === 'non-collinear' ? 'non-collinear' : 'ambiguous'
    };
  }

  // For adjacent placement, as long as there is a valid overlap interval and the snapped polygon does not intersect other walls, allow placement.
  // Adjacent placement: run intersection checks on the snapped polygon, ignoring the target wall,
  // and allowing pure endpoint-touch against other walls.
  if (
    doesPolygonIntersectWalls({
      geometry: args.geometry,
      polygon: plan.snappedPolygon,
      ignoredWallIndices: new Set([nearest.wallIndex]),
      allowEndpointTouch: true
    })
  ) {
    return { ok: false, kind: 'room-invalid', reason: 'intersects-walls' };
  }

  return { ok: true, kind: 'room-valid/adjacent', targetWallIndex: nearest.wallIndex, snapDistancePx: nearest.distancePx };
}
