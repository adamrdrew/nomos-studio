import type { MapEditorInteractionMode } from '../MapEditorCanvas';
import type { IconName } from '@blueprintjs/icons';

export type MapEditorToolId = 'select' | 'move' | 'zoom' | 'pan';

export type MapEditorToolbarCommandId =
  | 'select/delete'
  | 'select/clone'
  | 'zoom/in'
  | 'zoom/out'
  | 'zoom/default'
  | 'pan/center';

export type MapEditorToolbarCommandDefinition = Readonly<{
  id: MapEditorToolbarCommandId;
  label: string;
  icon?: IconName;
}>;

export type MapEditorToolDefinition = Readonly<{
  id: MapEditorToolId;
  label: string;
  tooltip: string;
  icon: IconName;
  interactionMode: MapEditorInteractionMode;
  toolbarCommands: readonly MapEditorToolbarCommandDefinition[];
}>;

export const MAP_EDITOR_TOOLS: readonly MapEditorToolDefinition[] = [
  {
    id: 'select',
    label: 'Select',
    tooltip: 'Select',
    icon: 'select',
    interactionMode: 'select',
    toolbarCommands: [
      { id: 'select/delete', label: 'Delete' },
      { id: 'select/clone', label: 'Clone' }
    ]
  },
  {
    id: 'move',
    label: 'Move',
    tooltip: 'Move',
    icon: 'move',
    interactionMode: 'move',
    toolbarCommands: []
  },
  {
    id: 'zoom',
    label: 'Zoom',
    tooltip: 'Zoom',
    icon: 'zoom-in',
    interactionMode: 'zoom',
    toolbarCommands: [
      { id: 'zoom/in', label: 'Zoom In' },
      { id: 'zoom/out', label: 'Zoom Out' },
      { id: 'zoom/default', label: 'Default Zoom' }
    ]
  },
  {
    id: 'pan',
    label: 'Pan',
    tooltip: 'Pan',
    icon: 'hand',
    interactionMode: 'pan',
    toolbarCommands: [{ id: 'pan/center', label: 'Center' }]
  }
] as const;

export function getDefaultMapEditorToolId(): MapEditorToolId {
  return 'select';
}

export function getMapEditorTool(toolId: MapEditorToolId): MapEditorToolDefinition {
  const tool = MAP_EDITOR_TOOLS.find((candidate) => candidate.id === toolId);
  if (tool === undefined) {
    // This is an internal consistency error: MapEditorToolId is a closed union.
    throw new Error(`Unknown MapEditorToolId: ${toolId}`);
  }
  return tool;
}
