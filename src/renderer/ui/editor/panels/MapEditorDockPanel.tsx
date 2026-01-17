import React from 'react';
import { Button, Intent, Position, Toaster, Tooltip } from '@blueprintjs/core';
import { Colors } from '@blueprintjs/core';

import { MapEditorCanvas } from '../MapEditorCanvas';
import type { MapEditorViewportApi } from '../MapEditorCanvas';
import { getDefaultMapEditorToolId, getMapEditorTool, MAP_EDITOR_TOOLS } from '../tools/mapEditorTools';
import type { MapEditorToolDefinition, MapEditorToolId, MapEditorToolbarCommandId } from '../tools/mapEditorTools';
import { useNomosStore } from '../../../store/nomosStore';
import type { MapSelection } from '../map/mapSelection';
import type { MapEditTargetRef } from '../../../../shared/ipc/nomosIpc';

const toaster = Toaster.create({ position: Position.TOP });

function MapEditorToolBar(props: {
  activeTool: MapEditorToolDefinition;
  onCommand: (commandId: MapEditorToolbarCommandId) => void;
  isCommandEnabled: (commandId: MapEditorToolbarCommandId) => boolean;
}): JSX.Element {
  return (
    <div
      style={{
        flex: '0 0 auto',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: 8,
        minHeight: 46,
        background: Colors.DARK_GRAY3,
        boxSizing: 'border-box'
      }}
    >
      {props.activeTool.toolbarCommands.map((command) => (
        <Button
          key={command.id}
          minimal={true}
          text={command.label}
          disabled={!props.isCommandEnabled(command.id)}
          onClick={() => props.onCommand(command.id)}
        />
      ))}
    </div>
  );
}

function toMapEditTargetRef(selection: MapSelection): MapEditTargetRef | null {
  switch (selection.kind) {
    case 'light':
    case 'particle':
    case 'entity':
      return { kind: selection.kind, index: selection.index };
    case 'door':
      return { kind: 'door', id: selection.id };
    case 'wall':
    case 'sector':
      return null;
    default: {
      const neverSelection: never = selection;
      return neverSelection;
    }
  }
}

export function MapEditorDockPanel(): JSX.Element {
  const [toolId, setToolId] = React.useState<MapEditorToolId>(getDefaultMapEditorToolId());
  const tool = getMapEditorTool(toolId);

  const mapDocument = useNomosStore((state) => state.mapDocument);
  const selection = useNomosStore((state) => state.mapSelection);
  const setMapSelection = useNomosStore((state) => state.setMapSelection);
  const applyMapSelectionEffect = useNomosStore((state) => state.applyMapSelectionEffect);

  const viewportRef = React.useRef<MapEditorViewportApi | null>(null);

  const toolButtonHeightPx = 34;

  const isToolBarCommandEnabled = React.useCallback(
    (commandId: MapEditorToolbarCommandId): boolean => {
      if (commandId === 'select/delete' || commandId === 'select/clone') {
        if (mapDocument === null || selection === null) {
          return false;
        }

        return toMapEditTargetRef(selection) !== null;
      }

      return true;
    },
    [mapDocument, selection]
  );

  const onToolBarCommand = (commandId: MapEditorToolbarCommandId): void => {
    switch (commandId) {
      case 'zoom/in': {
        viewportRef.current?.zoomIn();
        return;
      }
      case 'zoom/out': {
        viewportRef.current?.zoomOut();
        return;
      }
      case 'zoom/default': {
        viewportRef.current?.resetView();
        return;
      }
      case 'pan/center': {
        viewportRef.current?.centerOnOrigin();
        return;
      }
      case 'select/delete': {
        if (!isToolBarCommandEnabled(commandId)) {
          return;
        }
        if (mapDocument === null) {
          return;
        }
        if (selection === null) {
          return;
        }
        const target = toMapEditTargetRef(selection);
        if (target === null) {
          return;
        }

        void (async () => {
          const result = await window.nomos.map.edit({
            baseRevision: mapDocument.revision,
            command: {
              kind: 'map-edit/delete',
              target
            }
          });

          if (!result.ok) {
            if (result.error.code === 'map-edit/stale-revision') {
              await useNomosStore.getState().refreshFromMain();
              toaster.show({ message: 'Document changed; refreshed. Please retry.', intent: Intent.WARNING });
              return;
            }
            // eslint-disable-next-line no-console
            console.error('[nomos] map delete failed', result.error);
            return;
          }

          if (result.value.kind === 'map-edit/applied') {
            applyMapSelectionEffect(result.value.selection);
            return;
          }

          setMapSelection(null);
        })();
        return;
      }
      case 'select/clone': {
        if (!isToolBarCommandEnabled(commandId)) {
          return;
        }
        if (mapDocument === null) {
          return;
        }
        if (selection === null) {
          return;
        }
        const target = toMapEditTargetRef(selection);
        if (target === null) {
          return;
        }

        void (async () => {
          const result = await window.nomos.map.edit({
            baseRevision: mapDocument.revision,
            command: {
              kind: 'map-edit/clone',
              target
            }
          });

          if (!result.ok) {
            if (result.error.code === 'map-edit/stale-revision') {
              await useNomosStore.getState().refreshFromMain();
              toaster.show({ message: 'Document changed; refreshed. Please retry.', intent: Intent.WARNING });
              return;
            }
            // eslint-disable-next-line no-console
            console.error('[nomos] map clone failed', result.error);
            return;
          }

          if (result.value.kind === 'map-edit/applied') {
            applyMapSelectionEffect(result.value.selection);
            return;
          }

          if (result.value.kind === 'map-edit/cloned') {
            setMapSelection(result.value.newRef);
          }
        })();
        return;
      }
      default: {
        const exhaustiveCheck: never = commandId;
        return exhaustiveCheck;
      }
    }
  };

  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <MapEditorToolBar activeTool={tool} onCommand={onToolBarCommand} isCommandEnabled={isToolBarCommandEnabled} />

      <div style={{ flex: '1 1 auto', position: 'relative', overflow: 'hidden' }}>
        <MapEditorCanvas ref={viewportRef} interactionMode={tool.interactionMode} />

        <div
          style={{
            position: 'absolute',
            left: 8,
            top: 8,
            bottom: 8,
            width: 56,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            padding: 6,
            boxSizing: 'border-box',
            background: Colors.DARK_GRAY3,
            borderRadius: 4,
            overflowY: 'auto'
          }}
        >
          {MAP_EDITOR_TOOLS.map((toolDefinition) => (
            <Tooltip key={toolDefinition.id} content={toolDefinition.tooltip} placement="right">
              <Button
                icon={toolDefinition.icon}
                minimal={true}
                active={toolId === toolDefinition.id}
                style={{ height: toolButtonHeightPx }}
                onClick={() => setToolId(toolDefinition.id)}
              />
            </Tooltip>
          ))}
        </div>
      </div>
    </div>
  );
}
