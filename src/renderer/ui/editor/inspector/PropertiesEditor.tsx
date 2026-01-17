import React from 'react';
import { Colors, FormGroup, HTMLSelect, InputGroup, Intent, Position, Switch, Toaster } from '@blueprintjs/core';

import type { AssetIndex, MapDocument } from '../../../../shared/domain/models';
import type { MapEditPrimitiveValue, MapEditTargetRef } from '../../../../shared/ipc/nomosIpc';

import { useNomosStore } from '../../../store/nomosStore';

import type { MapDoor, MapEntityPlacement, MapLight, MapParticleEmitter, MapSector, MapWall } from '../map/mapViewModel';

const toaster = Toaster.create({ position: Position.TOP });

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

function parseEntityManifestDefNames(json: unknown): readonly string[] {
  const names: string[] = [];

  if (Array.isArray(json)) {
    for (const entry of json) {
      if (typeof entry === 'string' && entry.trim().length > 0) {
        names.push(entry.trim());
      } else if (isRecord(entry)) {
        const def = entry['def'];
        const name = entry['name'];
        const id = entry['id'];
        const candidate = typeof def === 'string' ? def : typeof name === 'string' ? name : typeof id === 'string' ? id : null;
        if (candidate && candidate.trim().length > 0) {
          names.push(candidate.trim());
        }
      }
    }
  } else if (isRecord(json)) {
    const entities = json['entities'];
    const defs = json['defs'];
    const rawList = Array.isArray(entities) ? entities : Array.isArray(defs) ? defs : null;

    if (rawList !== null) {
      for (const entry of rawList) {
        if (typeof entry === 'string' && entry.trim().length > 0) {
          names.push(entry.trim());
        } else if (isRecord(entry)) {
          const def = entry['def'];
          const name = entry['name'];
          const id = entry['id'];
          const candidate = typeof def === 'string' ? def : typeof name === 'string' ? name : typeof id === 'string' ? id : null;
          if (candidate && candidate.trim().length > 0) {
            names.push(candidate.trim());
          }
        }
      }
    }
  }

  const unique = Array.from(new Set(names));
  unique.sort((a, b) => a.localeCompare(b));
  return unique;
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

function ReadOnlyField(props: { label: string; value: string }): JSX.Element {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
      <div style={{ opacity: 0.85 }}>{props.label}</div>
      <div style={{ fontFamily: 'monospace', overflowWrap: 'anywhere' }}>{props.value}</div>
    </div>
  );
}

