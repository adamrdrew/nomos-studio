import type { MapDocumentRevision } from './models';

export type Result<Ok, Err> =
  | Readonly<{ ok: true; value: Ok }>
  | Readonly<{ ok: false; error: Err }>;

export type SettingsError = Readonly<{
  kind: 'settings-error';
  code:
    | 'settings/read-failed'
    | 'settings/write-failed'
    | 'settings/parse-failed';
  message: string;
}>;

export type AssetIndexError = Readonly<{
  kind: 'asset-index-error';
  code: 'asset-index/missing-base-dir' | 'asset-index/read-failed';
  message: string;
}>;

export type MapValidationErrorReport = Readonly<{
  kind: 'map-validation-error-report';
  prettyText: string;
  rawText: string;
}>;

export type MapValidationError = Readonly<{
  kind: 'map-validation-error';
  code:
    | 'map-validation/missing-settings'
    | 'map-validation/runner-failed'
    | 'map-validation/invalid-map';
  message: string;
  report?: MapValidationErrorReport;
}>;

export type MapIoError = Readonly<{
  kind: 'map-io-error';
  code:
    | 'map-io/open-cancelled'
    | 'map-io/read-failed'
    | 'map-io/parse-failed'
    | 'map-io/no-document'
    | 'map-io/write-failed';
  message: string;
}>;

export type MapEditStaleRevisionError = Readonly<{
  kind: 'map-edit-error';
  code: 'map-edit/stale-revision';
  message: string;
  currentRevision: MapDocumentRevision;
}>;

export type MapEditError =
  | MapEditStaleRevisionError
  | Readonly<{
      kind: 'map-edit-error';
      code:
        | 'map-edit/no-document'
        | 'map-edit/invalid-json'
        | 'map-edit/not-found'
        | 'map-edit/unsupported-target'
        | 'map-edit/transaction-empty'
        | 'map-edit/transaction-too-large'
        | 'map-edit/transaction-step-failed';
      message: string;
      stepIndex?: number;
      cause?: MapEditError;
    }>;

export type OpenAssetError = Readonly<{
  kind: 'open-asset-error';
  code:
    | 'open-asset/missing-settings'
    | 'open-asset/invalid-relative-path'
    | 'open-asset/outside-base-dir'
    | 'open-asset/open-failed';
  message: string;
}>;

export type OpenMapFromAssetsError = Readonly<{
  kind: 'open-map-from-assets-error';
  code:
    | 'open-map-from-assets/missing-settings'
    | 'open-map-from-assets/invalid-relative-path'
    | 'open-map-from-assets/outside-base-dir';
  message: string;
}>;

export type ReadAssetError = Readonly<{
  kind: 'read-asset-error';
  code:
    | 'read-asset/missing-settings'
    | 'read-asset/invalid-relative-path'
    | 'read-asset/outside-base-dir'
    | 'read-asset/read-failed';
  message: string;
}>;
