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

    const unsubscribe = window.nomos.state.onChanged((payload) => {
      if (payload?.selectionEffect !== undefined) {
        useNomosStore.getState().applyMapSelectionEffect(payload.selectionEffect);
      }
      void useNomosStore.getState().refreshFromMain();
    });

    return () => {
      unsubscribe();
    };
  }, []);

  React.useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (target.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
          return;
        }
      }

      const isUndo = (event.key === 'z' || event.key === 'Z') && (event.metaKey || event.ctrlKey) && !event.shiftKey;
      const isRedo =
        ((event.key === 'z' || event.key === 'Z') && (event.metaKey || event.ctrlKey) && event.shiftKey) ||
        ((event.key === 'y' || event.key === 'Y') && event.ctrlKey);

      if (!isUndo && !isRedo) {
        return;
      }

      event.preventDefault();

      void (async () => {
        const result = isUndo ? await window.nomos.map.undo() : await window.nomos.map.redo();
        if (!result.ok) {
          // eslint-disable-next-line no-console
          console.error('[nomos] map undo/redo failed', result.error);
          return;
        }

        if (result.value.kind === 'map-edit/applied') {
          useNomosStore.getState().applyMapSelectionEffect(result.value.selection);
        }
      })();
    };

    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
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
