import React from 'react';
import { Circle, Layer, Line, Rect, Stage } from 'react-konva';
import { Colors } from '@blueprintjs/core';
import type { KonvaEventObject } from 'konva/lib/Node';

import { useNomosStore } from '../../store/nomosStore';
import { decodeMapViewModel } from './map/mapDecoder';
import type { MapSelection } from './map/mapSelection';
import type { MapViewModel } from './map/mapViewModel';

export type MapEditorInteractionMode = 'select' | 'pan' | 'zoom';

type Size = Readonly<{ width: number; height: number }>;

type ViewTransform = Readonly<{ offsetX: number; offsetY: number; scale: number }>;

type Point = Readonly<{ x: number; y: number }>;

type Bounds = Readonly<{ minX: number; minY: number; maxX: number; maxY: number }>;

const MIN_VIEW_SCALE = 0.1;
const MAX_VIEW_SCALE = 24;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function modulo(value: number, modulus: number): number {
  if (modulus === 0) {
    return 0;
  }
  return ((value % modulus) + modulus) % modulus;
}

function distanceSquared(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function screenToWorld(screen: Point, view: ViewTransform): Point {
  return {
    x: (screen.x - view.offsetX) / view.scale,
    y: (screen.y - view.offsetY) / view.scale
  };
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function guessMimeType(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.png')) {
    return 'image/png';
  }
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
    return 'image/jpeg';
  }
  if (lower.endsWith('.webp')) {
    return 'image/webp';
  }
  return 'application/octet-stream';
}

function distancePointToSegment(worldPoint: Point, a: Point, b: Point): number {
  const abX = b.x - a.x;
  const abY = b.y - a.y;
  const apX = worldPoint.x - a.x;
  const apY = worldPoint.y - a.y;

  const abLenSquared = abX * abX + abY * abY;
  if (abLenSquared === 0) {
    return Math.sqrt(distanceSquared(worldPoint, a));
  }

  const t = clamp01((apX * abX + apY * abY) / abLenSquared);
  const closest: Point = { x: a.x + t * abX, y: a.y + t * abY };
  return Math.sqrt(distanceSquared(worldPoint, closest));
}

function pointInSector(worldPoint: Point, map: MapViewModel, sectorId: number): boolean {
  let crossings = 0;
  for (const wall of map.walls) {
    if (wall.frontSector !== sectorId) {
      continue;
    }

    const v0 = map.vertices[wall.v0];
    const v1 = map.vertices[wall.v1];
    if (!v0 || !v1) {
      continue;
    }

    const y1 = v0.y;
    const y2 = v1.y;
    const x1 = v0.x;
    const x2 = v1.x;

    const straddles = (y1 > worldPoint.y) !== (y2 > worldPoint.y);
    if (!straddles) {
      continue;
    }

    const xAtY = x1 + ((worldPoint.y - y1) * (x2 - x1)) / (y2 - y1);
    if (xAtY > worldPoint.x) {
      crossings += 1;
    }
  }
  return crossings % 2 === 1;
}

function buildSectorLoop(map: MapViewModel, sectorId: number): readonly number[] | null {
  const edges = map.walls
    .filter((wall) => wall.frontSector === sectorId)
    .map((wall) => ({ a: wall.v0, b: wall.v1 }));

  if (edges.length === 0) {
    return null;
  }

  const remaining = [...edges];
  const first = remaining.shift();
  if (!first) {
    return null;
  }

  const loop: number[] = [first.a, first.b];
  const start = loop[0];
  if (start === undefined) {
    return null;
  }
  let current = first.b;

  // Walk edges until we return to the start or run out.
  for (let steps = 0; steps < edges.length + 4; steps += 1) {
    if (current === loop[0] && loop.length > 2) {
      break;
    }

    const nextIndex = remaining.findIndex((edge) => edge.a === current || edge.b === current);
    if (nextIndex < 0) {
      break;
    }

    const next = remaining.splice(nextIndex, 1)[0];
    if (!next) {
      break;
    }

    const nextVertex = next.a === current ? next.b : next.a;
    loop.push(nextVertex);
    current = nextVertex;
  }

  if (loop.length < 4) {
    return null;
  }
  if (loop[0] !== loop[loop.length - 1]) {
    loop.push(start);
  }

  return loop;
}

