import type { AssetIndex } from '../../../../shared/domain/models';

const TEXTURE_PATH_PREFIXES = ['Images/Textures/', 'Assets/Images/Textures/'] as const;
export type TexturePathPrefix = (typeof TEXTURE_PATH_PREFIXES)[number];

export function getTextureFileNames(assetIndex: AssetIndex | null): readonly string[] {
  if (assetIndex === null) {
    return [];
  }

  return getTextureFileNamesFromEntries(assetIndex.entries);
}

export function getTextureFileNamesFromEntries(assetIndexEntries: readonly string[]): readonly string[] {
  let matches: string[] = [];

  for (const prefix of TEXTURE_PATH_PREFIXES) {
    const candidate = assetIndexEntries
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
