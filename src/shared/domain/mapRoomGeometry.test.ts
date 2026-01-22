import {
  computeAdjacentPortalPlan,
  computeRoomPlacementValidity,
  computeRoomPolygon,
  doesPolygonIntersectWalls,
  findNearestWallToPolygonWithinThresholdPx
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
});