function hitTestSelection(worldPoint: Point, view: ViewTransform, map: MapViewModel): MapSelection | null {
  // Priority: markers > doors > walls > sector
  const markerHitRadiusScreen = 10;
  const markerHitRadiusWorld = markerHitRadiusScreen / view.scale;

  for (const entity of map.entities) {
    const d2 = distanceSquared(worldPoint, { x: entity.x, y: entity.y });
    if (d2 <= markerHitRadiusWorld * markerHitRadiusWorld) {
      return { kind: 'entity', index: entity.index };
    }
  }

  for (const particle of map.particles) {
    const d2 = distanceSquared(worldPoint, { x: particle.x, y: particle.y });
    if (d2 <= markerHitRadiusWorld * markerHitRadiusWorld) {
      return { kind: 'particle', index: particle.index };
    }
  }

  for (const light of map.lights) {
    const d2 = distanceSquared(worldPoint, { x: light.x, y: light.y });
    if (d2 <= markerHitRadiusWorld * markerHitRadiusWorld) {
      return { kind: 'light', index: light.index };
    }
  }

  const doorHitRadiusScreen = 10;
  const doorHitRadiusWorld = doorHitRadiusScreen / view.scale;
  for (const door of map.doors) {
    const wall = map.walls[door.wallIndex];
    if (!wall) {
      continue;
    }
    const v0 = map.vertices[wall.v0];
    const v1 = map.vertices[wall.v1];
    if (!v0 || !v1) {
      continue;
    }

    const mid: Point = { x: (v0.x + v1.x) / 2, y: (v0.y + v1.y) / 2 };
    const d2 = distanceSquared(worldPoint, mid);
    if (d2 <= doorHitRadiusWorld * doorHitRadiusWorld) {
      return { kind: 'door', id: door.id };
    }
  }

  const wallHitThresholdScreen = 6;
  const wallHitThresholdWorld = wallHitThresholdScreen / view.scale;
  let bestWallIndex: number | null = null;
  let bestWallDistance = Number.POSITIVE_INFINITY;
  for (const wall of map.walls) {
    const v0 = map.vertices[wall.v0];
    const v1 = map.vertices[wall.v1];
    if (!v0 || !v1) {
      continue;
    }

    const distance = distancePointToSegment(worldPoint, v0, v1);
    if (distance <= wallHitThresholdWorld && distance < bestWallDistance) {
      bestWallDistance = distance;
      bestWallIndex = wall.index;
    }
  }
  if (bestWallIndex !== null) {
    return { kind: 'wall', index: bestWallIndex };
  }

  for (const sector of map.sectors) {
    if (pointInSector(worldPoint, map, sector.id)) {
      return { kind: 'sector', id: sector.id };
    }
  }

  return null;
}

function computeMapBounds(map: MapViewModel): Bounds | null {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  const includePoint = (point: Point): void => {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  };

  for (const vertex of map.vertices) {
    includePoint(vertex);
  }

  for (const entity of map.entities) {
    includePoint({ x: entity.x, y: entity.y });
  }

  for (const particle of map.particles) {
    includePoint({ x: particle.x, y: particle.y });
  }

  for (const light of map.lights) {
    const safeRadius = Math.max(0, light.radius);
    includePoint({ x: light.x - safeRadius, y: light.y - safeRadius });
    includePoint({ x: light.x + safeRadius, y: light.y + safeRadius });
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return null;
  }

  return { minX, minY, maxX, maxY };
}

