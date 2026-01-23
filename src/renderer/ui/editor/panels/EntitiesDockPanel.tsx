import React from 'react';
import { Card, Colors, H5, Spinner } from '@blueprintjs/core';

import { useNomosStore } from '../../../store/nomosStore';
import type { AssetIndex } from '../../../../shared/domain/models';

import { parseEntityDefDisplayModel, type EntityDefDisplayModel } from '../entities/entityDefParser';
import { parseEntityManifestFiles } from '../entities/entityManifestParser';
import { EntitySpriteThumbnail } from '../entities/EntitySpriteThumbnail';
import { writeEntityPlacementDragPayload } from '../entities/entityPlacementDragPayload';

type EntityBrowserRow =
  | Readonly<{
      kind: 'entity';
      defName: string;
      spriteFileName: string;
      frameWidthPx: number;
      frameHeightPx: number;
      defRelativePath: string;
    }>
  | Readonly<{
      kind: 'error';
      defRelativePath: string;
      message: string;
    }>;

type EntitiesLoadState =
  | Readonly<{ kind: 'idle' }>
  | Readonly<{ kind: 'loading' }>
  | Readonly<{ kind: 'failed'; message: string }>
  | Readonly<{ kind: 'loaded'; rows: readonly EntityBrowserRow[] }>;

const MANIFEST_PATHS_TO_TRY = ['Entities/entities_manifest.json', 'Assets/Entities/entities_manifest.json'] as const;

function joinRelativePath(prefix: string, suffix: string): string {
  const cleanedPrefix = prefix.replace(/\/+$/, '');
  const cleanedSuffix = suffix.replace(/^\/+/, '');
  return cleanedPrefix.length === 0 ? cleanedSuffix : `${cleanedPrefix}/${cleanedSuffix}`;
}

function toDefRelativePath(manifestPath: (typeof MANIFEST_PATHS_TO_TRY)[number], manifestEntry: string): string {
  const basePrefix = manifestPath === 'Entities/entities_manifest.json' ? 'Entities' : 'Assets/Entities';
  return joinRelativePath(basePrefix, manifestEntry);
}

function sortRowsStable(rows: readonly EntityBrowserRow[]): readonly EntityBrowserRow[] {
  const entities = rows.filter((row) => row.kind === 'entity') as ReadonlyArray<Extract<EntityBrowserRow, { kind: 'entity' }>>;
  const errors = rows.filter((row) => row.kind === 'error') as ReadonlyArray<Extract<EntityBrowserRow, { kind: 'error' }>>;

  const sortedEntities = [...entities].sort((a, b) => a.defName.localeCompare(b.defName));
  const sortedErrors = [...errors].sort((a, b) => a.defRelativePath.localeCompare(b.defRelativePath));

  return [...sortedEntities, ...sortedErrors];
}

