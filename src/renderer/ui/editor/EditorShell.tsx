import React from 'react';
import { DockviewDefaultTab, DockviewReact, type DockviewReadyEvent, type IDockviewDefaultTabProps } from 'dockview';

import { useNomosStore } from '../../store/nomosStore';

import { InspectorDockPanel } from './panels/InspectorDockPanel';
import { MapEditorDockPanel } from './panels/MapEditorDockPanel';

const NonClosableTab = (props: IDockviewDefaultTabProps): JSX.Element => {
  return <DockviewDefaultTab {...props} hideClose={true} />;
};

function ensureCorePanelsPresent(event: DockviewReadyEvent): void {
  if (event.api.getPanel('map-editor') === undefined) {
    event.api.addPanel({
      id: 'map-editor',
      title: 'Map Editor',
      component: 'mapEditor',
      tabComponent: 'nonClosable'
    });
  }

  if (event.api.getPanel('inspector') === undefined) {
    const inspectorInitialWidth = Math.round(window.innerWidth * 0.2);

    event.api.addPanel({
      id: 'inspector',
      title: 'Inspector',
      component: 'inspector',
      tabComponent: 'nonClosable',
      initialWidth: inspectorInitialWidth,
      position: {
        referencePanel: 'map-editor',
        direction: 'right'
      }
    });
  }
}

export function EditorShell(): JSX.Element {
  const dockDisposablesRef = React.useRef<readonly { dispose(): void }[]>([]);

  React.useEffect(() => {
    void useNomosStore.getState().refreshFromMain();

    const unsubscribe = window.nomos.state.onChanged(() => {
      void useNomosStore.getState().refreshFromMain();
    });

    return () => {
      unsubscribe();
    };
  }, []);

  React.useEffect(() => {
    return () => {
      for (const disposable of dockDisposablesRef.current) {
        disposable.dispose();
      }
    };
  }, []);

  const onDockReady = (event: DockviewReadyEvent): void => {
    ensureCorePanelsPresent(event);

    const onDidRemovePanelDisposable = event.api.onDidRemovePanel(() => {
      ensureCorePanelsPresent(event);
    });

    dockDisposablesRef.current = [...dockDisposablesRef.current, onDidRemovePanelDisposable];
  };

  return (
    <div style={{ height: '100vh', width: '100vw' }}>
      <DockviewReact
        onReady={onDockReady}
        tabComponents={{
          nonClosable: NonClosableTab
        }}
        components={{
          mapEditor: MapEditorDockPanel,
          inspector: InspectorDockPanel
        }}
      />
    </div>
  );
}
