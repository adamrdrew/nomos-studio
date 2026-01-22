import type { MapRenderMode } from '../../../../shared/domain/models';

import type { MapSelection } from './mapSelection';
import type { MapViewModel } from './mapViewModel';
import type { WallStripPolygon } from './wallStripGeometry';

type Point = Readonly<{ x: number; y: number }>;

type PickCandidate = Readonly<{
  priority: number;
  screenDistancePx: number;
  tiebreaker: number;
  selection: MapSelection;
}>;

const MARKER_HIT_RADIUS_PX = 10;
const DOOR_HIT_RADIUS_PX = 10;
const WALL_HIT_THRESHOLD_PX = 10;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function distanceSquared(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function distancePointToSegment(worldPoint: Point, a: Point, b: Point): number {
  const abX = b.x - a.x;
  const abY = b.y - a.y;
  const apX = worldPoint.x - a.x;
  const apY = worldPoint.y - a.y;

  const abLenSquared = abX * abX + abY * abY;
  if (abLenSquared === 0) {
    return Math.sqrt(distanceSquared(worldPoint, a));
  }

  const t = clamp01((apX * abX + apY * abY) / abLenSquared);
  const closest: Point = { x: a.x + t * abX, y: a.y + t * abY };
  return Math.sqrt(distanceSquared(worldPoint, closest));
}

function pointInPolygon(worldPoint: Point, polygon: readonly Point[]): boolean {
  // Ray crossing; treats points on the boundary as inside.
  if (polygon.length < 3) {
    return false;
  }

  let crossings = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const a = polygon[index];
    const b = polygon[(index + 1) % polygon.length];
    if (!a || !b) {
      continue;
    }

    const straddles = (a.y > worldPoint.y) !== (b.y > worldPoint.y);
    if (!straddles) {
      continue;
    }

    const xAtY = a.x + ((worldPoint.y - a.y) * (b.x - a.x)) / (b.y - a.y);
    if (xAtY === worldPoint.x) {
      return true;
    }

    if (xAtY > worldPoint.x) {
      crossings += 1;
    }
  }

  return crossings % 2 === 1;
}

function pointInSector(worldPoint: Point, map: MapViewModel, sectorId: number): boolean {
  let crossings = 0;
  for (const wall of map.walls) {
    if (wall.frontSector !== sectorId) {
      continue;
    }

    const v0 = map.vertices[wall.v0];
    const v1 = map.vertices[wall.v1];
    if (!v0 || !v1) {
      continue;
    }

    const straddles = (v0.y > worldPoint.y) !== (v1.y > worldPoint.y);
    if (!straddles) {
      continue;
    }

    const xAtY = v0.x + ((worldPoint.y - v0.y) * (v1.x - v0.x)) / (v1.y - v0.y);
    if (xAtY > worldPoint.x) {
      crossings += 1;
    }
  }
  return crossings % 2 === 1;
}

function isBetterCandidate(candidate: PickCandidate, best: PickCandidate | null): boolean {
  if (best === null) {
    return true;
  }
  if (candidate.priority !== best.priority) {
    return candidate.priority < best.priority;
  }

  const eps = 0.0001;
  if (candidate.screenDistancePx < best.screenDistancePx - eps) {
    return true;
  }
  if (Math.abs(candidate.screenDistancePx - best.screenDistancePx) <= eps) {
    return candidate.tiebreaker < best.tiebreaker;
  }

  return false;
}

