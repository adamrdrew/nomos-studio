import type { Result } from '../../../../shared/domain/results';

export type MapVertex = Readonly<{ x: number; y: number }>;

export type MapSector = Readonly<{
  id: number;
  floorZ: number;
  ceilZ: number;
  floorTex: string;
  ceilTex: string;
  light: number;
}>;

export type MapWall = Readonly<{
  index: number;
  v0: number;
  v1: number;
  frontSector: number;
  backSector: number;
  tex: string;
  endLevel: boolean;
}>;

export type MapDoor = Readonly<{
  id: string;
  wallIndex: number;
  tex: string;
  startsClosed: boolean;
  requiredItem: string | null;
  requiredItemMissingMessage: string | null;
}>;

export type RgbColor = Readonly<{ r: number; g: number; b: number }>; // 0..255

export type MapLight = Readonly<{
  index: number;
  x: number;
  y: number;
  radius: number;
  intensity: number;
  color: RgbColor;
}>;

export type MapParticleEmitter = Readonly<{
  index: number;
  x: number;
  y: number;
}>;

export type MapEntityPlacement = Readonly<{
  index: number;
  x: number;
  y: number;
  defName: string | null;
  yawDeg: number;
}>;

export type MapViewModel = Readonly<{
  sky: string | null;
  vertices: readonly MapVertex[];
  sectors: readonly MapSector[];
  walls: readonly MapWall[];
  doors: readonly MapDoor[];
  lights: readonly MapLight[];
  particles: readonly MapParticleEmitter[];
  entities: readonly MapEntityPlacement[];
}>;

export type MapDecodeError = Readonly<{
  kind: 'map-decode-error';
  message: string;
}>;

export type MapDecodeResult = Result<MapViewModel, MapDecodeError>;
