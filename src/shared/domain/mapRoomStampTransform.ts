import type { Vec2 } from './mapRoomGeometry';
import type { RoomRotationQuarterTurns } from './mapRoomCreation';

export type RoomStampAnchor = Readonly<{ x: number; y: number }>;

export function computePolygonBounds(polygon: readonly Vec2[]):
  | Readonly<{ min: Vec2; max: Vec2 }>
  | null {
  if (polygon.length === 0) {
    return null;
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const p of polygon) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return null;
  }

  return { min: { x: minX, y: minY }, max: { x: maxX, y: maxY } };
}

export function computePolygonAnchor(polygon: readonly Vec2[]): RoomStampAnchor | null {
  const bounds = computePolygonBounds(polygon);
  if (bounds === null) {
    return null;
  }
  return {
    x: (bounds.min.x + bounds.max.x) / 2,
    y: (bounds.min.y + bounds.max.y) / 2
  };
}

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

export function normalizePolygonToAnchor(polygon: readonly Vec2[]):
  | Readonly<{ localPolygon: readonly Vec2[]; anchor: RoomStampAnchor }>
  | null {
  const anchor = computePolygonAnchor(polygon);
  if (anchor === null) {
    return null;
  }

  const localPolygon = polygon.map((p) => ({ x: p.x - anchor.x, y: p.y - anchor.y }));
  return { localPolygon, anchor };
}

export function transformStampPolygon(args: Readonly<{
  localPolygon: readonly Vec2[];
  at: Vec2;
  rotationQuarterTurns: RoomRotationQuarterTurns;
  scale: Readonly<{ x: number; y: number }>;
}>): readonly Vec2[] {
  const scaled: Vec2[] = [];
  for (const p of args.localPolygon) {
    scaled.push({ x: p.x * args.scale.x, y: p.y * args.scale.y });
  }

  const rotated: Vec2[] = [];
  for (const p of scaled) {
    rotated.push(rotateQuarterTurns(p, args.rotationQuarterTurns));
  }

  return rotated.map((p) => ({ x: p.x + args.at.x, y: p.y + args.at.y }));
}
