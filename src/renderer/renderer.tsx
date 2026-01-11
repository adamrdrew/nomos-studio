import React from 'react';
import { createRoot } from 'react-dom/client';
import { Button, Callout, FormGroup, H1, InputGroup } from '@blueprintjs/core';

import { EditorShell } from './ui/editor/EditorShell';

import '@blueprintjs/core/lib/css/blueprint.css';
import '@blueprintjs/icons/lib/css/blueprint-icons.css';
import 'dockview/dist/styles/dockview.css';

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

  return <EditorShell />;
}

const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(<App />);
