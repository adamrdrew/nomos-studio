import React from 'react';
import { Circle, Layer, Line, Rect, Shape, Stage } from 'react-konva';
import { Colors } from '@blueprintjs/core';
import type { Context } from 'konva/lib/Context';
import type { KonvaEventObject } from 'konva/lib/Node';

import { useNomosStore } from '../../store/nomosStore';
import { decodeMapViewModel } from './map/mapDecoder';
import { pickMapSelection } from './map/mapPicking';
import { buildSectorLoop, isWorldPointInsideSectorLoop } from './map/sectorContainment';
import { computeTexturedWallStripPolygons } from './map/wallStripGeometry';
import type { MapSelection } from './map/mapSelection';
import type { MapViewModel } from './map/mapViewModel';
import type { WallStripPolygon } from './map/wallStripGeometry';
import { ROOM_CREATION_DEFAULTS } from '../../../shared/domain/mapRoomCreation';
import type { CreateRoomRequest, RoomTemplate } from '../../../shared/domain/mapRoomCreation';
import { computeRoomPlacementValidity, computeRoomPolygon } from '../../../shared/domain/mapRoomGeometry';
import type { RoomMapGeometry, RoomPlacementValidity, Vec2 } from '../../../shared/domain/mapRoomGeometry';
import { tryReadEntityPlacementDragPayload } from './entities/entityPlacementDragPayload';

export type MapEditorInteractionMode = 'select' | 'move' | 'door' | 'room' | 'pan' | 'zoom';

export type MapEditorViewportApi = Readonly<{
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
  centerOnOrigin: () => void;
}>;

type Size = Readonly<{ width: number; height: number }>;

type ViewTransform = Readonly<{ offsetX: number; offsetY: number; scale: number }>;

type Point = Readonly<{ x: number; y: number }>;

type Bounds = Readonly<{ minX: number; minY: number; maxX: number; maxY: number }>;

type PlayerStart = Readonly<{ x: number; y: number; angleDeg: number }>;

const MIN_VIEW_SCALE = 0.1;
const MAX_VIEW_SCALE = 64;

// World-space size of one repeated texture tile.
// Tuned so even small rooms show multiple repeats.
const TEXTURE_TILE_WORLD_UNITS = 4;

// Textured wall strip thickness is defined in world units so it scales proportionally with zoom.
// Derive from the texture tile world size to keep wall-to-texture proportions stable.
const TEXTURED_WALL_THICKNESS_WORLD = TEXTURE_TILE_WORLD_UNITS * 0.1;

function toRoomMapGeometry(map: MapViewModel): RoomMapGeometry {
  return {
    vertices: map.vertices,
    sectorIds: map.sectors.map((sector) => sector.id),
    walls: map.walls.map((wall) => ({
      index: wall.index,
      v0: wall.v0,
      v1: wall.v1,
      frontSectorId: wall.frontSector,
      backSectorId: wall.backSector
    }))
  };
}

function pickDefaultRoomTextures(assetIndex: Readonly<{ entries: readonly string[] }> | null):
  | Readonly<{ wallTex: string; floorTex: string; ceilTex: string }>
  | null {
  if (assetIndex === null) {
    return null;
  }

  const prefixes = ['Images/Textures/', 'Assets/Images/Textures/'] as const;

  let matches: string[] = [];
  for (const prefix of prefixes) {
    const candidate = assetIndex.entries
      .filter((entry) => entry.startsWith(prefix))
      .map((entry) => entry.slice(prefix.length))
      .filter((fileName) => fileName.trim().length > 0);

    if (candidate.length > 0) {
      matches = candidate;
      break;
    }
  }

  matches.sort((a, b) => a.localeCompare(b));

  const wallTex = matches[0] ?? null;
  const floorTex = matches[1] ?? null;
  const ceilTex = matches[2] ?? null;

  if (wallTex === null || floorTex === null || ceilTex === null) {
    return null;
  }

  return { wallTex, floorTex, ceilTex };
}

function getDefaultRoomSizeForTemplate(template: RoomTemplate): Readonly<{ width: number; height: number }> {
  if (template === 'square') {
    return { width: 6, height: 6 };
  }
  if (template === 'rectangle') {
    // Default hall: long and thin.
    return { width: 16, height: 4 };
  }
  // triangle
  return { width: 8, height: 6 };
}

