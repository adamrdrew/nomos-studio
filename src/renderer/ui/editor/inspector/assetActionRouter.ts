export type AssetDoubleClickAction =
  | Readonly<{ kind: 'open-map-in-editor'; relativePath: string }>
  | Readonly<{ kind: 'open-via-os'; relativePath: string }>;

function normalizePathSeparators(value: string): string {
  return value.replace(/\\/g, '/');
}

export function routeAssetDoubleClick(relativePath: string): AssetDoubleClickAction {
  const normalized = normalizePathSeparators(relativePath.trim());
  const lower = normalized.toLowerCase();

  const isMapUnderLevels = lower.startsWith('levels/') && lower.endsWith('.json');
  if (isMapUnderLevels) {
    return { kind: 'open-map-in-editor', relativePath: normalized };
  }

  return { kind: 'open-via-os', relativePath: normalized };
}