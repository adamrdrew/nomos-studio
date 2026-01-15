export type EditorSettings = Readonly<{
  assetsDirPath: string | null;
  gameExecutablePath: string | null;
}>;

export type AssetIndexStats = Readonly<{
  fileCount: number;
}>;

export type AssetIndex = Readonly<{
  baseDir: string;
  entries: readonly string[];
  stats: AssetIndexStats;
  builtAtIso: string;
}>;

export type MapValidationRecord =
  | Readonly<{
      ok: true;
      validatedAtIso: string;
    }>
  | Readonly<{
      ok: false;
      validatedAtIso: string;
      reportText: string;
    }>;

export type MapDocumentRevision = number;

export type MapDocument = Readonly<{
  filePath: string;
  json: unknown;
  dirty: boolean;
  lastValidation: MapValidationRecord | null;
  revision: MapDocumentRevision;
}>;

export type MapRenderMode = 'wireframe' | 'textured';

export type MapGridSettings = Readonly<{
  isGridVisible: boolean;
  gridOpacity: number;
}>;
