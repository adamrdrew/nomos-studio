import React from 'react';
import { Colors } from '@blueprintjs/core';

import type { AssetIndex } from '../../../../shared/domain/models';

import { resolveSpriteAssetRelativePath } from './spriteAssetResolver';

function inferImageMimeType(fileName: string): string {
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

type LoadState =
  | Readonly<{ kind: 'idle' | 'loading' }>
  | Readonly<{ kind: 'loaded'; src: string }>
  | Readonly<{ kind: 'failed' }>;

export function EntitySpriteThumbnail(props: {
  assetIndex: AssetIndex | null;
  spriteFileName: string;
  frameWidthPx: number;
  frameHeightPx: number;
  sizePx: number;
}): JSX.Element {
  const resolvedRelativePath = React.useMemo(() => {
    return resolveSpriteAssetRelativePath({ assetIndex: props.assetIndex, spriteFileName: props.spriteFileName });
  }, [props.assetIndex, props.spriteFileName]);

  const [loadState, setLoadState] = React.useState<LoadState>({ kind: 'idle' });

  const loadIdRef = React.useRef<number>(0);
  const objectUrlRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (objectUrlRef.current !== null) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    if (resolvedRelativePath === null) {
      setLoadState({ kind: 'failed' });
      return;
    }

    const loadId = loadIdRef.current + 1;
    loadIdRef.current = loadId;
    setLoadState({ kind: 'loading' });

    void (async () => {
      const bytesResult = await window.nomos.assets.readFileBytes({ relativePath: resolvedRelativePath });
      if (loadIdRef.current !== loadId) {
        return;
      }

      if (!bytesResult.ok) {
        setLoadState({ kind: 'failed' });
        return;
      }

      const blob = new Blob([new Uint8Array(bytesResult.value)], { type: inferImageMimeType(resolvedRelativePath) });
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      setLoadState({ kind: 'loaded', src: url });
    })();

    return () => {
      if (objectUrlRef.current !== null) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [resolvedRelativePath]);

  const scale =
    props.frameWidthPx > 0 && props.frameHeightPx > 0
      ? Math.min(props.sizePx / props.frameWidthPx, props.sizePx / props.frameHeightPx)
      : 1;

  if (loadState.kind !== 'loaded') {
    return (
      <div
        style={{
          width: props.sizePx,
          height: props.sizePx,
          borderRadius: 3,
          backgroundColor: Colors.DARK_GRAY2,
          border: `1px solid ${Colors.DARK_GRAY1}`
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: props.sizePx,
        height: props.sizePx,
        borderRadius: 3,
        backgroundColor: Colors.DARK_GRAY2,
        border: `1px solid ${Colors.DARK_GRAY1}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <div
        style={{
          width: props.frameWidthPx,
          height: props.frameHeightPx,
          overflow: 'hidden',
          transform: `scale(${scale})`,
          transformOrigin: 'top left'
        }}
      >
        <img
          src={loadState.src}
          alt=""
          draggable={false}
          style={{
            display: 'block',
            imageRendering: 'pixelated'
          }}
        />
      </div>
    </div>
  );
}
