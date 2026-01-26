import React from 'react';
import { DockviewDefaultTab, DockviewReact, type DockviewReadyEvent, type IDockviewDefaultTabProps } from 'dockview';
import { Intent, Position, Toaster } from '@blueprintjs/core';

import { useNomosStore } from '../../store/nomosStore';

import { InspectorDockPanel } from './panels/InspectorDockPanel';
import { EntitiesDockPanel } from './panels/EntitiesDockPanel';
import { MapEditorDockPanel } from './panels/MapEditorDockPanel';

const FOCUS_INSPECTOR_EVENT = 'nomos:focus-inspector';

const toaster = Toaster.create({ position: Position.TOP });

const NonClosableTab = (props: IDockviewDefaultTabProps): JSX.Element => {
  return <DockviewDefaultTab {...props} hideClose={true} />;
};

function ensureCorePanelsPresent(event: DockviewReadyEvent): void {
  if (event.api.getPanel('map-editor') === undefined) {
    event.api.addPanel({
      id: 'map-editor',
      title: 'Nomos Studio',
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

  if (event.api.getPanel('entities') === undefined) {
    // Place Entities in the same right-side tab group as Inspector.
    event.api.addPanel({
      id: 'entities',
      title: 'Entities',
      component: 'entities',
      tabComponent: 'nonClosable',
      position: {
        referencePanel: 'inspector',
        direction: 'within'
      }
    });
  }

  // Ensure Inspector remains the default active tab on startup.
  event.api.getPanel('inspector')?.api.setActive();
}

export function EditorShell(): JSX.Element {
  const dockDisposablesRef = React.useRef<readonly { dispose(): void }[]>([]);
  const dockApiRef = React.useRef<DockviewReadyEvent['api'] | null>(null);

  const saveActiveEditorTab = useNomosStore((state) => state.saveActiveEditorTab);
  const saveAllEditorsAndRun = useNomosStore((state) => state.saveAllEditorsAndRun);

  React.useEffect(() => {
    return window.nomos.menu.onSaveRequested(() => {
      void saveActiveEditorTab();
    });
  }, [saveActiveEditorTab]);

  React.useEffect(() => {
    return window.nomos.menu.onSaveAndRunRequested(() => {
      void saveAllEditorsAndRun();
    });
  }, [saveAllEditorsAndRun]);

  React.useEffect(() => {
    const handler = (): void => {
      dockApiRef.current?.getPanel('inspector')?.api.setActive();
    };

    window.addEventListener(FOCUS_INSPECTOR_EVENT, handler);
    return () => {
      window.removeEventListener(FOCUS_INSPECTOR_EVENT, handler);
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
        const mapDocument = useNomosStore.getState().mapDocument;
        if (mapDocument === null) {
          return;
        }

        const request = { baseRevision: mapDocument.revision };
        const result = isUndo ? await window.nomos.map.undo(request) : await window.nomos.map.redo(request);
        if (!result.ok) {
          if (result.error.code === 'map-edit/stale-revision') {
            await useNomosStore.getState().refreshFromMain();
            toaster.show({ message: 'Document changed; refreshed. Please retry.', intent: Intent.WARNING });
            return;
          }
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
    dockApiRef.current = event.api;
    ensureCorePanelsPresent(event);

    const onDidRemovePanelDisposable = event.api.onDidRemovePanel(() => {
      ensureCorePanelsPresent(event);
    });

    dockDisposablesRef.current = [...dockDisposablesRef.current, onDidRemovePanelDisposable];
  };

  return (
    <div style={{ height: '100%', width: '100%', overflow: 'hidden' }}>
      <DockviewReact
        className="dockview-theme-dark nomos-dockview"
        onReady={onDockReady}
        tabComponents={{
          nonClosable: NonClosableTab
        }}
        components={{
          mapEditor: MapEditorDockPanel,
          inspector: InspectorDockPanel,
          entities: EntitiesDockPanel
        }}
      />
    </div>
  );
}
