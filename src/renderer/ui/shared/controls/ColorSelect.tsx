import React from 'react';
import { Button, Colors, Popover, Position } from '@blueprintjs/core';

import type { HsvColor, RgbColor } from './colorUtils';
import { clampRgb, hsvToRgb, rgbToHex, rgbToHsv } from './colorUtils';

type Point = Readonly<{ x: number; y: number }>;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function hslHueColor(hueDeg: number): string {
  const h = clamp(hueDeg, 0, 360);
  return `hsl(${h}, 100%, 50%)`;
}

function getNormalizedPosition(args: Readonly<{ client: Point; rect: DOMRect }>): Readonly<{ nx: number; ny: number }> {
  const nx = clamp((args.client.x - args.rect.left) / Math.max(1, args.rect.width), 0, 1);
  const ny = clamp((args.client.y - args.rect.top) / Math.max(1, args.rect.height), 0, 1);
  return { nx, ny };
}

export function ColorSelect(props: Readonly<{
  value: RgbColor;
  onChange: (next: RgbColor) => void;
  onCommit: (next: RgbColor) => void;
  disabled?: boolean;
}>): JSX.Element {
  const [isOpen, setIsOpen] = React.useState(false);

  const hsv = React.useMemo(() => rgbToHsv(props.value), [props.value]);

  return (
    <Popover
      isOpen={isOpen}
      onInteraction={(next) => setIsOpen(next)}
      position={Position.BOTTOM_LEFT}
      disabled={Boolean(props.disabled)}
      content={
        <ColorPickerPanel
          hsv={hsv}
          onChange={props.onChange}
          onCommit={(next) => {
            props.onCommit(next);
          }}
        />
      }
    >
      <Button
        minimal={false}
        disabled={Boolean(props.disabled)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          width: '100%',
          backgroundColor: Colors.DARK_GRAY1,
          color: Colors.LIGHT_GRAY5
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              width: 18,
              height: 18,
              borderRadius: 4,
              backgroundColor: rgbToHex(props.value),
              border: `1px solid ${Colors.DARK_GRAY3}`
            }}
          />
          <span style={{ fontFamily: 'monospace' }}>{rgbToHex(props.value).toUpperCase()}</span>
        </span>
        <span style={{ opacity: 0.8 }}>Pick…</span>
      </Button>
    </Popover>
  );
}

function ColorPickerPanel(props: Readonly<{ hsv: HsvColor; onChange: (next: RgbColor) => void; onCommit: (next: RgbColor) => void }>): JSX.Element {
  const svRef = React.useRef<HTMLDivElement | null>(null);
  const hueRef = React.useRef<HTMLDivElement | null>(null);

  const [dragging, setDragging] = React.useState<null | 'sv' | 'hue'>(null);

  const setFromSvClientPoint = React.useCallback(
    (client: Point, mode: 'change' | 'commit'): void => {
      const el = svRef.current;
      if (!el) {
        return;
      }
      const rect = el.getBoundingClientRect();
      const { nx, ny } = getNormalizedPosition({ client, rect });
      const nextHsv: HsvColor = { h: props.hsv.h, s: nx, v: 1 - ny };
      const nextRgb = clampRgb(hsvToRgb(nextHsv));
      props.onChange(nextRgb);
      if (mode === 'commit') {
        props.onCommit(nextRgb);
      }
    },
    [props]
  );

  const setFromHueClientPoint = React.useCallback(
    (client: Point, mode: 'change' | 'commit'): void => {
      const el = hueRef.current;
      if (!el) {
        return;
      }
      const rect = el.getBoundingClientRect();
      const { nx } = getNormalizedPosition({ client, rect });
      const nextHue = nx * 360;
      const nextHsv: HsvColor = { h: nextHue, s: props.hsv.s, v: props.hsv.v };
      const nextRgb = clampRgb(hsvToRgb(nextHsv));
      props.onChange(nextRgb);
      if (mode === 'commit') {
        props.onCommit(nextRgb);
      }
    },
    [props]
  );

  React.useEffect(() => {
    if (dragging === null) {
      return;
    }

    const onMove = (event: MouseEvent): void => {
      if (dragging === 'sv') {
        setFromSvClientPoint({ x: event.clientX, y: event.clientY }, 'change');
      }
      if (dragging === 'hue') {
        setFromHueClientPoint({ x: event.clientX, y: event.clientY }, 'change');
      }
    };

    const onUp = (event: MouseEvent): void => {
      if (dragging === 'sv') {
        setFromSvClientPoint({ x: event.clientX, y: event.clientY }, 'commit');
      }
      if (dragging === 'hue') {
        setFromHueClientPoint({ x: event.clientX, y: event.clientY }, 'commit');
      }
      setDragging(null);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging, setFromHueClientPoint, setFromSvClientPoint]);

  const svSize = { width: 220, height: 160 };
  const hueHeight = 14;

  const svHandleX = clamp(props.hsv.s, 0, 1) * svSize.width;
  const svHandleY = (1 - clamp(props.hsv.v, 0, 1)) * svSize.height;

  const hueHandleX = (clamp(props.hsv.h, 0, 360) / 360) * 220;

  return (
    <div style={{ padding: 12, width: 250 }}>
      <div
        ref={svRef}
        onMouseDown={(event) => {
          setDragging('sv');
          setFromSvClientPoint({ x: event.clientX, y: event.clientY }, 'change');
        }}
        style={{
          position: 'relative',
          width: svSize.width,
          height: svSize.height,
          borderRadius: 6,
          backgroundColor: hslHueColor(props.hsv.h),
          border: `1px solid ${Colors.DARK_GRAY3}`,
          cursor: 'crosshair',
          userSelect: 'none'
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 6,
            background: 'linear-gradient(to right, rgba(255,255,255,1), rgba(255,255,255,0))'
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 6,
            background: 'linear-gradient(to top, rgba(0,0,0,1), rgba(0,0,0,0))'
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: svHandleX - 6,
            top: svHandleY - 6,
            width: 12,
            height: 12,
            borderRadius: 12,
            border: `2px solid ${Colors.WHITE}`,
            boxShadow: '0 0 0 1px rgba(0,0,0,0.6)'
          }}
        />
      </div>

      <div style={{ height: 10 }} />

      <div
        ref={hueRef}
        onMouseDown={(event) => {
          setDragging('hue');
          setFromHueClientPoint({ x: event.clientX, y: event.clientY }, 'change');
        }}
        style={{
          position: 'relative',
          width: 220,
          height: hueHeight,
          borderRadius: 6,
          background:
            'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
          border: `1px solid ${Colors.DARK_GRAY3}`,
          cursor: 'pointer',
          userSelect: 'none'
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: clamp(hueHandleX, 0, 220) - 6,
            top: -3,
            width: 12,
            height: hueHeight + 6,
            borderRadius: 6,
            border: `2px solid ${Colors.WHITE}`,
            boxShadow: '0 0 0 1px rgba(0,0,0,0.6)'
          }}
        />
      </div>
    </div>
  );
}
