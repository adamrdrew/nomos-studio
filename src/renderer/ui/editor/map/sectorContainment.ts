import type { MapViewModel } from './mapViewModel';

type Point = Readonly<{ x: number; y: number }>;

type SectorLoop = readonly number[];

type Edge = Readonly<{ a: number; b: number }>;

export function buildSectorLoop(map: MapViewModel, sectorId: number): SectorLoop | null {
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

  // Walk edges until we return to the start or run out.
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

export function isWorldPointInsideSectorLoop(worldPoint: Point, map: MapViewModel, sectorId: number): boolean {
  const loop = buildSectorLoop(map, sectorId);
  if (loop === null) {
    return false;
  }

  // buildSectorLoop returns a closed loop (first==last). Convert to points and drop the repeated last vertex.
  const polygon: Point[] = [];
  for (let index = 0; index < loop.length - 1; index += 1) {
    const vertexIndex = loop[index];
    if (vertexIndex === undefined) {
      continue;
    }

    const v = map.vertices[vertexIndex];
    if (!v) {
      continue;
    }

    polygon.push({ x: v.x, y: v.y });
  }

  return pointInPolygon(worldPoint, polygon);
}

function buildSectorEdges(map: MapViewModel, sectorId: number): readonly Edge[] {
  const edges: Edge[] = [];
  for (const wall of map.walls) {
    if (wall.frontSector === sectorId) {
      edges.push({ a: wall.v0, b: wall.v1 });
      continue;
    }
    if (wall.backSector === sectorId) {
      // Flip orientation so both sides follow the sector boundary consistently.
      edges.push({ a: wall.v1, b: wall.v0 });
    }
  }
  return edges;
}

export function isWorldPointInSector(worldPoint: Point, map: MapViewModel, sectorId: number): boolean {
  // Ray crossing over the sector's full boundary (including edges where the sector is the back side).
  const edges = buildSectorEdges(map, sectorId);
  if (edges.length === 0) {
    return false;
  }

  let crossings = 0;
  for (const edge of edges) {
    const v0 = map.vertices[edge.a];
    const v1 = map.vertices[edge.b];
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

function computeSectorAbsArea2(map: MapViewModel, sectorId: number): number | null {
  // 2x polygon area using the sector's directed edges.
  let sum = 0;
  let sawEdge = false;

  for (const edge of buildSectorEdges(map, sectorId)) {
    const v0 = map.vertices[edge.a];
    const v1 = map.vertices[edge.b];
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

export function pickSectorIdAtWorldPoint(worldPoint: Point, map: MapViewModel): number | null {
  // Nested sectors: prefer the smallest area sector containing the point.
  let bestSectorId: number | null = null;
  let bestSectorArea2 = Number.POSITIVE_INFINITY;
  const areaEps = 0.0001;

  for (const sector of map.sectors) {
    if (!isWorldPointInSector(worldPoint, map, sector.id)) {
      continue;
    }

    const area2 = computeSectorAbsArea2(map, sector.id);
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

  return bestSectorId;
}
