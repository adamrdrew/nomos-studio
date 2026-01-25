export type Point = Readonly<{ x: number; y: number }>;

export function computeLightRadiusHandleWorldPoint(args: Readonly<{ center: Point; radius: number }>): Point {
  const safeRadius = Number.isFinite(args.radius) ? Math.max(0, args.radius) : 0;
  return { x: args.center.x + safeRadius, y: args.center.y };
}

export function isWorldPointOnLightRadiusHandle(args: Readonly<{
  center: Point;
  radius: number;
  worldPoint: Point;
  viewScale: number;
  hitRadiusPx: number;
}>): boolean {
  const safeScale = Number.isFinite(args.viewScale) ? Math.max(0.0001, args.viewScale) : 0.0001;
  const safeHitRadiusPx = Number.isFinite(args.hitRadiusPx) ? Math.max(0, args.hitRadiusPx) : 0;
  const hitRadiusWorld = safeHitRadiusPx / safeScale;

  const handle = computeLightRadiusHandleWorldPoint({ center: args.center, radius: args.radius });

  const dx = args.worldPoint.x - handle.x;
  const dy = args.worldPoint.y - handle.y;
  const d2 = dx * dx + dy * dy;
  return d2 <= hitRadiusWorld * hitRadiusWorld;
}

export function computeLightRadiusFromWorldPoint(args: Readonly<{ center: Point; worldPoint: Point }>): number {
  const dx = args.worldPoint.x - args.center.x;
  const dy = args.worldPoint.y - args.center.y;
  const raw = Math.sqrt(dx * dx + dy * dy);
  if (!Number.isFinite(raw)) {
    return 0;
  }
  return Math.max(0, raw);
}
