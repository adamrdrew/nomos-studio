import React from 'react';
import { Layer, Line, Rect, Stage } from 'react-konva';
import { Colors } from '@blueprintjs/core';
import type { KonvaEventObject } from 'konva/lib/Node';

export type MapEditorInteractionMode = 'select' | 'pan' | 'zoom';

type Size = Readonly<{ width: number; height: number }>;

type ViewTransform = Readonly<{ offsetX: number; offsetY: number; scale: number }>;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function modulo(value: number, modulus: number): number {
  if (modulus === 0) {
    return 0;
  }
  return ((value % modulus) + modulus) % modulus;
}

export function MapEditorCanvas(props: { interactionMode: MapEditorInteractionMode }): JSX.Element {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [size, setSize] = React.useState<Size>({ width: 1, height: 1 });

  const [view, setView] = React.useState<ViewTransform>({
    offsetX: 0,
    offsetY: 0,
    scale: 1
  });

  React.useEffect(() => {
    const container = containerRef.current;
    if (container === null) {
      return;
    }

    const update = (): void => {
      const rect = container.getBoundingClientRect();
      setSize({ width: Math.max(1, Math.floor(rect.width)), height: Math.max(1, Math.floor(rect.height)) });
    };

    update();

    const observer = new ResizeObserver(() => {
      update();
    });

    observer.observe(container);
    return () => {
      observer.disconnect();
    };
  }, []);

  const isPanEnabled = props.interactionMode === 'pan';
  const isZoomEnabled = props.interactionMode === 'zoom';

  const isDraggingRef = React.useRef<boolean>(false);
  const lastPointerRef = React.useRef<Readonly<{ x: number; y: number }> | null>(null);

  const onMouseDown = (event: KonvaEventObject<MouseEvent>): void => {
    if (!isPanEnabled) {
      return;
    }

    const stage = event.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (pointer == null) {
      return;
    }

    isDraggingRef.current = true;
    lastPointerRef.current = { x: pointer.x, y: pointer.y };
  };

  const onMouseUp = (): void => {
    isDraggingRef.current = false;
    lastPointerRef.current = null;
  };

  const onMouseMove = (event: KonvaEventObject<MouseEvent>): void => {
    if (!isPanEnabled || !isDraggingRef.current) {
      return;
    }

    const stage = event.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (pointer == null) {
      return;
    }

    const lastPointer = lastPointerRef.current;
    if (lastPointer === null) {
      lastPointerRef.current = { x: pointer.x, y: pointer.y };
      return;
    }

    const deltaX = pointer.x - lastPointer.x;
    const deltaY = pointer.y - lastPointer.y;

    lastPointerRef.current = { x: pointer.x, y: pointer.y };

    if (deltaX === 0 && deltaY === 0) {
      return;
    }

    setView((current) => ({
      ...current,
      offsetX: current.offsetX + deltaX,
      offsetY: current.offsetY + deltaY
    }));
  };

  const onWheel = (event: KonvaEventObject<WheelEvent>): void => {
    if (!isZoomEnabled) {
      return;
    }

    event.evt.preventDefault();

    const stage = event.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (pointer == null) {
      return;
    }

    const zoomFactor = Math.exp(-event.evt.deltaY * 0.001);

    setView((current) => {
      const nextScale = clamp(current.scale * zoomFactor, 0.25, 6);
      if (nextScale === current.scale) {
        return current;
      }

      const worldX = (pointer.x - current.offsetX) / current.scale;
      const worldY = (pointer.y - current.offsetY) / current.scale;

      const nextOffsetX = pointer.x - worldX * nextScale;
      const nextOffsetY = pointer.y - worldY * nextScale;

      return {
        offsetX: nextOffsetX,
        offsetY: nextOffsetY,
        scale: nextScale
      };
    });
  };

  const minorGridWorldSpacing = 32;
  const majorGridCellCount = 5;

  const minorGridScreenSpacing = minorGridWorldSpacing * view.scale;

  const minorStrokeWidth = 1;
  const majorStrokeWidth = 2;

  const minorStroke = Colors.GRAY5;
  const majorStroke = Colors.GRAY3;
  const backgroundFill = Colors.DARK_GRAY1;

  const verticalLines: JSX.Element[] = [];
  const horizontalLines: JSX.Element[] = [];

  if (minorGridScreenSpacing >= 6) {
    const startX = modulo(view.offsetX, minorGridScreenSpacing);
    for (let screenX = startX; screenX <= size.width; screenX += minorGridScreenSpacing) {
      const worldColumn = Math.round((screenX - view.offsetX) / minorGridScreenSpacing);
      const isMajor = worldColumn % majorGridCellCount === 0;
      verticalLines.push(
        <Line
          key={`v-${screenX}`}
          points={[screenX, 0, screenX, size.height]}
          stroke={isMajor ? majorStroke : minorStroke}
          strokeWidth={isMajor ? majorStrokeWidth : minorStrokeWidth}
        />
      );
    }

    const startY = modulo(view.offsetY, minorGridScreenSpacing);
    for (let screenY = startY; screenY <= size.height; screenY += minorGridScreenSpacing) {
      const worldRow = Math.round((screenY - view.offsetY) / minorGridScreenSpacing);
      const isMajor = worldRow % majorGridCellCount === 0;
      horizontalLines.push(
        <Line
          key={`h-${screenY}`}
          points={[0, screenY, size.width, screenY]}
          stroke={isMajor ? majorStroke : minorStroke}
          strokeWidth={isMajor ? majorStrokeWidth : minorStrokeWidth}
        />
      );
    }
  }

  return (
    <div ref={containerRef} style={{ height: '100%', width: '100%' }}>
      <Stage
        width={size.width}
        height={size.height}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onMouseMove={onMouseMove}
        onWheel={onWheel}
      >
        <Layer listening={false}>
          <Rect x={0} y={0} width={size.width} height={size.height} fill={backgroundFill} />
        </Layer>
        <Layer listening={false}>
          {verticalLines}
          {horizontalLines}
        </Layer>
      </Stage>
    </div>
  );
}
