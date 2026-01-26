import React from 'react';
import { Button, Icon, Intent, Position, Toaster, Tooltip } from '@blueprintjs/core';
import { Colors } from '@blueprintjs/core';

import { MapEditorCanvas } from '../MapEditorCanvas';
import type { MapEditorViewportApi } from '../MapEditorCanvas';
import { getDefaultMapEditorToolId, getMapEditorTool, MAP_EDITOR_TOOLS } from '../tools/mapEditorTools';
import type { MapEditorToolDefinition, MapEditorToolId, MapEditorToolbarCommandId } from '../tools/mapEditorTools';
import type { ToolHotkeyPlatform } from '../tools/mapEditorToolHotkeys';
import {
  formatToolHotkeyLabel,
  getToolHotkeyDescriptorForIndex,
  isEditableActiveElement,
  parseToolIndexFromKeyboardEvent
} from '../tools/mapEditorToolHotkeys';
import { useNomosStore } from '../../../store/nomosStore';
import { JsonEditorPanel } from './JsonEditorPanel';
import type { MapSelection } from '../map/mapSelection';
import type { MapEditTargetRef } from '../../../../shared/ipc/nomosIpc';
import type { RoomTemplate } from '../../../../shared/domain/mapRoomCreation';
import { decodeMapViewModel } from '../map/mapDecoder';
import { buildRoomStampFromSector } from '../map/roomStampFromSector';
import { ScissorsIcon } from '../icons/ScissorsIcon';
import type { MapEditorToolIconId } from '../tools/mapEditorTools';

const toaster = Toaster.create({ position: Position.TOP });

function renderToolIcon(icon: MapEditorToolIconId): JSX.Element {
  if (icon === 'custom/scissors') {
    return <ScissorsIcon size={16} color={Colors.WHITE} />;
  }
  return <Icon icon={icon} color={Colors.WHITE} />;
}

