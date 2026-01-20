# Phase 0014 Review — Entity Properties + Textured Rendering Fixes

## Summary
Implements entity definition dropdown correctness/labeling fixes in the Properties inspector and improves textured map rendering defaults and texture tiling scale.

## Verified
Automated:
- `npm test` PASS (26/26 suites)
- `npm run typecheck` PASS
- `npm run lint` PASS (eslint prints a TypeScript version support warning but exits clean)

Code-level:
- Entity defs dropdown now parses entities manifest shape `{ files: string[] }` and includes current value as an option.
- Default `mapRenderMode` is now `textured` in main store and renderer store.
- Textured floors/walls tile using a repeating `CanvasPattern` with `setTransform()` so texture scale is consistent in world space.
- Texture loading remains renderer-safe (preload-mediated bytes) and resource-safe (bounded cache + object URL revocation).

Manual smoke (interactive Electron):
- Selecting an enemy entity shows **Entity** with the correct current value (no longer always `(none)`).
- Changing **Entity** commits via `map-edit/update-fields`, is undoable/redoable, and persists after save/reopen.
- Opening a map defaults to `textured` render mode.
- Textured mode tiles textures at a legible scale (no single huge stretched texture).
- Zooming in/out in textured mode does not cause wall outlines to balloon into black blobs.

## Issues
None found.

Notes:
- `MapEditorCanvas` uses Konva's internal native canvas context (`context._context`) within `Shape.sceneFunc` to apply a `CanvasPattern` transform. This is intentional to achieve correct tiling behavior that Konva's pattern props did not reliably produce in this app.

## Required follow-ups
- None.

## Decision
GREEN — Phase complete.

