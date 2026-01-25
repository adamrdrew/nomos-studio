export const TARGET_MINOR_GRID_SCREEN_SPACING_PX = 24;

export const MINOR_GRID_WORLD_SPACING_CANDIDATES = [1, 2, 4, 8, 16, 32, 64, 128, 256] as const;

export const MAJOR_GRID_MINOR_CELL_COUNT = 5;

export function chooseMinorGridWorldSpacing(viewScale: number): number {
  const safeScale = Math.max(0.0001, viewScale);
  const desiredWorldSpacing = TARGET_MINOR_GRID_SCREEN_SPACING_PX / safeScale;

  let best: number = MINOR_GRID_WORLD_SPACING_CANDIDATES[0];
  let bestError = Number.POSITIVE_INFINITY;

  for (const candidate of MINOR_GRID_WORLD_SPACING_CANDIDATES) {
    const error = Math.abs(candidate - desiredWorldSpacing);
    if (error < bestError) {
      bestError = error;
      best = candidate;
    }
  }

  return best;
}
