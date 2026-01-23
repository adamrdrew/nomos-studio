import React from 'react';
import { Button, Colors, FormGroup, HTMLSelect, InputGroup, Intent, Position, Switch, TextArea, Toaster } from '@blueprintjs/core';
import { IconNames } from '@blueprintjs/icons';

import type { AssetIndex, MapDocument } from '../../../../shared/domain/models';
import { MAP_EDIT_UNSET, type MapEditFieldValue, type MapEditTargetRef } from '../../../../shared/ipc/nomosIpc';

import { useNomosStore } from '../../../store/nomosStore';

import type { MapDoor, MapEntityPlacement, MapLight, MapParticleEmitter, MapSector, MapWall } from '../map/mapViewModel';

import {
  cancelToggleSectorIdPicker,
  reduceToggleSectorIdPicker,
  type ToggleSectorIdPicker
} from './toggleSectorIdPicker';

const toaster = Toaster.create({ position: Position.TOP });

const SECTOR_WALL_TEX_MIXED_VALUE = '__nomos_mixed__';

type EditableSelection =
  | Readonly<{ kind: 'light'; title: string; value: MapLight; target: MapEditTargetRef }>
  | Readonly<{ kind: 'particle'; title: string; value: MapParticleEmitter; target: MapEditTargetRef }>
  | Readonly<{ kind: 'entity'; title: string; value: MapEntityPlacement; target: MapEditTargetRef }>
  | Readonly<{ kind: 'door'; title: string; value: MapDoor; target: MapEditTargetRef }>
  | Readonly<{ kind: 'wall'; title: string; value: MapWall; target: MapEditTargetRef }>
  | Readonly<{ kind: 'sector'; title: string; value: MapSector; target: MapEditTargetRef }>;

export type InspectorSelectionModel = EditableSelection;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toHexByte(value: number): string {
  const rounded = Math.round(clamp(value, 0, 255));
  return rounded.toString(16).padStart(2, '0');
}

