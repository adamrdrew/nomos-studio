import type { MapEditorInteractionMode } from '../MapEditorCanvas';
import type { IconName } from '@blueprintjs/icons';

export type MapEditorToolIconId = IconName | 'custom/razor';

export type MapEditorToolId = 'select' | 'move' | 'door' | 'room' | 'zoom' | 'pan' | 'light' | 'split';

export type MapEditorToolbarCommandId =
  | 'select/delete'
  | 'select/clone'
  | 'room/rectangle'
  | 'room/square'
  | 'room/triangle'
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
  icon: MapEditorToolIconId;
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
    id: 'door',
    label: 'Door',
    tooltip: 'Door',
    icon: 'log-in',
    interactionMode: 'door',
    toolbarCommands: []
  },
  {
    id: 'room',
    label: 'Room',
    tooltip: 'Room',
    // Blueprint: pencil/edit icon
    icon: 'edit',
    interactionMode: 'room',
    toolbarCommands: [
      { id: 'room/rectangle', label: 'Rectangle' },
      { id: 'room/square', label: 'Square' },
      { id: 'room/triangle', label: 'Triangle' }
    ]
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
  },
  {
    id: 'light',
    label: 'Light',
    tooltip: 'Light',
    icon: 'lightbulb',
    interactionMode: 'light-create',
    toolbarCommands: []
  },
  {
    id: 'split',
    label: 'Split',
    tooltip: 'Split wall',
    icon: 'custom/razor',
    interactionMode: 'split',
    toolbarCommands: []
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
