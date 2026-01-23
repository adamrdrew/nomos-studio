function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseEntityManifestFiles(json: unknown): readonly string[] {
  const files: string[] = [];

  // Primary supported shape:
  // { files: ["defs/shambler.json", ...] }
  if (isRecord(json) && Array.isArray(json['files'])) {
    for (const entry of json['files']) {
      if (typeof entry === 'string' && entry.trim().length > 0) {
        files.push(entry.trim());
      }
    }
  }

  // Back-compat shapes from earlier experiments:
  // - raw array
  // - { entities: [...] } or { defs: [...] }
  const rawList: unknown[] | null =
    Array.isArray(json)
      ? json
      : isRecord(json) && Array.isArray(json['entities'])
        ? (json['entities'] as unknown[])
        : isRecord(json) && Array.isArray(json['defs'])
          ? (json['defs'] as unknown[])
          : null;

  if (rawList !== null) {
    for (const entry of rawList) {
      if (typeof entry === 'string' && entry.trim().length > 0) {
        files.push(entry.trim());
      } else if (isRecord(entry)) {
        const def = entry['def'];
        const name = entry['name'];
        const id = entry['id'];
        const candidate =
          typeof def === 'string' ? def : typeof name === 'string' ? name : typeof id === 'string' ? id : null;
        if (candidate && candidate.trim().length > 0) {
          files.push(candidate.trim());
        }
      }
    }
  }

  const unique = Array.from(new Set(files));
  unique.sort((a, b) => a.localeCompare(b));
  return unique;
}
