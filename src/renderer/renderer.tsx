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

function isSettingsMode(): boolean {
  try {
    const search = new URLSearchParams(window.location.search);
    const fromSearch = search.get('nomosSettings');
    if (fromSearch === '1' || fromSearch === 'true') {
      return true;
    }

    const hash = window.location.hash;
    const queryStart = hash.indexOf('?');
    if (queryStart >= 0) {
      const hashQuery = new URLSearchParams(hash.slice(queryStart + 1));
      const fromHash = hashQuery.get('nomosSettings');
      return fromHash === '1' || fromHash === 'true';
    }

    return false;
  } catch (_error: unknown) {
    return false;
  }
}

function SettingsPanel(props: { onDone: () => void; onCancel: () => void }): JSX.Element {
  const [assetsDirPath, setAssetsDirPath] = React.useState<string>('');
  const [gameExecutablePath, setGameExecutablePath] = React.useState<string>('');
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
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
  }, []);

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

    props.onDone();
  };

  return (
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
        <Button onClick={props.onCancel}>Cancel</Button>
        <Button intent="primary" onClick={save}>
          Save
        </Button>
      </div>
    </div>
  );
}

function SettingsDialog(): JSX.Element {
  const isOpen = useAppStore((state) => state.isSettingsDialogOpen);
  const close = useAppStore((state) => state.closeSettingsDialog);

  return (
    <Dialog isOpen={isOpen} onClose={close} title="Settings" canOutsideClickClose={true}>
      {isOpen ? <SettingsPanel onDone={close} onCancel={close} /> : null}
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
  const settingsMode = isSettingsMode();

  if (settingsMode) {
    return (
      <div style={{ padding: 16, height: '100vh', boxSizing: 'border-box' }}>
        <H1>Settings</H1>
        <SettingsPanel onDone={() => window.close()} onCancel={() => window.close()} />
      </div>
    );
  }

  const title = useAppStore((state) => state.title);
  const clickCount = useAppStore((state) => state.clickCount);
  const incrementClickCount = useAppStore((state) => state.incrementClickCount);

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
