export type RoomTemplate = 'rectangle' | 'square' | 'triangle';

// 0=0°, 1=90° CW, 2=180°, 3=270°.
export type RoomRotationQuarterTurns = 0 | 1 | 2 | 3;

export type RoomDefaults = Readonly<{
  wallTex: string;
  floorTex: string;
  ceilTex: string;
  floorZ: number;
  ceilZ: number;
  light: number;
}>;

export type RoomPlacementPlan =
  | Readonly<{ kind: 'room-placement/nested'; enclosingSectorId: number }>
  | Readonly<{ kind: 'room-placement/adjacent'; targetWallIndex: number; snapDistancePx: number }>
  | Readonly<{ kind: 'room-placement/seed' }>;

export type CreateRoomRequest = Readonly<{
  template: RoomTemplate;

  // Room center in world coordinates.
  center: Readonly<{ x: number; y: number }>;

  // Size in world units (applies after template selection; square uses width===height).
  size: Readonly<{ width: number; height: number }>;

  rotationQuarterTurns: RoomRotationQuarterTurns;

  defaults: RoomDefaults;

  // Renderer-computed plan (used for deterministic validity + UX parity).
  // Main must still validate it against the current map JSON.
  placement: RoomPlacementPlan;
}>;

export const ROOM_CREATION_DEFAULTS = {
  snapThresholdPx: 12,
  rotationStepQuarterTurns: 1,
  scaleStep: 1,
  minSizeWorld: 1
} as const;
