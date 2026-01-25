import type { AssetIndex } from '../../../../shared/domain/models';

export type ReadFileBytesResult =
  | Readonly<{ ok: true; value: Uint8Array }>
  | Readonly<{ ok: false; error: unknown }>;

export type ReadFileBytes = (args: Readonly<{ relativePath: string }>) => Promise<ReadFileBytesResult>;

export type ObjectUrlAdapter = Readonly<{
  create: (bytes: Uint8Array, mimeType: string) => string;
  revoke: (url: string) => void;
}>;

export function inferImageMimeType(fileName: string): string {
  const lowered = fileName.trim().toLowerCase();
  if (lowered.endsWith('.png')) {
    return 'image/png';
  }
  if (lowered.endsWith('.jpg') || lowered.endsWith('.jpeg')) {
    return 'image/jpeg';
  }
  if (lowered.endsWith('.webp')) {
    return 'image/webp';
  }
  if (lowered.endsWith('.gif')) {
    return 'image/gif';
  }
  return 'application/octet-stream';
}

export function createBrowserObjectUrlAdapter(): ObjectUrlAdapter {
  return {
    create: (bytes: Uint8Array, mimeType: string) => {
      const bytesCopy = new Uint8Array(bytes);
      const blob = new Blob([bytesCopy.buffer], { type: mimeType });
      return URL.createObjectURL(blob);
    },
    revoke: (url: string) => {
      URL.revokeObjectURL(url);
    }
  };
}

export function resolveTextureRelativePath(props: Readonly<{ assetIndex: AssetIndex | null; textureFileName: string }>): string | null {
  const trimmed = props.textureFileName.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const primary = `Images/Textures/${trimmed}`;
  const fallback = `Assets/Images/Textures/${trimmed}`;

  if (props.assetIndex === null) {
    return primary;
  }

  if (props.assetIndex.entries.includes(primary)) {
    return primary;
  }

  if (props.assetIndex.entries.includes(fallback)) {
    return fallback;
  }

  return null;
}

// Lifecycle expectations:
// - Keep a single cache instance for the renderer session (or per-window) to avoid re-fetching bytes.
// - URLs are revoked on eviction and on clear(). If you discard a cache instance, call clear() first.
// - UI components should cancel async work on unmount; this module does not manage React lifecycles.
export class TextureObjectUrlCache {
  private readonly maxEntries: number;
  private readonly objectUrls: ObjectUrlAdapter;
  private readonly cacheByKey: Map<string, string>;

  public constructor(props: Readonly<{ maxEntries: number; objectUrls: ObjectUrlAdapter }>) {
    this.maxEntries = Math.max(1, Math.floor(props.maxEntries));
    this.objectUrls = props.objectUrls;
    this.cacheByKey = new Map();
  }

  public get(key: string): string | null {
    const existing = this.cacheByKey.get(key) ?? null;
    if (existing === null) {
      return null;
    }

    // LRU: move to most-recent by re-inserting.
    this.cacheByKey.delete(key);
    this.cacheByKey.set(key, existing);
    return existing;
  }

  public put(key: string, url: string): void {
    const existing = this.cacheByKey.get(key);
    if (existing !== undefined && existing !== url) {
      this.objectUrls.revoke(existing);
    }

    this.cacheByKey.delete(key);
    this.cacheByKey.set(key, url);

    while (this.cacheByKey.size > this.maxEntries) {
      const oldestKey = this.cacheByKey.keys().next().value as string | undefined;
      if (oldestKey === undefined) {
        break;
      }
      const evictedUrl = this.cacheByKey.get(oldestKey);
      this.cacheByKey.delete(oldestKey);
      if (evictedUrl !== undefined) {
        this.objectUrls.revoke(evictedUrl);
      }
    }
  }

  public clear(): void {
    for (const url of this.cacheByKey.values()) {
      this.objectUrls.revoke(url);
    }
    this.cacheByKey.clear();
  }

  public getSize(): number {
    return this.cacheByKey.size;
  }
}

export async function ensureTextureObjectUrl(props: Readonly<{
  cache: TextureObjectUrlCache;
  relativePath: string;
  fileNameForMimeType: string;
  readFileBytes: ReadFileBytes;
  objectUrls: ObjectUrlAdapter;
}>): Promise<string | null> {
  const cached = props.cache.get(props.relativePath);
  if (cached !== null) {
    return cached;
  }

  const result = await props.readFileBytes({ relativePath: props.relativePath });
  if (!result.ok) {
    return null;
  }

  const mimeType = inferImageMimeType(props.fileNameForMimeType);
  const url = props.objectUrls.create(result.value, mimeType);
  props.cache.put(props.relativePath, url);
  return url;
}