function canPlaceDoorAtWallIndex(map: MapViewModel, wallIndex: number): boolean {
  const wall = map.walls[wallIndex];
  if (!wall) {
    return false;
  }
  if (wall.backSector <= -1) {
    return false;
  }
  return !map.doors.some((door) => door.wallIndex === wallIndex);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function areSelectionsEqual(a: MapSelection | null, b: MapSelection | null): boolean {
  if (a === null || b === null) {
    return a === b;
  }
  if (a.kind !== b.kind) {
    return false;
  }
  if (a.kind === 'door' && b.kind === 'door') {
    return a.id === b.id;
  }
  if (a.kind === 'sector' && b.kind === 'sector') {
    return a.id === b.id;
  }
  if (a.kind === 'wall' && b.kind === 'wall') {
    return a.index === b.index;
  }
  if (a.kind === 'entity' && b.kind === 'entity') {
    return a.index === b.index;
  }
  if (a.kind === 'light' && b.kind === 'light') {
    return a.index === b.index;
  }
  if (a.kind === 'particle' && b.kind === 'particle') {
    return a.index === b.index;
  }
  return false;
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

function buildRepeatPattern(native: CanvasRenderingContext2D, image: HTMLImageElement): CanvasPattern | null {
  const pattern = native.createPattern(image, 'repeat');
  if (pattern === null) {
    return null;
  }

  const safeWidth = Math.max(1, image.width);
  const safeHeight = Math.max(1, image.height);

  // By default, a CanvasPattern is in the same units as the canvas coordinate space (our world space).
  // Use a pattern transform so one image tile maps to a chosen world size, forcing repeats.
  const scaleX = TEXTURE_TILE_WORLD_UNITS / safeWidth;
  const scaleY = TEXTURE_TILE_WORLD_UNITS / safeHeight;

  const maybeSetTransform = (pattern as unknown as { setTransform?: (transform: DOMMatrix2DInit) => void }).setTransform;
  if (typeof maybeSetTransform === 'function') {
    maybeSetTransform.call(pattern, new DOMMatrix([scaleX, 0, 0, scaleY, 0, 0]));
  }

  return pattern;
}

function getNative2dContext(context: Context): CanvasRenderingContext2D | null {
  const native = (context as unknown as { _context?: CanvasRenderingContext2D })._context;
  return native ?? null;
}

function hexToRgba(hexColor: string, alpha: number): string {
  const normalized = hexColor.trim();
  if (!normalized.startsWith('#') || normalized.length !== 7) {
    return `rgba(0, 0, 0, ${clamp01(alpha)})`;
  }

  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);

  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return `rgba(0, 0, 0, ${clamp01(alpha)})`;
  }

  return `rgba(${r}, ${g}, ${b}, ${clamp01(alpha)})`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readPlayerStartFromJson(json: unknown): PlayerStart | null {
  if (!isRecord(json)) {
    return null;
  }

  const playerStart = json['player_start'];
  if (!isRecord(playerStart)) {
    return null;
  }

  const x = playerStart['x'];
  const y = playerStart['y'];
  const angleDeg = playerStart['angle_deg'];

  if (typeof x !== 'number' || typeof y !== 'number' || typeof angleDeg !== 'number') {
    return null;
  }
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(angleDeg)) {
    return null;
  }

  return { x, y, angleDeg };
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

export const MapEditorCanvas = React.forwardRef<
  MapEditorViewportApi,
  {
    interactionMode: MapEditorInteractionMode;
    roomTemplate?: RoomTemplate;
  }
>(
  function MapEditorCanvas(props, ref): JSX.Element {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const stageRef = React.useRef<
    Readonly<{ getPointerPosition: () => Readonly<{ x: number; y: number }> | null }> | null
  >(null);

  type EntityDropCursorState = 'none' | 'valid' | 'invalid';
  const [entityDropCursorState, setEntityDropCursorState] = React.useState<EntityDropCursorState>('none');
  const entityDropCursorStateRef = React.useRef<EntityDropCursorState>('none');

  const setEntityDropCursorStateIfChanged = React.useCallback((next: EntityDropCursorState) => {
    if (entityDropCursorStateRef.current === next) {
      return;
    }
    entityDropCursorStateRef.current = next;
    setEntityDropCursorState(next);
  }, []);

  const [size, setSize] = React.useState<Size>({ width: 1, height: 1 });

  const mapDocument = useNomosStore((state) => state.mapDocument);
  const mapRenderMode = useNomosStore((state) => state.mapRenderMode);
  const mapSectorSurface = useNomosStore((state) => state.mapSectorSurface);
  const mapGridSettings = useNomosStore((state) => state.mapGridSettings);
  const mapHighlightPortals = useNomosStore((state) => state.mapHighlightPortals);
  const mapHighlightToggleWalls = useNomosStore((state) => state.mapHighlightToggleWalls);
  const mapDoorVisibility = useNomosStore((state) => state.mapDoorVisibility);
  const mapSelection = useNomosStore((state) => state.mapSelection);
  const assetIndex = useNomosStore((state) => state.assetIndex);
  const isPickingPlayerStart = useNomosStore((state) => state.isPickingPlayerStart);
  const setIsPickingPlayerStart = useNomosStore((state) => state.setIsPickingPlayerStart);
  const setMapSelection = useNomosStore((state) => state.setMapSelection);
  const applyMapSelectionEffect = useNomosStore((state) => state.applyMapSelectionEffect);

  const [hoveredSelection, setHoveredSelection] = React.useState<MapSelection | null>(null);

  const mapFilePath = mapDocument?.filePath ?? null;

  const decodedMap = React.useMemo(() => {
    if (mapDocument === null) {
      return null;
    }

    return decodeMapViewModel(mapDocument.json);
  }, [mapDocument]);

  const texturedWallPolygons = React.useMemo<readonly WallStripPolygon[] | null>(() => {
    if (mapRenderMode !== 'textured') {
      return null;
    }
    if (decodedMap === null || !decodedMap.ok) {
      return null;
    }
    return computeTexturedWallStripPolygons(decodedMap.value, TEXTURED_WALL_THICKNESS_WORLD);
  }, [decodedMap, mapRenderMode]);

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

  const findSectorIdAtWorldPoint = React.useCallback((worldPoint: Point, map: MapViewModel): number | null => {
    for (const sector of map.sectors) {
      if (isWorldPointInsideSectorLoop(worldPoint, map, sector.id)) {
        return sector.id;
      }
    }
    return null;
  }, []);

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

    type NeededTexture = Readonly<{ cacheKey: string; fileName: string; relativePath: string }>;

    const needed: NeededTexture[] = [];
    const addTexture = (fileName: string): void => {
      const trimmed = fileName.trim();
      if (trimmed.length === 0) {
        return;
      }
      needed.push({ cacheKey: trimmed, fileName: trimmed, relativePath: `Images/Textures/${trimmed}` });
    };
    const addSkyTexture = (fileName: string): void => {
      const trimmed = fileName.trim();
      if (trimmed.length === 0) {
        return;
      }
      const relativePath = `Images/Sky/${trimmed}`;
      needed.push({ cacheKey: relativePath, fileName: trimmed, relativePath });
    };

    if (mapSectorSurface === 'floor') {
      for (const sector of decodedMap.value.sectors) {
        addTexture(sector.floorTex);
      }
    } else {
      let needsSky = false;
      for (const sector of decodedMap.value.sectors) {
        if (sector.ceilTex.trim().toLowerCase() === 'sky') {
          needsSky = true;
          continue;
        }
        addTexture(sector.ceilTex);
      }

      if (needsSky && decodedMap.value.sky !== null) {
        addSkyTexture(decodedMap.value.sky);
      }
    }

    for (const wall of decodedMap.value.walls) {
      addTexture(wall.tex);
    }

    const uniqueNeededByKey = new Map<string, NeededTexture>();
    for (const entry of needed) {
      uniqueNeededByKey.set(entry.cacheKey, entry);
    }

    let cancelled = false;

    void (async () => {
      for (const entry of uniqueNeededByKey.values()) {
        if (cancelled) {
          return;
        }

        if (textureCacheRef.current.has(entry.cacheKey)) {
          continue;
        }

        const bytesResult = await window.nomos.assets.readFileBytes({ relativePath: entry.relativePath });
        if (!bytesResult.ok) {
          continue;
        }

        const mimeType = guessMimeType(entry.fileName);
        const bytesCopy = new Uint8Array(bytesResult.value);
        const objectUrl = URL.createObjectURL(new Blob([bytesCopy.buffer], { type: mimeType }));

        try {
          const image = await new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error(`Failed to load image: ${entry.fileName}`));
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

          textureCacheRef.current.set(entry.cacheKey, { image, objectUrl });

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
  }, [decodedMap, mapRenderMode, mapSectorSurface]);

  const [view, setView] = React.useState<ViewTransform>({
    offsetX: 0,
    offsetY: 0,
    scale: 1
  });

  const tryComputeAuthoredWorldPointFromClient = React.useCallback(
    (clientPoint: Readonly<{ x: number; y: number }>): Point | null => {
      const container = containerRef.current;
      if (container === null) {
        return null;
      }

      const rect = container.getBoundingClientRect();
      const screenPoint: Point = {
        x: clientPoint.x - rect.left,
        y: clientPoint.y - rect.top
      };

      const renderWorldPoint = screenToWorld(screenPoint, view);
      return {
        x: renderWorldPoint.x + mapOrigin.x,
        y: renderWorldPoint.y + mapOrigin.y
      };
    },
    [mapOrigin.x, mapOrigin.y, view]
  );

  const zoomStepFactor = 1.2;

  const getBestZoomFocusPoint = React.useCallback((): Readonly<{ x: number; y: number }> => {
    const pointer = stageRef.current?.getPointerPosition() ?? null;
    if (pointer !== null) {
      return { x: pointer.x, y: pointer.y };
    }

    return { x: size.width / 2, y: size.height / 2 };
  }, [size.height, size.width]);

  const zoomAroundScreenPoint = React.useCallback(
    (screenPoint: Readonly<{ x: number; y: number }>, scaleFactor: number): void => {
      setView((current) => {
        const nextScale = clamp(current.scale * scaleFactor, MIN_VIEW_SCALE, MAX_VIEW_SCALE);
        if (nextScale === current.scale) {
          return current;
        }

        const worldX = (screenPoint.x - current.offsetX) / current.scale;
        const worldY = (screenPoint.y - current.offsetY) / current.scale;

        const nextOffsetX = screenPoint.x - worldX * nextScale;
        const nextOffsetY = screenPoint.y - worldY * nextScale;

        return {
          offsetX: nextOffsetX,
          offsetY: nextOffsetY,
          scale: nextScale
        };
      });
    },
    []
  );

  const computeInitialScale = React.useCallback((): number => {
    if (mapBounds === null) {
      return clamp(1, MIN_VIEW_SCALE, 6);
    }

    const widthWorld = Math.max(1, mapBounds.maxX - mapBounds.minX);
    const heightWorld = Math.max(1, mapBounds.maxY - mapBounds.minY);

    const paddingFactor = 0.85;
    const fitScaleX = (size.width * paddingFactor) / widthWorld;
    const fitScaleY = (size.height * paddingFactor) / heightWorld;
    const fitScale = Math.min(fitScaleX, fitScaleY);

    return clamp(fitScale, MIN_VIEW_SCALE, 6);
  }, [mapBounds, size.height, size.width]);

  React.useImperativeHandle(
    ref,
    () => ({
      zoomIn: () => {
        zoomAroundScreenPoint(getBestZoomFocusPoint(), zoomStepFactor);
      },
      zoomOut: () => {
        zoomAroundScreenPoint(getBestZoomFocusPoint(), 1 / zoomStepFactor);
      },
      resetView: () => {
        const initialScale = computeInitialScale();
        setView({ offsetX: size.width / 2, offsetY: size.height / 2, scale: initialScale });
      },
      centerOnOrigin: () => {
        setView((current) => ({ ...current, offsetX: size.width / 2, offsetY: size.height / 2 }));
      }
    }),
    [computeInitialScale, getBestZoomFocusPoint, size.height, size.width, zoomAroundScreenPoint]
  );

  const lastFramedMapRef = React.useRef<string | null>(null);
  const lastInitialScaleMapRef = React.useRef<string | null>(null);

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
      lastInitialScaleMapRef.current = null;
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
    lastInitialScaleMapRef.current = null;
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

    // Apply the initial fit-to-map scale once per opened map.
    // Tool switching can change layout height and trigger a resize; we should not reset user zoom.
    if (lastInitialScaleMapRef.current === mapFilePath) {
      return;
    }

    // Wait for real layout size; the initial state is { width: 1, height: 1 }.
    if (size.width <= 1 || size.height <= 1) {
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

    lastInitialScaleMapRef.current = mapFilePath;
  }, [mapBounds, mapFilePath, size.height, size.width]);

  const isPanEnabled = props.interactionMode === 'pan';
  const isZoomEnabled = props.interactionMode === 'zoom';
  const isSelectEnabled = props.interactionMode === 'select';
  const isMoveEnabled = props.interactionMode === 'move';
  const isDoorEnabled = props.interactionMode === 'door';
  const isRoomEnabled = props.interactionMode === 'room';

  React.useEffect(() => {
    if (!isSelectEnabled && !isDoorEnabled) {
      setHoveredSelection(null);
    }
  }, [isDoorEnabled, isSelectEnabled]);

  React.useEffect(() => {
    if (isDoorEnabled || isRoomEnabled) {
      return;
    }
    if (containerRef.current !== null) {
      containerRef.current.style.cursor = '';
    }
  }, [isDoorEnabled, isRoomEnabled]);

  const [roomCenter, setRoomCenter] = React.useState<Point | null>(null);
  React.useEffect(() => {
    if (!isRoomEnabled) {
      setRoomCenter(null);
      return;
    }
  }, [isRoomEnabled]);

  const [roomSize, setRoomSize] = React.useState<Readonly<{ width: number; height: number }>>({ width: 6, height: 6 });
  const [roomRotationQuarterTurns, setRoomRotationQuarterTurns] = React.useState<0 | 1 | 2 | 3>(0);

  React.useEffect(() => {
    if (isPickingPlayerStart) {
      if (containerRef.current !== null) {
        containerRef.current.style.cursor = 'crosshair';
      }
      return;
    }

    if (!isRoomEnabled) {
      return;
    }

    const template = props.roomTemplate;
    if (template === undefined) {
      return;
    }

    setRoomSize(getDefaultRoomSizeForTemplate(template));
    setRoomRotationQuarterTurns(0);
  }, [isPickingPlayerStart, isRoomEnabled, props.roomTemplate]);

  React.useEffect(() => {
    if (!isRoomEnabled) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      // Avoid stealing arrows while typing in UI controls.
      const target = event.target as HTMLElement | null;
      if (target !== null) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) {
          return;
        }
      }

      const isMac = navigator.platform.toLowerCase().includes('mac');
      const isPrimary = isMac ? event.metaKey : event.ctrlKey;
      if (!isPrimary) {
        return;
      }

      const template = props.roomTemplate;
      if (template === undefined) {
        return;
      }

      const isRotate = !event.altKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight');
      const isScale = event.altKey &&
        (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'ArrowUp' || event.key === 'ArrowDown');

      if (!isRotate && !isScale) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (isRotate) {
        const delta = event.key === 'ArrowRight' ? 1 : -1;
        setRoomRotationQuarterTurns((current) => {
          const next = ((current + delta) % 4 + 4) % 4;
          return next as 0 | 1 | 2 | 3;
        });
        return;
      }

      // Scale along the view axes (screen X/Y). Since the view has no rotation, these map to world X/Y.
      // The room template applies rotation after sizing, so when the room is rotated 90°/270° we swap
      // which size dimension affects the view-axis extents.
      const delta = event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -ROOM_CREATION_DEFAULTS.scaleStep : ROOM_CREATION_DEFAULTS.scaleStep;
      const axis: 'horizontal' | 'vertical' = event.key === 'ArrowLeft' || event.key === 'ArrowRight' ? 'horizontal' : 'vertical';

      setRoomSize((current) => {
        const isOddRotation = roomRotationQuarterTurns % 2 === 1;

        let width = current.width;
        let height = current.height;

        if (template === 'square') {
          const next = Math.max(ROOM_CREATION_DEFAULTS.minSizeWorld, width + delta);
          return { width: next, height: next };
        }

        const affectsWidth = (axis === 'horizontal' && !isOddRotation) || (axis === 'vertical' && isOddRotation);
        if (affectsWidth) {
          width = Math.max(ROOM_CREATION_DEFAULTS.minSizeWorld, width + delta);
        } else {
          height = Math.max(ROOM_CREATION_DEFAULTS.minSizeWorld, height + delta);
        }

        return { width, height };
      });
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isRoomEnabled, props.roomTemplate, roomRotationQuarterTurns]);

  const roomPreview = React.useMemo<
    | Readonly<{
        polygon: readonly Vec2[];
        validity: RoomPlacementValidity;
        request: CreateRoomRequest | null;
      }>
    | null
  >(() => {
    if (!isRoomEnabled) {
      return null;
    }
    if (roomCenter === null) {
      return null;
    }
    if (decodedMap === null || !decodedMap.ok) {
      return null;
    }
    if (props.roomTemplate === undefined) {
      return null;
    }

    const template = props.roomTemplate;
    const size =
      template === 'square'
        ? { width: roomSize.width, height: roomSize.width }
        : { width: roomSize.width, height: roomSize.height };


    const polygon = computeRoomPolygon({
      template,
      center: roomCenter,
      size,
      rotationQuarterTurns: roomRotationQuarterTurns
    });

    const geometry = toRoomMapGeometry(decodedMap.value);

    const validity = computeRoomPlacementValidity({
      geometry,
      polygon,
      viewScale: view.scale,
      snapThresholdPx: ROOM_CREATION_DEFAULTS.snapThresholdPx,
      minSizeWorld: ROOM_CREATION_DEFAULTS.minSizeWorld
    });


    const textures = pickDefaultRoomTextures(assetIndex);
    if (textures === null) {
      return {
        polygon,
        validity: { ok: false, kind: 'room-invalid', reason: 'ambiguous' },
        request: null
      };
    }

    if (!validity.ok) {
      return { polygon, validity, request: null };
    }

    const placement =
      validity.kind === 'room-valid/seed'
        ? ({ kind: 'room-placement/seed' } as const)
        : validity.kind === 'room-valid/nested'
          ? ({ kind: 'room-placement/nested', enclosingSectorId: validity.enclosingSectorId } as const)
          : ({ kind: 'room-placement/adjacent', targetWallIndex: validity.targetWallIndex, snapDistancePx: validity.snapDistancePx } as const);

    const request: CreateRoomRequest = {
      template,
      center: roomCenter,
      size,
      rotationQuarterTurns: roomRotationQuarterTurns,
      defaults: {
        wallTex: textures.wallTex,
        floorTex: textures.floorTex,
        ceilTex: textures.ceilTex,
        floorZ: 0,
        ceilZ: 4,
        light: 1
      },
      placement
    };

    return { polygon, validity, request };
  }, [assetIndex, decodedMap, isRoomEnabled, props.roomTemplate, roomCenter, roomRotationQuarterTurns, roomSize.height, roomSize.width, view.scale]);

  React.useEffect(() => {
    if (!isRoomEnabled) {
      return;
    }

    const canCreate = roomPreview !== null && roomPreview.validity.ok && roomPreview.request !== null;
    if (containerRef.current !== null) {
      containerRef.current.style.cursor = canCreate ? 'crosshair' : 'not-allowed';
    }
  }, [isPickingPlayerStart, isRoomEnabled, roomPreview]);

  const isDraggingRef = React.useRef<boolean>(false);
  const lastPointerRef = React.useRef<Readonly<{ x: number; y: number }> | null>(null);

  const [movePreview, setMovePreview] = React.useState<Readonly<{ kind: 'entity' | 'light'; index: number; x: number; y: number }> | null>(null);
  const movePreviewRef = React.useRef<Readonly<{ kind: 'entity' | 'light'; index: number; x: number; y: number }> | null>(null);
  React.useEffect(() => {
    movePreviewRef.current = movePreview;
  }, [movePreview]);

  const isMoveDraggingRef = React.useRef<boolean>(false);
  const moveDragOffsetRef = React.useRef<Point | null>(null);

  React.useEffect(() => {
    if (!isMoveEnabled) {
      isMoveDraggingRef.current = false;
      moveDragOffsetRef.current = null;
      setMovePreview(null);
    }
  }, [isMoveEnabled]);

  React.useEffect(() => {
    if (mapSelection?.kind !== 'entity' && mapSelection?.kind !== 'light') {
      isMoveDraggingRef.current = false;
      moveDragOffsetRef.current = null;
      setMovePreview(null);
      return;
    }

    if (movePreview !== null && (movePreview.kind !== mapSelection.kind || movePreview.index !== mapSelection.index)) {
      isMoveDraggingRef.current = false;
      moveDragOffsetRef.current = null;
      setMovePreview(null);
    }
  }, [mapSelection, movePreview]);

  React.useEffect(() => {
    // Clear any local preview when the authoritative snapshot changes.
    isMoveDraggingRef.current = false;
    moveDragOffsetRef.current = null;
    setMovePreview(null);
  }, [mapDocument?.revision, mapFilePath]);

  const onMouseDown = (event: KonvaEventObject<MouseEvent>): void => {
    if (isPickingPlayerStart) {
      if (mapDocument === null) {
        return;
      }

      const stage = event.target.getStage();
      const pointer = stage?.getPointerPosition();
      if (pointer == null) {
        return;
      }

      const renderWorldPoint = screenToWorld({ x: pointer.x, y: pointer.y }, view);
      const authoredWorldPoint: Point = {
        x: renderWorldPoint.x + mapOrigin.x,
        y: renderWorldPoint.y + mapOrigin.y
      };

      const currentAngleDeg = readPlayerStartFromJson(mapDocument.json)?.angleDeg ?? 0;

      // Exit pick mode immediately after a click to avoid accidental double-sets.
      setIsPickingPlayerStart(false);

      void (async () => {
        const result = await window.nomos.map.edit({
          baseRevision: mapDocument.revision,
          command: {
            kind: 'map-edit/set-player-start',
            playerStart: { x: authoredWorldPoint.x, y: authoredWorldPoint.y, angleDeg: currentAngleDeg }
          }
        });

        if (!result.ok) {
          if (result.error.code === 'map-edit/stale-revision') {
            await useNomosStore.getState().refreshFromMain();
            return;
          }
          // eslint-disable-next-line no-console
          console.error('[nomos] map set-player-start failed', result.error);
        }
      })();

      return;
    }

    if (isRoomEnabled) {
      if (mapDocument === null) {
        return;
      }
      if (roomPreview === null || !roomPreview.validity.ok || roomPreview.request === null) {
        return;
      }

      const request = roomPreview.request;

      void (async () => {
        const result = await window.nomos.map.edit({
          baseRevision: mapDocument.revision,
          command: {
            kind: 'map-edit/create-room',
            request
          }
        });

        if (!result.ok) {
          if (result.error.code === 'map-edit/stale-revision') {
            await useNomosStore.getState().refreshFromMain();
            return;
          }
          // eslint-disable-next-line no-console
          console.error('[nomos] map create-room failed', result.error);
          return;
        }

        if (result.value.kind === 'map-edit/applied') {
          applyMapSelectionEffect(result.value.selection);
        }
      })();

      return;
    }
    if (isDoorEnabled) {
      if (mapDocument === null) {
        return;
      }
      if (!decodedMap?.ok) {
        return;
      }

      const stage = event.target.getStage();
      const pointer = stage?.getPointerPosition();
      if (pointer == null) {
        return;
      }

      const renderWorldPoint = screenToWorld({ x: pointer.x, y: pointer.y }, view);
      const authoredWorldPoint: Point = {
        x: renderWorldPoint.x + mapOrigin.x,
        y: renderWorldPoint.y + mapOrigin.y
      };
      const selection = pickMapSelection({
        worldPoint: authoredWorldPoint,
        viewScale: view.scale,
        map: decodedMap.value,
        renderMode: mapRenderMode,
        texturedWallPolygons
      });

      if (selection?.kind !== 'wall') {
        return;
      }

      if (!canPlaceDoorAtWallIndex(decodedMap.value, selection.index)) {
        return;
      }

      void (async () => {
        const result = await window.nomos.map.edit({
          baseRevision: mapDocument.revision,
          command: {
            kind: 'map-edit/create-door',
            atWallIndex: selection.index
          }
        });

        if (!result.ok) {
          if (result.error.code === 'map-edit/stale-revision') {
            await useNomosStore.getState().refreshFromMain();
            return;
          }
          if (result.error.code === 'map-edit/not-a-portal' || result.error.code === 'map-edit/door-already-exists') {
            return;
          }
          // eslint-disable-next-line no-console
          console.error('[nomos] map create-door failed', result.error);
          return;
        }

        if (result.value.kind === 'map-edit/applied') {
          applyMapSelectionEffect(result.value.selection);
        }
      })();

      return;
    }

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
        const selection = pickMapSelection({
          worldPoint: authoredWorldPoint,
          viewScale: view.scale,
          map: decodedMap.value,
          renderMode: mapRenderMode,
          texturedWallPolygons
        });
        setMapSelection(selection);
      } else {
        setMapSelection(null);
      }

      return;
    }

    if (isMoveEnabled) {
      if (mapDocument === null) {
        return;
      }

      if (mapSelection === null || (mapSelection.kind !== 'entity' && mapSelection.kind !== 'light')) {
        return;
      }

      if (!decodedMap?.ok) {
        return;
      }

      const stage = event.target.getStage();
      const pointer = stage?.getPointerPosition();
      if (pointer == null) {
        return;
      }

      const selected =
        mapSelection.kind === 'entity'
          ? decodedMap.value.entities[mapSelection.index]
          : decodedMap.value.lights[mapSelection.index];
      if (!selected) {
        return;
      }

      const renderWorldPoint = screenToWorld({ x: pointer.x, y: pointer.y }, view);
      const authoredWorldPoint: Point = {
        x: renderWorldPoint.x + mapOrigin.x,
        y: renderWorldPoint.y + mapOrigin.y
      };

      const activePreview = movePreviewRef.current;
      const currentX =
        activePreview !== null && activePreview.kind === mapSelection.kind && activePreview.index === mapSelection.index
          ? activePreview.x
          : selected.x;
      const currentY =
        activePreview !== null && activePreview.kind === mapSelection.kind && activePreview.index === mapSelection.index
          ? activePreview.y
          : selected.y;

      const markerHitRadiusScreen = 10;
      const markerHitRadiusWorld = markerHitRadiusScreen / view.scale;
      const d2 = distanceSquared(authoredWorldPoint, { x: currentX, y: currentY });
      if (d2 > markerHitRadiusWorld * markerHitRadiusWorld) {
        return;
      }

      isMoveDraggingRef.current = true;
      moveDragOffsetRef.current = { x: currentX - authoredWorldPoint.x, y: currentY - authoredWorldPoint.y };
      setMovePreview({ kind: mapSelection.kind, index: mapSelection.index, x: currentX, y: currentY });
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

  const onMouseLeave = (): void => {
    onMouseUp();
    setHoveredSelection(null);
  };

  const onMouseUp = (): void => {
    isDraggingRef.current = false;
    lastPointerRef.current = null;

    if (!isMoveDraggingRef.current) {
      return;
    }

    isMoveDraggingRef.current = false;
    moveDragOffsetRef.current = null;

    if (mapDocument === null) {
      setMovePreview(null);
      return;
    }
    if (mapSelection === null || (mapSelection.kind !== 'entity' && mapSelection.kind !== 'light')) {
      setMovePreview(null);
      return;
    }
    const preview = movePreviewRef.current;
    if (preview === null || preview.kind !== mapSelection.kind || preview.index !== mapSelection.index) {
      setMovePreview(null);
      return;
    }

    void (async () => {
      const command =
        mapSelection.kind === 'entity'
          ? {
              kind: 'map-edit/move-entity' as const,
              target: { kind: 'entity' as const, index: mapSelection.index },
              to: { x: preview.x, y: preview.y }
            }
          : {
              kind: 'map-edit/move-light' as const,
              target: { kind: 'light' as const, index: mapSelection.index },
              to: { x: preview.x, y: preview.y }
            };

      const result = await window.nomos.map.edit({
        baseRevision: mapDocument.revision,
        command
      });

      if (!result.ok) {
        if (result.error.code === 'map-edit/stale-revision') {
          await useNomosStore.getState().refreshFromMain();
          setMovePreview(null);
          return;
        }
        // eslint-disable-next-line no-console
        console.error('[nomos] map move failed', result.error);
        setMovePreview(null);
        return;
      }

      setMovePreview(null);
    })();
  };

  const onMouseMove = (event: KonvaEventObject<MouseEvent>): void => {
        if (isRoomEnabled) {
          const stage = event.target.getStage();
          const pointer = stage?.getPointerPosition();
          if (pointer == null) {
            return;
          }

          const renderWorldPoint = screenToWorld({ x: pointer.x, y: pointer.y }, view);
          const authoredWorldPoint: Point = {
            x: renderWorldPoint.x + mapOrigin.x,
            y: renderWorldPoint.y + mapOrigin.y
          };

          setRoomCenter((current) =>
            current !== null && Math.abs(current.x - authoredWorldPoint.x) < 1e-6 && Math.abs(current.y - authoredWorldPoint.y) < 1e-6
              ? current
              : authoredWorldPoint
          );

          return;
        }
    if (isDoorEnabled) {
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
        const nextHovered = pickMapSelection({
          worldPoint: authoredWorldPoint,
          viewScale: view.scale,
          map: decodedMap.value,
          renderMode: mapRenderMode,
          texturedWallPolygons
        });

        setHoveredSelection((current) => (areSelectionsEqual(current, nextHovered) ? current : nextHovered));

        const canPlace = nextHovered?.kind === 'wall' && canPlaceDoorAtWallIndex(decodedMap.value, nextHovered.index);
        if (containerRef.current !== null) {
          containerRef.current.style.cursor = canPlace ? 'crosshair' : 'not-allowed';
        }
      } else {
        setHoveredSelection(null);
        if (containerRef.current !== null) {
          containerRef.current.style.cursor = 'not-allowed';
        }
      }

      return;
    }

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
        const nextHovered = pickMapSelection({
          worldPoint: authoredWorldPoint,
          viewScale: view.scale,
          map: decodedMap.value,
          renderMode: mapRenderMode,
          texturedWallPolygons
        });

        setHoveredSelection((current) => (areSelectionsEqual(current, nextHovered) ? current : nextHovered));
      } else {
        setHoveredSelection(null);
      }

      return;
    }

    if (isMoveEnabled && isMoveDraggingRef.current) {
      if (mapSelection === null || (mapSelection.kind !== 'entity' && mapSelection.kind !== 'light')) {
        return;
      }

      const stage = event.target.getStage();
      const pointer = stage?.getPointerPosition();
      if (pointer == null) {
        return;
      }

      const offset = moveDragOffsetRef.current;
      if (offset === null) {
        moveDragOffsetRef.current = { x: 0, y: 0 };
        return;
      }

      const renderWorldPoint = screenToWorld({ x: pointer.x, y: pointer.y }, view);
      const authoredWorldPoint: Point = {
        x: renderWorldPoint.x + mapOrigin.x,
        y: renderWorldPoint.y + mapOrigin.y
      };

      setMovePreview({
        kind: mapSelection.kind,
        index: mapSelection.index,
        x: authoredWorldPoint.x + offset.x,
        y: authoredWorldPoint.y + offset.y
      });
      return;
    }

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
  const portalWallStroke = Colors.BLUE4;
  const portalWallOverlayFill = hexToRgba(Colors.CERULEAN4, 0.35);
  const toggleWallStroke = Colors.GREEN4;
  const toggleWallOverlayFill = hexToRgba(Colors.GREEN4, 0.25);
  const wallStrokeWidth = 2;
  const selectionStroke = Colors.RED4;
  const selectionStrokeWidth = 3;
  const hoverStroke = Colors.GOLD5;
  const hoverStrokeWidth = 2;
  const doorStroke = Colors.ORANGE4;
  const doorStrokeWidth = 2;
  const doorMarkerSizePx = 10;

  const markerStroke = Colors.WHITE;
  const markerStrokeWidthPx = 2;
  const lightMarkerRadiusPx = 6;
  const particleMarkerSizePx = 12;
  const entityMarkerSizePx = 14;

  const verticalLines: JSX.Element[] = [];
  const horizontalLines: JSX.Element[] = [];

  if (mapGridSettings.isGridVisible && minorGridScreenSpacing >= 6) {
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
  const roomPreviewOverlays: JSX.Element[] = [];
  const doorMarkers: JSX.Element[] = [];
  const texturedFloors: JSX.Element[] = [];
  const texturedWalls: JSX.Element[] = [];
  const hoverOverlays: JSX.Element[] = [];
  const selectionOverlays: JSX.Element[] = [];
  const lightRadiusCircles: JSX.Element[] = [];
  const lightMarkers: JSX.Element[] = [];
  const particleMarkers: JSX.Element[] = [];
  const entityMarkers: JSX.Element[] = [];
  const playerStartOverlays: JSX.Element[] = [];

  if (decodedMap?.ok) {
    const map = decodedMap.value;

    const toRenderX = (authoredX: number): number => authoredX - mapOrigin.x;
    const toRenderY = (authoredY: number): number => authoredY - mapOrigin.y;

    if (isRoomEnabled && roomPreview !== null) {
      const points: number[] = [];
      for (const p of roomPreview.polygon) {
        points.push(toRenderX(p.x), toRenderY(p.y));
      }

      if (points.length >= 6) {
        const stroke = roomPreview.validity.ok && roomPreview.request !== null ? Colors.GREEN5 : Colors.RED5;
        roomPreviewOverlays.push(
          <Line
            key="room-preview"
            points={points}
            closed={true}
            stroke={stroke}
            strokeWidth={2}
            strokeScaleEnabled={false}
            lineCap="round"
            lineJoin="round"
          />
        );
      }
    }

    // Marker sizes are defined in screen pixels and converted to world units.
    const safeScale = Math.max(0.0001, view.scale);
    const doorMarkerSizeWorld = doorMarkerSizePx / safeScale;
    const lightMarkerRadiusWorld = lightMarkerRadiusPx / safeScale;
    const particleMarkerSizeWorld = particleMarkerSizePx / safeScale;
    const entityMarkerSizeWorld = entityMarkerSizePx / safeScale;

    const playerStart = readPlayerStartFromJson(mapDocument?.json ?? null);
    if (playerStart !== null) {
      const radiusWorld = 8 / safeScale;
      const coneLengthWorld = 40 / safeScale;
      const halfAngleRad = (30 * Math.PI) / 180;
      const angleRad = (playerStart.angleDeg * Math.PI) / 180;

      const originX = toRenderX(playerStart.x);
      const originY = toRenderY(playerStart.y);

      const leftRad = angleRad - halfAngleRad;
      const rightRad = angleRad + halfAngleRad;
      const leftX = originX + Math.cos(leftRad) * coneLengthWorld;
      const leftY = originY + Math.sin(leftRad) * coneLengthWorld;
      const rightX = originX + Math.cos(rightRad) * coneLengthWorld;
      const rightY = originY + Math.sin(rightRad) * coneLengthWorld;

      const forwardX = originX + Math.cos(angleRad) * coneLengthWorld;
      const forwardY = originY + Math.sin(angleRad) * coneLengthWorld;

      playerStartOverlays.push(
        <Line
          key="player-start-cone"
          points={[originX, originY, leftX, leftY, rightX, rightY]}
          closed={true}
          fill={hexToRgba(Colors.GOLD5, 0.15)}
          stroke={hexToRgba(Colors.GOLD5, 0.4)}
          strokeWidth={1}
          strokeScaleEnabled={false}
          lineJoin="round"
        />
      );

      playerStartOverlays.push(
        <Line
          key="player-start-direction"
          points={[originX, originY, forwardX, forwardY]}
          stroke={hexToRgba(Colors.GOLD5, 0.8)}
          strokeWidth={2}
          strokeScaleEnabled={false}
          lineCap="round"
        />
      );

      playerStartOverlays.push(
        <Circle
          key="player-start-circle"
          x={originX}
          y={originY}
          radius={radiusWorld}
          fill={Colors.GOLD5}
          stroke={markerStroke}
          strokeWidth={markerStrokeWidthPx}
          strokeScaleEnabled={false}
        />
      );
    }

    const appendSelectionOutline = (
      selection: MapSelection,
      stroke: string,
      strokeWidth: number,
      out: JSX.Element[]
    ): void => {
      if (selection.kind === 'sector') {
        const loop = buildSectorLoop(map, selection.id);
        if (loop === null) {
          return;
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
          return;
        }

        out.push(
          <Line
            key={`outline-${stroke}-${selection.kind}-${selection.id}`}
            points={points}
            closed={true}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeScaleEnabled={false}
            lineCap="round"
            lineJoin="round"
          />
        );
        return;
      }

      if (selection.kind === 'wall') {
        const wall = map.walls[selection.index];
        if (!wall) {
          return;
        }

        const v0 = map.vertices[wall.v0];
        const v1 = map.vertices[wall.v1];
        if (!v0 || !v1) {
          return;
        }

        if (mapRenderMode === 'textured' && texturedWallPolygons !== null) {
          const polygon = texturedWallPolygons.find((candidate) => candidate.wallIndex === wall.index) ?? null;
          if (polygon !== null) {
            const points: number[] = [];
            for (const point of polygon.points) {
              points.push(toRenderX(point.x), toRenderY(point.y));
            }

            if (points.length >= 6) {
              out.push(
                <Line
                  key={`outline-${stroke}-${selection.kind}-${wall.index}`}
                  points={points}
                  closed={true}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  strokeScaleEnabled={false}
                  lineCap="round"
                  lineJoin="round"
                />
              );
              return;
            }
          }
        }

        out.push(
          <Line
            key={`outline-${stroke}-${selection.kind}-${wall.index}`}
            points={[toRenderX(v0.x), toRenderY(v0.y), toRenderX(v1.x), toRenderY(v1.y)]}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeScaleEnabled={false}
            lineCap="round"
            lineJoin="round"
          />
        );
        return;
      }

      if (selection.kind === 'door') {
        const door = map.doors.find((candidate) => candidate.id === selection.id) ?? null;
        const wall = door ? map.walls[door.wallIndex] : null;
        if (!wall) {
          return;
        }

        const v0 = map.vertices[wall.v0];
        const v1 = map.vertices[wall.v1];
        if (!v0 || !v1) {
          return;
        }

        const midX = toRenderX((v0.x + v1.x) / 2);
        const midY = toRenderY((v0.y + v1.y) / 2);
        out.push(
          <Line
            key={`outline-${stroke}-${selection.kind}-${selection.id}`}
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
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeScaleEnabled={false}
            lineCap="round"
            lineJoin="round"
          />
        );
        return;
      }

      if (selection.kind === 'entity') {
        const entity = map.entities[selection.index];
        if (!entity) {
          return;
        }

        const preview = movePreview;
        const entityX = preview !== null && preview.kind === 'entity' && preview.index === entity.index ? preview.x : entity.x;
        const entityY = preview !== null && preview.kind === 'entity' && preview.index === entity.index ? preview.y : entity.y;
        const half = entityMarkerSizeWorld / 2;

        out.push(
          <Line
            key={`outline-${stroke}-${selection.kind}-${selection.index}`}
            points={[
              toRenderX(entityX),
              toRenderY(entityY) - half,
              toRenderX(entityX) + half,
              toRenderY(entityY) + half,
              toRenderX(entityX) - half,
              toRenderY(entityY) + half
            ]}
            closed={true}
            fill="rgba(0,0,0,0)"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeScaleEnabled={false}
            lineJoin="round"
          />
        );
        return;
      }

      if (selection.kind === 'light') {
        const light = map.lights[selection.index];
        if (!light) {
          return;
        }

        const preview = movePreview;
        const lightX = preview !== null && preview.kind === 'light' && preview.index === light.index ? preview.x : light.x;
        const lightY = preview !== null && preview.kind === 'light' && preview.index === light.index ? preview.y : light.y;

        out.push(
          <Circle
            key={`outline-${stroke}-${selection.kind}-${selection.index}`}
            x={toRenderX(lightX)}
            y={toRenderY(lightY)}
            radius={lightMarkerRadiusWorld}
            fill="rgba(0,0,0,0)"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeScaleEnabled={false}
          />
        );
        return;
      }

      if (selection.kind === 'particle') {
        const particle = map.particles[selection.index];
        if (!particle) {
          return;
        }

        const half = particleMarkerSizeWorld / 2;
        out.push(
          <Rect
            key={`outline-${stroke}-${selection.kind}-${selection.index}`}
            x={toRenderX(particle.x) - half}
            y={toRenderY(particle.y) - half}
            width={particleMarkerSizeWorld}
            height={particleMarkerSizeWorld}
            fill="rgba(0,0,0,0)"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeScaleEnabled={false}
          />
        );
      }
    };

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

        const { resolvedTextureKey, isSkyFill } = (() => {
          if (mapSectorSurface === 'floor') {
            return { resolvedTextureKey: sector.floorTex, isSkyFill: false };
          }

          if (sector.ceilTex.trim().toLowerCase() === 'sky') {
            if (map.sky === null) {
              return { resolvedTextureKey: null, isSkyFill: true };
            }
            return { resolvedTextureKey: `Images/Sky/${map.sky}`, isSkyFill: true };
          }

          return { resolvedTextureKey: sector.ceilTex, isSkyFill: false };
        })();

        if (resolvedTextureKey === null) {
          continue;
        }

        const image = textureImages[resolvedTextureKey];
        if (!image) {
          // While textures are loading (or missing), avoid drawing large fallback fills.
          // Walls still render below, keeping the view usable.
          continue;
        }

        texturedFloors.push(
          <Shape
            key={`floor-${sector.id}`}
            sceneFunc={(context, shape) => {
              const native = getNative2dContext(context);
              if (native === null) {
                return;
              }

              const pattern = buildRepeatPattern(native, image);
              if (pattern === null) {
                return;
              }

              native.imageSmoothingEnabled = false;
              native.fillStyle = pattern;

              native.beginPath();
              native.moveTo(points[0] ?? 0, points[1] ?? 0);
              for (let index = 2; index < points.length; index += 2) {
                native.lineTo(points[index] ?? 0, points[index + 1] ?? 0);
              }
              native.closePath();
              native.fill();

              if (!isSkyFill) {
                const brightness = clamp01(sector.light);
                const darkness = 1 - brightness;
                if (darkness > 0) {
                  native.fillStyle = `rgba(0, 0, 0, ${clamp01(darkness)})`;
                  native.beginPath();
                  native.moveTo(points[0] ?? 0, points[1] ?? 0);
                  for (let index = 2; index < points.length; index += 2) {
                    native.lineTo(points[index] ?? 0, points[index + 1] ?? 0);
                  }
                  native.closePath();
                  native.fill();
                }
              }

              context.fillStrokeShape(shape);
            }}
          />
        );
      }

      const sortedWallPolygons = [...(texturedWallPolygons ?? [])].sort((a, b) => a.wallIndex - b.wallIndex);

      for (const polygon of sortedWallPolygons) {
        const wall = map.walls[polygon.wallIndex];
        if (!wall) {
          continue;
        }

        const isPortalHighlighted = mapHighlightPortals && wall.backSector > -1;
        const isToggleWallHighlighted = mapHighlightToggleWalls && wall.toggleSector;

        const highlightStroke = isToggleWallHighlighted ? toggleWallStroke : isPortalHighlighted ? portalWallStroke : null;
        const highlightOverlayFill =
          isToggleWallHighlighted ? toggleWallOverlayFill : isPortalHighlighted ? portalWallOverlayFill : null;

        const v0 = map.vertices[wall.v0];
        const v1 = map.vertices[wall.v1];
        if (!v0 || !v1) {
          continue;
        }

        const p0 = polygon.points[0];
        const p1 = polygon.points[1];
        const p2 = polygon.points[2];
        const p3 = polygon.points[3];
        if (!p0 || !p1 || !p2 || !p3) {
          continue;
        }

        const startMidAuthX = (p0.x + p3.x) / 2;
        const startMidAuthY = (p0.y + p3.y) / 2;
        const endMidAuthX = (p1.x + p2.x) / 2;
        const endMidAuthY = (p1.y + p2.y) / 2;

        const startMidX = toRenderX(startMidAuthX);
        const startMidY = toRenderY(startMidAuthY);
        const endMidX = toRenderX(endMidAuthX);
        const endMidY = toRenderY(endMidAuthY);

        const dirX = endMidX - startMidX;
        const dirY = endMidY - startMidY;
        const dirLen = Math.hypot(dirX, dirY);
        if (dirLen <= 0.0001) {
          continue;
        }

        const angleRad = Math.atan2(dirY, dirX);
        const angleDeg = (angleRad * 180) / Math.PI;
        const midX = (startMidX + endMidX) / 2;
        const midY = (startMidY + endMidY) / 2;

        const cosA = Math.cos(angleRad);
        const sinA = Math.sin(angleRad);

        const localPoints: number[] = [];
        for (const point of polygon.points) {
          const rx = toRenderX(point.x);
          const ry = toRenderY(point.y);
          const tx = rx - midX;
          const ty = ry - midY;

          // Inverse rotate so that after Konva applies rotation, the polygon lands in world space.
          const lx = tx * cosA + ty * sinA;
          const ly = -tx * sinA + ty * cosA;
          localPoints.push(lx, ly);
        }

        const image = textureImages[wall.tex];
        if (!image) {
          // While textures are loading (or missing), fall back to the wireframe segment.
          texturedWalls.push(
            <Line
              key={`wall-tex-fallback-${wall.index}`}
              points={[toRenderX(v0.x), toRenderY(v0.y), toRenderX(v1.x), toRenderY(v1.y)]}
              stroke={highlightStroke ?? wallStroke}
              strokeWidth={wallStrokeWidth}
              strokeScaleEnabled={false}
              lineCap="round"
            />
          );
          continue;
        }

        texturedWalls.push(
          <Shape
            key={`wall-tex-${wall.index}`}
            x={midX}
            y={midY}
            rotation={angleDeg}
            sceneFunc={(context, shape) => {
              const native = getNative2dContext(context);
              if (native === null) {
                return;
              }

              const pattern = buildRepeatPattern(native, image);
              if (pattern === null) {
                return;
              }

              native.imageSmoothingEnabled = false;
              native.fillStyle = pattern;

              native.beginPath();
              native.moveTo(localPoints[0] ?? 0, localPoints[1] ?? 0);
              for (let index = 2; index < localPoints.length; index += 2) {
                native.lineTo(localPoints[index] ?? 0, localPoints[index + 1] ?? 0);
              }
              native.closePath();
              native.fill();

              if (highlightOverlayFill !== null) {
                native.fillStyle = highlightOverlayFill;
                native.beginPath();
                native.moveTo(localPoints[0] ?? 0, localPoints[1] ?? 0);
                for (let index = 2; index < localPoints.length; index += 2) {
                  native.lineTo(localPoints[index] ?? 0, localPoints[index + 1] ?? 0);
                }
                native.closePath();
                native.fill();
              }

              // Keep the existing outline behavior.
              native.strokeStyle = highlightStroke ?? Colors.BLACK;
              // The render layer is scaled by view.scale. Compensate so the outline stays ~1px on screen.
              const safeScale = Math.max(0.0001, view.scale);
              native.lineWidth = 1 / safeScale;
              native.stroke();

              context.fillStrokeShape(shape);
            }}
          />
        );
      }

      if (mapDoorVisibility === 'visible') {
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
    }

    if (mapRenderMode === 'wireframe') {
      for (const wall of map.walls) {
        const v0 = map.vertices[wall.v0];
        const v1 = map.vertices[wall.v1];
        if (!v0 || !v1) {
          continue;
        }

        const stroke =
          mapHighlightToggleWalls && wall.toggleSector
            ? toggleWallStroke
            : mapHighlightPortals && wall.backSector > -1
              ? portalWallStroke
              : wallStroke;

        wallLines.push(
          <Line
            key={`wall-${wall.index}`}
            points={[toRenderX(v0.x), toRenderY(v0.y), toRenderX(v1.x), toRenderY(v1.y)]}
            stroke={stroke}
            strokeWidth={wallStrokeWidth}
            strokeScaleEnabled={false}
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
      const preview = movePreview;
      const lightX = preview !== null && preview.kind === 'light' && preview.index === light.index ? preview.x : light.x;
      const lightY = preview !== null && preview.kind === 'light' && preview.index === light.index ? preview.y : light.y;

      const baseAlpha = 0.08;
      const intensityAlpha = clamp(light.intensity * 0.12, 0, 0.2);
      const radiusFillAlpha = clamp(baseAlpha + intensityAlpha, 0.05, 0.25);

      const radiusFill = `rgba(${light.color.r}, ${light.color.g}, ${light.color.b}, ${radiusFillAlpha})`;
      const radiusStroke = `rgba(${light.color.r}, ${light.color.g}, ${light.color.b}, ${clamp(radiusFillAlpha + 0.15, 0.15, 0.4)})`;

      lightRadiusCircles.push(
        <Circle
          key={`light-radius-${light.index}`}
          x={toRenderX(lightX)}
          y={toRenderY(lightY)}
          radius={Math.max(0, light.radius)}
          fill={radiusFill}
          stroke={radiusStroke}
          strokeWidth={1}
        />
      );

      lightMarkers.push(
        <Circle
          key={`light-marker-${light.index}`}
          x={toRenderX(lightX)}
          y={toRenderY(lightY)}
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
      const preview = movePreview;
      const entityX = preview !== null && preview.kind === 'entity' && preview.index === entity.index ? preview.x : entity.x;
      const entityY = preview !== null && preview.kind === 'entity' && preview.index === entity.index ? preview.y : entity.y;
      const half = entityMarkerSizeWorld / 2;
      entityMarkers.push(
        <Line
          key={`entity-${entity.index}`}
          points={[
            toRenderX(entityX),
            toRenderY(entityY) - half,
            toRenderX(entityX) + half,
            toRenderY(entityY) + half,
            toRenderX(entityX) - half,
            toRenderY(entityY) + half
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

    const hoverCandidate =
      props.interactionMode === 'select' && !areSelectionsEqual(hoveredSelection, mapSelection) ? hoveredSelection : null;
    if (hoverCandidate !== null) {
      appendSelectionOutline(hoverCandidate, hoverStroke, hoverStrokeWidth, hoverOverlays);
    }

    if (mapSelection !== null) {
      appendSelectionOutline(mapSelection, selectionStroke, selectionStrokeWidth, selectionOverlays);
    }
  }

  const onDragEnter = (event: React.DragEvent<HTMLDivElement>): void => {
    const payload = tryReadEntityPlacementDragPayload(event.dataTransfer);
    if (payload === null) {
      return;
    }
    setEntityDropCursorStateIfChanged('invalid');
  };

  const onDragLeave = (event: React.DragEvent<HTMLDivElement>): void => {
    void event;
    setEntityDropCursorStateIfChanged('none');
  };

  const onDragOver = (event: React.DragEvent<HTMLDivElement>): void => {
    const payload = tryReadEntityPlacementDragPayload(event.dataTransfer);
    if (payload === null) {
      return;
    }

    if (mapDocument === null || decodedMap === null || !decodedMap.ok) {
      setEntityDropCursorStateIfChanged('invalid');
      return;
    }

    const authoredWorldPoint = tryComputeAuthoredWorldPointFromClient({ x: event.clientX, y: event.clientY });
    if (authoredWorldPoint === null) {
      setEntityDropCursorStateIfChanged('invalid');
      return;
    }

    const sectorId = findSectorIdAtWorldPoint(authoredWorldPoint, decodedMap.value);
    if (sectorId === null) {
      setEntityDropCursorStateIfChanged('invalid');
      return;
    }

    setEntityDropCursorStateIfChanged('valid');
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  };

  const onDrop = (event: React.DragEvent<HTMLDivElement>): void => {
    const payload = tryReadEntityPlacementDragPayload(event.dataTransfer);
    if (payload === null) {
      return;
    }

    if (mapDocument === null || decodedMap === null || !decodedMap.ok) {
      setEntityDropCursorStateIfChanged('none');
      return;
    }

    const authoredWorldPoint = tryComputeAuthoredWorldPointFromClient({ x: event.clientX, y: event.clientY });
    if (authoredWorldPoint === null) {
      setEntityDropCursorStateIfChanged('none');
      return;
    }

    const sectorId = findSectorIdAtWorldPoint(authoredWorldPoint, decodedMap.value);
    if (sectorId === null) {
      setEntityDropCursorStateIfChanged('none');
      return;
    }

    event.preventDefault();
    setEntityDropCursorStateIfChanged('none');

    void (async () => {
      const result = await window.nomos.map.edit({
        baseRevision: mapDocument.revision,
        command: {
          kind: 'map-edit/create-entity',
          at: { x: authoredWorldPoint.x, y: authoredWorldPoint.y },
          def: payload.defName
        }
      });

      if (!result.ok) {
        if (result.error.code === 'map-edit/stale-revision') {
          await useNomosStore.getState().refreshFromMain();
          return;
        }
        // eslint-disable-next-line no-console
        console.error('[nomos] map create-entity failed', result.error.code, result.error.message, result.error);
        return;
      }

      if (result.value.kind === 'map-edit/applied') {
        applyMapSelectionEffect(result.value.selection);
      }
    })();
  };

  const cursor = entityDropCursorState === 'valid' ? 'copy' : entityDropCursorState === 'invalid' ? 'not-allowed' : 'auto';

  return (
    <div
      ref={containerRef}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={{ height: '100%', width: '100%', cursor }}
    >
      <Stage
        ref={(stage) => {
          stageRef.current = stage as unknown as Readonly<{
            getPointerPosition: () => Readonly<{ x: number; y: number }> | null;
          }> | null;
        }}
        width={size.width}
        height={size.height}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        onMouseMove={onMouseMove}
        onWheel={onWheel}
      >
        <Layer listening={false}>
          <Rect x={0} y={0} width={size.width} height={size.height} fill={backgroundFill} />
        </Layer>
        {mapGridSettings.isGridVisible ? (
          <Layer listening={false} opacity={mapGridSettings.gridOpacity}>
            {verticalLines}
            {horizontalLines}
          </Layer>
        ) : null}
        <Layer
          listening={false}
          x={view.offsetX}
          y={view.offsetY}
          scaleX={view.scale}
          scaleY={view.scale}
          imageSmoothingEnabled={false}
        >
          {texturedFloors}
          {texturedWalls}
          {wallLines}
          {doorMarkers}
          {lightRadiusCircles}
          {lightMarkers}
          {particleMarkers}
          {entityMarkers}
          {playerStartOverlays}
          {roomPreviewOverlays}
          {hoverOverlays}
          {selectionOverlays}
        </Layer>
      </Stage>
    </div>
  );
}
);
