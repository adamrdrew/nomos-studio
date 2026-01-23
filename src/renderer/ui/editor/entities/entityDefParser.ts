import type { Result } from '../../../../shared/domain/results';

export type EntityDefDisplayModel = Readonly<{
  entityName: string;
  spriteFileName: string;
  frameWidthPx: number;
  frameHeightPx: number;
}>;

export type EntityDefParseError = Readonly<{
  kind: 'entity-def-parse-error';
  code:
    | 'entity-def/invalid-shape'
    | 'entity-def/missing-name'
    | 'entity-def/missing-sprite-file-name'
    | 'entity-def/missing-frame-dimensions'
    | 'entity-def/invalid-frame-dimensions';
  message: string;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readNonEmptyString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readFiniteNumber(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];
  if (typeof value !== 'number') {
    return null;
  }
  return Number.isFinite(value) ? value : null;
}

export function parseEntityDefDisplayModel(json: unknown): Result<EntityDefDisplayModel, EntityDefParseError> {
  if (!isRecord(json)) {
    return {
      ok: false,
      error: {
        kind: 'entity-def-parse-error',
        code: 'entity-def/invalid-shape',
        message: 'Entity def JSON must be an object.'
      }
    };
  }

  const entityName = readNonEmptyString(json, 'name');
  if (entityName === null) {
    return {
      ok: false,
      error: {
        kind: 'entity-def-parse-error',
        code: 'entity-def/missing-name',
        message: 'Entity def is missing required string field: name.'
      }
    };
  }

  const sprite = json['sprite'];
  if (!isRecord(sprite)) {
    return {
      ok: false,
      error: {
        kind: 'entity-def-parse-error',
        code: 'entity-def/missing-sprite-file-name',
        message: 'Entity def is missing required object field: sprite.'
      }
    };
  }

  const spriteFile = sprite['file'];
  if (!isRecord(spriteFile)) {
    return {
      ok: false,
      error: {
        kind: 'entity-def-parse-error',
        code: 'entity-def/missing-sprite-file-name',
        message: 'Entity def is missing required object field: sprite.file.'
      }
    };
  }

  const spriteFileName = readNonEmptyString(spriteFile, 'name');
  if (spriteFileName === null) {
    return {
      ok: false,
      error: {
        kind: 'entity-def-parse-error',
        code: 'entity-def/missing-sprite-file-name',
        message: 'Entity def is missing required string field: sprite.file.name.'
      }
    };
  }

  const frames = sprite['frames'];
  if (!isRecord(frames)) {
    return {
      ok: false,
      error: {
        kind: 'entity-def-parse-error',
        code: 'entity-def/missing-frame-dimensions',
        message: 'Entity def is missing required object field: sprite.frames.'
      }
    };
  }

  const dimensions = frames['dimensions'];
  if (!isRecord(dimensions)) {
    return {
      ok: false,
      error: {
        kind: 'entity-def-parse-error',
        code: 'entity-def/missing-frame-dimensions',
        message: 'Entity def is missing required object field: sprite.frames.dimensions.'
      }
    };
  }

  const frameWidthPx = readFiniteNumber(dimensions, 'x');
  const frameHeightPx = readFiniteNumber(dimensions, 'y');
  if (frameWidthPx === null || frameHeightPx === null) {
    return {
      ok: false,
      error: {
        kind: 'entity-def-parse-error',
        code: 'entity-def/missing-frame-dimensions',
        message: 'Entity def is missing required numeric fields: sprite.frames.dimensions.x/y.'
      }
    };
  }

  if (frameWidthPx <= 0 || frameHeightPx <= 0) {
    return {
      ok: false,
      error: {
        kind: 'entity-def-parse-error',
        code: 'entity-def/invalid-frame-dimensions',
        message: 'Entity def frame dimensions must be positive.'
      }
    };
  }

  return {
    ok: true,
    value: {
      entityName,
      spriteFileName,
      frameWidthPx,
      frameHeightPx
    }
  };
}
