import React from 'react';
import { createRoot } from 'react-dom/client';
import { Button, Callout, Card, Dialog, FormGroup, H1, InputGroup } from '@blueprintjs/core';
import { DockviewReact, type DockviewReadyEvent } from 'dockview';
import { create } from 'zustand';
import { Layer, Rect, Stage } from 'react-konva';

import { useNomosStore } from './store/nomosStore';

import '@blueprintjs/core/lib/css/blueprint.css';
import '@blueprintjs/icons/lib/css/blueprint-icons.css';
import 'dockview/dist/styles/dockview.css';

type AppStoreState = {
  title: string;
  incrementClickCount: () => void;
  clickCount: number;
  isSettingsDialogOpen: boolean;
  openSettingsDialog: () => void;
  closeSettingsDialog: () => void;
};

const useAppStore = create<AppStoreState>((set) => ({
  title: 'Nomos Studio',
  clickCount: 0,
  incrementClickCount: () => {
    set((currentState) => ({ clickCount: currentState.clickCount + 1 }));
  },
  isSettingsDialogOpen: false,
  openSettingsDialog: () => {
    set({ isSettingsDialogOpen: true });
  },
  closeSettingsDialog: () => {
    set({ isSettingsDialogOpen: false });
  }
}));

function SettingsDialog(): JSX.Element {
  const isOpen = useAppStore((state) => state.isSettingsDialogOpen);
  const close = useAppStore((state) => state.closeSettingsDialog);

  const [assetsDirPath, setAssetsDirPath] = React.useState<string>('');
  const [gameExecutablePath, setGameExecutablePath] = React.useState<string>('');
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }

    let isCancelled = false;
    setErrorMessage(null);

    void (async () => {
      const result = await window.nomos.settings.get();
      if (!result.ok) {
        if (!isCancelled) {
          setErrorMessage(result.error.message);
        }
        return;
      }

      if (!isCancelled) {
        setAssetsDirPath(result.value.assetsDirPath ?? '');
        setGameExecutablePath(result.value.gameExecutablePath ?? '');
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [isOpen]);

  const browseAssets = async (): Promise<void> => {
    setErrorMessage(null);
    const result = await window.nomos.dialogs.pickDirectory();
    if (!result.ok) {
      setErrorMessage(result.error.message);
      return;
    }
    if (result.value !== null) {
      setAssetsDirPath(result.value);
    }
  };

  const browseGameExecutable = async (): Promise<void> => {
    setErrorMessage(null);
    const result = await window.nomos.dialogs.pickFile();
    if (!result.ok) {
      setErrorMessage(result.error.message);
      return;
    }
    if (result.value !== null) {
      setGameExecutablePath(result.value);
    }
  };

  const save = async (): Promise<void> => {
    setErrorMessage(null);
    const result = await window.nomos.settings.update({
      assetsDirPath: assetsDirPath.trim().length === 0 ? null : assetsDirPath.trim(),
      gameExecutablePath: gameExecutablePath.trim().length === 0 ? null : gameExecutablePath.trim()
    });

    if (!result.ok) {
      setErrorMessage(result.error.message);
      return;
    }

    close();
  };

  return (
    <Dialog isOpen={isOpen} onClose={close} title="Settings" canOutsideClickClose={true}>
      <div style={{ padding: 16, width: 620 }}>
        {errorMessage !== null ? (
          <Callout intent="danger" style={{ marginBottom: 12 }}>
            {errorMessage}
          </Callout>
        ) : null}

        <FormGroup
          label="Assets directory"
          helperText={assetsDirPath.trim().length === 0 ? 'Path not set' : undefined}
        >
          <div style={{ display: 'flex', gap: 8 }}>
            <InputGroup
              value={assetsDirPath}
              onChange={(event) => setAssetsDirPath(event.currentTarget.value)}
              placeholder="Select an assets directory"
              fill={true}
            />
            <Button onClick={browseAssets}>Browse…</Button>
          </div>
        </FormGroup>

        <FormGroup
          label="Game executable"
          helperText={gameExecutablePath.trim().length === 0 ? 'Path not set' : undefined}
        >
          <div style={{ display: 'flex', gap: 8 }}>
            <InputGroup
              value={gameExecutablePath}
              onChange={(event) => setGameExecutablePath(event.currentTarget.value)}
              placeholder="Select the game executable"
              fill={true}
            />
            <Button onClick={browseGameExecutable}>Browse…</Button>
          </div>
        </FormGroup>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <Button onClick={close}>Cancel</Button>
          <Button intent="primary" onClick={save}>
            Save
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function DockPanel(): JSX.Element {
  return (
    <div style={{ padding: 12 }}>
      <p>DockView panel (bootstrap only)</p>
      <Stage width={260} height={140}>
        <Layer>
          <Rect x={20} y={20} width={120} height={80} fill="#d9822b" cornerRadius={6} />
        </Layer>
      </Stage>
    </div>
  );
}

function App(): JSX.Element {
  const title = useAppStore((state) => state.title);
  const clickCount = useAppStore((state) => state.clickCount);
  const incrementClickCount = useAppStore((state) => state.incrementClickCount);
  const openSettingsDialog = useAppStore((state) => state.openSettingsDialog);

  React.useEffect(() => {
    const unsubscribe = window.nomos.events.onOpenSettings(() => {
      openSettingsDialog();
    });

    return () => {
      unsubscribe();
    };
  }, [openSettingsDialog]);

  React.useEffect(() => {
    void useNomosStore.getState().refreshFromMain();
  }, []);

  const onDockReady = (event: DockviewReadyEvent): void => {
    event.api.addPanel({
      id: 'bootstrap-panel',
      title: 'Bootstrap Panel',
      component: 'dockPanel'
    });
  };

  return (
    <div style={{ padding: 16, height: '100vh', boxSizing: 'border-box' }}>
      <H1>{title}</H1>
      <SettingsDialog />
      <Card style={{ marginBottom: 12 }}>
        <p>Bootstrap phase: window + UI shell only.</p>
        <Button onClick={incrementClickCount}>Clicks: {clickCount}</Button>
      </Card>

      <div style={{ height: 'calc(100% - 140px)' }}>
        <DockviewReact
          onReady={onDockReady}
          components={{ dockPanel: DockPanel }}
        />
      </div>
    </div>
  );
}

const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(<App />);
