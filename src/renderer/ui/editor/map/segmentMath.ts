export type Vec2 = Readonly<{ x: number; y: number }>;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function closestPointOnSegment(point: Vec2, a: Vec2, b: Vec2): Vec2 {
  const abX = b.x - a.x;
  const abY = b.y - a.y;
  const abLen2 = abX * abX + abY * abY;
  if (abLen2 === 0) {
    return { x: a.x, y: a.y };
  }

  const apX = point.x - a.x;
  const apY = point.y - a.y;
  const t = clamp((apX * abX + apY * abY) / abLen2, 0, 1);
  return { x: a.x + t * abX, y: a.y + t * abY };
}

export function isPointNearSegmentEndpoints(point: Vec2, a: Vec2, b: Vec2, epsilon: number): boolean {
  const epsilonSquared = epsilon * epsilon;

  const dx0 = point.x - a.x;
  const dy0 = point.y - a.y;
  if (dx0 * dx0 + dy0 * dy0 <= epsilonSquared) {
    return true;
  }

  const dx1 = point.x - b.x;
  const dy1 = point.y - b.y;
  return dx1 * dx1 + dy1 * dy1 <= epsilonSquared;
}
