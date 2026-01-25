import React from 'react';
import { Button, Colors, Popover, Position } from '@blueprintjs/core';

import type { AssetIndex } from '../../../../shared/domain/models';

import {
  TextureObjectUrlCache,
  createBrowserObjectUrlAdapter,
  ensureTextureObjectUrl,
  resolveTextureRelativePath
} from '../textures/textureThumbnails';

type SpecialOption = Readonly<{ value: string; label: string }>;

type Tile =
  | Readonly<{ kind: 'special'; value: string; label: string }>
  | Readonly<{ kind: 'empty'; value: ''; label: string }>
  | Readonly<{ kind: 'texture'; value: string; label: string }>
  | Readonly<{ kind: 'missing'; value: string; label: string }>;

function useIsVisible(targetRef: React.RefObject<HTMLElement>, enabled: boolean): boolean {
  const [isVisible, setIsVisible] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (!enabled) {
      setIsVisible(false);
      return;
    }

    const el = targetRef.current;
    if (el === null) {
      return;
    }

    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        setIsVisible(Boolean(first?.isIntersecting));
      },
      { root: null, rootMargin: '120px', threshold: 0.01 }
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, [enabled, targetRef]);

  return isVisible;
}

function TilePreview(props: Readonly<{
  assetIndex: AssetIndex | null;
  textureFileName: string;
  cache: TextureObjectUrlCache;
  shouldLoad: boolean;
  sizePx: number;
}>): JSX.Element {
  const objectUrls = React.useMemo(() => createBrowserObjectUrlAdapter(), []);
  const relativePath = React.useMemo(() => {
    return resolveTextureRelativePath({ assetIndex: props.assetIndex, textureFileName: props.textureFileName });
  }, [props.assetIndex, props.textureFileName]);

  const [url, setUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setUrl(null);

    if (!props.shouldLoad) {
      return;
    }

    if (relativePath === null) {
      return;
    }

    void (async () => {
      const next = await ensureTextureObjectUrl({
        cache: props.cache,
        relativePath,
        fileNameForMimeType: props.textureFileName,
        readFileBytes: window.nomos.assets.readFileBytes,
        objectUrls
      });

      if (!cancelled) {
        setUrl(next);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [objectUrls, props.cache, props.shouldLoad, props.textureFileName, relativePath]);

  if (url === null) {
    return (
      <div
        style={{
          width: props.sizePx,
          height: props.sizePx,
          backgroundColor: Colors.DARK_GRAY3,
          borderRadius: 4
        }}
      />
    );
  }

  return (
    <img
      src={url}
      alt={props.textureFileName}
      style={{
        width: props.sizePx,
        height: props.sizePx,
        objectFit: 'cover',
        backgroundColor: Colors.DARK_GRAY3,
        borderRadius: 4,
        imageRendering: 'pixelated'
      }}
      onError={() => setUrl(null)}
    />
  );
}

function TextureTileButton(props: Readonly<{
  assetIndex: AssetIndex | null;
  tile: Tile;
  isSelected: boolean;
  onSelect: () => void;
  cache: TextureObjectUrlCache;
  tileSizePx: number;
}>): JSX.Element {
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const isVisible = useIsVisible(buttonRef as unknown as React.RefObject<HTMLElement>, props.tile.kind === 'texture');

  const borderColor = props.isSelected ? Colors.BLUE4 : Colors.DARK_GRAY1;

  const baseStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: 8,
    borderRadius: 6,
    border: `1px solid ${borderColor}`,
    backgroundColor: Colors.DARK_GRAY2,
    color: Colors.LIGHT_GRAY5,
    cursor: 'pointer',
    textAlign: 'center'
  };

  return (
    <button type="button" ref={buttonRef} onClick={props.onSelect} style={baseStyle}>
      {props.tile.kind === 'texture' ? (
        <TilePreview
          assetIndex={props.assetIndex}
          textureFileName={props.tile.value}
          cache={props.cache}
          shouldLoad={isVisible}
          sizePx={props.tileSizePx}
        />
      ) : (
        <div
          style={{
            width: props.tileSizePx,
            height: props.tileSizePx,
            backgroundColor: Colors.DARK_GRAY3,
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 6,
            boxSizing: 'border-box',
            fontSize: 12,
            opacity: 0.8
          }}
        >
          {props.tile.kind === 'empty' ? '∅' : '…'}
        </div>
      )}

      <div style={{ fontSize: 12, opacity: 0.9, overflowWrap: 'anywhere' }}>{props.tile.label}</div>
    </button>
  );
}

export function TextureSelect(props: Readonly<{
  assetIndex: AssetIndex | null;
  value: string;
  textureOptions: readonly string[];
  onChange: (nextValue: string) => void;

  disabled?: boolean;

  allowEmpty?: boolean;
  emptyLabel?: string;

  specialOptions?: readonly SpecialOption[];

  includeMissingValue?: boolean;
  missingSuffix?: string;

  tileSizePx?: number;
  maxMenuHeightPx?: number;
  menuWidthPx?: number;
  emptyStateLabel?: string;
}>): JSX.Element {
  const tileSizePx = props.tileSizePx ?? 72;
  const maxMenuHeightPx = props.maxMenuHeightPx ?? 360;
  const menuWidthPx = props.menuWidthPx ?? 420;

  const allowEmpty = props.allowEmpty ?? false;
  const emptyLabel = props.emptyLabel ?? '(none)';
  const missingSuffix = props.missingSuffix ?? ' (missing)';

  const [isOpen, setIsOpen] = React.useState<boolean>(false);

  const objectUrls = React.useMemo(() => createBrowserObjectUrlAdapter(), []);
  const cache = React.useMemo(() => new TextureObjectUrlCache({ maxEntries: 96, objectUrls }), [objectUrls]);

  React.useEffect(() => {
    return () => {
      cache.clear();
    };
  }, [cache]);

  const tiles = React.useMemo((): readonly Tile[] => {
    const next: Tile[] = [];

    for (const opt of props.specialOptions ?? []) {
      next.push({ kind: 'special', value: opt.value, label: opt.label });
    }

    if (allowEmpty) {
      next.push({ kind: 'empty', value: '', label: emptyLabel });
    }

    for (const fileName of props.textureOptions) {
      next.push({ kind: 'texture', value: fileName, label: fileName });
    }

    const trimmedValue = props.value.trim();
    const selectedIsEmpty = trimmedValue.length === 0;

    const specialValues = new Set((props.specialOptions ?? []).map((opt) => opt.value));

    if (
      props.includeMissingValue === true &&
      !selectedIsEmpty &&
      !specialValues.has(props.value) &&
      !props.textureOptions.includes(props.value)
    ) {
      next.push({ kind: 'missing', value: props.value, label: `${props.value}${missingSuffix}` });
    }

    return next;
  }, [allowEmpty, emptyLabel, missingSuffix, props.includeMissingValue, props.specialOptions, props.textureOptions, props.value]);

  const selectedLabel = React.useMemo(() => {
    if (props.value.trim().length === 0) {
      return allowEmpty ? emptyLabel : '(select)';
    }

    const special = (props.specialOptions ?? []).find((opt) => opt.value === props.value);
    if (special) {
      return special.label;
    }

    if (props.textureOptions.includes(props.value)) {
      return props.value;
    }

    if (props.includeMissingValue === true) {
      return `${props.value}${missingSuffix}`;
    }

    return props.value;
  }, [allowEmpty, emptyLabel, missingSuffix, props.includeMissingValue, props.specialOptions, props.textureOptions, props.value]);

  const selectedIsTexture = props.value.trim().length > 0 && props.textureOptions.includes(props.value);

  const selectedPreview = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
      <div style={{ flex: 'none' }}>
        {selectedIsTexture ? (
          <TilePreview
            assetIndex={props.assetIndex}
            textureFileName={props.value}
            cache={cache}
            shouldLoad={isOpen}
            sizePx={18}
          />
        ) : (
          <div style={{ width: 18, height: 18, backgroundColor: Colors.DARK_GRAY3, borderRadius: 3 }} />
        )}
      </div>
      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedLabel}</div>
    </div>
  );

  const content = (
    <div style={{ width: menuWidthPx }}>
      {props.textureOptions.length === 0 ? (
        <div style={{ padding: 10, opacity: 0.8, fontSize: 12 }}>{props.emptyStateLabel ?? 'No textures indexed.'}</div>
      ) : null}

      <div
        style={{
          maxHeight: maxMenuHeightPx,
          overflow: 'auto',
          padding: 10,
          boxSizing: 'border-box'
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fill, minmax(${tileSizePx + 16}px, 1fr))`,
            gap: 8
          }}
        >
          {tiles.map((tile) => {
            const isSelected = tile.value === props.value;

            return (
              <TextureTileButton
                key={`${tile.kind}:${tile.value}`}
                assetIndex={props.assetIndex}
                tile={tile}
                isSelected={isSelected}
                cache={cache}
                tileSizePx={tileSizePx}
                onSelect={() => {
                  props.onChange(tile.value);
                  setIsOpen(false);
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <Popover
      position={Position.BOTTOM_LEFT}
      isOpen={isOpen}
      onInteraction={(nextOpen) => setIsOpen(nextOpen)}
      minimal={true}
      content={content}
      disabled={props.disabled === true}
    >
      <Button
        fill={true}
        alignText="left"
        disabled={props.disabled === true}
        style={{
          backgroundColor: Colors.DARK_GRAY1,
          color: Colors.LIGHT_GRAY5,
          justifyContent: 'space-between'
        }}
        rightIcon="caret-down"
        text={selectedPreview}
      />
    </Popover>
  );
}
