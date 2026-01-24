import React from 'react';
import { createRoot } from 'react-dom/client';
import { Button, Callout, FormGroup, H1, HTMLSelect, InputGroup, Spinner } from '@blueprintjs/core';

import { EditorShell } from './ui/editor/EditorShell';
import { useNomosStore } from './store/nomosStore';
import { FreshLaunchView } from './ui/launch/FreshLaunchView';

import '@blueprintjs/core/lib/css/blueprint.css';
import '@blueprintjs/icons/lib/css/blueprint-icons.css';
import 'dockview/dist/styles/dockview.css';
import './renderer.css';

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

function extractAssetBasenames(assetIndexEntries: readonly string[], prefix: string): string[] {
  const basenames = new Set<string>();

  for (const entry of assetIndexEntries) {
    if (!entry.startsWith(prefix)) {
      continue;
    }

    const remainder = entry.slice(prefix.length);
    const parts = remainder.split('/').filter((segment) => segment.trim().length > 0);
    const last = parts.at(-1);
    if (last === undefined) {
      continue;
    }

    basenames.add(last);
  }

  return [...basenames].sort((a, b) => a.localeCompare(b));
}

function getTextureFileNames(assetIndexEntries: readonly string[]): readonly string[] {
  const prefixes = ['Images/Textures/', 'Assets/Images/Textures/'] as const;

  let matches: string[] = [];
  for (const prefix of prefixes) {
    const candidate = assetIndexEntries
      .filter((entry) => entry.startsWith(prefix))
      .map((entry) => entry.slice(prefix.length))
      .filter((fileName) => fileName.trim().length > 0);

    if (candidate.length > 0) {
      matches = candidate;
      break;
    }
  }

  matches.sort((a, b) => a.localeCompare(b));
  return matches;
}

type SelectOption = Readonly<{ value: string; label: string }>;

function buildSelectOptions(available: readonly string[], current: string | null): SelectOption[] {
  const options: SelectOption[] = [{ value: '', label: '(none)' }];

  if (current !== null && current !== '' && !available.includes(current)) {
    options.push({ value: current, label: `${current} (missing)` });
  }

  for (const value of available) {
    options.push({ value, label: value });
  }

  return options;
}