function rgbToHex(color: Readonly<{ r: number; g: number; b: number }>): string {
  return `#${toHexByte(color.r)}${toHexByte(color.g)}${toHexByte(color.b)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseEntityManifestFiles(json: unknown): readonly string[] {
  const files: string[] = [];

  // Primary supported shape:
  // { files: ["defs/shambler.json", ...] }
  if (isRecord(json) && Array.isArray(json['files'])) {
    for (const entry of json['files']) {
      if (typeof entry === 'string' && entry.trim().length > 0) {
        files.push(entry.trim());
      }
    }
  }

  // Back-compat shapes from earlier experiments:
  // - raw array
  // - { entities: [...] } or { defs: [...] }
  const rawList: unknown[] | null =
    Array.isArray(json) ? json : isRecord(json) && Array.isArray(json['entities']) ? (json['entities'] as unknown[]) : isRecord(json) && Array.isArray(json['defs']) ? (json['defs'] as unknown[]) : null;

  if (rawList !== null) {
    for (const entry of rawList) {
      if (typeof entry === 'string' && entry.trim().length > 0) {
        files.push(entry.trim());
      } else if (isRecord(entry)) {
        const def = entry['def'];
        const name = entry['name'];
        const id = entry['id'];
        const candidate = typeof def === 'string' ? def : typeof name === 'string' ? name : typeof id === 'string' ? id : null;
        if (candidate && candidate.trim().length > 0) {
          files.push(candidate.trim());
        }
      }
    }
  }

  const unique = Array.from(new Set(files));
  unique.sort((a, b) => a.localeCompare(b));
  return unique;
}

type EntityDefOption = Readonly<{ value: string; label: string }>;

function fileToEntityLabel(filePath: string): string {
  const trimmed = filePath.trim();
  if (trimmed.length === 0) {
    return trimmed;
  }
  const lastSlash = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'));
  const base = lastSlash >= 0 ? trimmed.slice(lastSlash + 1) : trimmed;
  return base.toLowerCase().endsWith('.json') ? base.slice(0, -'.json'.length) : base;
}

function entityDefValueLooksLikeFilePath(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.includes('/') || trimmed.includes('\\') || trimmed.toLowerCase().endsWith('.json');
}

function buildEntityDefOptions(manifestFiles: readonly string[], currentValue: string | null): readonly EntityDefOption[] {
  const useFilePathValues = currentValue !== null && entityDefValueLooksLikeFilePath(currentValue);

  const options: EntityDefOption[] = [];
  for (const filePath of manifestFiles) {
    const label = fileToEntityLabel(filePath);
    const value = useFilePathValues ? filePath : label;
    options.push({ value, label });
  }

  // Ensure the current value remains selectable/displayable even if it isn't in the manifest list.
  if (currentValue && currentValue.trim().length > 0) {
    const alreadyPresent = options.some((opt) => opt.value === currentValue);
    if (!alreadyPresent) {
      options.push({ value: currentValue, label: currentValue });
    }
  }

  options.sort((a, b) => a.label.localeCompare(b.label));
  return options;
}

function getTextureFileNames(assetIndex: AssetIndex | null): readonly string[] {
  if (assetIndex === null) {
    return [];
  }

  const prefixes = ['Images/Textures/', 'Assets/Images/Textures/'] as const;

  let matches: string[] = [];
  for (const prefix of prefixes) {
    const candidate = assetIndex.entries
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

function getEffectsSoundFileNames(assetIndex: AssetIndex | null): readonly string[] {
  if (assetIndex === null) {
    return [];
  }

  const prefixes = ['Sounds/Effects/', 'Assets/Sounds/Effects/'] as const;

  let matches: string[] = [];
  for (const prefix of prefixes) {
    const candidate = assetIndex.entries
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

function ReadOnlyField(props: { label: string; value: string }): JSX.Element {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
      <div style={{ opacity: 0.85 }}>{props.label}</div>
      <div style={{ fontFamily: 'monospace', overflowWrap: 'anywhere' }}>{props.value}</div>
    </div>
  );
}

function getSectorBoundaryWallTexState(
  mapJson: unknown,
  sectorId: number
): Readonly<{ kind: 'none' } | { kind: 'uniform'; tex: string } | { kind: 'mixed' }> {
  if (!isRecord(mapJson)) {
    return { kind: 'none' };
  }

  const walls = mapJson['walls'];
  if (!Array.isArray(walls)) {
    return { kind: 'none' };
  }

  const textures = new Set<string>();
  for (const wall of walls) {
    if (!isRecord(wall)) {
      continue;
    }

    const frontSector = wall['front_sector'];
    if (typeof frontSector !== 'number' || !Number.isInteger(frontSector) || frontSector !== sectorId) {
      continue;
    }

    const tex = wall['tex'];
    if (typeof tex !== 'string') {
      continue;
    }

    const trimmed = tex.trim();
    if (trimmed.length === 0) {
      continue;
    }

    textures.add(trimmed);
    if (textures.size > 1) {
      return { kind: 'mixed' };
    }
  }

  const only = textures.values().next().value as string | undefined;
  return only ? { kind: 'uniform', tex: only } : { kind: 'none' };
}

function useEditCommitter(mapDocument: MapDocument | null): {
  commitUpdateFields: (target: MapEditTargetRef, set: Readonly<Record<string, MapEditFieldValue>>) => Promise<void>;
  commitSetSectorWallTex: (sectorId: number, tex: string) => Promise<void>;
} {
  const commitUpdateFields = React.useCallback(
    async (target: MapEditTargetRef, set: Readonly<Record<string, MapEditFieldValue>>): Promise<void> => {
      if (mapDocument === null) {
        return;
      }

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
        console.error('[nomos] map update-fields failed', result.error);
      }
    },
    [mapDocument]
  );

  const commitSetSectorWallTex = React.useCallback(
    async (sectorId: number, tex: string): Promise<void> => {
      if (mapDocument === null) {
        return;
      }

      const result = await window.nomos.map.edit({
        baseRevision: mapDocument.revision,
        command: {
          kind: 'map-edit/set-sector-wall-tex',
          sectorId,
          tex
        }
      });

      if (!result.ok) {
        if (result.error.code === 'map-edit/stale-revision') {
          await useNomosStore.getState().refreshFromMain();
          toaster.show({ message: 'Document changed; refreshed. Please retry.', intent: Intent.WARNING });
          return;
        }

        // eslint-disable-next-line no-console
        console.error('[nomos] map set-sector-wall-tex failed', result.error);
        toaster.show({ message: 'Failed to texture walls.', intent: Intent.DANGER });
      }
    },
    [mapDocument]
  );

  return { commitUpdateFields, commitSetSectorWallTex };
}

function buildSectorIdSelectOptions(
  availableSectorIds: readonly number[],
  currentId: number | null
): readonly { value: string; label: string; disabled?: boolean }[] {
  const options: { value: string; label: string; disabled?: boolean }[] = [{ value: '', label: '(none)' }];

  const availableSet = new Set<number>(availableSectorIds);
  if (currentId !== null && !availableSet.has(currentId)) {
    options.push({ value: String(currentId), label: `${currentId} (missing)`, disabled: true });
  }

  const sorted = [...availableSectorIds].sort((a, b) => a - b);
  for (const sectorId of sorted) {
    options.push({ value: String(sectorId), label: String(sectorId) });
  }

  return options;
}

function EditorTextInput(props: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  onCommit: () => void;
  error?: string | null;
}): JSX.Element {
  return (
    <FormGroup
      label={props.label}
      helperText={props.error ?? undefined}
      intent={props.error ? Intent.DANGER : Intent.NONE}
      style={{ marginBottom: 10 }}
    >
      <InputGroup
        value={props.value}
        onChange={(event) => props.onChange(event.currentTarget.value)}
        onBlur={() => props.onCommit()}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            props.onCommit();
          }
        }}
        intent={props.error ? Intent.DANGER : Intent.NONE}
        style={{ backgroundColor: Colors.DARK_GRAY1, color: Colors.LIGHT_GRAY5 }}
      />
    </FormGroup>
  );
}

function LightEditor(props: {
  mapDocument: MapDocument;
  assetIndex: AssetIndex | null;
  light: MapLight;
  target: MapEditTargetRef;
}): JSX.Element {
  const { commitUpdateFields } = useEditCommitter(props.mapDocument);

  const selectionKey = `light:${props.light.index}`;

  const [xText, setXText] = React.useState<string>(String(props.light.x));
  const [yText, setYText] = React.useState<string>(String(props.light.y));
  const [radiusText, setRadiusText] = React.useState<string>(String(props.light.radius));
  const [intensityText, setIntensityText] = React.useState<string>(String(props.light.intensity));

  const [colorRText, setColorRText] = React.useState<string>(String(props.light.color.r));
  const [colorGText, setColorGText] = React.useState<string>(String(props.light.color.g));
  const [colorBText, setColorBText] = React.useState<string>(String(props.light.color.b));

  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setXText(String(props.light.x));
    setYText(String(props.light.y));
    setRadiusText(String(props.light.radius));
    setIntensityText(String(props.light.intensity));
    setColorRText(String(props.light.color.r));
    setColorGText(String(props.light.color.g));
    setColorBText(String(props.light.color.b));
    setError(null);
  }, [selectionKey, props.light]);

  const commitNumber = async (
    jsonKey: string,
    rawText: string,
    currentValue: number,
    setText: (next: string) => void
  ): Promise<void> => {
    const parsed = Number.parseFloat(rawText);
    if (!Number.isFinite(parsed)) {
      setError(`${jsonKey} must be a finite number`);
      setText(String(currentValue));
      return;
    }

    if (parsed === currentValue) {
      setError(null);
      return;
    }

    setError(null);
    setText(String(parsed));
    await commitUpdateFields(props.target, { [jsonKey]: parsed });
  };

  const commitColor = async (): Promise<void> => {
    const r = Number.parseFloat(colorRText);
    const g = Number.parseFloat(colorGText);
    const b = Number.parseFloat(colorBText);

    if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) {
      setError('color components must be finite numbers');
      setColorRText(String(props.light.color.r));
      setColorGText(String(props.light.color.g));
      setColorBText(String(props.light.color.b));
      return;
    }

    const clamped = {
      r: Math.round(clamp(r, 0, 255)),
      g: Math.round(clamp(g, 0, 255)),
      b: Math.round(clamp(b, 0, 255))
    };

    const nextHex = rgbToHex(clamped);
    const currentHex = rgbToHex(props.light.color);
    if (nextHex.toLowerCase() === currentHex.toLowerCase()) {
      setError(null);
      return;
    }

    setError(null);
    setColorRText(String(clamped.r));
    setColorGText(String(clamped.g));
    setColorBText(String(clamped.b));
    await commitUpdateFields(props.target, { color: nextHex });
  };

  return (
    <div>
      <EditorTextInput
        label="x"
        value={xText}
        onChange={setXText}
        onCommit={() => {
          void commitNumber('x', xText, props.light.x, setXText);
        }}
        error={error}
      />
      <EditorTextInput
        label="y"
        value={yText}
        onChange={setYText}
        onCommit={() => {
          void commitNumber('y', yText, props.light.y, setYText);
        }}
        error={error}
      />
      <EditorTextInput
        label="radius"
        value={radiusText}
        onChange={setRadiusText}
        onCommit={() => {
          void commitNumber('radius', radiusText, props.light.radius, setRadiusText);
        }}
        error={error}
      />
      <EditorTextInput
        label="intensity"
        value={intensityText}
        onChange={setIntensityText}
        onCommit={() => {
          void commitNumber('intensity', intensityText, props.light.intensity, setIntensityText);
        }}
        error={error}
      />

      <FormGroup label="color (RGB 0–255)" helperText={error ?? undefined} intent={error ? Intent.DANGER : Intent.NONE}>
        <div style={{ display: 'flex', gap: 8 }}>
          <InputGroup
            value={colorRText}
            onChange={(event) => setColorRText(event.currentTarget.value)}
            onBlur={() => void commitColor()}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                void commitColor();
              }
            }}
            style={{ backgroundColor: Colors.DARK_GRAY1, color: Colors.LIGHT_GRAY5 }}
          />
          <InputGroup
            value={colorGText}
            onChange={(event) => setColorGText(event.currentTarget.value)}
            onBlur={() => void commitColor()}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                void commitColor();
              }
            }}
            style={{ backgroundColor: Colors.DARK_GRAY1, color: Colors.LIGHT_GRAY5 }}
          />
          <InputGroup
            value={colorBText}
            onChange={(event) => setColorBText(event.currentTarget.value)}
            onBlur={() => void commitColor()}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                void commitColor();
              }
            }}
            style={{ backgroundColor: Colors.DARK_GRAY1, color: Colors.LIGHT_GRAY5 }}
          />
        </div>
      </FormGroup>
    </div>
  );
}

function ParticleEditor(props: { mapDocument: MapDocument; particle: MapParticleEmitter; target: MapEditTargetRef }): JSX.Element {
  const { commitUpdateFields } = useEditCommitter(props.mapDocument);

  const selectionKey = `particle:${props.particle.index}`;

  const [xText, setXText] = React.useState<string>(String(props.particle.x));
  const [yText, setYText] = React.useState<string>(String(props.particle.y));
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setXText(String(props.particle.x));
    setYText(String(props.particle.y));
    setError(null);
  }, [selectionKey, props.particle]);

  const commitNumber = async (
    jsonKey: 'x' | 'y',
    rawText: string,
    currentValue: number,
    setText: (next: string) => void
  ): Promise<void> => {
    const parsed = Number.parseFloat(rawText);
    if (!Number.isFinite(parsed)) {
      setError(`${jsonKey} must be a finite number`);
      setText(String(currentValue));
      return;
    }

    if (parsed === currentValue) {
      setError(null);
      return;
    }

    setError(null);
    setText(String(parsed));
    await commitUpdateFields(props.target, { [jsonKey]: parsed });
  };

  return (
    <div>
      <EditorTextInput
        label="x"
        value={xText}
        onChange={setXText}
        onCommit={() => {
          void commitNumber('x', xText, props.particle.x, setXText);
        }}
        error={error}
      />
      <EditorTextInput
        label="y"
        value={yText}
        onChange={setYText}
        onCommit={() => {
          void commitNumber('y', yText, props.particle.y, setYText);
        }}
        error={error}
      />
    </div>
  );
}

function DoorEditor(props: {
  mapDocument: MapDocument;
  assetIndex: AssetIndex | null;
  door: MapDoor;
  target: MapEditTargetRef;
}): JSX.Element {
  const { commitUpdateFields } = useEditCommitter(props.mapDocument);

  const textureOptions = React.useMemo(() => getTextureFileNames(props.assetIndex), [props.assetIndex]);

  const selectionKey = `door:${props.door.id}`;

  const [tex, setTex] = React.useState<string>(props.door.tex ?? '');
  const [startsClosed, setStartsClosed] = React.useState<boolean>(props.door.startsClosed);
  const [requiredItemText, setRequiredItemText] = React.useState<string>(props.door.requiredItem ?? '');
  const [requiredItemMissingMessageText, setRequiredItemMissingMessageText] = React.useState<string>(props.door.requiredItemMissingMessage ?? '');

  React.useEffect(() => {
    setTex(props.door.tex ?? '');
    setStartsClosed(props.door.startsClosed);
    setRequiredItemText(props.door.requiredItem ?? '');
    setRequiredItemMissingMessageText(props.door.requiredItemMissingMessage ?? '');
  }, [selectionKey, props.door]);

  const commitOptionalString = React.useCallback(
    async (jsonKey: string, rawText: string, currentValue: string | null, setText: (next: string) => void): Promise<void> => {
      const trimmed = rawText.trim();
      const nextValue = trimmed.length === 0 ? null : trimmed;

      if (nextValue === currentValue) {
        setText(currentValue ?? '');
        return;
      }

      setText(nextValue ?? '');
      await commitUpdateFields(props.target, { [jsonKey]: nextValue });
    },
    [commitUpdateFields, props.target]
  );

  return (
    <div>
      <ReadOnlyField label="id" value={props.door.id} />
      <ReadOnlyField label="wallIndex" value={String(props.door.wallIndex)} />

      <FormGroup label="texture" style={{ marginTop: 10, marginBottom: 10 }}>
        <HTMLSelect
          value={tex}
          onChange={(event) => {
            const next = event.currentTarget.value;
            setTex(next);
            const current = props.door.tex ?? '';
            if (next === current) {
              return;
            }
            if (next.trim().length === 0) {
              void commitUpdateFields(props.target, { tex: MAP_EDIT_UNSET });
              return;
            }
            void commitUpdateFields(props.target, { tex: next });
          }}
          style={{ width: '100%', backgroundColor: Colors.DARK_GRAY1, color: Colors.LIGHT_GRAY5 }}
        >
          <option value="">(select texture)</option>
          {textureOptions.length === 0 ? <option value={tex}>No textures indexed</option> : null}
          {textureOptions.map((fileName) => (
            <option key={fileName} value={fileName}>
              {fileName}
            </option>
          ))}
        </HTMLSelect>
      </FormGroup>

      <FormGroup label="startsClosed" style={{ marginBottom: 0 }}>
        <Switch
          checked={startsClosed}
          onChange={(event) => {
            const next = (event.currentTarget as HTMLInputElement).checked;
            setStartsClosed(next);
            if (next !== props.door.startsClosed) {
              void commitUpdateFields(props.target, { starts_closed: next });
            }
          }}
          style={{ color: Colors.LIGHT_GRAY5 }}
        />
      </FormGroup>

      <EditorTextInput
        label="requiredItem"
        value={requiredItemText}
        onChange={setRequiredItemText}
        onCommit={() => {
          void commitOptionalString('required_item', requiredItemText, props.door.requiredItem, setRequiredItemText);
        }}
      />

      <FormGroup label="requiredItemMissingMessage" style={{ marginBottom: 10 }}>
        <TextArea
          value={requiredItemMissingMessageText}
          onChange={(event) => setRequiredItemMissingMessageText(event.currentTarget.value)}
          onBlur={() => {
            void commitOptionalString(
              'required_item_missing_message',
              requiredItemMissingMessageText,
              props.door.requiredItemMissingMessage,
              setRequiredItemMissingMessageText
            );
          }}
          style={{ width: '100%', backgroundColor: Colors.DARK_GRAY1, color: Colors.LIGHT_GRAY5, minHeight: 80 }}
        />
      </FormGroup>
    </div>
  );
}

function WallEditor(props: {
  mapDocument: MapDocument;
  assetIndex: AssetIndex | null;
  wall: MapWall;
  target: MapEditTargetRef;
  availableSectorIds: readonly number[];
  isPickingToggleSectorId: boolean;
  onTogglePickToggleSectorId: () => void;
}): JSX.Element {
  const { commitUpdateFields } = useEditCommitter(props.mapDocument);

  const textureOptions = React.useMemo(() => getTextureFileNames(props.assetIndex), [props.assetIndex]);
  const effectsSoundOptions = React.useMemo(() => getEffectsSoundFileNames(props.assetIndex), [props.assetIndex]);

  const selectionKey = `wall:${props.wall.index}`;

  const [v0Text, setV0Text] = React.useState<string>(String(props.wall.v0));
  const [v1Text, setV1Text] = React.useState<string>(String(props.wall.v1));
  const [frontSectorText, setFrontSectorText] = React.useState<string>(String(props.wall.frontSector));
  const [backSectorText, setBackSectorText] = React.useState<string>(String(props.wall.backSector));
  const [tex, setTex] = React.useState<string>(props.wall.tex);
  const [endLevel, setEndLevel] = React.useState<boolean>(props.wall.endLevel);

  const [toggleSector, setToggleSector] = React.useState<boolean>(props.wall.toggleSector);
  const [toggleSectorId, setToggleSectorId] = React.useState<number | null>(props.wall.toggleSectorId);
  const [toggleSectorOneshot, setToggleSectorOneshot] = React.useState<boolean>(props.wall.toggleSectorOneshot);
  const [toggleSound, setToggleSound] = React.useState<string>(props.wall.toggleSound ?? '');
  const [toggleSoundFinish, setToggleSoundFinish] = React.useState<string>(props.wall.toggleSoundFinish ?? '');

  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setV0Text(String(props.wall.v0));
    setV1Text(String(props.wall.v1));
    setFrontSectorText(String(props.wall.frontSector));
    setBackSectorText(String(props.wall.backSector));
    setTex(props.wall.tex);
    setEndLevel(props.wall.endLevel);

    setToggleSector(props.wall.toggleSector);
    setToggleSectorId(props.wall.toggleSectorId);
    setToggleSectorOneshot(props.wall.toggleSectorOneshot);
    setToggleSound(props.wall.toggleSound ?? '');
    setToggleSoundFinish(props.wall.toggleSoundFinish ?? '');

    setError(null);
  }, [selectionKey, props.wall]);

  const commitInt = async (
    jsonKey: string,
    rawText: string,
    currentValue: number,
    setText: (next: string) => void
  ): Promise<void> => {
    const parsed = Number.parseFloat(rawText);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
      setError(`${jsonKey} must be an integer`);
      setText(String(currentValue));
      return;
    }

    if (parsed === currentValue) {
      setError(null);
      return;
    }

    setError(null);
    setText(String(parsed));
    await commitUpdateFields(props.target, { [jsonKey]: parsed });
  };

  return (
    <div>
      <ReadOnlyField label="index" value={String(props.wall.index)} />

      <EditorTextInput
        label="v0"
        value={v0Text}
        onChange={setV0Text}
        onCommit={() => {
          void commitInt('v0', v0Text, props.wall.v0, setV0Text);
        }}
        error={error}
      />
      <EditorTextInput
        label="v1"
        value={v1Text}
        onChange={setV1Text}
        onCommit={() => {
          void commitInt('v1', v1Text, props.wall.v1, setV1Text);
        }}
        error={error}
      />
      <EditorTextInput
        label="frontSector"
        value={frontSectorText}
        onChange={setFrontSectorText}
        onCommit={() => {
          void commitInt('front_sector', frontSectorText, props.wall.frontSector, setFrontSectorText);
        }}
        error={error}
      />
      <EditorTextInput
        label="backSector"
        value={backSectorText}
        onChange={setBackSectorText}
        onCommit={() => {
          void commitInt('back_sector', backSectorText, props.wall.backSector, setBackSectorText);
        }}
        error={error}
      />

      <FormGroup label="texture" style={{ marginTop: 10, marginBottom: 10 }}>
        <HTMLSelect
          value={tex}
          onChange={(event) => {
            const next = event.currentTarget.value;
            setTex(next);
            if (next !== props.wall.tex) {
              void commitUpdateFields(props.target, { tex: next });
            }
          }}
          style={{ width: '100%', backgroundColor: Colors.DARK_GRAY1, color: Colors.LIGHT_GRAY5 }}
        >
          {textureOptions.length === 0 ? <option value={tex}>No textures indexed</option> : null}
          {textureOptions.map((fileName) => (
            <option key={fileName} value={fileName}>
              {fileName}
            </option>
          ))}
        </HTMLSelect>
      </FormGroup>

      <FormGroup label="endLevel" style={{ marginBottom: 0 }}>
        <Switch
          checked={endLevel}
          onChange={(event) => {
            const next = (event.currentTarget as HTMLInputElement).checked;
            setEndLevel(next);
            if (next !== props.wall.endLevel) {
              void commitUpdateFields(props.target, { end_level: next });
            }
          }}
          style={{ color: Colors.LIGHT_GRAY5 }}
        />
      </FormGroup>

      <div style={{ height: 1, backgroundColor: Colors.DARK_GRAY1, margin: '14px 0' }} />

      <FormGroup label="toggleSector" style={{ marginBottom: 10 }}>
        <Switch
          checked={toggleSector}
          onChange={(event) => {
            const next = (event.currentTarget as HTMLInputElement).checked;
            setToggleSector(next);

            if (next) {
              if (!props.wall.toggleSector) {
                void commitUpdateFields(props.target, { toggle_sector: true });
              }
              return;
            }

            setToggleSectorId(null);
            setToggleSectorOneshot(false);
            setToggleSound('');
            setToggleSoundFinish('');

            void commitUpdateFields(props.target, {
              toggle_sector: MAP_EDIT_UNSET,
              toggle_sector_id: MAP_EDIT_UNSET,
              toggle_sector_oneshot: MAP_EDIT_UNSET,
              toggle_sound: MAP_EDIT_UNSET,
              toggle_sound_finish: MAP_EDIT_UNSET
            });
          }}
          style={{ color: Colors.LIGHT_GRAY5 }}
        />
      </FormGroup>

      {toggleSector ? (
        <>
          <FormGroup
            label="toggleSectorId"
            helperText={
              props.isPickingToggleSectorId ? 'Pick mode: click a sector to set this ID (Esc to cancel).' : undefined
            }
            style={{ marginBottom: 10 }}
          >
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <HTMLSelect
                fill={true}
                value={toggleSectorId !== null ? String(toggleSectorId) : ''}
                onChange={(event) => {
                  const raw = event.currentTarget.value;
                  const parsed = raw.trim().length === 0 ? null : Number.parseInt(raw, 10);
                  if (parsed === null) {
                    setToggleSectorId(null);
                    if (props.wall.toggleSectorId !== null) {
                      void commitUpdateFields(props.target, { toggle_sector_id: MAP_EDIT_UNSET });
                    }
                    return;
                  }
                  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
                    return;
                  }
                  if (!props.availableSectorIds.includes(parsed)) {
                    return;
                  }

                  setToggleSectorId(parsed);
                  if (parsed !== props.wall.toggleSectorId) {
                    void commitUpdateFields(props.target, { toggle_sector_id: parsed });
                  }
                }}
                style={{ width: '100%', backgroundColor: Colors.DARK_GRAY1, color: Colors.LIGHT_GRAY5 }}
              >
                {buildSectorIdSelectOptions(props.availableSectorIds, toggleSectorId).map((option) => (
                  <option key={option.label} value={option.value} disabled={option.disabled}>
                    {option.label}
                  </option>
                ))}
              </HTMLSelect>

              <Button
                small={true}
                minimal={true}
                icon={props.isPickingToggleSectorId ? IconNames.DISABLE : IconNames.TARGET}
                intent={props.isPickingToggleSectorId ? Intent.SUCCESS : Intent.NONE}
                onClick={props.onTogglePickToggleSectorId}
                title={props.isPickingToggleSectorId ? 'Cancel sector pick (Esc)' : 'Pick sector from map'}
              />
            </div>
          </FormGroup>

          <FormGroup label="toggleSectorOneshot" style={{ marginBottom: 10 }}>
            <Switch
              checked={toggleSectorOneshot}
              onChange={(event) => {
                const next = (event.currentTarget as HTMLInputElement).checked;
                setToggleSectorOneshot(next);
                if (next) {
                  if (!props.wall.toggleSectorOneshot) {
                    void commitUpdateFields(props.target, { toggle_sector_oneshot: true });
                  }
                  return;
                }

                if (props.wall.toggleSectorOneshot) {
                  void commitUpdateFields(props.target, { toggle_sector_oneshot: MAP_EDIT_UNSET });
                }
              }}
              style={{ color: Colors.LIGHT_GRAY5 }}
            />
          </FormGroup>

          <FormGroup label="toggleSound" style={{ marginBottom: 10 }}>
            <HTMLSelect
              fill={true}
              value={toggleSound}
              onChange={(event) => {
                const next = event.currentTarget.value;
                setToggleSound(next);
                const trimmed = next.trim();
                if (trimmed.length === 0) {
                  if (props.wall.toggleSound !== null) {
                    void commitUpdateFields(props.target, { toggle_sound: MAP_EDIT_UNSET });
                  }
                  return;
                }
                if (trimmed !== props.wall.toggleSound) {
                  void commitUpdateFields(props.target, { toggle_sound: trimmed });
                }
              }}
              style={{ width: '100%', backgroundColor: Colors.DARK_GRAY1, color: Colors.LIGHT_GRAY5 }}
            >
              <option value="">(none)</option>
              {effectsSoundOptions.map((fileName) => (
                <option key={fileName} value={fileName}>
                  {fileName}
                </option>
              ))}

              {toggleSound.trim().length > 0 && !effectsSoundOptions.includes(toggleSound.trim()) ? (
                <option value={toggleSound.trim()}>{toggleSound.trim()} (missing)</option>
              ) : null}
            </HTMLSelect>
          </FormGroup>

          <FormGroup label="toggleSoundFinish" style={{ marginBottom: 0 }}>
            <HTMLSelect
              fill={true}
              value={toggleSoundFinish}
              onChange={(event) => {
                const next = event.currentTarget.value;
                setToggleSoundFinish(next);
                const trimmed = next.trim();
                if (trimmed.length === 0) {
                  if (props.wall.toggleSoundFinish !== null) {
                    void commitUpdateFields(props.target, { toggle_sound_finish: MAP_EDIT_UNSET });
                  }
                  return;
                }
                if (trimmed !== props.wall.toggleSoundFinish) {
                  void commitUpdateFields(props.target, { toggle_sound_finish: trimmed });
                }
              }}
              style={{ width: '100%', backgroundColor: Colors.DARK_GRAY1, color: Colors.LIGHT_GRAY5 }}
            >
              <option value="">(none)</option>
              {effectsSoundOptions.map((fileName) => (
                <option key={fileName} value={fileName}>
                  {fileName}
                </option>
              ))}

              {toggleSoundFinish.trim().length > 0 && !effectsSoundOptions.includes(toggleSoundFinish.trim()) ? (
                <option value={toggleSoundFinish.trim()}>{toggleSoundFinish.trim()} (missing)</option>
              ) : null}
            </HTMLSelect>
          </FormGroup>

          {effectsSoundOptions.length === 0 ? (
            <div style={{ marginTop: 8, opacity: 0.7, fontSize: 12 }}>
              No sounds indexed under Sounds/Effects/.
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function SectorEditor(props: {
  mapDocument: MapDocument;
  assetIndex: AssetIndex | null;
  sector: MapSector;
  target: MapEditTargetRef;
}): JSX.Element {
  const { commitUpdateFields, commitSetSectorWallTex } = useEditCommitter(props.mapDocument);

  const textureOptions = React.useMemo(() => getTextureFileNames(props.assetIndex), [props.assetIndex]);
  const selectionKey = `sector:${props.sector.id}`;

  const [floorZText, setFloorZText] = React.useState<string>(String(props.sector.floorZ));
  const [ceilZText, setCeilZText] = React.useState<string>(String(props.sector.ceilZ));
  const [lightText, setLightText] = React.useState<string>(String(props.sector.light));
  const [floorTex, setFloorTex] = React.useState<string>(props.sector.floorTex);
  const [ceilTex, setCeilTex] = React.useState<string>(props.sector.ceilTex);
  const [floorZToggledPos, setFloorZToggledPos] = React.useState<number | null>(props.sector.floorZToggledPos);
  const [wallTex, setWallTex] = React.useState<string>('');

  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setFloorZText(String(props.sector.floorZ));
    setCeilZText(String(props.sector.ceilZ));
    setLightText(String(props.sector.light));
    setFloorTex(props.sector.floorTex);
    setCeilTex(props.sector.ceilTex);
    setFloorZToggledPos(props.sector.floorZToggledPos);

    setWallTex('');

    setError(null);
  }, [selectionKey, props.sector]);

  React.useEffect(() => {
    const wallTexState = getSectorBoundaryWallTexState(props.mapDocument.json, props.sector.id);
    const nextWallTex =
      wallTexState.kind === 'uniform'
        ? wallTexState.tex
        : wallTexState.kind === 'mixed'
          ? SECTOR_WALL_TEX_MIXED_VALUE
          : '';

    setWallTex((current) => {
      const trimmed = current.trim();
      const isUserChoice = trimmed.length > 0 && current !== SECTOR_WALL_TEX_MIXED_VALUE;
      return isUserChoice ? current : nextWallTex;
    });
  }, [props.mapDocument.json, props.sector.id]);

  const commitNumber = async (
    jsonKey: string,
    rawText: string,
    currentValue: number,
    setText: (next: string) => void
  ): Promise<void> => {
    const parsed = Number.parseFloat(rawText);
    if (!Number.isFinite(parsed)) {
      setError(`${jsonKey} must be a finite number`);
      setText(String(currentValue));
      return;
    }

    if (parsed === currentValue) {
      setError(null);
      return;
    }

    setError(null);
    setText(String(parsed));
    await commitUpdateFields(props.target, { [jsonKey]: parsed });
  };

  const commitSectorLight = async (): Promise<void> => {
    const parsed = Number.parseFloat(lightText);
    if (!Number.isFinite(parsed)) {
      setError('light must be a finite number');
      setLightText(String(props.sector.light));
      return;
    }

    const clamped = clamp(parsed, 0, 1);
    if (clamped !== parsed) {
      toaster.show({ message: 'Clamped light to [0, 1].', intent: Intent.WARNING });
    }

    if (clamped === props.sector.light) {
      setError(null);
      setLightText(String(clamped));
      return;
    }

    setError(null);
    setLightText(String(clamped));
    await commitUpdateFields(props.target, { light: clamped });
  };

  return (
    <div>
      <ReadOnlyField label="id" value={String(props.sector.id)} />

      <EditorTextInput
        label="floorZ"
        value={floorZText}
        onChange={setFloorZText}
        onCommit={() => {
          void commitNumber('floor_z', floorZText, props.sector.floorZ, setFloorZText);
        }}
        error={error}
      />
      <EditorTextInput
        label="ceilZ"
        value={ceilZText}
        onChange={setCeilZText}
        onCommit={() => {
          void commitNumber('ceil_z', ceilZText, props.sector.ceilZ, setCeilZText);
        }}
        error={error}
      />
      <EditorTextInput
        label="light (0..1)"
        value={lightText}
        onChange={setLightText}
        onCommit={() => {
          void commitSectorLight();
        }}
        error={error}
      />

      <FormGroup label="floor texture" style={{ marginTop: 10, marginBottom: 10 }}>
        <HTMLSelect
          value={floorTex}
          onChange={(event) => {
            const next = event.currentTarget.value;
            setFloorTex(next);
            if (next !== props.sector.floorTex) {
              void commitUpdateFields(props.target, { floor_tex: next });
            }
          }}
          style={{ width: '100%', backgroundColor: Colors.DARK_GRAY1, color: Colors.LIGHT_GRAY5 }}
        >
          {textureOptions.length === 0 ? <option value={floorTex}>No textures indexed</option> : null}
          {textureOptions.map((fileName) => (
            <option key={fileName} value={fileName}>
              {fileName}
            </option>
          ))}
        </HTMLSelect>
      </FormGroup>

      <FormGroup label="ceil texture" style={{ marginBottom: 0 }}>
        <HTMLSelect
          value={ceilTex}
          onChange={(event) => {
            const next = event.currentTarget.value;
            setCeilTex(next);
            if (next !== props.sector.ceilTex) {
              void commitUpdateFields(props.target, { ceil_tex: next });
            }
          }}
          style={{ width: '100%', backgroundColor: Colors.DARK_GRAY1, color: Colors.LIGHT_GRAY5 }}
        >
          {textureOptions.length === 0 ? <option value={ceilTex}>No textures indexed</option> : null}
          {textureOptions.map((fileName) => (
            <option key={fileName} value={fileName}>
              {fileName}
            </option>
          ))}
        </HTMLSelect>
      </FormGroup>

      <FormGroup label="Texture Walls" style={{ marginTop: 10, marginBottom: 0 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <HTMLSelect
            fill={true}
            value={wallTex}
            onChange={(event) => {
              setWallTex(event.currentTarget.value);
            }}
            style={{ flex: 1, backgroundColor: Colors.DARK_GRAY1, color: Colors.LIGHT_GRAY5 }}
          >
            {textureOptions.length === 0 ? <option value="">No textures indexed</option> : null}

            {textureOptions.length > 0 ? <option value="">(none)</option> : null}
            {textureOptions.length > 0 ? <option value={SECTOR_WALL_TEX_MIXED_VALUE}>(mixed)</option> : null}

            {textureOptions.map((fileName) => (
              <option key={fileName} value={fileName}>
                {fileName}
              </option>
            ))}

            {wallTex.trim().length > 0 && wallTex !== SECTOR_WALL_TEX_MIXED_VALUE && !textureOptions.includes(wallTex.trim()) ? (
              <option value={wallTex.trim()}>{wallTex.trim()} (missing)</option>
            ) : null}
          </HTMLSelect>

          <Button
            text="Set"
            intent={Intent.PRIMARY}
            disabled={
              textureOptions.length === 0 ||
              wallTex === SECTOR_WALL_TEX_MIXED_VALUE ||
              wallTex.trim().length === 0 ||
              !textureOptions.includes(wallTex.trim())
            }
            onClick={() => {
              void commitSetSectorWallTex(props.sector.id, wallTex.trim());
            }}
          />
        </div>

        {textureOptions.length === 0 ? (
          <div style={{ marginTop: 8, opacity: 0.7, fontSize: 12 }}>No textures indexed under Images/Textures/.</div>
        ) : null}
      </FormGroup>

      <FormGroup label="floorZToggledPos" style={{ marginBottom: 0 }}>
        <HTMLSelect
          fill={true}
          value={floorZToggledPos !== null ? String(floorZToggledPos) : ''}
          onChange={(event) => {
            const raw = event.currentTarget.value;
            const trimmed = raw.trim();
            if (trimmed.length === 0) {
              setFloorZToggledPos(null);
              if (props.sector.floorZToggledPos !== null) {
                void commitUpdateFields(props.target, { floor_z_toggled_pos: MAP_EDIT_UNSET });
              }
              return;
            }

            const parsed = Number.parseInt(trimmed, 10);
            if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
              return;
            }
            if (parsed < -10 || parsed > 10) {
              return;
            }

            setFloorZToggledPos(parsed);
            if (parsed !== props.sector.floorZToggledPos) {
              void commitUpdateFields(props.target, { floor_z_toggled_pos: parsed });
            }
          }}
          style={{ width: '100%', backgroundColor: Colors.DARK_GRAY1, color: Colors.LIGHT_GRAY5 }}
        >
          <option value="">(none)</option>
          {Array.from({ length: 21 }, (_, idx) => idx - 10).map((value) => (
            <option key={value} value={String(value)}>
              {value}
            </option>
          ))}
        </HTMLSelect>
      </FormGroup>
    </div>
  );
}

function EntityEditor(props: {
  mapDocument: MapDocument;
  assetIndex: AssetIndex | null;
  entity: MapEntityPlacement;
  target: MapEditTargetRef;
}): JSX.Element {
  const { commitUpdateFields } = useEditCommitter(props.mapDocument);

  const selectionKey = `entity:${props.entity.index}`;

  const [xText, setXText] = React.useState<string>(String(props.entity.x));
  const [yText, setYText] = React.useState<string>(String(props.entity.y));
  const [yawText, setYawText] = React.useState<string>(String(props.entity.yawDeg));

  const [defName, setDefName] = React.useState<string>(props.entity.defName ?? '');

  const [error, setError] = React.useState<string | null>(null);

  const [defNames, setDefNames] = React.useState<readonly string[] | null>(null);
  const [defNamesStatus, setDefNamesStatus] = React.useState<'idle' | 'loading' | 'loaded' | 'failed'>('idle');

  React.useEffect(() => {
    setXText(String(props.entity.x));
    setYText(String(props.entity.y));
    setYawText(String(props.entity.yawDeg));
    setDefName(props.entity.defName ?? '');
    setError(null);
  }, [selectionKey, props.entity]);

  React.useEffect(() => {
    let cancelled = false;

    setDefNamesStatus('loading');

    void (async () => {
      const pathsToTry = ['Entities/entities_manifest.json', 'Assets/Entities/entities_manifest.json'] as const;

      for (const relativePath of pathsToTry) {
        const result = await window.nomos.assets.readFileBytes({ relativePath });
        if (!result.ok) {
          continue;
        }

        try {
          const text = new TextDecoder('utf-8').decode(new Uint8Array(result.value));
          const parsed: unknown = JSON.parse(text);
          const next = parseEntityManifestFiles(parsed);

          if (!cancelled) {
            setDefNames(next);
            setDefNamesStatus('loaded');
          }
          return;
        } catch (_error: unknown) {
          // continue
        }
      }

      if (!cancelled) {
        setDefNames(null);
        setDefNamesStatus('failed');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const commitNumber = async (
    jsonKey: string,
    rawText: string,
    currentValue: number,
    setText: (next: string) => void
  ): Promise<void> => {
    const parsed = Number.parseFloat(rawText);
    if (!Number.isFinite(parsed)) {
      setError(`${jsonKey} must be a finite number`);
      setText(String(currentValue));
      return;
    }

    if (parsed === currentValue) {
      setError(null);
      return;
    }

    setError(null);
    setText(String(parsed));
    await commitUpdateFields(props.target, { [jsonKey]: parsed });
  };

  const commitDegrees = async (): Promise<void> => {
    const parsed = Number.parseFloat(yawText);
    if (!Number.isFinite(parsed)) {
      setError('yawDeg must be a finite number');
      setYawText(String(props.entity.yawDeg));
      return;
    }

    const clamped = clamp(parsed, 0, 360);
    if (clamped === props.entity.yawDeg) {
      setError(null);
      return;
    }

    setError(null);
    setYawText(String(clamped));
    await commitUpdateFields(props.target, { yaw_deg: clamped });
  };

  const options = defNames ?? [];

  const entityDefOptions = buildEntityDefOptions(options, props.entity.defName);

  return (
    <div>
      <EditorTextInput
        label="x"
        value={xText}
        onChange={setXText}
        onCommit={() => {
          void commitNumber('x', xText, props.entity.x, setXText);
        }}
        error={error}
      />
      <EditorTextInput
        label="y"
        value={yText}
        onChange={setYText}
        onCommit={() => {
          void commitNumber('y', yText, props.entity.y, setYText);
        }}
        error={error}
      />

      <EditorTextInput
        label="yawDeg (0–360)"
        value={yawText}
        onChange={setYawText}
        onCommit={() => {
          void commitDegrees();
        }}
        error={error}
      />

      <FormGroup
        label="Entity"
        helperText={
          defNamesStatus === 'loading'
            ? 'Loading entity defs…'
            : defNamesStatus === 'failed'
              ? 'Failed to load entities manifest; using current value.'
              : undefined
        }
      >
        <HTMLSelect
          value={defName}
          onChange={(event) => {
            const next = event.currentTarget.value;
            setDefName(next);
            const nextValue = next.trim().length === 0 ? null : next;
            if (nextValue !== props.entity.defName) {
              void commitUpdateFields(props.target, { def: nextValue });
            }
          }}
          style={{ width: '100%', backgroundColor: Colors.DARK_GRAY1, color: Colors.LIGHT_GRAY5 }}
        >
          <option value="">(none)</option>
          {entityDefOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </HTMLSelect>
      </FormGroup>
    </div>
  );
}

export function PropertiesEditor(props: {
  mapDocument: MapDocument | null;
  assetIndex: AssetIndex | null;
  selection: InspectorSelectionModel | null;
  availableSectorIds: readonly number[];
}): JSX.Element {
  const mapSelection = useNomosStore((state) => state.mapSelection);
  const setMapSelection = useNomosStore((state) => state.setMapSelection);
  const { commitUpdateFields } = useEditCommitter(props.mapDocument);

  const [toggleSectorIdPicker, setToggleSectorIdPicker] = React.useState<ToggleSectorIdPicker | null>(null);

  React.useEffect(() => {
    if (toggleSectorIdPicker === null) {
      return;
    }

    // If the user switches to a different wall while in pick mode, cancel.
    if (mapSelection !== null && mapSelection.kind === 'wall' && mapSelection.index !== toggleSectorIdPicker.wallIndex) {
      setToggleSectorIdPicker(null);
      return;
    }

    const reduced = reduceToggleSectorIdPicker(toggleSectorIdPicker, mapSelection);
    if (reduced.pickedSectorId === null) {
      return;
    }

    void commitUpdateFields(toggleSectorIdPicker.wallTarget, { toggle_sector_id: reduced.pickedSectorId });
    if (reduced.restoreSelection !== null) {
      setMapSelection(reduced.restoreSelection);
    }
    setToggleSectorIdPicker(reduced.nextPicker);
  }, [commitUpdateFields, mapSelection, setMapSelection, toggleSectorIdPicker]);

  React.useEffect(() => {
    if (toggleSectorIdPicker === null) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') {
        return;
      }

      const cancelled = cancelToggleSectorIdPicker(toggleSectorIdPicker);
      if (cancelled.restoreSelection !== null) {
        setMapSelection(cancelled.restoreSelection);
      }
      setToggleSectorIdPicker(cancelled.nextPicker);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setMapSelection, toggleSectorIdPicker]);

  const selection = props.selection;

  if (selection === null || props.mapDocument === null) {
    return <div style={{ opacity: 0.7 }}>Nothing selected</div>;
  }

  return (
    <div>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>{selection.title}</div>

      {selection.kind === 'light' ? (
        <LightEditor
          key={`light:${selection.value.index}`}
          mapDocument={props.mapDocument}
          assetIndex={props.assetIndex}
          light={selection.value}
          target={selection.target}
        />
      ) : selection.kind === 'particle' ? (
        <ParticleEditor
          key={`particle:${selection.value.index}`}
          mapDocument={props.mapDocument}
          particle={selection.value}
          target={selection.target}
        />
      ) : selection.kind === 'entity' ? (
        <EntityEditor
          key={`entity:${selection.value.index}`}
          mapDocument={props.mapDocument}
          assetIndex={props.assetIndex}
          entity={selection.value}
          target={selection.target}
        />
      ) : selection.kind === 'door' ? (
        <DoorEditor
          key={`door:${selection.value.id}`}
          mapDocument={props.mapDocument}
          assetIndex={props.assetIndex}
          door={selection.value}
          target={selection.target}
        />
      ) : selection.kind === 'wall' ? (
        <WallEditor
          key={`wall:${selection.value.index}`}
          mapDocument={props.mapDocument}
          assetIndex={props.assetIndex}
          wall={selection.value}
          target={selection.target}
          availableSectorIds={props.availableSectorIds}
          isPickingToggleSectorId={
            toggleSectorIdPicker !== null && toggleSectorIdPicker.wallIndex === selection.value.index
          }
          onTogglePickToggleSectorId={() => {
            if (toggleSectorIdPicker !== null && toggleSectorIdPicker.wallIndex === selection.value.index) {
              const cancelled = cancelToggleSectorIdPicker(toggleSectorIdPicker);
              if (cancelled.restoreSelection !== null) {
                setMapSelection(cancelled.restoreSelection);
              }
              setToggleSectorIdPicker(cancelled.nextPicker);
              return;
            }

            const nextPicker: ToggleSectorIdPicker = { wallIndex: selection.value.index, wallTarget: selection.target };
            setToggleSectorIdPicker(nextPicker);
          }}
        />
      ) : selection.kind === 'sector' ? (
        <SectorEditor
          key={`sector:${selection.value.id}`}
          mapDocument={props.mapDocument}
          assetIndex={props.assetIndex}
          sector={selection.value}
          target={selection.target}
        />
      ) : (
        (() => {
          const neverSelection: never = selection;
          return neverSelection;
        })()
      )}
    </div>
  );
}