async function readJsonFromAssets(relativePath: string): Promise<unknown | null> {
  const bytesResult = await window.nomos.assets.readFileBytes({ relativePath });
  if (!bytesResult.ok) {
    return null;
  }

  try {
    const text = new TextDecoder('utf-8').decode(new Uint8Array(bytesResult.value));
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function toEntityRow(defRelativePath: string, display: EntityDefDisplayModel): EntityBrowserRow {
  return {
    kind: 'entity',
    defName: display.entityName,
    spriteFileName: display.spriteFileName,
    frameWidthPx: display.frameWidthPx,
    frameHeightPx: display.frameHeightPx,
    defRelativePath
  };
}

function EntityBrowserEntityRow(
  props: Readonly<{ row: Extract<EntityBrowserRow, { kind: 'entity' }>; assetIndex: AssetIndex | null }>
): JSX.Element {
  const dragCanvasRef = React.useRef<HTMLCanvasElement>(null);

  return (
    <div
      draggable={true}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'copy';
        writeEntityPlacementDragPayload(event.dataTransfer, { defName: props.row.defName });

        const dragCanvas = dragCanvasRef.current;
        if (dragCanvas !== null) {
          event.dataTransfer.setDragImage(dragCanvas, 32, 32);
        }
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: 8,
        border: `1px solid ${Colors.DARK_GRAY1}`,
        borderRadius: 3,
        backgroundColor: Colors.DARK_GRAY4
      }}
    >
      <EntitySpriteThumbnail
        assetIndex={props.assetIndex}
        spriteFileName={props.row.spriteFileName}
        frameWidthPx={props.row.frameWidthPx}
        frameHeightPx={props.row.frameHeightPx}
        sizePx={40}
        dragPreviewCanvasRef={dragCanvasRef}
        dragPreviewSizePx={64}
      />
      <canvas
        ref={dragCanvasRef}
        aria-hidden={true}
        style={{
          position: 'fixed',
          top: 0,
          left: -10000,
          width: 64,
          height: 64,
          pointerEvents: 'none'
        }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <div
          style={{
            color: Colors.WHITE,
            fontSize: 13,
            fontWeight: 600,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
        >
          {props.row.defName}
        </div>
        <div
          style={{
            color: Colors.GRAY3,
            fontSize: 11,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
        >
          {props.row.spriteFileName} ({props.row.frameWidthPx}×{props.row.frameHeightPx})
        </div>
      </div>
    </div>
  );
}

export function EntitiesDockPanel(): JSX.Element {
  const assetIndex = useNomosStore((state) => state.assetIndex);
  const assetIndexBuiltAtIso = useNomosStore((state) => state.assetIndex?.builtAtIso ?? null);
  const assetsDirPath = useNomosStore((state) => state.settings.assetsDirPath);

  const [loadState, setLoadState] = React.useState<EntitiesLoadState>({ kind: 'idle' });

  const loadIdRef = React.useRef<number>(0);

  React.useEffect(() => {
    if (assetsDirPath === null) {
      setLoadState({ kind: 'failed', message: 'No assets directory configured.' });
      return;
    }

    const loadId = loadIdRef.current + 1;
    loadIdRef.current = loadId;

    setLoadState({ kind: 'loading' });

    void (async () => {
      for (const manifestPath of MANIFEST_PATHS_TO_TRY) {
        const manifestJson = await readJsonFromAssets(manifestPath);
        if (loadIdRef.current !== loadId) {
          return;
        }
        if (manifestJson === null) {
          continue;
        }

        const manifestFiles = parseEntityManifestFiles(manifestJson);

        const rows: EntityBrowserRow[] = [];
        for (const entry of manifestFiles) {
          const defRelativePath = toDefRelativePath(manifestPath, entry);
          const defJson = await readJsonFromAssets(defRelativePath);
          if (loadIdRef.current !== loadId) {
            return;
          }

          if (defJson === null) {
            rows.push({
              kind: 'error',
              defRelativePath,
              message: `Failed to read entity def: ${defRelativePath}`
            });
            continue;
          }

          const parsed = parseEntityDefDisplayModel(defJson);
          if (!parsed.ok) {
            rows.push({
              kind: 'error',
              defRelativePath,
              message: parsed.error.message
            });
            continue;
          }

          rows.push(toEntityRow(defRelativePath, parsed.value));
        }

        setLoadState({ kind: 'loaded', rows: sortRowsStable(rows) });
        return;
      }

      setLoadState({
        kind: 'failed',
        message: `Failed to load entity manifest. Tried: ${MANIFEST_PATHS_TO_TRY.join(', ')}`
      });
    })();
  }, [assetIndexBuiltAtIso, assetsDirPath]);

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        padding: 10,
        boxSizing: 'border-box',
        overflow: 'auto'
      }}
    >
      <Card style={{ backgroundColor: Colors.DARK_GRAY3, padding: 10 }}>
        <H5 style={{ margin: 0, color: Colors.WHITE }}>Entities</H5>
        {loadState.kind === 'loading' || loadState.kind === 'idle' ? (
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, color: Colors.LIGHT_GRAY5 }}>
            <Spinner size={16} />
            <div style={{ fontSize: 12 }}>Loading entity manifest…</div>
          </div>
        ) : null}

        {loadState.kind === 'failed' ? (
          <div style={{ marginTop: 10, color: Colors.RED3, fontSize: 12 }}>{loadState.message}</div>
        ) : null}

        {loadState.kind === 'loaded' ? (
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {loadState.rows.length === 0 ? (
              <div style={{ color: Colors.LIGHT_GRAY5, fontSize: 12 }}>No entities found in manifest.</div>
            ) : null}

            {loadState.rows.map((row) => {
              if (row.kind === 'error') {
                return (
                  <div
                    key={row.defRelativePath}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                      padding: 8,
                      border: `1px solid ${Colors.DARK_GRAY1}`,
                      borderRadius: 3,
                      backgroundColor: Colors.DARK_GRAY4
                    }}
                  >
                    <div style={{ color: Colors.RED3, fontSize: 12 }}>{row.message}</div>
                    <div style={{ color: Colors.GRAY3, fontSize: 11 }}>{row.defRelativePath}</div>
                  </div>
                );
              }

              return <EntityBrowserEntityRow key={row.defRelativePath} row={row} assetIndex={assetIndex} />;
            })}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
