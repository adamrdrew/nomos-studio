# Steps — Phase 0032 SKY support for sector ceiling textures

## S001 — Locate current sector ceiling texture editing UI
- **Intent:** Make changes surgically within the existing inspector patterns.
- **Work:**
  - Identify where the sector editor renders `ceil_tex` (currently in the renderer inspector properties editor).
  - Identify how commits are performed (expected: `window.nomos.map.edit(...)` with `map-edit/update-fields`).
- **Done when:** The exact file/component and current behavior are documented and referenced by subsequent steps.

## S002 — Define SKY detection helper
- **Intent:** Ensure consistent, case-insensitive interpretation of SKY ceilings.
- **Work:**
  - Add a small helper (renderer-local) that returns `true` when `ceil_tex` is `SKY` ignoring whitespace/case.
  - Use it to derive the UI state from the current selection.
- **Done when:** The sector editor can reliably infer "Show Skybox" state from the model.

## S003 — Add “Show Skybox” control to Sector Object Properties
- **Intent:** Provide an explicit authoring affordance without polluting texture dropdown options.
- **Work:**
  - Add a new **Show Skybox** control (radio-style on/off) in the sector editor near the existing floor/ceil texture controls.
  - Ensure default behavior is Off when `ceil_tex` is not SKY.
  - If sector is SKY, show On.
- **Done when:** The control renders correctly and reflects the current sector state.

## S004 — Implement toggle-on behavior (set `ceil_tex` to "SKY")
- **Intent:** Ensure skybox authoring is a single, explicit edit.
- **Work:**
  - When toggled On, commit `ceil_tex: "SKY"` using the existing update-fields edit path.
  - Ensure the local UI state stays in sync with snapshot/selection updates (no stale local state).
- **Done when:** Toggling On results in persisted `ceil_tex === "SKY"` and UI updates accordingly.

## S005 — Implement toggle-off behavior without introducing a dropdown SKY option
- **Intent:** Keep the dropdown pure (textures only) while enabling users to leave SKY mode.
- **Work:**
  - Determine the dropdown ordering rule for texture options (must match the existing dropdown).
  - When toggled Off and the persisted `ceil_tex` is SKY, immediately commit `ceil_tex` to the **first** available texture option (same string value the dropdown uses).
  - If there are **no** texture options, block toggling Off and show inline feedback (e.g., “At least one texture is required to disable Skybox.”).
  - Confirm that after a successful Off-toggle, the ceiling dropdown can render with a valid option/value.
- **Done when:** Users can toggle Off from SKY without dropdown corruption and without adding SKY to options.

## S006 — Conditionally render the ceiling texture dropdown
- **Intent:** Hide irrelevant controls and avoid knock-on effects from synthetic dropdown entries.
- **Work:**
  - When Show Skybox is On, do not render the ceiling texture dropdown.
  - When Off, render the existing ceiling texture dropdown unchanged (except for any necessary validity handling from S005).
- **Done when:** UI matches requirements: SKY mode hides dropdown; non-SKY mode shows dropdown.

## S007 — Confirm/implement textured ceiling SKY resolution via `map.sky`
- **Intent:** Ensure textured ceiling rendering does not break when `ceil_tex` is SKY.
- **Work:**
  - Inspect the textured sector fill pipeline to find where ceiling textures are resolved/loaded.
  - Ensure that when sector surface is **ceiling** and `sector.ceil_tex` is SKY (case-insensitive), the renderer resolves the texture to `Images/Sky/<map.sky>`.
  - Ensure missing/empty/unloadable `map.sky` fails gracefully (skip fill; no crash).
  - Keep behavior case-insensitive on `ceil_tex` and whitespace-tolerant.
- **Done when:** SKY ceilings render using `map.sky` and do not attempt to load `Images/Textures/SKY`.

## S008 — Add/adjust unit tests for SKY (UI + main + rendering helpers) (L04)
- **Intent:** Prevent regressions across authoring and rendering paths.
- **Work:**
  - Add or update unit tests in the main maps command/edit layer to cover:
    - Setting a sector’s `ceil_tex` to `"SKY"` using `map-edit/update-fields`.
    - Setting it back to a non-SKY value (any valid texture string) using `map-edit/update-fields`.
  - Add unit tests for any extracted renderer helper responsible for resolving ceiling texture keys so SKY branching is covered deterministically:
    - `ceil_tex` SKY + `map.sky` set => `Images/Sky/<map.sky>`
    - `ceil_tex` SKY + `map.sky` missing => no fill / null result
    - `ceil_tex` non-SKY => `Images/Textures/<ceil_tex>`
- **Done when:** Tests explicitly cover SKY branches in the relevant public/branchy code paths.

## S009 — Update documentation (L09)
- **Intent:** Keep subsystem docs aligned with the inspector’s behavior.
- **Work:**
  - Update `docs/renderer-ui-system.md` in the Inspector → Sector fields section to describe:
    - Show Skybox control
    - SKY sets `ceil_tex = "SKY"`
    - Dropdown hidden in SKY mode
  - Ensure the renderer textured ceiling documentation explicitly states SKY ceilings resolve via `map.sky` under `Images/Sky/`.
- **Done when:** Docs accurately describe the feature and match implemented behavior.

## S010 — Verification pass
- **Intent:** Ensure quality gates and core workflows remain intact.
- **Work:**
  - Run lint/typecheck/tests.
  - Manual smoke test:
    - Select a sector → toggle Show Skybox On → confirm `ceil_tex` becomes SKY and dropdown hides.
    - Toggle Off → dropdown shows and `ceil_tex` changes to the first dropdown entry.
    - If textures are empty, confirm Off-toggle is blocked with clear UI feedback.
    - In textured mode with sector surface set to ceiling:
      - SKY ceilings render using `Images/Sky/<map.sky>`.
      - If `map.sky` is missing/empty or unloadable, SKY ceilings do not crash the renderer.
- **Done when:** All checks are green and behavior matches acceptance criteria.
