import {
  computeAdjacentPortalPlan,
  findEnclosingSectorIdForPolygon,
  computeRoomPlacementValidity,
  computeRoomPolygon,
  distancePointToSegment,
  doesPolygonIntersectWalls,
  findNearestWallWithinThresholdPx,
  findNearestWallToPolygonWithinThresholdPx,
  polygonEdges,
  pointInSector
} from './mapRoomGeometry';

import type { RoomMapGeometry } from './mapRoomGeometry';

function rectRoomGeometry(args: { width: number; height: number; sectorId: number }): RoomMapGeometry {
  const w = args.width;
  const h = args.height;
  return {
    vertices: [
      { x: 0, y: 0 },
      { x: w, y: 0 },
      { x: w, y: h },
      { x: 0, y: h }
    ],
    sectorIds: [args.sectorId],
    walls: [
      { index: 0, v0: 0, v1: 1, frontSectorId: args.sectorId, backSectorId: -1 },
      { index: 1, v0: 1, v1: 2, frontSectorId: args.sectorId, backSectorId: -1 },
      { index: 2, v0: 2, v1: 3, frontSectorId: args.sectorId, backSectorId: -1 },
      { index: 3, v0: 3, v1: 0, frontSectorId: args.sectorId, backSectorId: -1 }
    ]
  };
}

