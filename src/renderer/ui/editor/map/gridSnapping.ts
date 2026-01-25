import type { Vec2 } from '../../../../shared/domain/mapRoomGeometry';

import { chooseMinorGridWorldSpacing } from './gridSpacing';

export function shouldSnapToGrid(options: Readonly<{ isSnapToGridEnabled: boolean; isShiftKeyPressed: boolean }>): boolean {
  return options.isSnapToGridEnabled && !options.isShiftKeyPressed;
}

export function snapWorldPointToGrid(point: Vec2, gridWorldSpacing: number): Vec2 {
  if (!Number.isFinite(gridWorldSpacing) || gridWorldSpacing <= 0) {
    return point;
  }

  const snappedX = Math.round(point.x / gridWorldSpacing) * gridWorldSpacing;
  const snappedY = Math.round(point.y / gridWorldSpacing) * gridWorldSpacing;

  const normalizedX = snappedX === 0 ? 0 : snappedX;
  const normalizedY = snappedY === 0 ? 0 : snappedY;

  return {
    x: normalizedX,
    y: normalizedY
  };
}

export function snapWorldPointToDisplayedGrid(point: Vec2, viewScale: number): Vec2 {
  const gridWorldSpacing = chooseMinorGridWorldSpacing(viewScale);
  return snapWorldPointToGrid(point, gridWorldSpacing);
}
