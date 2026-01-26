# Assets System

## Overview
Nomos Studio maintains an in-memory index of files found under the configured Assets directory. The index is built in the main process and stored in the main-process `AppStore`. The renderer can trigger a refresh via a preload-exposed IPC call.

The assets index currently represents:
- the configured base directory path
- a sorted list of relative file paths (POSIX-style separators)
- basic stats (`fileCount`)
- the build timestamp

In the editor UI, the Asset Browser uses a small double-click routing rule:
- `Levels/*.json` is treated as a map and opened in-editor.
- other `*.json` files open in the in-app JSON editor.
- All other assets open via the OS default handler.

## Architecture
The assets system is split across the standard boundaries:

- **Shared domain types**
	- `AssetIndex` and `AssetIndexError` live under `src/shared/domain/`.

- **Application layer (main process, orchestration)**
	- `AssetIndexService` is the application entrypoint to refresh the index.
	- It reads `assetsDirPath` from `AppStore.state.settings`.
	- It writes either `assetIndex` or `assetIndexError` into `AppStore`.

- **Infrastructure layer (side effects)**
	- `AssetIndexer` performs filesystem traversal via an injected `DirectoryReader` adapter.
	- `nodeDirectoryReader` implements `DirectoryReader` using Node’s `fs.promises.readdir` with `withFileTypes: true`.
	- `nodePathService` is a small adapter over Node `path` utilities used for absolute/relative path checks.
	- `nodeShellOpener` is an adapter over Electron shell integration used to open files in the OS.
	- `nodeBinaryFileReader` is an adapter used to read file bytes from disk (for textures and other binary assets).
	- `nodeTextFileReader` is an adapter used to read and write UTF-8 text files from disk (for JSON editor tabs).

- **IPC / preload surface**
	- The renderer can call `window.nomos.assets.refreshIndex()`.
	- The main process handles that via the `nomos:assets:refresh-index` channel, which delegates to `AssetIndexService.refreshIndex()`.
	- The renderer can call `window.nomos.assets.open({ relativePath })` to open an asset using the OS default handler.
	- The main process handles that via the `nomos:assets:open` channel, which delegates to `OpenAssetService.openAsset(relativePath)`.
	- The renderer can call `window.nomos.assets.readFileBytes({ relativePath })` to read asset bytes (e.g., for rendering textures).
	- The main process handles that via the `nomos:assets:read-file-bytes` channel, which delegates to `ReadAssetFileBytesService.readFileBytes(relativePath)`.
	- The renderer can call `window.nomos.assets.readJsonText({ relativePath })` to read JSON text for in-app editing.
	- The main process handles that via the `nomos:assets:read-json-text` channel, which delegates to `ReadAssetJsonTextService.readJsonText(relativePath)`.
	- The renderer can call `window.nomos.assets.writeJsonText({ relativePath, text })` to save JSON text back to disk.
	- The main process handles that via the `nomos:assets:write-json-text` channel, which delegates to `WriteAssetJsonTextService.writeJsonText(relativePath, text)`.

## Public API / entrypoints

### Application API (main)
- `AssetIndexService`
	- `refreshIndex(): Promise<Result<AssetIndex, AssetIndexError>>`

- `OpenAssetService`
	- `openAsset(relativePath: string): Promise<Result<null, OpenAssetError>>`

- `ReadAssetFileBytesService`
	- `readFileBytes(relativePath: string): Promise<Result<Uint8Array, ReadAssetError>>`

- `ReadAssetJsonTextService`
	- `readJsonText(relativePath: string): Promise<Result<string, ReadAssetError>>`

- `WriteAssetJsonTextService`
	- `writeJsonText(relativePath: string, text: string): Promise<Result<null, WriteAssetError>>`

### Infrastructure API (main)
- `AssetIndexer`
	- `buildIndex(baseDir: string): Promise<Result<AssetIndex, AssetIndexError>>`

### Filesystem seam
- `DirectoryReader` (interface)
	- `readDir(dirPath: string): Promise<readonly { name: string; isDirectory: boolean }[]>`

### Preload API (renderer-facing)
- `window.nomos.assets.refreshIndex(): Promise<RefreshAssetIndexResponse>`
- `window.nomos.assets.open(request: { relativePath: string }): Promise<OpenAssetResponse>`
- `window.nomos.assets.readFileBytes(request: { relativePath: string }): Promise<ReadAssetFileBytesResponse>`
- `window.nomos.assets.readJsonText(request: { relativePath: string }): Promise<ReadAssetJsonTextResponse>`
- `window.nomos.assets.writeJsonText(request: { relativePath: string; text: string }): Promise<WriteAssetJsonTextResponse>`

Editor-only map open:
- `window.nomos.map.openFromAssets(request: { relativePath: string }): Promise<OpenMapFromAssetsResponse>`

