import type { AssetIndex } from '../../../../shared/domain/models';

function basename(posixPath: string): string {
  const normalized = posixPath.replace(/\\/g, '/');
  const lastSlash = normalized.lastIndexOf('/');
  return lastSlash >= 0 ? normalized.slice(lastSlash + 1) : normalized;
}

export function resolveSpriteAssetRelativePath(args: Readonly<{
  assetIndex: AssetIndex | null;
  spriteFileName: string;
}>): string | null {
  const spriteFileName = args.spriteFileName.trim();
  if (spriteFileName.length === 0) {
    return null;
  }

  const assetIndex = args.assetIndex;
  if (assetIndex === null) {
    return null;
  }

  // Preferred deterministic prefixes.
  const prefixes = ['Images/Sprites/', 'Assets/Images/Sprites/'] as const;

  for (const prefix of prefixes) {
    const candidate = `${prefix}${spriteFileName}`;
    if (assetIndex.entries.includes(candidate)) {
      return candidate;
    }
  }

  // Fallback: search the asset index for a matching basename.
  // If multiple matches exist, pick the lexicographically smallest relative path.
  const matches = assetIndex.entries.filter((entry) => basename(entry) === spriteFileName);
  if (matches.length === 0) {
    return null;
  }

  const sorted = [...matches].sort((a, b) => a.localeCompare(b));
  return sorted[0] ?? null;
}
