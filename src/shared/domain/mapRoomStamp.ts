import type { Vec2 } from './mapRoomGeometry';
import type { RoomPlacementPlan } from './mapRoomCreation';

export type RoomStampWallProps = Readonly<{
  tex: string;
  endLevel: boolean;
  toggleSector: boolean;
  toggleSectorId: number | null;
  toggleSectorOneshot: boolean;
  toggleSound: string | null;
  toggleSoundFinish: string | null;
}>;

export type RoomStampSectorProps = Readonly<{
  floorZ: number;
  floorZToggledPos: number | null;
  ceilZ: number;
  floorTex: string;
  ceilTex: string;
  light: number;
}>;

export type RoomStamp = Readonly<{
  polygon: readonly Vec2[];
  wallProps: readonly RoomStampWallProps[];
  sectorProps: RoomStampSectorProps;
}>;

export type StampRoomRequest = Readonly<{
  // World-space polygon vertices, ordered and closed implicitly.
  polygon: readonly Vec2[];

  // One entry per polygon edge, aligned with the polygon vertex order.
  // wallProps[i] applies to the edge from polygon[i] -> polygon[(i+1)%n].
  wallProps: readonly RoomStampWallProps[];

  sectorProps: RoomStampSectorProps;

  // Renderer-computed plan (used for deterministic validity + UX parity).
  // Main must still validate it against the current map JSON.
  placement: RoomPlacementPlan;
}>;
