import type { MapViewModel } from './mapViewModel';

import type { RoomMapGeometry } from '../../../../shared/domain/mapRoomGeometry';
import { extractSingleSectorBoundaryLoop } from '../../../../shared/domain/mapSectorBoundary';
import type { RoomStamp, RoomStampSectorProps, RoomStampWallProps } from '../../../../shared/domain/mapRoomStamp';
import type { Result } from '../../../../shared/domain/results';

export type RoomStampFromSectorError = Readonly<{
  kind: 'room-stamp-from-sector-error';
  reason:
    | 'missing-sector'
    | 'missing-wall'
    | 'no-edges'
    | 'too-few-edges'
    | 'open-loop'
    | 'ambiguous'
    | 'missing-vertex'
    | 'non-simple';
}>;

function toRoomMapGeometry(map: MapViewModel): RoomMapGeometry {
  return {
    vertices: map.vertices,
    sectorIds: map.sectors.map((sector) => sector.id),
    walls: map.walls.map((wall) => ({
      index: wall.index,
      v0: wall.v0,
      v1: wall.v1,
      frontSectorId: wall.frontSector,
      backSectorId: wall.backSector
    }))
  };
}

function findWallByIndex(map: MapViewModel, wallIndex: number): RoomStampWallProps | null {
  // Fast path: most maps keep `walls[index]` aligned.
  const direct = map.walls[wallIndex];
  const wall = direct && direct.index === wallIndex ? direct : map.walls.find((candidate) => candidate.index === wallIndex);
  if (!wall) {
    return null;
  }

  return {
    tex: wall.tex,
    endLevel: wall.endLevel,
    toggleSector: wall.toggleSector,
    toggleSectorId: wall.toggleSectorId,
    toggleSectorOneshot: wall.toggleSectorOneshot,
    toggleSound: wall.toggleSound,
    toggleSoundFinish: wall.toggleSoundFinish
  };
}

export function buildRoomStampFromSector(map: MapViewModel, sectorId: number): Result<RoomStamp, RoomStampFromSectorError> {
  const sector = map.sectors.find((candidate) => candidate.id === sectorId);
  if (!sector) {
    return { ok: false, error: { kind: 'room-stamp-from-sector-error', reason: 'missing-sector' } };
  }

  const geometry = toRoomMapGeometry(map);
  const loop = extractSingleSectorBoundaryLoop(geometry, sectorId);
  if (loop.kind === 'sector-boundary-loop-error') {
    return { ok: false, error: { kind: 'room-stamp-from-sector-error', reason: loop.reason } };
  }

  const sectorProps: RoomStampSectorProps = {
    floorZ: sector.floorZ,
    floorZToggledPos: sector.floorZToggledPos,
    ceilZ: sector.ceilZ,
    floorTex: sector.floorTex,
    ceilTex: sector.ceilTex,
    light: sector.light
  };

  const wallProps: RoomStampWallProps[] = [];
  for (const wallIndex of loop.wallIndices) {
    const props = findWallByIndex(map, wallIndex);
    if (!props) {
      return { ok: false, error: { kind: 'room-stamp-from-sector-error', reason: 'missing-wall' } };
    }
    wallProps.push(props);
  }

  return {
    ok: true,
    value: {
      polygon: loop.polygon,
      wallProps,
      sectorProps
    }
  };
}