function MapEditorToolBar(props: {
  activeTool: MapEditorToolDefinition;
  onCommand: (commandId: MapEditorToolbarCommandId) => void;
  isCommandEnabled: (commandId: MapEditorToolbarCommandId) => boolean;
  rightSlot?: React.ReactNode;
}): JSX.Element {
  return (
    <div
      style={{
        flex: '0 0 auto',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        justifyContent: 'space-between',
        padding: 8,
        minHeight: 46,
        background: Colors.DARK_GRAY2,
        color: Colors.WHITE,
        boxSizing: 'border-box'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        {props.activeTool.toolbarCommands.map((command) => (
          <Button
            key={command.id}
            minimal={true}
            text={command.label}
            disabled={!props.isCommandEnabled(command.id)}
            style={{ color: Colors.WHITE }}
            onClick={() => props.onCommand(command.id)}
          />
        ))}
      </div>

      {props.rightSlot ? (
        <div
          style={{
            marginLeft: 8,
            textAlign: 'right',
            color: Colors.WHITE,
            fontSize: 12,
            lineHeight: 1.2,
            opacity: 0.95
          }}
        >
          {props.rightSlot}
        </div>
      ) : null}
    </div>
  );
}

function toMapEditTargetRef(selection: MapSelection): MapEditTargetRef | null {
  switch (selection.kind) {
    case 'map':
      return null;
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

  const [roomTemplate, setRoomTemplate] = React.useState<RoomTemplate>('rectangle');

  const mapDocument = useNomosStore((state) => state.mapDocument);
  const selection = useNomosStore((state) => state.mapSelection);
  const setMapSelection = useNomosStore((state) => state.setMapSelection);
  const applyMapSelectionEffect = useNomosStore((state) => state.applyMapSelectionEffect);
  const setRoomCloneBuffer = useNomosStore((state) => state.setRoomCloneBuffer);
  const clearRoomCloneBuffer = useNomosStore((state) => state.clearRoomCloneBuffer);

  const activeEditorTabId = useNomosStore((state) => state.activeEditorTabId);
  const jsonEditorTabs = useNomosStore((state) => state.jsonEditorTabs);
  const closeJsonEditorTab = useNomosStore((state) => state.closeJsonEditorTab);
  const setActiveEditorTabId = useNomosStore((state) => state.setActiveEditorTabId);

  const viewportRef = React.useRef<MapEditorViewportApi | null>(null);

  const hotkeyPlatform = React.useMemo<ToolHotkeyPlatform>(() => {
    return navigator.platform.toLowerCase().includes('mac') ? 'mac' : 'win-linux';
  }, []);

  const [isPrimaryModifierHeld, setIsPrimaryModifierHeld] = React.useState<boolean>(false);

  React.useEffect(() => {
    function updateModifierHeld(event: KeyboardEvent): void {
      const held = hotkeyPlatform === 'mac' ? event.metaKey : event.ctrlKey;
      setIsPrimaryModifierHeld(held);
    }

    function clearModifierHeld(): void {
      setIsPrimaryModifierHeld(false);
    }

    window.addEventListener('keydown', updateModifierHeld);
    window.addEventListener('keyup', updateModifierHeld);
    window.addEventListener('blur', clearModifierHeld);

    return () => {
      window.removeEventListener('keydown', updateModifierHeld);
      window.removeEventListener('keyup', updateModifierHeld);
      window.removeEventListener('blur', clearModifierHeld);
    };
  }, [hotkeyPlatform]);

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (isEditableActiveElement(document)) {
        return;
      }

      const toolIndex = parseToolIndexFromKeyboardEvent(event, hotkeyPlatform, { allowNumpad: true });
      if (toolIndex === null) {
        return;
      }

      const toolDefinition = MAP_EDITOR_TOOLS[toolIndex];
      if (toolDefinition === undefined) {
        return;
      }

      event.preventDefault();
      setToolId(toolDefinition.id);
      window.dispatchEvent(new Event('nomos:focus-inspector'));
    }

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [hotkeyPlatform]);

  const toolButtonHeightPx = 34;

  const isToolBarCommandEnabled = React.useCallback(
    (commandId: MapEditorToolbarCommandId): boolean => {
      if (commandId === 'select/delete') {
        if (mapDocument === null || selection === null) {
          return false;
        }

        return toMapEditTargetRef(selection) !== null;
      }

      if (commandId === 'select/clone') {
        if (mapDocument === null || selection === null) {
          return false;
        }

        if (selection.kind === 'sector') {
          return true;
        }

        return toMapEditTargetRef(selection) !== null;
      }

      return true;
    },
    [mapDocument, selection]
  );

  const onToolBarCommand = (commandId: MapEditorToolbarCommandId): void => {
    switch (commandId) {
      case 'room/rectangle': {
        clearRoomCloneBuffer();
        setRoomTemplate('rectangle');
        return;
      }
      case 'room/square': {
        clearRoomCloneBuffer();
        setRoomTemplate('square');
        return;
      }
      case 'room/triangle': {
        clearRoomCloneBuffer();
        setRoomTemplate('triangle');
        return;
      }
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

        if (selection.kind === 'sector') {
          const decoded = decodeMapViewModel(mapDocument.json);
          if (!decoded.ok) {
            // eslint-disable-next-line no-console
            console.error('[nomos] map decode failed (clone sector)', decoded.error);
            toaster.show({ message: 'Unable to clone this room (map decode failed).', intent: Intent.WARNING });
            return;
          }

          const stamp = buildRoomStampFromSector(decoded.value, selection.id);
          if (!stamp.ok) {
            // eslint-disable-next-line no-console
            console.error('[nomos] room stamp extraction failed (clone sector)', stamp.error);
            toaster.show({
              message: `Unable to clone this room (${stamp.error.reason}).`,
              intent: Intent.WARNING
            });
            return;
          }

          setRoomCloneBuffer(stamp.value);
          setToolId('room');
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
            applyMapSelectionEffect({ kind: 'map-edit/selection/set', ref: result.value.newRef });
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

  const roomToolHints = React.useMemo((): React.ReactNode | null => {
    if (toolId !== 'room') {
      return null;
    }

    const isMac = navigator.platform.toLowerCase().includes('mac');
    const primary = isMac ? 'Cmd' : 'Ctrl';
    const alt = isMac ? 'Option' : 'Alt';

    return (
      <div>
          <div>{`Rotate: ${primary} + ←/→`}</div>
          <div>{`Scale: ${primary} + ${alt} + ←/→/↑/↓`}</div>
      </div>
    );
  }, [toolId]);

  const activeJsonTab = React.useMemo(() => {
    if (activeEditorTabId === 'map') {
      return null;
    }
    return jsonEditorTabs.find((tab) => tab.id === activeEditorTabId) ?? null;
  }, [activeEditorTabId, jsonEditorTabs]);

  const tabBar = (
    <div
      style={{
        flex: '0 0 auto',
        display: 'flex',
        alignItems: 'stretch',
        gap: 2,
        padding: '6px 6px',
        background: Colors.DARK_GRAY1,
        overflowX: 'auto',
        overflowY: 'hidden',
        whiteSpace: 'nowrap',
        boxSizing: 'border-box',
        borderBottom: `1px solid ${Colors.DARK_GRAY4}`
      }}
    >
      <div
        role="button"
        tabIndex={0}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 10px',
          borderRadius: 4,
          cursor: 'pointer',
          userSelect: 'none',
          background: activeEditorTabId === 'map' ? Colors.DARK_GRAY3 : 'transparent',
          color: Colors.WHITE,
          flex: '0 0 auto'
        }}
        onClick={() => setActiveEditorTabId('map')}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setActiveEditorTabId('map');
          }
        }}
      >
        <span style={{ color: mapDocument?.dirty === true ? Colors.RED3 : Colors.WHITE }}>Map</span>
      </div>

      {jsonEditorTabs.map((tab) => {
        const isActive = activeEditorTabId === tab.id;

        return (
          <div
            key={tab.id}
            role="button"
            tabIndex={0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 10px',
              borderRadius: 4,
              cursor: 'pointer',
              userSelect: 'none',
              background: isActive ? Colors.DARK_GRAY3 : 'transparent',
              color: Colors.WHITE,
              flex: '0 0 auto'
            }}
            onClick={() => setActiveEditorTabId(tab.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setActiveEditorTabId(tab.id);
              }
            }}
          >
            <Button
              minimal={true}
              icon={<Icon icon="small-cross" color={Colors.GRAY3} />}
              style={{ padding: 0, minHeight: 0, minWidth: 0 }}
              onClick={(event) => {
                event.stopPropagation();
                closeJsonEditorTab(tab.id);
              }}
            />
            <span style={{ color: tab.isDirty ? Colors.RED3 : Colors.WHITE }}>{tab.fileName}</span>
          </div>
        );
      })}
    </div>
  );

  const mapEditorContent = (
    <>
      <MapEditorToolBar
        activeTool={tool}
        onCommand={onToolBarCommand}
        isCommandEnabled={isToolBarCommandEnabled}
        rightSlot={roomToolHints}
      />

      <div style={{ flex: '1 1 auto', position: 'relative', overflow: 'hidden' }}>
        <MapEditorCanvas ref={viewportRef} interactionMode={tool.interactionMode} roomTemplate={roomTemplate} />

        <div
          style={{
            position: 'absolute',
            left: 8,
            top: 8,
            bottom: 8,
            width: 50,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            padding: 6,
            boxSizing: 'border-box',
            background: Colors.DARK_GRAY2,
            borderRadius: 4,
            overflowY: 'auto'
          }}
        >
          {MAP_EDITOR_TOOLS.map((toolDefinition, toolIndex) => {
            const descriptor = getToolHotkeyDescriptorForIndex(toolIndex);
            const hotkeyLabel =
              isPrimaryModifierHeld && descriptor !== null ? formatToolHotkeyLabel(descriptor, hotkeyPlatform) : null;

            return (
            <Tooltip key={toolDefinition.id} content={toolDefinition.tooltip} placement="right">
              <div style={{ position: 'relative', width: '100%' }}>
                <Button
                  icon={renderToolIcon(toolDefinition.icon)}
                  minimal={true}
                  fill={true}
                  active={toolId === toolDefinition.id}
                  style={{ height: toolButtonHeightPx, width: '100%', justifyContent: 'center', color: Colors.WHITE }}
                  onClick={() => {
                    setToolId(toolDefinition.id);
                    window.dispatchEvent(new Event('nomos:focus-inspector'));
                  }}
                />

                {hotkeyLabel ? (
                  <div
                    style={{
                      position: 'absolute',
                      left: '50%',
                      top: '50%',
                      transform: 'translate(-50%, -50%)',
                      padding: '3px 5px',
                      borderRadius: 999,
                      fontSize: 9,
                      lineHeight: '12px',
                      fontWeight: 600,
                      color: Colors.WHITE,
                      background: Colors.DARK_GRAY1,
                      border: `1px solid ${Colors.DARK_GRAY4}`,
                      pointerEvents: 'none',
                      userSelect: 'none',
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 1,
                      width: 46,
                      opacity: 0.95
                    }}
                  >
                    <div style={{ fontSize: 9, lineHeight: '11px' }}>{toolDefinition.label}</div>
                    <div style={{ fontSize: 8, lineHeight: '10px' }}>{hotkeyLabel}</div>
                  </div>
                ) : null}
              </div>
            </Tooltip>
            );
          })}
        </div>
      </div>
    </>
  );

  const jsonEditorContent = (
    <div style={{ flex: '1 1 auto', minHeight: 0, overflow: 'hidden' }}>
      {activeJsonTab ? (
        <JsonEditorPanel model={activeJsonTab.model} />
      ) : (
        <div style={{ padding: 16, color: Colors.GRAY2 }}>No JSON tab selected.</div>
      )}
    </div>
  );

  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {tabBar}
      {activeEditorTabId === 'map' ? mapEditorContent : jsonEditorContent}
    </div>
  );
}
