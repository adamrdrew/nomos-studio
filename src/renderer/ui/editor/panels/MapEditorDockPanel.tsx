import React from 'react';
import { Button, ButtonGroup } from '@blueprintjs/core';
import { Colors } from '@blueprintjs/core';

import { MapEditorCanvas } from '../MapEditorCanvas';
import type { MapEditorInteractionMode } from '../MapEditorCanvas';

export function MapEditorDockPanel(): JSX.Element {
  const [tool, setTool] = React.useState<MapEditorInteractionMode>('select');

  return (
    <div style={{ height: '100%', width: '100%', position: 'relative', overflow: 'hidden' }}>
      <MapEditorCanvas interactionMode={tool} />

      <div
        style={{
          position: 'absolute',
          left: 8,
          top: 8,
          bottom: 8,
          width: 44,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          padding: 6,
          boxSizing: 'border-box',
          background: Colors.DARK_GRAY3,
          borderRadius: 4
        }}
      >
        <ButtonGroup vertical={true} fill={true}>
          <Button
            title="Select"
            text="S"
            active={tool === 'select'}
            onClick={() => setTool('select')}
          />
          <Button title="Zoom" text="Z" active={tool === 'zoom'} onClick={() => setTool('zoom')} />
          <Button title="Pan" text="P" active={tool === 'pan'} onClick={() => setTool('pan')} />
        </ButtonGroup>
      </div>
    </div>
  );
}
