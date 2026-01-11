import React from 'react';
import { Button, Tooltip } from '@blueprintjs/core';
import { Colors } from '@blueprintjs/core';

import { MapEditorCanvas } from '../MapEditorCanvas';
import type { MapEditorInteractionMode } from '../MapEditorCanvas';

export function MapEditorDockPanel(): JSX.Element {
  const [tool, setTool] = React.useState<MapEditorInteractionMode>('select');

  const toolButtonHeightPx = 34;

  return (
    <div style={{ height: '100%', width: '100%', position: 'relative', overflow: 'hidden' }}>
      <MapEditorCanvas interactionMode={tool} />

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
        <Tooltip content="Select" placement="right">
          <Button
            icon="select"
            minimal={true}
            active={tool === 'select'}
            style={{ height: toolButtonHeightPx }}
            onClick={() => setTool('select')}
          />
        </Tooltip>

        <Tooltip content="Zoom" placement="right">
          <Button
            icon="zoom-in"
            minimal={true}
            active={tool === 'zoom'}
            style={{ height: toolButtonHeightPx }}
            onClick={() => setTool('zoom')}
          />
        </Tooltip>

        <Tooltip content="Pan" placement="right">
          <Button
            icon="hand"
            minimal={true}
            active={tool === 'pan'}
            style={{ height: toolButtonHeightPx }}
            onClick={() => setTool('pan')}
          />
        </Tooltip>
      </div>
    </div>
  );
}
