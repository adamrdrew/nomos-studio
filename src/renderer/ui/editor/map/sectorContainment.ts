import type { MapViewModel } from './mapViewModel';

type Point = Readonly<{ x: number; y: number }>;

type SectorLoop = readonly number[];

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
