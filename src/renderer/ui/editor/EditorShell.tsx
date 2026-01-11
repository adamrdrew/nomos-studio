import React from 'react';
import { DockviewReact, type DockviewReadyEvent } from 'dockview';

import { useNomosStore } from '../../store/nomosStore';

import { InspectorDockPanel } from './panels/InspectorDockPanel';
import { MapEditorDockPanel } from './panels/MapEditorDockPanel';

export function EditorShell(): JSX.Element {
  React.useEffect(() => {
    void useNomosStore.getState().refreshFromMain();

    const unsubscribe = window.nomos.state.onChanged(() => {
      void useNomosStore.getState().refreshFromMain();
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const onDockReady = (event: DockviewReadyEvent): void => {
    event.api.addPanel({
      id: 'map-editor',
      title: 'Map Editor',
      component: 'mapEditor'
    });

    event.api.addPanel({
      id: 'inspector',
      title: 'Inspector',
      component: 'inspector',
      // DockView positioning is type-driven; this is the minimal intended layout.
      position: {
        referencePanel: 'map-editor',
        direction: 'right'
      }
    });
  };

  return (
    <div style={{ height: '100vh', width: '100vw' }}>
      <DockviewReact
        onReady={onDockReady}
        components={{
          mapEditor: MapEditorDockPanel,
          inspector: InspectorDockPanel
        }}
      />
    </div>
  );
}