describe('mapRoomGeometry', () => {
  test('computeRoomPolygon: triangle template produces 3 vertices', () => {
    const polygon = computeRoomPolygon({
      template: 'triangle',
      center: { x: 0, y: 0 },
      size: { width: 4, height: 6 },
      rotationQuarterTurns: 0
    });

    expect(polygon).toHaveLength(3);
  });

  test('computeRoomPolygon: supports quarter-turn rotations (90/180/270)', () => {
    const base = computeRoomPolygon({
      template: 'square',
      center: { x: 0, y: 0 },
      size: { width: 2, height: 2 },
      rotationQuarterTurns: 0
    });

    const r90 = computeRoomPolygon({
      template: 'square',
      center: { x: 0, y: 0 },
      size: { width: 2, height: 2 },
      rotationQuarterTurns: 1
    });

    const r180 = computeRoomPolygon({
      template: 'square',
      center: { x: 0, y: 0 },
      size: { width: 2, height: 2 },
      rotationQuarterTurns: 2
    });

    const r270 = computeRoomPolygon({
      template: 'square',
      center: { x: 0, y: 0 },
      size: { width: 2, height: 2 },
      rotationQuarterTurns: 3
    });

    expect(base[0]).toEqual({ x: -1, y: -1 });
    expect(r90[0]).toEqual({ x: -1, y: 1 });
    expect(r180[0]).toEqual({ x: 1, y: 1 });
    expect(r270[0]).toEqual({ x: 1, y: -1 });
  });

  test('polygonEdges: skips undefined points defensively', () => {
    const edges = polygonEdges([
      { x: 0, y: 0 },
      undefined as unknown as { x: number; y: number },
      { x: 1, y: 0 }
    ] as unknown as ReadonlyArray<{ x: number; y: number }>);

    expect(edges).toHaveLength(1);
    expect(edges[0]).toEqual({ a: { x: 1, y: 0 }, b: { x: 0, y: 0 } });
  });

  test('findNearestWallToPolygonWithinThresholdPx: empty polygon returns null', () => {
    const geometry = rectRoomGeometry({ width: 10, height: 10, sectorId: 1 });

    const nearest = findNearestWallToPolygonWithinThresholdPx({
      geometry,
      polygon: [],
      viewScale: 10,
      thresholdPx: 12
    });

    expect(nearest).toBeNull();
  });

  test('findNearestWallToPolygonWithinThresholdPx: ignores walls with missing vertices', () => {
    const geometry: RoomMapGeometry = {
      vertices: [{ x: 0, y: 0 }],
      sectorIds: [],
      walls: [{ index: 0, v0: 0, v1: 999, frontSectorId: 1, backSectorId: -1 }]
    };

    const polygon = computeRoomPolygon({
      template: 'rectangle',
      center: { x: 5, y: -1 },
      size: { width: 4, height: 2 },
      rotationQuarterTurns: 0
    });

    const nearest = findNearestWallToPolygonWithinThresholdPx({
      geometry,
      polygon,
      viewScale: 10,
      thresholdPx: 12
    });

    expect(nearest).toBeNull();
  });

  test('findNearestWallToPolygonWithinThresholdPx: intersecting polygon edge yields distance 0', () => {
    const geometry: RoomMapGeometry = {
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 }
      ],
      sectorIds: [],
      walls: [{ index: 0, v0: 0, v1: 1, frontSectorId: 1, backSectorId: -1 }]
    };

    // Rectangle whose top edge lies exactly on the wall segment.
    const polygon = computeRoomPolygon({
      template: 'rectangle',
      center: { x: 5, y: -1 },
      size: { width: 4, height: 2 },
      rotationQuarterTurns: 0
    });

    const nearest = findNearestWallToPolygonWithinThresholdPx({
      geometry,
      polygon,
      viewScale: 10,
      thresholdPx: 0.5
    });

    expect(nearest).not.toBeNull();
    if (nearest) {
      expect(nearest.wallIndex).toBe(0);
      expect(nearest.distancePx).toBe(0);
    }
  });

  test('findNearestWallToPolygonWithinThresholdPx: does not replace best when a later wall is farther', () => {
    const geometry: RoomMapGeometry = {
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 0, y: 10 },
        { x: 10, y: 10 }
      ],
      sectorIds: [],
      walls: [
        { index: 0, v0: 0, v1: 1, frontSectorId: 1, backSectorId: -1 },
        { index: 1, v0: 2, v1: 3, frontSectorId: 1, backSectorId: -1 }
      ]
    };

    // Rectangle near the lower wall (y=0), far from the upper wall (y=10).
    const polygon = computeRoomPolygon({
      template: 'rectangle',
      center: { x: 5, y: -1 },
      size: { width: 4, height: 2 },
      rotationQuarterTurns: 0
    });

    const nearest = findNearestWallToPolygonWithinThresholdPx({
      geometry,
      polygon,
      viewScale: 10,
      thresholdPx: 200
    });

    expect(nearest).not.toBeNull();
    if (nearest) {
      expect(nearest.wallIndex).toBe(0);
      expect(nearest.distancePx).toBeLessThan(100);
    }
  });

  test('doesPolygonIntersectWalls: walls with missing vertices are ignored', () => {
    const geometry: RoomMapGeometry = {
      vertices: [{ x: 0, y: 0 }],
      sectorIds: [],
      walls: [
        // References missing vertex, so it is ignored.
        { index: 0, v0: 0, v1: 1, frontSectorId: 1, backSectorId: -1 }
      ]
    };

    const polygon = computeRoomPolygon({
      template: 'rectangle',
      center: { x: 0, y: 0 },
      size: { width: 4, height: 4 },
      rotationQuarterTurns: 0
    });

    expect(doesPolygonIntersectWalls({ geometry, polygon })).toBe(false);
  });

  test('distancePointToSegment: degenerate segment (a == b) uses point distance', () => {
    const d = distancePointToSegment({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 0, y: 0 });
    expect(d).toBe(5);
  });

  test('pointInSector: ignores walls with missing vertices', () => {
    const geometry: RoomMapGeometry = {
      vertices: [{ x: 0, y: 0 }],
      sectorIds: [1],
      walls: [
        // References missing vertex, so it is ignored.
        { index: 0, v0: 0, v1: 1, frontSectorId: 1, backSectorId: -1 }
      ]
    };

    expect(pointInSector({ x: 0, y: 0 }, geometry, 1)).toBe(false);
  });

  test('pointInSector: returns true when ray intersection lands exactly on worldPoint.x', () => {
    const geometry: RoomMapGeometry = {
      vertices: [
        { x: 0, y: 0 },
        { x: 0, y: 10 }
      ],
      sectorIds: [1],
      walls: [{ index: 0, v0: 0, v1: 1, frontSectorId: 1, backSectorId: -1 }]
    };

    expect(pointInSector({ x: 0, y: 5 }, geometry, 1)).toBe(true);
  });

  test('findEnclosingSectorIdForPolygon: empty polygon chooses smallest candidate sector id (area treated as infinite)', () => {
    const geometry: RoomMapGeometry = {
      vertices: [],
      sectorIds: [2, 1],
      walls: []
    };

    const enclosing = findEnclosingSectorIdForPolygon(geometry, []);
    expect(enclosing).toBe(1);
  });

  test('findEnclosingSectorIdForPolygon: missing wall vertices are ignored when computing sector area', () => {
    const geometry: RoomMapGeometry = {
      vertices: [],
      sectorIds: [1],
      walls: [
        // References missing vertices; area computation should skip this edge.
        { index: 0, v0: 0, v1: 1, frontSectorId: 1, backSectorId: -1 }
      ]
    };

    const enclosing = findEnclosingSectorIdForPolygon(geometry, []);
    expect(enclosing).toBe(1);
  });

  test('findNearestWallWithinThresholdPx: returns null when no wall is within threshold', () => {
    const geometry: RoomMapGeometry = {
      vertices: [
        { x: 100, y: 0 },
        { x: 110, y: 0 }
      ],
      sectorIds: [],
      walls: [{ index: 0, v0: 0, v1: 1, frontSectorId: 1, backSectorId: -1 }]
    };

    const nearest = findNearestWallWithinThresholdPx({
      geometry,
      worldPoint: { x: 0, y: 0 },
      viewScale: 10,
      thresholdPx: 12
    });

    expect(nearest).toBeNull();
  });

  test('findNearestWallWithinThresholdPx: ignores walls with missing vertices', () => {
    const geometry: RoomMapGeometry = {
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 }
      ],
      sectorIds: [],
      walls: [
        { index: 0, v0: 0, v1: 999, frontSectorId: 1, backSectorId: -1 },
        { index: 1, v0: 0, v1: 1, frontSectorId: 1, backSectorId: -1 }
      ]
    };

    const nearest = findNearestWallWithinThresholdPx({
      geometry,
      worldPoint: { x: 5, y: 0.2 },
      viewScale: 10,
      thresholdPx: 12
    });

    expect(nearest).not.toBeNull();
    if (nearest) {
      expect(nearest.wallIndex).toBe(1);
    }
  });

  test('findNearestWallWithinThresholdPx: selects the closest wall within threshold', () => {
    const geometry: RoomMapGeometry = {
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 0, y: 1 },
        { x: 10, y: 1 }
      ],
      sectorIds: [],
      walls: [
        { index: 0, v0: 0, v1: 1, frontSectorId: 1, backSectorId: -1 },
        { index: 1, v0: 2, v1: 3, frontSectorId: 1, backSectorId: -1 }
      ]
    };

    const nearest = findNearestWallWithinThresholdPx({
      geometry,
      worldPoint: { x: 5, y: 0.8 },
      viewScale: 10,
      thresholdPx: 12
    });

    expect(nearest).not.toBeNull();
    if (nearest) {
      expect(nearest.wallIndex).toBe(1);
    }
  });

  test('nested validity: polygon fully inside sector is valid/nested', () => {
    const geometry = rectRoomGeometry({ width: 10, height: 10, sectorId: 1 });

    const polygon = computeRoomPolygon({
      template: 'rectangle',
      center: { x: 5, y: 5 },
      size: { width: 4, height: 4 },
      rotationQuarterTurns: 0
    });

    const validity = computeRoomPlacementValidity({
      geometry,
      polygon,
      viewScale: 1,
      snapThresholdPx: 12,
      minSizeWorld: 1
    });

    expect(validity.ok).toBe(true);
    if (validity.ok) {
      expect(validity.kind).toBe('room-valid/nested');
      if (validity.kind === 'room-valid/nested') {
        expect(validity.enclosingSectorId).toBe(1);
      }
    }
  });

  test('intersection validity: polygon that crosses an existing wall is invalid', () => {
    const geometry = rectRoomGeometry({ width: 10, height: 10, sectorId: 1 });

    const polygon = computeRoomPolygon({
      template: 'rectangle',
      center: { x: 5, y: 0 },
      size: { width: 4, height: 4 },
      rotationQuarterTurns: 0
    });

    expect(doesPolygonIntersectWalls({ geometry, polygon })).toBe(true);

    const validity = computeRoomPlacementValidity({
      geometry,
      polygon,
      viewScale: 1,
      snapThresholdPx: 12,
      minSizeWorld: 1
    });

    expect(validity.ok).toBe(false);
    if (!validity.ok) {
      expect(validity.reason).toBe('intersects-walls');
    }
  });

  test('adjacent validity: polygon outside sector but near wall is valid/adjacent', () => {
    const geometry = rectRoomGeometry({ width: 10, height: 10, sectorId: 1 });

    const polygon = computeRoomPolygon({
      template: 'rectangle',
      center: { x: 5, y: -1.1 },
      size: { width: 4, height: 2 },
      rotationQuarterTurns: 0
    });

    const validity = computeRoomPlacementValidity({
      geometry,
      polygon,
      viewScale: 10, // 10 px per world unit
      snapThresholdPx: 12,
      minSizeWorld: 1
    });

    expect(validity.ok).toBe(true);
    if (validity.ok) {
      expect(validity.kind).toBe('room-valid/adjacent');
    }
  });

  test('adjacent validity: full-wall portal is allowed (endpoint touches ignored)', () => {
    const geometry = rectRoomGeometry({ width: 10, height: 10, sectorId: 1 });

    // A room directly below the bottom wall (y=0) whose top edge spans the full wall x=0..10.
    const polygon = computeRoomPolygon({
      template: 'rectangle',
      center: { x: 5, y: -1 },
      size: { width: 10, height: 2 },
      rotationQuarterTurns: 0
    });

    const validity = computeRoomPlacementValidity({
      geometry,
      polygon,
      viewScale: 10,
      snapThresholdPx: 12,
      minSizeWorld: 1
    });

    if (!validity.ok) {
      throw new Error(`Expected valid adjacent placement, got invalid: ${validity.reason}`);
    }
    expect(validity.kind).toBe('room-valid/adjacent');
    if (validity.kind === 'room-valid/adjacent') {
      expect(validity.targetWallIndex).toBe(0);
    }
  });

  test('adjacent validity: edge within snap threshold is enough even when center is far from wall', () => {
    const geometry = rectRoomGeometry({ width: 10, height: 10, sectorId: 1 });

    // A long hallway just below the bottom wall y=0, with its top edge at y=-0.25.
    // The polygon center is 5.25 world units away from y=0, but the edge is close.
    const polygon = computeRoomPolygon({
      template: 'rectangle',
      center: { x: 5, y: -5.25 },
      // Keep the hall within the x-range of the target wall so it doesn't intersect corner walls when snapped.
      size: { width: 8, height: 10 },
      rotationQuarterTurns: 0
    });

    const nearest = findNearestWallToPolygonWithinThresholdPx({
      geometry,
      polygon,
      viewScale: 100, // 100 px per world unit
      thresholdPx: 30
    });
    expect(nearest).not.toBeNull();

    const validity = computeRoomPlacementValidity({
      geometry,
      polygon,
      viewScale: 100,
      snapThresholdPx: 30,
      minSizeWorld: 1
    });

    expect(validity.ok).toBe(true);
    if (validity.ok) {
      expect(validity.kind).toBe('room-valid/adjacent');
    }
  });

  test('adjacent validity: ignores non-axis-aligned walls when selecting a snap target', () => {
    const geometry: RoomMapGeometry = {
      vertices: [
        // Solid horizontal wall at y=0
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        // A diagonal wall very close to the candidate polygon (but not axis-aligned).
        // Place it near the polygon bottom so snapping the top edge upward does not intersect it.
        { x: 3, y: -2.06 },
        { x: 3.1, y: -2.04 }
      ],
      sectorIds: [],
      walls: [
        { index: 0, v0: 0, v1: 1, frontSectorId: 1, backSectorId: -1 },
        { index: 1, v0: 2, v1: 3, frontSectorId: 1, backSectorId: -1 }
      ]
    };

    const polygon = computeRoomPolygon({
      template: 'rectangle',
      center: { x: 5, y: -1.1 },
      size: { width: 4, height: 2 },
      rotationQuarterTurns: 0
    });

    const validity = computeRoomPlacementValidity({
      geometry,
      polygon,
      viewScale: 100,
      snapThresholdPx: 12,
      minSizeWorld: 1
    });

    if (!validity.ok) {
      throw new Error(`Expected valid adjacent placement, got invalid: ${validity.reason}`);
    }
    expect(validity.kind).toBe('room-valid/adjacent');
    if (validity.kind === 'room-valid/adjacent') {
      expect(validity.targetWallIndex).toBe(0);
    }
  });

  test('adjacent validity: ignores portal walls (backSectorId > -1) when selecting a snap target', () => {
    const geometry: RoomMapGeometry = {
      vertices: [
        // Portal wall below the candidate polygon (closer than the solid wall),
        // so the wall would otherwise be chosen as the snap target.
        { x: 0, y: -2.1 },
        { x: 10, y: -2.1 },
        // Solid wall at y=0.1 (eligible snap target)
        { x: 0, y: 0.1 },
        { x: 10, y: 0.1 }
      ],
      sectorIds: [],
      walls: [
        { index: 0, v0: 0, v1: 1, frontSectorId: 1, backSectorId: 2 },
        { index: 1, v0: 2, v1: 3, frontSectorId: 1, backSectorId: -1 }
      ]
    };

    const polygon = computeRoomPolygon({
      template: 'rectangle',
      center: { x: 5, y: -1.05 },
      size: { width: 4, height: 2 },
      rotationQuarterTurns: 0
    });

    const validity = computeRoomPlacementValidity({
      geometry,
      polygon,
      viewScale: 100,
      snapThresholdPx: 20,
      minSizeWorld: 1
    });

    if (!validity.ok) {
      throw new Error(`Expected valid adjacent placement, got invalid: ${validity.reason}`);
    }
    expect(validity.kind).toBe('room-valid/adjacent');
    if (validity.kind === 'room-valid/adjacent') {
      expect(validity.targetWallIndex).toBe(1);
    }
  });

  test('adjacent portal plan: snaps polygon edge to wall and computes overlap segment', () => {
    const geometry = rectRoomGeometry({ width: 10, height: 10, sectorId: 1 });

    const polygon = computeRoomPolygon({
      template: 'rectangle',
      center: { x: 5, y: -1.1 },
      size: { width: 6, height: 2 },
      rotationQuarterTurns: 0
    });

    const plan = computeAdjacentPortalPlan({ geometry, polygon, targetWallIndex: 0 });
    expect(plan.kind).toBe('room-adjacent-portal-plan');
    if (plan.kind !== 'room-adjacent-portal-plan') {
      throw new Error('Expected room-adjacent-portal-plan');
    }

    expect(plan.orientation).toBe('horizontal');
    expect(plan.targetWallFrontSectorId).toBe(1);
    expect(plan.portalA.y).toBe(0);
    expect(plan.portalB.y).toBe(0);
    expect(plan.portalB.x).toBeGreaterThan(plan.portalA.x);
  });

  test('adjacent portal plan: invalid-wall-index returns a typed error', () => {
    const geometry = rectRoomGeometry({ width: 10, height: 10, sectorId: 1 });

    const polygon = computeRoomPolygon({
      template: 'rectangle',
      center: { x: 5, y: -1.1 },
      size: { width: 4, height: 2 },
      rotationQuarterTurns: 0
    });

    const plan = computeAdjacentPortalPlan({ geometry, polygon, targetWallIndex: 999 });
    expect(plan.kind).toBe('room-adjacent-portal-plan-error');
    if (plan.kind !== 'room-adjacent-portal-plan-error') {
      throw new Error('Expected room-adjacent-portal-plan-error');
    }
    expect(plan.reason).toBe('invalid-wall-index');
  });

  test('adjacent portal plan: wall referencing missing vertices returns invalid-wall-index', () => {
    const geometry: RoomMapGeometry = {
      vertices: [{ x: 0, y: 0 }],
      sectorIds: [],
      walls: [{ index: 0, v0: 0, v1: 999, frontSectorId: 1, backSectorId: -1 }]
    };

    const polygon = computeRoomPolygon({
      template: 'rectangle',
      center: { x: 0, y: 0 },
      size: { width: 4, height: 2 },
      rotationQuarterTurns: 0
    });

    const plan = computeAdjacentPortalPlan({ geometry, polygon, targetWallIndex: 0 });
    expect(plan.kind).toBe('room-adjacent-portal-plan-error');
    if (plan.kind !== 'room-adjacent-portal-plan-error') {
      throw new Error('Expected room-adjacent-portal-plan-error');
    }
    expect(plan.reason).toBe('invalid-wall-index');
  });

  test('adjacent portal plan: non-axis-aligned target wall returns non-collinear', () => {
    const geometry: RoomMapGeometry = {
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 10 }
      ],
      sectorIds: [],
      walls: [{ index: 0, v0: 0, v1: 1, frontSectorId: 1, backSectorId: -1 }]
    };

    const polygon = computeRoomPolygon({
      template: 'rectangle',
      center: { x: 5, y: 5 },
      size: { width: 4, height: 2 },
      rotationQuarterTurns: 0
    });

    const plan = computeAdjacentPortalPlan({ geometry, polygon, targetWallIndex: 0 });
    expect(plan.kind).toBe('room-adjacent-portal-plan-error');
    if (plan.kind !== 'room-adjacent-portal-plan-error') {
      throw new Error('Expected room-adjacent-portal-plan-error');
    }
    expect(plan.reason).toBe('non-collinear');
  });

  test('adjacent portal plan: polygon with no edges returns no-overlap', () => {
    const geometry = rectRoomGeometry({ width: 10, height: 10, sectorId: 1 });

    const plan = computeAdjacentPortalPlan({ geometry, polygon: [], targetWallIndex: 0 });
    expect(plan.kind).toBe('room-adjacent-portal-plan-error');
    if (plan.kind !== 'room-adjacent-portal-plan-error') {
      throw new Error('Expected room-adjacent-portal-plan-error');
    }
    expect(plan.reason).toBe('no-overlap');
  });

  test('adjacent portal plan: zero-length wall returns non-collinear', () => {
    const geometry: RoomMapGeometry = {
      vertices: [
        { x: 0, y: 0 },
        { x: 0, y: 0 }
      ],
      sectorIds: [],
      walls: [{ index: 0, v0: 0, v1: 1, frontSectorId: 1, backSectorId: -1 }]
    };

    const polygon = computeRoomPolygon({
      template: 'rectangle',
      center: { x: 5, y: -1 },
      size: { width: 4, height: 2 },
      rotationQuarterTurns: 0
    });

    const plan = computeAdjacentPortalPlan({ geometry, polygon, targetWallIndex: 0 });
    expect(plan.kind).toBe('room-adjacent-portal-plan-error');
    if (plan.kind !== 'room-adjacent-portal-plan-error') {
      throw new Error('Expected room-adjacent-portal-plan-error');
    }
    expect(plan.reason).toBe('non-collinear');
  });

  test('adjacent portal plan: no sufficiently parallel edge returns non-collinear', () => {
    const geometry: RoomMapGeometry = {
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 }
      ],
      sectorIds: [],
      walls: [{ index: 0, v0: 0, v1: 1, frontSectorId: 1, backSectorId: -1 }]
    };

    // A rotated square (diamond) has only diagonal edges (45°), so it has no edges sufficiently parallel to a horizontal wall.
    const polygon = [
      { x: 0, y: 1 },
      { x: 1, y: 0 },
      { x: 0, y: -1 },
      { x: -1, y: 0 }
    ];

    const plan = computeAdjacentPortalPlan({ geometry, polygon, targetWallIndex: 0 });
    expect(plan.kind).toBe('room-adjacent-portal-plan-error');
    if (plan.kind !== 'room-adjacent-portal-plan-error') {
      throw new Error('Expected room-adjacent-portal-plan-error');
    }
    expect(plan.reason).toBe('non-collinear');
  });

  test('adjacent portal plan: ignores degenerate polygon edges when selecting a snap edge', () => {
    const geometry = rectRoomGeometry({ width: 10, height: 10, sectorId: 1 });

    const polygon = computeRoomPolygon({
      template: 'rectangle',
      center: { x: 5, y: -1.1 },
      size: { width: 6, height: 2 },
      rotationQuarterTurns: 0
    });

    const polygonWithDegenerateEdge = [polygon[0]!, polygon[1]!, polygon[1]!, polygon[2]!, polygon[3]!];

    const plan = computeAdjacentPortalPlan({ geometry, polygon: polygonWithDegenerateEdge, targetWallIndex: 0 });
    expect(plan.kind).toBe('room-adjacent-portal-plan');
  });

  test('adjacent portal plan: parallel edge with no axis overlap returns non-collinear', () => {
    const geometry = rectRoomGeometry({ width: 10, height: 10, sectorId: 1 });

    // Polygon edges are horizontal (parallel), but far away in X so they do not overlap the wall interval.
    const polygon = computeRoomPolygon({
      template: 'rectangle',
      center: { x: 100, y: -1 },
      size: { width: 4, height: 2 },
      rotationQuarterTurns: 0
    });

    const plan = computeAdjacentPortalPlan({ geometry, polygon, targetWallIndex: 0 });
    expect(plan.kind).toBe('room-adjacent-portal-plan-error');
    if (plan.kind !== 'room-adjacent-portal-plan-error') {
      throw new Error('Expected room-adjacent-portal-plan-error');
    }
    expect(plan.reason).toBe('non-collinear');
  });

  test('adjacent portal plan: endpoint-only overlap is treated as no usable overlap (non-collinear)', () => {
    const geometry = rectRoomGeometry({ width: 10, height: 10, sectorId: 1 });

    // Edge touches the wall interval at exactly one endpoint (x=10), yielding zero overlap length.
    const polygon = [
      { x: 10, y: 0 },
      { x: 14, y: 0 },
      { x: 14, y: -2 },
      { x: 10, y: -2 }
    ];

    const plan = computeAdjacentPortalPlan({ geometry, polygon, targetWallIndex: 0 });
    expect(plan.kind).toBe('room-adjacent-portal-plan-error');
    if (plan.kind !== 'room-adjacent-portal-plan-error') {
      throw new Error('Expected room-adjacent-portal-plan-error');
    }
    expect(plan.reason).toBe('non-collinear');
  });

  test('adjacent portal plan: prefers the closer overlapping parallel edge when multiple exist', () => {
    const geometry = rectRoomGeometry({ width: 10, height: 10, sectorId: 1 });

    // Two horizontal edges overlap the wall interval: y=3 (farther) and y=1 (closer).
    // Start the polygon at the farther edge so the planner must replace best with the closer edge.
    const polygon = [
      { x: 2, y: 3 },
      { x: 8, y: 3 },
      { x: 8, y: 1 },
      { x: 2, y: 1 }
    ];

    const plan = computeAdjacentPortalPlan({ geometry, polygon, targetWallIndex: 0 });
    expect(plan.kind).toBe('room-adjacent-portal-plan');
    if (plan.kind !== 'room-adjacent-portal-plan') {
      throw new Error('Expected room-adjacent-portal-plan');
    }

    expect(Math.min(...plan.snappedPolygon.map((p) => p.y))).toBe(0);
  });

  test('adjacent portal plan: when distances tie, prefers the edge with larger overlap', () => {
    const geometry = rectRoomGeometry({ width: 10, height: 10, sectorId: 1 });

    // Two horizontal edges at y=1 (same perpendicular distance), but with different overlap lengths.
    // The longer overlap should win.
    const polygon = [
      { x: 8, y: 1 },
      { x: 10, y: 1 },
      { x: 0, y: 1 },
      { x: 0, y: 3 },
      { x: 8, y: 3 }
    ];

    const plan = computeAdjacentPortalPlan({ geometry, polygon, targetWallIndex: 0 });
    expect(plan.kind).toBe('room-adjacent-portal-plan');
    if (plan.kind !== 'room-adjacent-portal-plan') {
      throw new Error('Expected room-adjacent-portal-plan');
    }

    expect(plan.portalA.x).toBeCloseTo(0);
    expect(plan.portalB.x).toBeCloseTo(10);
  });

  test('adjacent validity: near a non-axis-aligned wall is rejected as non-collinear', () => {
    const geometry: RoomMapGeometry = {
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 }
      ],
      sectorIds: [],
      walls: [
        // Diagonal wall
        { index: 0, v0: 0, v1: 2, frontSectorId: 1, backSectorId: -1 }
      ]
    };

    const polygon = computeRoomPolygon({
      template: 'rectangle',
      center: { x: 1, y: 2.6 },
      size: { width: 2, height: 1 },
      rotationQuarterTurns: 0
    });

    const validity = computeRoomPlacementValidity({
      geometry,
      polygon,
      viewScale: 10,
      snapThresholdPx: 12,
      minSizeWorld: 1
    });

    expect(validity.ok).toBe(false);
    if (!validity.ok) {
      // Adjacent joins only consider axis-aligned walls as snap targets.
      expect(validity.reason).toBe('no-snap-target');
    }
  });

  test('no-snap-target validity: polygon outside sector and far from walls is invalid', () => {
    const geometry = rectRoomGeometry({ width: 10, height: 10, sectorId: 1 });

    const polygon = computeRoomPolygon({
      template: 'rectangle',
      center: { x: 50, y: 50 },
      size: { width: 4, height: 4 },
      rotationQuarterTurns: 0
    });

    const validity = computeRoomPlacementValidity({
      geometry,
      polygon,
      viewScale: 10,
      snapThresholdPx: 12,
      minSizeWorld: 1
    });

    expect(validity.ok).toBe(false);
    if (!validity.ok) {
      expect(validity.reason).toBe('no-snap-target');
    }
  });

  test('seed validity: empty map allows creating the first room', () => {
    const geometry: RoomMapGeometry = {
      vertices: [],
      sectorIds: [],
      walls: []
    };

    const polygon = computeRoomPolygon({
      template: 'rectangle',
      center: { x: 5, y: 5 },
      size: { width: 4, height: 4 },
      rotationQuarterTurns: 0
    });

    const validity = computeRoomPlacementValidity({
      geometry,
      polygon,
      viewScale: 10,
      snapThresholdPx: 12,
      minSizeWorld: 1
    });

    expect(validity.ok).toBe(true);
    if (validity.ok) {
      expect(validity.kind).toBe('room-valid/seed');
    }
  });

  test('invalid-size validity: too-small polygon is rejected', () => {
    const geometry = rectRoomGeometry({ width: 10, height: 10, sectorId: 1 });

    const polygon = computeRoomPolygon({
      template: 'rectangle',
      center: { x: 5, y: 5 },
      size: { width: 0.5, height: 0.5 },
      rotationQuarterTurns: 0
    });

    const validity = computeRoomPlacementValidity({
      geometry,
      polygon,
      viewScale: 10,
      snapThresholdPx: 12,
      minSizeWorld: 1
    });

    expect(validity.ok).toBe(false);
    if (!validity.ok) {
      expect(validity.reason).toBe('invalid-size');
    }
  });

  test('nested validity: polygon inside sector but crossing an internal wall is rejected', () => {
    const geometry: RoomMapGeometry = {
      vertices: [
        // Boundary square
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
        // Internal wall endpoints (share y with boundary but are distinct vertices)
        { x: 5, y: 0 },
        { x: 5, y: 10 }
      ],
      sectorIds: [1],
      walls: [
        { index: 0, v0: 0, v1: 1, frontSectorId: 1, backSectorId: -1 },
        { index: 1, v0: 1, v1: 2, frontSectorId: 1, backSectorId: -1 },
        { index: 2, v0: 2, v1: 3, frontSectorId: 1, backSectorId: -1 },
        { index: 3, v0: 3, v1: 0, frontSectorId: 1, backSectorId: -1 },
        // Internal wall splitting the sector
        // Note: this wall is intentionally NOT part of sector 1's boundary (frontSectorId != 1)
        // so point-in-sector containment remains well-defined while intersection checks still see it.
        { index: 4, v0: 4, v1: 5, frontSectorId: 2, backSectorId: -1 }
      ]
    };

    const polygon = computeRoomPolygon({
      template: 'rectangle',
      center: { x: 5, y: 5 },
      size: { width: 4, height: 4 },
      rotationQuarterTurns: 0
    });

    const validity = computeRoomPlacementValidity({
      geometry,
      polygon,
      viewScale: 10,
      snapThresholdPx: 12,
      minSizeWorld: 1
    });

    expect(validity.ok).toBe(false);
    if (!validity.ok) {
      expect(validity.reason).toBe('intersects-walls');
    }
  });

  test('adjacent validity: polygon crossing the snap target wall line is rejected (ambiguous snap)', () => {
    // Use a geometry with a single eligible wall so we deterministically exercise
    // the ambiguous-crossing check in computeRoomPlacementValidity.
    const geometry: RoomMapGeometry = {
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 }
      ],
      sectorIds: [],
      walls: [{ index: 0, v0: 0, v1: 1, frontSectorId: 1, backSectorId: -1 }]
    };

    // Center on the bottom wall (y=0) so the polygon crosses the wall line.
    // Both horizontal edges are equally close to the wall, making snapping ambiguous.
    const polygon = computeRoomPolygon({
      template: 'rectangle',
      center: { x: 5, y: 0 },
      size: { width: 4, height: 4 },
      rotationQuarterTurns: 0
    });

    const validity = computeRoomPlacementValidity({
      geometry,
      polygon,
      viewScale: 10,
      snapThresholdPx: 30,
      minSizeWorld: 1
    });

    expect(validity.ok).toBe(false);
    if (!validity.ok) {
      expect(validity.reason).toBe('intersects-walls');
    }
  });

  test('adjacent validity: vertical wall line crossing is rejected as ambiguous (covers vertical branch)', () => {
    const geometry: RoomMapGeometry = {
      vertices: [
        { x: 0, y: 0 },
        { x: 0, y: 10 }
      ],
      sectorIds: [],
      walls: [{ index: 0, v0: 0, v1: 1, frontSectorId: 1, backSectorId: -1 }]
    };

    // Center on the wall (x=0) so the polygon crosses the wall line.
    // Both vertical edges are equally close to the wall, making snapping ambiguous.
    const polygon = computeRoomPolygon({
      template: 'rectangle',
      center: { x: 0, y: 5 },
      size: { width: 4, height: 4 },
      rotationQuarterTurns: 0
    });

    const validity = computeRoomPlacementValidity({
      geometry,
      polygon,
      viewScale: 10,
      snapThresholdPx: 30,
      minSizeWorld: 1
    });

    expect(validity.ok).toBe(false);
    if (!validity.ok) {
      expect(validity.reason).toBe('intersects-walls');
    }
  });

  test('no-snap-target validity: polygon with <2 points cannot snap to a wall', () => {
    const geometry: RoomMapGeometry = {
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 }
      ],
      sectorIds: [],
      walls: [{ index: 0, v0: 0, v1: 1, frontSectorId: 1, backSectorId: -1 }]
    };

    const polygon = [{ x: 5, y: -1 }];

    const validity = computeRoomPlacementValidity({
      geometry,
      polygon,
      viewScale: 10,
      snapThresholdPx: 30,
      minSizeWorld: 0
    });

    expect(validity.ok).toBe(false);
    if (!validity.ok) {
      expect(validity.reason).toBe('no-snap-target');
    }
  });

  test('no-snap-target validity: walls referencing missing vertices are ignored', () => {
    const geometry: RoomMapGeometry = {
      vertices: [{ x: 0, y: 0 }],
      sectorIds: [],
      walls: [
        // v1 is out of range, so the wall is ignored by snap-target selection.
        { index: 0, v0: 0, v1: 1, frontSectorId: 1, backSectorId: -1 }
      ]
    };

    const polygon = computeRoomPolygon({
      template: 'rectangle',
      center: { x: 5, y: -1 },
      size: { width: 4, height: 2 },
      rotationQuarterTurns: 0
    });

    const validity = computeRoomPlacementValidity({
      geometry,
      polygon,
      viewScale: 10,
      snapThresholdPx: 30,
      minSizeWorld: 1
    });

    expect(validity.ok).toBe(false);
    if (!validity.ok) {
      expect(validity.reason).toBe('no-snap-target');
    }
  });

  test('adjacent validity: ambiguous-crossing loop ignores non-overlapping and zero-overlap edges', () => {
    const geometry: RoomMapGeometry = {
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 }
      ],
      sectorIds: [],
      walls: [{ index: 0, v0: 0, v1: 1, frontSectorId: 1, backSectorId: -1 }]
    };

    // This polygon crosses y=0 and includes:
    // - a horizontal edge fully left of the wall interval -> overlap === null
    // - a horizontal edge that only touches at x=0 -> overlapLen === 0
    // - two horizontal edges that overlap positively at equal distance -> ambiguous snap
    const polygon = [
      { x: -20, y: -2 },
      { x: -10, y: -2 },
      { x: -10, y: 2 },
      { x: 0, y: 2 },
      { x: 10, y: 2 },
      { x: 10, y: -2 }
    ];

    const validity = computeRoomPlacementValidity({
      geometry,
      polygon,
      viewScale: 10,
      snapThresholdPx: 30,
      minSizeWorld: 1
    });

    expect(validity.ok).toBe(false);
    if (!validity.ok) {
      expect(validity.reason).toBe('intersects-walls');
    }
  });

  test('adjacent validity: malformed wall.index triggers portal-plan error mapping to ambiguous', () => {
    const geometry: RoomMapGeometry = {
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 }
      ],
      sectorIds: [],
      // wall.index intentionally does not match its array index
      walls: [{ index: 10, v0: 0, v1: 1, frontSectorId: 1, backSectorId: -1 }]
    };

    const polygon = computeRoomPolygon({
      template: 'rectangle',
      center: { x: 5, y: -1 },
      size: { width: 4, height: 2 },
      rotationQuarterTurns: 0
    });

    const validity = computeRoomPlacementValidity({
      geometry,
      polygon,
      viewScale: 10,
      snapThresholdPx: 30,
      minSizeWorld: 1
    });

    expect(validity.ok).toBe(false);
    if (!validity.ok) {
      expect(validity.reason).toBe('ambiguous');
    }
  });

  test('adjacent validity: portal-plan non-collinear error maps to non-collinear (malformed wall.index)', () => {
    const geometry: RoomMapGeometry = {
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 }
      ],
      sectorIds: [],
      // The eligible axis-aligned wall has index=1, but walls[1] is diagonal.
      walls: [
        { index: 1, v0: 0, v1: 1, frontSectorId: 1, backSectorId: -1 },
        { index: 0, v0: 0, v1: 2, frontSectorId: 1, backSectorId: -1 }
      ]
    };

    const polygon = computeRoomPolygon({
      template: 'rectangle',
      center: { x: 5, y: -1 },
      size: { width: 4, height: 2 },
      rotationQuarterTurns: 0
    });

    const validity = computeRoomPlacementValidity({
      geometry,
      polygon,
      viewScale: 10,
      snapThresholdPx: 30,
      minSizeWorld: 1
    });

    expect(validity.ok).toBe(false);
    if (!validity.ok) {
      expect(validity.reason).toBe('non-collinear');
    }
  });

  test('adjacent validity: snapped polygon intersecting a different wall is rejected', () => {
    const base = rectRoomGeometry({ width: 10, height: 10, sectorId: 1 });
    const geometry: RoomMapGeometry = {
      ...base,
      vertices: [...base.vertices, { x: 5, y: -4 }, { x: 5, y: 2 }],
      walls: [
        ...base.walls,
        // A vertical wall close enough to intersect the snapped polygon,
        // but far enough away (in X) to not be chosen as the snap target.
        { index: 4, v0: 4, v1: 5, frontSectorId: 2, backSectorId: -1 }
      ]
    };

    const polygon = computeRoomPolygon({
      template: 'rectangle',
      center: { x: 5, y: -2.1 },
      size: { width: 4, height: 4 },
      rotationQuarterTurns: 0
    });

    const validity = computeRoomPlacementValidity({
      geometry,
      polygon,
      viewScale: 10,
      snapThresholdPx: 12,
      minSizeWorld: 1
    });

    expect(validity.ok).toBe(false);
    if (!validity.ok) {
      expect(validity.reason).toBe('intersects-walls');
    }
  });

    test('adjacent validity: square can be attached to rectangle room', () => {
      const geometry = rectRoomGeometry({ width: 10, height: 10, sectorId: 1 });

      const polygon = computeRoomPolygon({
        template: 'square',
        center: { x: 5, y: -1.1 },
        size: { width: 4, height: 4 },
        rotationQuarterTurns: 0
      });

      const validity = computeRoomPlacementValidity({
        geometry,
        polygon,
        viewScale: 10,
        snapThresholdPx: 12,
        minSizeWorld: 1
      });

      expect(validity.ok).toBe(true);
      if (validity.ok) {
        expect(validity.kind).toBe('room-valid/adjacent');
      }
    });

    test('adjacent validity: triangle can be attached to rectangle room', () => {
      const geometry = rectRoomGeometry({ width: 10, height: 10, sectorId: 1 });

      const polygon = computeRoomPolygon({
        template: 'triangle',
        center: { x: 5, y: -1.1 },
        size: { width: 4, height: 4 },
        rotationQuarterTurns: 0
      });

      const validity = computeRoomPlacementValidity({
        geometry,
        polygon,
        viewScale: 10,
        snapThresholdPx: 12,
        minSizeWorld: 1
      });

      expect(validity.ok).toBe(true);
      if (validity.ok) {
        expect(validity.kind).toBe('room-valid/adjacent');
      }
    });

    test('adjacent validity: larger square can attach to a narrow hall end wall (T-junction corner touches allowed)', () => {
      // A narrow hall: width 4 (x=0..4), height 2 (y=0..2). We will attach a square
      // to the hall end wall at x=4 where the square is taller than the wall.
      const geometry: RoomMapGeometry = {
        vertices: [
          { x: 0, y: 0 },
          { x: 4, y: 0 },
          { x: 4, y: 2 },
          { x: 0, y: 2 }
        ],
        sectorIds: [],
        walls: [
          { index: 0, v0: 0, v1: 1, frontSectorId: 1, backSectorId: -1 },
          { index: 1, v0: 1, v1: 2, frontSectorId: 1, backSectorId: -1 },
          { index: 2, v0: 2, v1: 3, frontSectorId: 1, backSectorId: -1 },
          { index: 3, v0: 3, v1: 0, frontSectorId: 1, backSectorId: -1 }
        ]
      };

      // Square to the right of the hall end wall. Left edge is within snap threshold (0.1 world units).
      // Height 4 > wall height 2, so hall corner vertices touch the interior of the square's left edge.
      const polygon = computeRoomPolygon({
        template: 'square',
        center: { x: 6.1, y: 1 },
        size: { width: 4, height: 4 },
        rotationQuarterTurns: 0
      });

      const validity = computeRoomPlacementValidity({
        geometry,
        polygon,
        viewScale: 10,
        snapThresholdPx: 12,
        minSizeWorld: 1
      });

      expect(validity.ok).toBe(true);
      if (validity.ok) {
        expect(validity.kind).toBe('room-valid/adjacent');
        if (validity.kind === 'room-valid/adjacent') {
          expect(validity.targetWallIndex).toBe(1);
        }
      }
    });
});
