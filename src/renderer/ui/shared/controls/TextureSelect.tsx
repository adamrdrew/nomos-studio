import React from 'react';
import { Button, Colors, Popover, Position } from '@blueprintjs/core';

import type { AssetIndex } from '../../../../shared/domain/models';

import {
  TextureObjectUrlCache,
  ensureTextureObjectUrl,
  resolveTextureRelativePath,
  type ObjectUrlAdapter
} from '../textures/textureThumbnails';

type SpecialOption = Readonly<{ value: string; label: string }>;

type TextureSelectTheme = 'dark' | 'light';

function createBrowserObjectUrlAdapter(): ObjectUrlAdapter {
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
  placeholderColor: string;
  backgroundColor: string;
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
          backgroundColor: props.placeholderColor,
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
        backgroundColor: props.backgroundColor,
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
  theme: TextureSelectTheme;
}>): JSX.Element {
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const isVisible = useIsVisible(buttonRef as unknown as React.RefObject<HTMLElement>, props.tile.kind === 'texture');

  const colors =
    props.theme === 'dark'
      ? {
          tileBackground: Colors.DARK_GRAY2,
          tileText: Colors.LIGHT_GRAY5,
          tilePlaceholder: Colors.DARK_GRAY3,
          tileBorder: Colors.DARK_GRAY1,
          selectedBorder: Colors.BLUE4
        }
      : {
          tileBackground: Colors.WHITE,
          tileText: Colors.BLACK,
          tilePlaceholder: Colors.LIGHT_GRAY4,
          tileBorder: Colors.LIGHT_GRAY1,
          selectedBorder: Colors.BLUE3
        };

  const borderColor = props.isSelected ? colors.selectedBorder : colors.tileBorder;

  const baseStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: 8,
    borderRadius: 6,
    border: `1px solid ${borderColor}`,
    backgroundColor: colors.tileBackground,
    color: colors.tileText,
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
          placeholderColor={colors.tilePlaceholder}
          backgroundColor={colors.tilePlaceholder}
        />
      ) : (
        <div
          style={{
            width: props.tileSizePx,
            height: props.tileSizePx,
            backgroundColor: colors.tilePlaceholder,
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

  theme?: TextureSelectTheme;
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
  const menuWidthPx = props.menuWidthPx;

  const theme: TextureSelectTheme = props.theme ?? 'dark';
  const colors =
    theme === 'dark'
      ? {
          buttonBackground: Colors.DARK_GRAY1,
          buttonText: Colors.LIGHT_GRAY5,
          buttonBorder: Colors.DARK_GRAY1,
          menuBackground: Colors.DARK_GRAY2,
          menuText: Colors.LIGHT_GRAY5,
          placeholder: Colors.DARK_GRAY3
        }
      : {
          buttonBackground: Colors.WHITE,
          buttonText: Colors.BLACK,
          buttonBorder: Colors.LIGHT_GRAY2,
          menuBackground: Colors.WHITE,
          menuText: Colors.BLACK,
          placeholder: Colors.LIGHT_GRAY4
        };

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
            shouldLoad={true}
            sizePx={18}
            placeholderColor={colors.placeholder}
            backgroundColor={colors.placeholder}
          />
        ) : (
          <div style={{ width: 18, height: 18, backgroundColor: colors.placeholder, borderRadius: 3 }} />
        )}
      </div>
      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedLabel}</div>
    </div>
  );

  const content = (
    <div
      style={{
        width: menuWidthPx ?? '100%',
        backgroundColor: colors.menuBackground,
        color: colors.menuText
      }}
    >
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
                theme={theme}
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
    <div style={{ width: '100%' }}>
      <Popover
      position={Position.BOTTOM_LEFT}
      isOpen={isOpen}
      onInteraction={(nextOpen) => setIsOpen(nextOpen)}
      minimal={true}
      content={content}
      disabled={props.disabled === true}
      fill={true}
      matchTargetWidth={true}
      popoverClassName={theme === 'dark' ? 'bp5-dark' : undefined}
      >
        <Button
          fill={true}
          alignText="left"
          disabled={props.disabled === true}
          style={{
            width: '100%',
            backgroundColor: colors.buttonBackground,
            color: colors.buttonText,
            border: `1px solid ${colors.buttonBorder}`,
            justifyContent: 'space-between'
          }}
          rightIcon="caret-down"
          text={selectedPreview}
        />
      </Popover>
    </div>
  );
}
