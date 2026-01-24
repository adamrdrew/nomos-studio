import type { AssetIndex, EditorSettings } from '../../../../shared/domain/models';

export type RoomTextureDefaults = Readonly<{ wallTex: string; floorTex: string; ceilTex: string }>;

function listAvailableTextureFileNames(assetIndex: AssetIndex): readonly string[] {
  const prefixes = ['Images/Textures/', 'Assets/Images/Textures/'] as const;

  let matches: string[] = [];
  for (const prefix of prefixes) {
    const candidate = assetIndex.entries
      .filter((entry) => entry.startsWith(prefix))
      .map((entry) => entry.slice(prefix.length))
      .filter((fileName) => fileName.trim().length > 0);

    if (candidate.length > 0) {
      matches = candidate;
      break;
    }
  }

  matches.sort((a, b) => a.localeCompare(b));
  return matches;
}

function isValidDefaultTexture(value: string | null, available: readonly string[]): value is string {
  if (value === null) {
    return false;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return false;
  }
  return available.includes(trimmed);
}

export function pickDefaultRoomTextures(props: {
  assetIndex: AssetIndex | null;
  settings: Pick<EditorSettings, 'defaultWallTex' | 'defaultFloorTex' | 'defaultCeilTex'>;
}): RoomTextureDefaults | null {
  if (props.assetIndex === null) {
    return null;
  }

  const available = listAvailableTextureFileNames(props.assetIndex);

  const wallDefault = props.settings.defaultWallTex;
  const floorDefault = props.settings.defaultFloorTex;
  const ceilDefault = props.settings.defaultCeilTex;

  const hasValidDefaults =
    isValidDefaultTexture(wallDefault, available) &&
    isValidDefaultTexture(floorDefault, available) &&
    isValidDefaultTexture(ceilDefault, available);

  if (hasValidDefaults) {
    return {
      wallTex: wallDefault.trim(),
      floorTex: floorDefault.trim(),
      ceilTex: ceilDefault.trim()
    };
  }

  const wallTex = available[0] ?? null;
  const floorTex = available[1] ?? null;
  const ceilTex = available[2] ?? null;

  if (wallTex === null || floorTex === null || ceilTex === null) {
    return null;
  }

  return { wallTex, floorTex, ceilTex };
}
