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
  | Readonly<{ kind: 'loaded'; image: HTMLImageElement }>
  | Readonly<{ kind: 'failed' }>;

export function EntitySpriteThumbnail(props: {
  assetIndex: AssetIndex | null;
  spriteFileName: string;
  frameWidthPx: number;
  frameHeightPx: number;
  sizePx: number;
  dragPreviewCanvasRef?: React.RefObject<HTMLCanvasElement>;
  dragPreviewSizePx?: number;
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

      const imageResult = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to decode image: ${resolvedRelativePath}`));
        img.src = url;
      }).catch(() => null);

      if (loadIdRef.current !== loadId) {
        return;
      }

      if (imageResult === null) {
        setLoadState({ kind: 'failed' });
        return;
      }

      setLoadState({ kind: 'loaded', image: imageResult });
    })();

    return () => {
      if (objectUrlRef.current !== null) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [resolvedRelativePath]);

  const thumbnailCanvasRef = React.useRef<HTMLCanvasElement | null>(null);

  const draw = React.useCallback(
    (args: Readonly<{
      image: HTMLImageElement;
      canvas: HTMLCanvasElement;
      sizePx: number;
      sourceRect: Readonly<{ x: number; y: number; w: number; h: number }>;
      fit: 'contain' | 'stretch';
    }>): void => {
      const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
      args.canvas.width = Math.max(1, Math.floor(args.sizePx * dpr));
      args.canvas.height = Math.max(1, Math.floor(args.sizePx * dpr));
      args.canvas.style.width = `${args.sizePx}px`;
      args.canvas.style.height = `${args.sizePx}px`;

      const ctx = args.canvas.getContext('2d');
      if (!ctx) {
        return;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, args.sizePx, args.sizePx);
      ctx.imageSmoothingEnabled = false;

      const safeW = Math.max(1, args.sourceRect.w);
      const safeH = Math.max(1, args.sourceRect.h);

      if (args.fit === 'stretch') {
        ctx.drawImage(
          args.image,
          args.sourceRect.x,
          args.sourceRect.y,
          safeW,
          safeH,
          0,
          0,
          args.sizePx,
          args.sizePx
        );
        return;
      }

      const scale = Math.min(args.sizePx / safeW, args.sizePx / safeH);
      const destW = safeW * scale;
      const destH = safeH * scale;
      const destX = (args.sizePx - destW) / 2;
      const destY = (args.sizePx - destH) / 2;

      ctx.drawImage(
        args.image,
        args.sourceRect.x,
        args.sourceRect.y,
        safeW,
        safeH,
        destX,
        destY,
        destW,
        destH
      );
    },
    []
  );

  React.useEffect(() => {
    if (loadState.kind !== 'loaded') {
      return;
    }

    const canvas = thumbnailCanvasRef.current;
    if (canvas === null) {
      return;
    }

    const frameW = Math.max(1, Math.floor(props.frameWidthPx || 1));
    const frameH = Math.max(1, Math.floor(props.frameHeightPx || 1));

    draw({
      image: loadState.image,
      canvas,
      sizePx: props.sizePx,
      sourceRect: { x: 0, y: 0, w: frameW, h: frameH },
      fit: 'contain'
    });

    const dragCanvas = props.dragPreviewCanvasRef?.current ?? null;
    const dragSize = props.dragPreviewSizePx ?? null;
    if (dragCanvas !== null && dragSize !== null) {
      const crop = 64;
      const sx = Math.max(0, loadState.image.width - crop);
      const sy = 0;
      const sw = Math.min(crop, loadState.image.width);
      const sh = Math.min(crop, loadState.image.height);

      draw({
        image: loadState.image,
        canvas: dragCanvas,
        sizePx: dragSize,
        sourceRect: { x: sx, y: sy, w: sw, h: sh },
        fit: 'stretch'
      });
    }
  }, [draw, loadState, props.dragPreviewCanvasRef, props.dragPreviewSizePx, props.frameHeightPx, props.frameWidthPx, props.sizePx]);

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
      <canvas
        ref={thumbnailCanvasRef}
        draggable={false}
        style={{
          display: 'block',
          width: props.sizePx,
          height: props.sizePx,
          imageRendering: 'pixelated'
        }}
      />
    </div>
  );
}
