import type { MapSector } from './mapViewModel';

export type ResolvedSectorSurfaceTexture = Readonly<{
  resolvedTextureKey: string | null;
  isSkyFill: boolean;
}>;

function isSkyCeilTex(value: string): boolean {
  return value.trim().toLowerCase() === 'sky';
}

export function resolveSectorSurfaceTexture(props: {
  surface: 'floor' | 'ceiling';
  sector: Pick<MapSector, 'floorTex' | 'ceilTex'>;
  mapSky: string | null;
}): ResolvedSectorSurfaceTexture {
  if (props.surface === 'floor') {
    return { resolvedTextureKey: props.sector.floorTex, isSkyFill: false };
  }

  if (isSkyCeilTex(props.sector.ceilTex)) {
    if (props.mapSky === null) {
      return { resolvedTextureKey: null, isSkyFill: true };
    }

    return { resolvedTextureKey: `Images/Sky/${props.mapSky}`, isSkyFill: true };
  }

  return { resolvedTextureKey: props.sector.ceilTex, isSkyFill: false };
}