### IPC contract
Defined in `src/shared/ipc/nomosIpc.ts`:
- Channel: `nomos:assets:refresh-index`
- Response type: `RefreshAssetIndexResponse = Result<AssetIndex, AssetIndexError>`

Open in OS:
- Channel: `nomos:assets:open`
- Request type: `OpenAssetRequest = Readonly<{ relativePath: string }>`
- Response type: `OpenAssetResponse = Result<null, OpenAssetError>`

Read file bytes:
- Channel: `nomos:assets:read-file-bytes`
- Request type: `ReadAssetFileBytesRequest = Readonly<{ relativePath: string }>`
- Response type: `ReadAssetFileBytesResponse = Result<Uint8Array, ReadAssetError>`

Read JSON text:
- Channel: `nomos:assets:read-json-text`
- Request type: `ReadAssetJsonTextRequest = Readonly<{ relativePath: string }>`
- Response type: `ReadAssetJsonTextResponse = Result<string, ReadAssetError>`

Write JSON text:
- Channel: `nomos:assets:write-json-text`
- Request type: `WriteAssetJsonTextRequest = Readonly<{ relativePath: string; text: string }>`
- Response type: `WriteAssetJsonTextResponse = Result<null, WriteAssetError>`

## Data shapes

### In-memory types
`AssetIndex`:
```ts
type AssetIndex = Readonly<{
	baseDir: string;
	entries: readonly string[];
	stats: Readonly<{ fileCount: number }>;
	builtAtIso: string;
}>;
```

`AssetIndexError`:
```ts
type AssetIndexError = Readonly<{
	kind: 'asset-index-error';
	code: 'asset-index/missing-base-dir' | 'asset-index/read-failed';
	message: string;
}>;
```

### Path conventions
- `AssetIndex.entries` are **relative** to `AssetIndex.baseDir`.
- Entries are normalized to **POSIX separators** (`/`) regardless of OS. (Implementation converts from `path.sep` to `path.posix.sep`.)

## Boundaries & invariants

### Security boundary (L03)
- Directory traversal and indexing run in the **main process**.
- The renderer must not traverse the filesystem; it can only request refresh through preload/IPC.

### System safety for open-asset (L06)
- The renderer sends a *relative* asset path.
- The main process validates:
	- assets are configured (`settings.assetsDirPath`)
	- the resolved absolute path is within the assets base directory
- Only then does the main process invoke the OS handler to open the file.

### System safety for read-file-bytes (L06)
- The renderer sends a *relative* asset path.
- The main process rejects:
	- missing settings
	- empty paths
	- absolute paths
	- null bytes
	- paths that resolve outside the configured assets directory

### System safety for JSON text read/write (L06)
- JSON text operations use the same traversal protection rules as read-file-bytes.
- JSON text operations additionally reject non-`.json` paths.
- JSON text writes use a safe-write strategy (temp + replace) to avoid partially-written files.

### Settings dependency
- Indexing depends on `EditorSettings.assetsDirPath`.
- If `assetsDirPath` is `null` or only whitespace:
	- `AssetIndexService.refreshIndex()` returns `asset-index/missing-base-dir` and stores the error in `AppStore`.

### Traversal behavior
- `AssetIndexer` performs a recursive directory walk starting at `baseDir`.
- All non-directory children are recorded as entries.
- Entries are sorted lexicographically before returning.

### Failure behavior
- If directory traversal fails for any reason, `AssetIndexer.buildIndex` returns `asset-index/read-failed`.

### Resource usage (L05)
- The index is stored in memory; there is no on-disk cache at present.
- The index size grows with the number of files under the assets directory.

## How to extend safely

### Adding richer asset metadata
If future work needs metadata per entry (size, mtime, type detection):
1. Extend `AssetIndex` in `src/shared/domain/models.ts` (prefer additive fields).
2. Update `AssetIndexer` to gather metadata via injected adapters (do not import Node fs directly into application/domain layers).
3. Keep POSIX normalization consistent so renderer/UI code does not become OS-dependent.
4. Extend `AssetIndexService.refreshIndex` only as needed; keep it as orchestration around `AppStore`.
5. Add/extend unit tests covering conditional paths.

### Filtering or ignoring files
- Introduce filtering rules in `AssetIndexer` (e.g., ignore dotfiles) and test them.
- Keep rules explicit and deterministic.

### Avoid widening the renderer API
- Prefer keeping large data processing in main.
- If the renderer needs subsets or queries, add explicit IPC methods rather than exposing the entire store.

## Testing notes
Existing unit tests cover the main branches:
- `src/main/application/assets/AssetIndexService.test.ts`
- `src/main/infrastructure/assets/AssetIndexer.test.ts`
- `src/main/infrastructure/assets/nodeDirectoryReader.test.ts`

Test seams:
- `AssetIndexer` depends on `DirectoryReader` and `nowIso`, allowing deterministic tests.
