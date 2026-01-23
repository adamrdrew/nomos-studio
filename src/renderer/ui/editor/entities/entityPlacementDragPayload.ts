export const ENTITY_PLACEMENT_DRAG_MIME = 'application/x-nomos-entity-placement' as const;

export type EntityPlacementDragPayload = Readonly<{
  defName: string;
}>;

function normalizeDefName(defName: string): string {
  return defName.trim();
}

export function encodeEntityPlacementDragPayload(payload: EntityPlacementDragPayload): string {
  return JSON.stringify({ defName: normalizeDefName(payload.defName) });
}

export function tryDecodeEntityPlacementDragPayload(text: string): EntityPlacementDragPayload | null {
  if (text.trim().length === 0) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return null;
  }

  const defName = (parsed as Record<string, unknown>)['defName'];
  if (typeof defName !== 'string') {
    return null;
  }

  const normalized = normalizeDefName(defName);
  if (normalized.length === 0) {
    return null;
  }

  return { defName: normalized };
}

export function writeEntityPlacementDragPayload(
  dataTransfer: Readonly<Pick<DataTransfer, 'setData'>>,
  payload: EntityPlacementDragPayload
): void {
  dataTransfer.setData(ENTITY_PLACEMENT_DRAG_MIME, encodeEntityPlacementDragPayload(payload));
}

export function tryReadEntityPlacementDragPayload(
  dataTransfer: Readonly<Pick<DataTransfer, 'getData'>>
): EntityPlacementDragPayload | null {
  const text = dataTransfer.getData(ENTITY_PLACEMENT_DRAG_MIME);
  return tryDecodeEntityPlacementDragPayload(text);
}
