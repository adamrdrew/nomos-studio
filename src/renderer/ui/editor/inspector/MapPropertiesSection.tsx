import React from 'react';
import { Colors, FormGroup, HTMLSelect, InputGroup, Intent, Position, Toaster } from '@blueprintjs/core';

import { useNomosStore } from '../../../store/nomosStore';

import type { MapEditPrimitiveValue, MapEditTargetRef } from '../../../../shared/ipc/nomosIpc';

const toaster = Toaster.create({ position: Position.TOP });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readOptionalNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
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

export function MapPropertiesSection(): JSX.Element {
  const mapDocument = useNomosStore((state) => state.mapDocument);
  const assetIndex = useNomosStore((state) => state.assetIndex);

  const revision = mapDocument?.revision ?? 0;

  const midiOptions = React.useMemo(() => {
    if (assetIndex === null) {
      return [];
    }
    return extractAssetBasenames(assetIndex.entries, 'Sounds/MIDI/');
  }, [assetIndex]);

  const soundFontOptions = React.useMemo(() => {
    if (assetIndex === null) {
      return [];
    }
    return extractAssetBasenames(assetIndex.entries, 'Sounds/SoundFonts/');
  }, [assetIndex]);

  const skyOptions = React.useMemo(() => {
    if (assetIndex === null) {
      return [];
    }
    return extractAssetBasenames(assetIndex.entries, 'Images/Sky/');
  }, [assetIndex]);

  const commitUpdateFields = React.useCallback(
    async (set: Readonly<Record<string, MapEditPrimitiveValue>>): Promise<void> => {
      if (mapDocument === null) {
        return;
      }

      const target: MapEditTargetRef = { kind: 'map' };

      const result = await window.nomos.map.edit({
        baseRevision: mapDocument.revision,
        command: {
          kind: 'map-edit/update-fields',
          target,
          set
        }
      });

      if (!result.ok) {
        if (result.error.code === 'map-edit/stale-revision') {
          await useNomosStore.getState().refreshFromMain();
          toaster.show({ message: 'Document changed; refreshed. Please retry.', intent: Intent.WARNING });
          return;
        }

        // eslint-disable-next-line no-console
        console.error('[nomos] map update-fields (map root) failed', result.error);
      }
    },
    [mapDocument]
  );

  const json = mapDocument?.json ?? null;
  const root = isRecord(json) ? json : null;

  const currentBgmusic = root ? readOptionalNonEmptyString(root['bgmusic']) : null;
  const currentSoundfont = root ? readOptionalNonEmptyString(root['soundfont']) : null;
  const currentSky = root ? readOptionalNonEmptyString(root['sky']) : null;
  const currentName = root ? readOptionalNonEmptyString(root['name']) : null;

  const [nameInput, setNameInput] = React.useState<string>(currentName ?? '');
  React.useEffect(() => {
    setNameInput(currentName ?? '');
  }, [currentName, revision]);

  if (mapDocument === null) {
    return <div style={{ opacity: 0.7 }}>No map is open</div>;
  }

  if (root === null) {
    return <div style={{ opacity: 0.7 }}>Map JSON root is not an object</div>;
  }

  const assetsAvailable = assetIndex !== null;
  const assetHelperText = assetsAvailable
    ? undefined
    : 'Assets index is not available. Configure assets and refresh the index to populate dropdowns.';

  return (
    <div>
      <FormGroup label="Name" style={{ marginBottom: 10 }}>
        <InputGroup
          value={nameInput}
          onChange={(event) => setNameInput(event.currentTarget.value)}
          onBlur={() => void commitUpdateFields({ name: nameInput })}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              void commitUpdateFields({ name: nameInput });
            }
          }}
          style={{ backgroundColor: Colors.DARK_GRAY1, color: Colors.LIGHT_GRAY5 }}
        />
      </FormGroup>

      <FormGroup label="Background Music" helperText={assetHelperText} style={{ marginBottom: 10 }}>
        <HTMLSelect
          fill={true}
          disabled={!assetsAvailable}
          value={currentBgmusic ?? ''}
          onChange={(event) =>
            void commitUpdateFields({
              bgmusic: event.currentTarget.value.trim().length === 0 ? null : event.currentTarget.value
            })
          }
        >
          {buildSelectOptions(midiOptions, currentBgmusic).map((option) => (
            <option key={option.label} value={option.value}>
              {option.label}
            </option>
          ))}
        </HTMLSelect>
      </FormGroup>

      <FormGroup label="Sound Font" helperText={assetHelperText} style={{ marginBottom: 10 }}>
        <HTMLSelect
          fill={true}
          disabled={!assetsAvailable}
          value={currentSoundfont ?? ''}
          onChange={(event) =>
            void commitUpdateFields({
              soundfont: event.currentTarget.value.trim().length === 0 ? null : event.currentTarget.value
            })
          }
        >
          {buildSelectOptions(soundFontOptions, currentSoundfont).map((option) => (
            <option key={option.label} value={option.value}>
              {option.label}
            </option>
          ))}
        </HTMLSelect>
      </FormGroup>

      <FormGroup label="Sky" helperText={assetHelperText} style={{ marginBottom: 0 }}>
        <HTMLSelect
          fill={true}
          disabled={!assetsAvailable}
          value={currentSky ?? ''}
          onChange={(event) =>
            void commitUpdateFields({ sky: event.currentTarget.value.trim().length === 0 ? null : event.currentTarget.value })
          }
        >
          {buildSelectOptions(skyOptions, currentSky).map((option) => (
            <option key={option.label} value={option.value}>
              {option.label}
            </option>
          ))}
        </HTMLSelect>
      </FormGroup>
    </div>
  );
}
