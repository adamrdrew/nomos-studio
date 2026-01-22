import type { MapEditTargetRef } from '../../../../shared/ipc/nomosIpc';

import type { MapSelection } from '../map/mapSelection';

export type ToggleSectorIdPicker = Readonly<{
  wallIndex: number;
  wallTarget: MapEditTargetRef;
}>;

export function reduceToggleSectorIdPicker(
  picker: ToggleSectorIdPicker | null,
  selection: MapSelection | null
): Readonly<{
  nextPicker: ToggleSectorIdPicker | null;
  pickedSectorId: number | null;
  restoreSelection: MapSelection | null;
}> {
  if (picker === null) {
    return { nextPicker: null, pickedSectorId: null, restoreSelection: null };
  }

  if (selection !== null && selection.kind === 'sector') {
    return {
      nextPicker: null,
      pickedSectorId: selection.id,
      restoreSelection: { kind: 'wall', index: picker.wallIndex }
    };
  }

  return { nextPicker: picker, pickedSectorId: null, restoreSelection: null };
}

export function cancelToggleSectorIdPicker(
  picker: ToggleSectorIdPicker | null
): Readonly<{ nextPicker: null; restoreSelection: MapSelection | null }> {
  if (picker === null) {
    return { nextPicker: null, restoreSelection: null };
  }

  return { nextPicker: null, restoreSelection: { kind: 'wall', index: picker.wallIndex } };
}