function useEditCommitter(mapDocument: MapDocument | null): {
  commitUpdateFields: (target: MapEditTargetRef, set: Readonly<Record<string, MapEditPrimitiveValue>>) => Promise<void>;
} {
  const commitUpdateFields = React.useCallback(
    async (target: MapEditTargetRef, set: Readonly<Record<string, MapEditPrimitiveValue>>): Promise<void> => {
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

  return { commitUpdateFields };
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

  const [tex, setTex] = React.useState<string>(props.door.tex);
  const [startsClosed, setStartsClosed] = React.useState<boolean>(props.door.startsClosed);

  React.useEffect(() => {
    setTex(props.door.tex);
    setStartsClosed(props.door.startsClosed);
  }, [selectionKey, props.door]);

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
            if (next !== props.door.tex) {
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
    </div>
  );
}

function WallEditor(props: {
  mapDocument: MapDocument;
  assetIndex: AssetIndex | null;
  wall: MapWall;
  target: MapEditTargetRef;
}): JSX.Element {
  const { commitUpdateFields } = useEditCommitter(props.mapDocument);

  const textureOptions = React.useMemo(() => getTextureFileNames(props.assetIndex), [props.assetIndex]);

  const selectionKey = `wall:${props.wall.index}`;

  const [v0Text, setV0Text] = React.useState<string>(String(props.wall.v0));
  const [v1Text, setV1Text] = React.useState<string>(String(props.wall.v1));
  const [frontSectorText, setFrontSectorText] = React.useState<string>(String(props.wall.frontSector));
  const [backSectorText, setBackSectorText] = React.useState<string>(String(props.wall.backSector));
  const [tex, setTex] = React.useState<string>(props.wall.tex);
  const [endLevel, setEndLevel] = React.useState<boolean>(props.wall.endLevel);

  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setV0Text(String(props.wall.v0));
    setV1Text(String(props.wall.v1));
    setFrontSectorText(String(props.wall.frontSector));
    setBackSectorText(String(props.wall.backSector));
    setTex(props.wall.tex);
    setEndLevel(props.wall.endLevel);
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
    </div>
  );
}

function SectorEditor(props: {
  mapDocument: MapDocument;
  assetIndex: AssetIndex | null;
  sector: MapSector;
  target: MapEditTargetRef;
}): JSX.Element {
  const { commitUpdateFields } = useEditCommitter(props.mapDocument);

  const textureOptions = React.useMemo(() => getTextureFileNames(props.assetIndex), [props.assetIndex]);
  const selectionKey = `sector:${props.sector.id}`;

  const [floorZText, setFloorZText] = React.useState<string>(String(props.sector.floorZ));
  const [ceilZText, setCeilZText] = React.useState<string>(String(props.sector.ceilZ));
  const [lightText, setLightText] = React.useState<string>(String(props.sector.light));
  const [floorTex, setFloorTex] = React.useState<string>(props.sector.floorTex);
  const [ceilTex, setCeilTex] = React.useState<string>(props.sector.ceilTex);

  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setFloorZText(String(props.sector.floorZ));
    setCeilZText(String(props.sector.ceilZ));
    setLightText(String(props.sector.light));
    setFloorTex(props.sector.floorTex);
    setCeilTex(props.sector.ceilTex);
    setError(null);
  }, [selectionKey, props.sector]);

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
        label="light"
        value={lightText}
        onChange={setLightText}
        onCommit={() => {
          void commitNumber('light', lightText, props.sector.light, setLightText);
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
          const next = parseEntityManifestDefNames(parsed);

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
        label="defName"
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
          {options.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
          {defNamesStatus !== 'loaded' && props.entity.defName && options.indexOf(props.entity.defName) < 0 ? (
            <option value={props.entity.defName}>{props.entity.defName}</option>
          ) : null}
        </HTMLSelect>
      </FormGroup>
    </div>
  );
}

export function PropertiesEditor(props: {
  mapDocument: MapDocument | null;
  assetIndex: AssetIndex | null;
  selection: InspectorSelectionModel | null;
}): JSX.Element {
  if (props.selection === null || props.mapDocument === null) {
    return <div style={{ opacity: 0.7 }}>Nothing selected</div>;
  }

  const selection = props.selection;

  return (
    <div>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>{selection.title}</div>

      {selection.kind === 'light' ? (
        <LightEditor mapDocument={props.mapDocument} assetIndex={props.assetIndex} light={selection.value} target={selection.target} />
      ) : selection.kind === 'particle' ? (
        <ParticleEditor mapDocument={props.mapDocument} particle={selection.value} target={selection.target} />
      ) : selection.kind === 'entity' ? (
        <EntityEditor mapDocument={props.mapDocument} assetIndex={props.assetIndex} entity={selection.value} target={selection.target} />
      ) : selection.kind === 'door' ? (
        <DoorEditor mapDocument={props.mapDocument} assetIndex={props.assetIndex} door={selection.value} target={selection.target} />
      ) : selection.kind === 'wall' ? (
        <WallEditor mapDocument={props.mapDocument} assetIndex={props.assetIndex} wall={selection.value} target={selection.target} />
      ) : selection.kind === 'sector' ? (
        <SectorEditor mapDocument={props.mapDocument} assetIndex={props.assetIndex} sector={selection.value} target={selection.target} />
      ) : (
        (() => {
          const neverSelection: never = selection;
          return neverSelection;
        })()
      )}
    </div>
  );
}