function stableStringTiebreaker(value: string): number {
  // Deterministic, bounded hash for stable ordering; not cryptographic.
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function computeSectorAbsArea2(map: MapViewModel, sectorId: number): number | null {
  // Compute 2x polygon area using directed wall edges.
  // This relies on a convention that a sector's boundary walls are consistently oriented.
  // If the sector boundary is malformed, return null so callers can fall back to stable ids.
  let sum = 0;
  let sawEdge = false;

  for (const wall of map.walls) {
    if (wall.frontSector !== sectorId) {
      continue;
    }

    const v0 = map.vertices[wall.v0];
    const v1 = map.vertices[wall.v1];
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

export function pickMapSelection(args: Readonly<{
  worldPoint: Point;
  viewScale: number;
  map: MapViewModel;
  renderMode: MapRenderMode;
  texturedWallPolygons?: readonly WallStripPolygon[] | null;
}>): MapSelection | null {
  const safeScale = Math.max(0.0001, args.viewScale);

  let best: PickCandidate | null = null;

  const markerRadiusWorld = MARKER_HIT_RADIUS_PX / safeScale;
  const markerRadiusWorldSquared = markerRadiusWorld * markerRadiusWorld;

  // Markers: consider all marker kinds as one priority band.
  for (const entity of args.map.entities) {
    const d2 = distanceSquared(args.worldPoint, { x: entity.x, y: entity.y });
    if (d2 <= markerRadiusWorldSquared) {
      const candidate: PickCandidate = {
        priority: 10,
        screenDistancePx: Math.sqrt(d2) * safeScale,
        tiebreaker: entity.index,
        selection: { kind: 'entity', index: entity.index }
      };
      if (isBetterCandidate(candidate, best)) {
        best = candidate;
      }
    }
  }

  for (const particle of args.map.particles) {
    const d2 = distanceSquared(args.worldPoint, { x: particle.x, y: particle.y });
    if (d2 <= markerRadiusWorldSquared) {
      const candidate: PickCandidate = {
        priority: 10,
        screenDistancePx: Math.sqrt(d2) * safeScale,
        tiebreaker: 1_000_000 + particle.index,
        selection: { kind: 'particle', index: particle.index }
      };
      if (isBetterCandidate(candidate, best)) {
        best = candidate;
      }
    }
  }

  for (const light of args.map.lights) {
    const d2 = distanceSquared(args.worldPoint, { x: light.x, y: light.y });
    if (d2 <= markerRadiusWorldSquared) {
      const candidate: PickCandidate = {
        priority: 10,
        screenDistancePx: Math.sqrt(d2) * safeScale,
        tiebreaker: 2_000_000 + light.index,
        selection: { kind: 'light', index: light.index }
      };
      if (isBetterCandidate(candidate, best)) {
        best = candidate;
      }
    }
  }

  // Doors.
  const doorRadiusWorld = DOOR_HIT_RADIUS_PX / safeScale;
  const doorRadiusWorldSquared = doorRadiusWorld * doorRadiusWorld;

  for (const door of args.map.doors) {
    const wall = args.map.walls[door.wallIndex];
    if (!wall) {
      continue;
    }

    const v0 = args.map.vertices[wall.v0];
    const v1 = args.map.vertices[wall.v1];
    if (!v0 || !v1) {
      continue;
    }

    const mid: Point = { x: (v0.x + v1.x) / 2, y: (v0.y + v1.y) / 2 };
    const d2 = distanceSquared(args.worldPoint, mid);
    if (d2 <= doorRadiusWorldSquared) {
      const candidate: PickCandidate = {
        priority: 20,
        screenDistancePx: Math.sqrt(d2) * safeScale,
        tiebreaker: stableStringTiebreaker(door.id),
        selection: { kind: 'door', id: door.id }
      };
      if (isBetterCandidate(candidate, best)) {
        best = candidate;
      }
    }
  }

  // Walls.
  // In textured mode, if wall strip polygons are available, treat points inside the strip as an immediate hit.
  if (args.renderMode === 'textured' && args.texturedWallPolygons) {
    for (const polygon of args.texturedWallPolygons) {
      if (pointInPolygon(args.worldPoint, polygon.points)) {
        const candidate: PickCandidate = {
          priority: 30,
          screenDistancePx: 0,
          tiebreaker: polygon.wallIndex,
          selection: { kind: 'wall', index: polygon.wallIndex }
        };
        if (isBetterCandidate(candidate, best)) {
          best = candidate;
        }
      }
    }
  }

  for (const wall of args.map.walls) {
    const v0 = args.map.vertices[wall.v0];
    const v1 = args.map.vertices[wall.v1];
    if (!v0 || !v1) {
      continue;
    }

    const worldDistance = distancePointToSegment(args.worldPoint, v0, v1);
    const screenDistancePx = worldDistance * safeScale;
    if (screenDistancePx <= WALL_HIT_THRESHOLD_PX) {
      const candidate: PickCandidate = {
        priority: 30,
        screenDistancePx,
        tiebreaker: wall.index,
        selection: { kind: 'wall', index: wall.index }
      };
      if (isBetterCandidate(candidate, best)) {
        best = candidate;
      }
    }
  }

  if (best !== null) {
    return best.selection;
  }

  // Sectors.
  //
  // Nested sectors: it is valid for multiple sectors to contain the same point (pits/pillars/platforms).
  // When this happens, Select-mode should pick the most specific (innermost) sector under the cursor.
  //
  // Tie-breaker policy for multiple containing sectors:
  // - Choose the sector with the smallest absolute polygon area (derived from its directed wall edges).
  // - If areas tie within epsilon (or are unavailable), choose the lowest sector id.
  let bestSectorId: number | null = null;
  let bestSectorArea2: number = Number.POSITIVE_INFINITY;
  const areaEps = 0.0001;

  for (const sector of args.map.sectors) {
    if (!pointInSector(args.worldPoint, args.map, sector.id)) {
      continue;
    }

    const area2 = computeSectorAbsArea2(args.map, sector.id);
    const safeArea2 = area2 ?? Number.POSITIVE_INFINITY;

    if (bestSectorId === null) {
      bestSectorId = sector.id;
      bestSectorArea2 = safeArea2;
      continue;
    }

    if (safeArea2 < bestSectorArea2 - areaEps) {
      bestSectorId = sector.id;
      bestSectorArea2 = safeArea2;
      continue;
    }

    if (Math.abs(safeArea2 - bestSectorArea2) <= areaEps && sector.id < bestSectorId) {
      bestSectorId = sector.id;
      bestSectorArea2 = safeArea2;
    }
  }

  if (bestSectorId !== null) {
    return { kind: 'sector', id: bestSectorId };
  }

  return null;
}