function chooseMinorGridWorldSpacing(viewScale: number): number {
  const safeScale = Math.max(0.0001, viewScale);
  const targetMinorGridScreenSpacing = 24;
  const desiredWorldSpacing = targetMinorGridScreenSpacing / safeScale;

  const candidates = [0.5, 1, 2, 4, 8, 16, 32, 64, 128, 256];

  let best = candidates[0] ?? 8;
  let bestError = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const error = Math.abs(candidate - desiredWorldSpacing);
    if (error < bestError) {
      bestError = error;
      best = candidate;
    }
  }

  return best;
}

export function MapEditorCanvas(props: { interactionMode: MapEditorInteractionMode }): JSX.Element {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [size, setSize] = React.useState<Size>({ width: 1, height: 1 });

  const mapDocument = useNomosStore((state) => state.mapDocument);
  const mapRenderMode = useNomosStore((state) => state.mapRenderMode);
  const setMapSelection = useNomosStore((state) => state.setMapSelection);

  const mapFilePath = mapDocument?.filePath ?? null;

  const decodedMap = React.useMemo(() => {
    if (mapDocument === null) {
      return null;
    }

    return decodeMapViewModel(mapDocument.json);
  }, [mapDocument]);

  const mapOrigin = React.useMemo<Point>(() => {
    if (decodedMap === null || !decodedMap.ok) {
      return { x: 0, y: 0 };
    }

    const bounds = computeMapBounds(decodedMap.value);
    if (bounds === null) {
      return { x: 0, y: 0 };
    }

    return {
      x: (bounds.minX + bounds.maxX) / 2,
      y: (bounds.minY + bounds.maxY) / 2
    };
  }, [decodedMap]);

  const mapBounds = React.useMemo<Bounds | null>(() => {
    if (decodedMap === null || !decodedMap.ok) {
      return null;
    }
    return computeMapBounds(decodedMap.value);
  }, [decodedMap]);

  const maxCachedTextures = 64;
  const textureCacheRef = React.useRef<Map<string, Readonly<{ image: HTMLImageElement; objectUrl: string }>>>(
    new Map()
  );
  const [textureImages, setTextureImages] = React.useState<Readonly<Record<string, HTMLImageElement>>>({});

  const clearTextureCache = React.useCallback(() => {
    for (const entry of textureCacheRef.current.values()) {
      URL.revokeObjectURL(entry.objectUrl);
    }
    textureCacheRef.current.clear();
    setTextureImages({});
  }, []);

  React.useEffect(() => {
    // Clear cache when the current map changes or is closed.
    clearTextureCache();
  }, [clearTextureCache, mapFilePath]);

  React.useEffect(() => {
    return () => {
      // Safety: revoke any remaining object URLs.
      clearTextureCache();
    };
  }, [clearTextureCache]);

  React.useEffect(() => {
    if (mapRenderMode !== 'textured') {
      return;
    }
    if (decodedMap === null || !decodedMap.ok) {
      return;
    }

    const needed = new Set<string>();
    for (const sector of decodedMap.value.sectors) {
      needed.add(sector.floorTex);
    }
    for (const wall of decodedMap.value.walls) {
      needed.add(wall.tex);
    }

    let cancelled = false;

    void (async () => {
      for (const fileName of needed) {
        if (cancelled) {
          return;
        }

        if (textureCacheRef.current.has(fileName)) {
          continue;
        }

        const relativePath = `Images/Textures/${fileName}`;
        const bytesResult = await window.nomos.assets.readFileBytes({ relativePath });
        if (!bytesResult.ok) {
          continue;
        }

        const mimeType = guessMimeType(fileName);
        const bytesCopy = new Uint8Array(bytesResult.value);
        const objectUrl = URL.createObjectURL(new Blob([bytesCopy.buffer], { type: mimeType }));

        try {
          const image = await new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error(`Failed to load image: ${fileName}`));
            img.src = objectUrl;
          });

          // Evict oldest entries to keep cache bounded.
          while (textureCacheRef.current.size >= maxCachedTextures) {
            const oldestKey = textureCacheRef.current.keys().next().value as string | undefined;
            if (oldestKey === undefined) {
              break;
            }
            const evicted = textureCacheRef.current.get(oldestKey);
            textureCacheRef.current.delete(oldestKey);
            if (evicted) {
              URL.revokeObjectURL(evicted.objectUrl);
            }
          }

          textureCacheRef.current.set(fileName, { image, objectUrl });

          setTextureImages(() => {
            const next: Record<string, HTMLImageElement> = {};
            for (const [key, entry] of textureCacheRef.current) {
              next[key] = entry.image;
            }
            return next;
          });
        } catch (_error: unknown) {
          URL.revokeObjectURL(objectUrl);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [decodedMap, mapRenderMode]);

  const [view, setView] = React.useState<ViewTransform>({
    offsetX: 0,
    offsetY: 0,
    scale: 1
  });

  const lastFramedMapRef = React.useRef<string | null>(null);

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

  React.useEffect(() => {
    if (mapFilePath === null) {
      lastFramedMapRef.current = null;
      return;
    }

    if (lastFramedMapRef.current === mapFilePath) {
      return;
    }

    // Initialize framing when a map is opened.
    setView((current) => ({
      ...current,
      offsetX: size.width / 2,
      offsetY: size.height / 2
    }));

    lastFramedMapRef.current = mapFilePath;
  }, [mapFilePath, size.height, size.width]);

  React.useEffect(() => {
    if (mapFilePath === null) {
      return;
    }

    if (lastFramedMapRef.current !== mapFilePath) {
      return;
    }

    if (mapBounds === null) {
      return;
    }

    const widthWorld = Math.max(1, mapBounds.maxX - mapBounds.minX);
    const heightWorld = Math.max(1, mapBounds.maxY - mapBounds.minY);

    const paddingFactor = 0.85;
    const fitScaleX = (size.width * paddingFactor) / widthWorld;
    const fitScaleY = (size.height * paddingFactor) / heightWorld;
    const fitScale = Math.min(fitScaleX, fitScaleY);

    // Keep initial scale bounded so small maps aren't overwhelmingly zoomed in.
    const initialScale = clamp(fitScale, MIN_VIEW_SCALE, 6);

    setView((current) => ({
      ...current,
      scale: initialScale
    }));
  }, [mapBounds, mapFilePath, size.height, size.width]);

  const isPanEnabled = props.interactionMode === 'pan';
  const isZoomEnabled = props.interactionMode === 'zoom';
  const isSelectEnabled = props.interactionMode === 'select';

  const isDraggingRef = React.useRef<boolean>(false);
  const lastPointerRef = React.useRef<Readonly<{ x: number; y: number }> | null>(null);

  const onMouseDown = (event: KonvaEventObject<MouseEvent>): void => {
    if (isSelectEnabled) {
      const stage = event.target.getStage();
      const pointer = stage?.getPointerPosition();
      if (pointer == null) {
        return;
      }

      if (decodedMap?.ok) {
        const renderWorldPoint = screenToWorld({ x: pointer.x, y: pointer.y }, view);
        const authoredWorldPoint: Point = {
          x: renderWorldPoint.x + mapOrigin.x,
          y: renderWorldPoint.y + mapOrigin.y
        };
        const selection = hitTestSelection(authoredWorldPoint, view, decodedMap.value);
        setMapSelection(selection);
      } else {
        setMapSelection(null);
      }

      return;
    }

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
      const nextScale = clamp(current.scale * zoomFactor, MIN_VIEW_SCALE, MAX_VIEW_SCALE);
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

  const minorGridWorldSpacing = chooseMinorGridWorldSpacing(view.scale);
  const majorGridCellCount = 5;

  const minorGridScreenSpacing = minorGridWorldSpacing * view.scale;

  const minorStrokeWidth = 1;
  const majorStrokeWidth = 2;

  const minorStroke = Colors.GRAY5;
  const majorStroke = Colors.GRAY3;
  const backgroundFill = Colors.DARK_GRAY1;

  const wallStroke = Colors.LIGHT_GRAY3;
  const wallStrokeWidth = 2;
  const doorStroke = Colors.ORANGE4;
  const doorStrokeWidth = 2;
  const doorMarkerSizePx = 10;

  const markerStroke = Colors.WHITE;
  const markerStrokeWidthPx = 2;
  const lightMarkerRadiusPx = 6;
  const particleMarkerSizePx = 12;
  const entityMarkerSizePx = 14;

  const texturedFloorFallbackFill = Colors.DARK_GRAY3;
  const texturedWallFallbackFill = Colors.GRAY1;
  const texturedWallThickness = 10;

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

  const wallLines: JSX.Element[] = [];
  const doorMarkers: JSX.Element[] = [];
  const texturedFloors: JSX.Element[] = [];
  const texturedWalls: JSX.Element[] = [];
  const lightRadiusCircles: JSX.Element[] = [];
  const lightMarkers: JSX.Element[] = [];
  const particleMarkers: JSX.Element[] = [];
  const entityMarkers: JSX.Element[] = [];

  if (decodedMap?.ok) {
    const map = decodedMap.value;

    const toRenderX = (authoredX: number): number => authoredX - mapOrigin.x;
    const toRenderY = (authoredY: number): number => authoredY - mapOrigin.y;

    // Marker sizes are defined in screen pixels and converted to world units.
    const safeScale = Math.max(0.0001, view.scale);
    const doorMarkerSizeWorld = doorMarkerSizePx / safeScale;
    const lightMarkerRadiusWorld = lightMarkerRadiusPx / safeScale;
    const particleMarkerSizeWorld = particleMarkerSizePx / safeScale;
    const entityMarkerSizeWorld = entityMarkerSizePx / safeScale;

    if (mapRenderMode === 'textured') {
      for (const sector of map.sectors) {
        const loop = buildSectorLoop(map, sector.id);
        if (loop === null) {
          continue;
        }

        const points: number[] = [];
        for (const vertexIndex of loop) {
          const vertex = map.vertices[vertexIndex];
          if (!vertex) {
            continue;
          }
          points.push(toRenderX(vertex.x), toRenderY(vertex.y));
        }

        if (points.length < 6) {
          continue;
        }

        const image = textureImages[sector.floorTex];
        texturedFloors.push(
          <Line
            key={`floor-${sector.id}`}
            points={points}
            closed={true}
            {...(image
              ? { fillPatternImage: image, fillPatternRepeat: 'repeat' }
              : { fill: texturedFloorFallbackFill })}
            strokeEnabled={false}
          />
        );
      }

      for (const wall of map.walls) {
        const v0 = map.vertices[wall.v0];
        const v1 = map.vertices[wall.v1];
        if (!v0 || !v1) {
          continue;
        }

        const dx = v1.x - v0.x;
        const dy = v1.y - v0.y;
        const length = Math.hypot(dx, dy);
        if (length <= 0.0001) {
          continue;
        }

        const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
        const midX = toRenderX((v0.x + v1.x) / 2);
        const midY = toRenderY((v0.y + v1.y) / 2);

        const image = textureImages[wall.tex];

        texturedWalls.push(
          <Rect
            key={`wall-tex-${wall.index}`}
            x={midX}
            y={midY}
            width={length}
            height={texturedWallThickness}
            offsetX={length / 2}
            offsetY={texturedWallThickness / 2}
            rotation={angleDeg}
            {...(image
              ? { fillPatternImage: image, fillPatternRepeat: 'repeat' }
              : { fill: texturedWallFallbackFill })}
            stroke={Colors.BLACK}
            strokeWidth={1}
          />
        );
      }
    }

    if (mapRenderMode === 'wireframe') {
      for (const wall of map.walls) {
        const v0 = map.vertices[wall.v0];
        const v1 = map.vertices[wall.v1];
        if (!v0 || !v1) {
          continue;
        }

        wallLines.push(
          <Line
            key={`wall-${wall.index}`}
            points={[toRenderX(v0.x), toRenderY(v0.y), toRenderX(v1.x), toRenderY(v1.y)]}
            stroke={wallStroke}
            strokeWidth={wallStrokeWidth}
            lineCap="round"
          />
        );
      }

      for (const door of map.doors) {
        const wall = map.walls[door.wallIndex];
        if (!wall) {
          continue;
        }
        const v0 = map.vertices[wall.v0];
        const v1 = map.vertices[wall.v1];
        if (!v0 || !v1) {
          continue;
        }

        const midX = toRenderX((v0.x + v1.x) / 2);
        const midY = toRenderY((v0.y + v1.y) / 2);

        doorMarkers.push(
          <Line
            key={`door-${door.id}`}
            points={[
              midX - doorMarkerSizeWorld / 2,
              midY - doorMarkerSizeWorld / 2,
              midX + doorMarkerSizeWorld / 2,
              midY + doorMarkerSizeWorld / 2,
              midX + doorMarkerSizeWorld / 2,
              midY - doorMarkerSizeWorld / 2,
              midX - doorMarkerSizeWorld / 2,
              midY + doorMarkerSizeWorld / 2
            ]}
            stroke={doorStroke}
            strokeWidth={doorStrokeWidth}
            strokeScaleEnabled={false}
            lineCap="round"
            lineJoin="round"
          />
        );
      }
    }

    for (const light of map.lights) {
      const baseAlpha = 0.08;
      const intensityAlpha = clamp(light.intensity * 0.12, 0, 0.2);
      const radiusFillAlpha = clamp(baseAlpha + intensityAlpha, 0.05, 0.25);

      const radiusFill = `rgba(${light.color.r}, ${light.color.g}, ${light.color.b}, ${radiusFillAlpha})`;
      const radiusStroke = `rgba(${light.color.r}, ${light.color.g}, ${light.color.b}, ${clamp(radiusFillAlpha + 0.15, 0.15, 0.4)})`;

      lightRadiusCircles.push(
        <Circle
          key={`light-radius-${light.index}`}
          x={toRenderX(light.x)}
          y={toRenderY(light.y)}
          radius={Math.max(0, light.radius)}
          fill={radiusFill}
          stroke={radiusStroke}
          strokeWidth={1}
        />
      );

      lightMarkers.push(
        <Circle
          key={`light-marker-${light.index}`}
          x={toRenderX(light.x)}
          y={toRenderY(light.y)}
          radius={lightMarkerRadiusWorld}
          fill={radiusStroke}
          stroke={markerStroke}
          strokeWidth={markerStrokeWidthPx}
          strokeScaleEnabled={false}
        />
      );
    }

    for (const particle of map.particles) {
      const half = particleMarkerSizeWorld / 2;
      particleMarkers.push(
        <Rect
          key={`particle-${particle.index}`}
          x={toRenderX(particle.x) - half}
          y={toRenderY(particle.y) - half}
          width={particleMarkerSizeWorld}
          height={particleMarkerSizeWorld}
          fill={Colors.GREEN4}
          stroke={markerStroke}
          strokeWidth={markerStrokeWidthPx}
          strokeScaleEnabled={false}
        />
      );
    }

    for (const entity of map.entities) {
      const half = entityMarkerSizeWorld / 2;
      entityMarkers.push(
        <Line
          key={`entity-${entity.index}`}
          points={[
            toRenderX(entity.x),
            toRenderY(entity.y) - half,
            toRenderX(entity.x) + half,
            toRenderY(entity.y) + half,
            toRenderX(entity.x) - half,
            toRenderY(entity.y) + half
          ]}
          closed={true}
          fill={Colors.CERULEAN4}
          stroke={markerStroke}
          strokeWidth={markerStrokeWidthPx}
          strokeScaleEnabled={false}
          lineJoin="round"
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
        <Layer
          listening={false}
          x={view.offsetX}
          y={view.offsetY}
          scaleX={view.scale}
          scaleY={view.scale}
        >
          {texturedFloors}
          {texturedWalls}
          {wallLines}
          {doorMarkers}
          {lightRadiusCircles}
          {lightMarkers}
          {particleMarkers}
          {entityMarkers}
        </Layer>
      </Stage>
    </div>
  );
}