function SettingsPanel(props: { onDone: () => void; onCancel: () => void }): JSX.Element {
  const [assetsDirPath, setAssetsDirPath] = React.useState<string>('');
  const [gameExecutablePath, setGameExecutablePath] = React.useState<string>('');
  const [defaultSky, setDefaultSky] = React.useState<string>('');
  const [defaultSoundfont, setDefaultSoundfont] = React.useState<string>('');
  const [defaultBgmusic, setDefaultBgmusic] = React.useState<string>('');
  const [defaultWallTex, setDefaultWallTex] = React.useState<string>('');
  const [defaultFloorTex, setDefaultFloorTex] = React.useState<string>('');
  const [defaultCeilTex, setDefaultCeilTex] = React.useState<string>('');
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const [indexRefreshRequestedForPath, setIndexRefreshRequestedForPath] = React.useState<string | null>(null);

  const assetIndex = useNomosStore((state) => state.assetIndex);

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
        setDefaultSky(result.value.defaultSky ?? '');
        setDefaultSoundfont(result.value.defaultSoundfont ?? '');
        setDefaultBgmusic(result.value.defaultBgmusic ?? '');
        setDefaultWallTex(result.value.defaultWallTex ?? '');
        setDefaultFloorTex(result.value.defaultFloorTex ?? '');
        setDefaultCeilTex(result.value.defaultCeilTex ?? '');
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

  const apply = async (): Promise<void> => {
    setErrorMessage(null);
    const result = await window.nomos.settings.update({
      assetsDirPath: assetsDirPath.trim().length === 0 ? null : assetsDirPath.trim(),
      gameExecutablePath: gameExecutablePath.trim().length === 0 ? null : gameExecutablePath.trim(),
      defaultSky: defaultSky.trim().length === 0 ? null : defaultSky.trim(),
      defaultSoundfont: defaultSoundfont.trim().length === 0 ? null : defaultSoundfont.trim(),
      defaultBgmusic: defaultBgmusic.trim().length === 0 ? null : defaultBgmusic.trim(),
      defaultWallTex: defaultWallTex.trim().length === 0 ? null : defaultWallTex.trim(),
      defaultFloorTex: defaultFloorTex.trim().length === 0 ? null : defaultFloorTex.trim(),
      defaultCeilTex: defaultCeilTex.trim().length === 0 ? null : defaultCeilTex.trim()
    });

    if (!result.ok) {
      setErrorMessage(result.error.message);
      return;
    }

    await useNomosStore.getState().refreshFromMain();
  };

  const isAssetsConfigured = assetsDirPath.trim().length > 0;
  const isIndexingAssets = isAssetsConfigured && assetIndex === null;
  const defaultsDisabled = !isAssetsConfigured || assetIndex === null;
  const defaultsHelperText = defaultsDisabled ? 'Set an assets directory and wait for indexing to complete.' : undefined;

  React.useEffect(() => {
    if (!isAssetsConfigured) {
      if (indexRefreshRequestedForPath !== null) {
        setIndexRefreshRequestedForPath(null);
      }
      return;
    }

    if (assetIndex !== null) {
      return;
    }

    const trimmedPath = assetsDirPath.trim();
    if (trimmedPath.length === 0) {
      return;
    }

    if (indexRefreshRequestedForPath === trimmedPath) {
      return;
    }

    setIndexRefreshRequestedForPath(trimmedPath);

    void (async () => {
      await window.nomos.assets.refreshIndex();
      await useNomosStore.getState().refreshFromMain();
    })();
  }, [assetIndex, assetsDirPath, indexRefreshRequestedForPath, isAssetsConfigured]);

  const skyOptions = React.useMemo(() => {
    if (assetIndex === null) {
      return [];
    }
    return extractAssetBasenames(assetIndex.entries, 'Images/Sky/');
  }, [assetIndex]);

  const soundfontOptions = React.useMemo(() => {
    if (assetIndex === null) {
      return [];
    }
    return extractAssetBasenames(assetIndex.entries, 'Sounds/SoundFonts/');
  }, [assetIndex]);

  const midiOptions = React.useMemo(() => {
    if (assetIndex === null) {
      return [];
    }
    return extractAssetBasenames(assetIndex.entries, 'Sounds/MIDI/');
  }, [assetIndex]);

  const textureOptions = React.useMemo(() => {
    if (assetIndex === null) {
      return [];
    }
    return getTextureFileNames(assetIndex.entries);
  }, [assetIndex]);

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

      <div style={{ marginTop: 16 }}>
        <H1 style={{ fontSize: 18, margin: '8px 0' }}>Default assets</H1>

        {isIndexingAssets ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Spinner size={16} />
            <div>Indexing assets…</div>
          </div>
        ) : null}

        <FormGroup label="Sky texture" helperText={defaultsHelperText}>
          <HTMLSelect
            value={defaultSky}
            onChange={(event) => setDefaultSky(event.currentTarget.value)}
            disabled={defaultsDisabled}
            options={buildSelectOptions(skyOptions, defaultSky.trim().length === 0 ? null : defaultSky)}
            fill={true}
          />
        </FormGroup>

        <FormGroup label="Sound font" helperText={defaultsHelperText}>
          <HTMLSelect
            value={defaultSoundfont}
            onChange={(event) => setDefaultSoundfont(event.currentTarget.value)}
            disabled={defaultsDisabled}
            options={buildSelectOptions(
              soundfontOptions,
              defaultSoundfont.trim().length === 0 ? null : defaultSoundfont
            )}
            fill={true}
          />
        </FormGroup>

        <FormGroup label="Background MIDI" helperText={defaultsHelperText}>
          <HTMLSelect
            value={defaultBgmusic}
            onChange={(event) => setDefaultBgmusic(event.currentTarget.value)}
            disabled={defaultsDisabled}
            options={buildSelectOptions(midiOptions, defaultBgmusic.trim().length === 0 ? null : defaultBgmusic)}
            fill={true}
          />
        </FormGroup>

        <FormGroup label="Default wall texture" helperText={defaultsHelperText}>
          <HTMLSelect
            value={defaultWallTex}
            onChange={(event) => setDefaultWallTex(event.currentTarget.value)}
            disabled={defaultsDisabled}
            options={buildSelectOptions(textureOptions, defaultWallTex.trim().length === 0 ? null : defaultWallTex)}
            fill={true}
          />
        </FormGroup>

        <FormGroup label="Default floor texture" helperText={defaultsHelperText}>
          <HTMLSelect
            value={defaultFloorTex}
            onChange={(event) => setDefaultFloorTex(event.currentTarget.value)}
            disabled={defaultsDisabled}
            options={buildSelectOptions(
              textureOptions,
              defaultFloorTex.trim().length === 0 ? null : defaultFloorTex
            )}
            fill={true}
          />
        </FormGroup>

        <FormGroup label="Default ceiling texture" helperText={defaultsHelperText}>
          <HTMLSelect
            value={defaultCeilTex}
            onChange={(event) => setDefaultCeilTex(event.currentTarget.value)}
            disabled={defaultsDisabled}
            options={buildSelectOptions(textureOptions, defaultCeilTex.trim().length === 0 ? null : defaultCeilTex)}
            fill={true}
          />
        </FormGroup>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <Button onClick={props.onCancel}>Cancel</Button>
        <Button onClick={props.onDone}>Done</Button>
        <Button intent="primary" onClick={apply}>
          Apply
        </Button>
      </div>
    </div>
  );
}

function App(): JSX.Element {
  const settingsMode = isSettingsMode();

  const mapDocument = useNomosStore((state) => state.mapDocument);
  const settings = useNomosStore((state) => state.settings);
  const recentMapPaths = useNomosStore((state) => state.recentMapPaths);

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

  if (settingsMode) {
    return (
      <div style={{ padding: 16, height: '100%', boxSizing: 'border-box', overflow: 'auto' }}>
        <H1>Settings</H1>
        <SettingsPanel onDone={() => window.close()} onCancel={() => window.close()} />
      </div>
    );
  }

  if (mapDocument === null) {
    return (
      <FreshLaunchView
        settings={settings}
        recentMapPaths={recentMapPaths}
        onCreateNew={() => {
          void (async () => {
            await window.nomos.map.new();
          })();
        }}
        onOpenExisting={() => {
          void (async () => {
            const result = await window.nomos.dialogs.openMap();
            if (!result.ok) {
              return;
            }
            if (result.value === null) {
              return;
            }
            await window.nomos.map.open({ mapPath: result.value });
          })();
        }}
        onOpenRecentMap={(mapPath) => {
          void (async () => {
            await window.nomos.map.open({ mapPath });
          })();
        }}
      />
    );
  }

  return <EditorShell />;
}

const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(<App />);
