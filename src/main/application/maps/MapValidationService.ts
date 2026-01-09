import path from 'node:path';

import type { MapValidationRecord } from '../../../shared/domain/models';
import type { MapValidationError, MapValidationErrorReport, Result } from '../../../shared/domain/results';
import type { AppStore } from '../store/AppStore';
import type { ProcessRunner } from '../../infrastructure/process/ProcessRunner';

export class MapValidationService {
  private readonly store: AppStore;
  private readonly processRunner: ProcessRunner;
  private readonly nowIso: () => string;

  public constructor(store: AppStore, processRunner: ProcessRunner, nowIso: () => string) {
    this.store = store;
    this.processRunner = processRunner;
    this.nowIso = nowIso;
  }

  public async validateMap(mapPath: string): Promise<Result<MapValidationRecord, MapValidationError>> {
    const gameExecutablePath = this.store.getState().settings.gameExecutablePath;
    if (gameExecutablePath === null || gameExecutablePath.trim().length === 0) {
      return {
        ok: false,
        error: {
          kind: 'map-validation-error',
          code: 'map-validation/missing-settings',
          message: 'Game executable path is not set'
        }
      };
    }

    const absoluteMapPath = path.resolve(mapPath);

    let runResult: { exitCode: number | null; stdout: string; stderr: string };
    try {
      runResult = await this.processRunner.run({
        command: gameExecutablePath,
        args: ['--validate-map', absoluteMapPath]
      });
    } catch (_error: unknown) {
      return {
        ok: false,
        error: {
          kind: 'map-validation-error',
          code: 'map-validation/runner-failed',
          message: 'Failed to run map validation'
        }
      };
    }

    const validatedAtIso = this.nowIso();

    if (runResult.exitCode === 0) {
      return { ok: true, value: { ok: true, validatedAtIso } };
    }

    const rawText = (runResult.stdout.trim().length > 0 ? runResult.stdout : runResult.stderr).trim();
    const report = this.tryParseReport(rawText);

    return {
      ok: false,
      error: {
        kind: 'map-validation-error',
        code: 'map-validation/invalid-map',
        message: 'Map validation failed',
        report
      }
    };
  }

  private tryParseReport(rawText: string): MapValidationErrorReport {
    if (rawText.trim().length === 0) {
      return {
        kind: 'map-validation-error-report',
        rawText: '',
        prettyText: ''
      };
    }

    try {
      const parsed = JSON.parse(rawText) as unknown;
      return {
        kind: 'map-validation-error-report',
        rawText,
        prettyText: JSON.stringify(parsed, null, 2)
      };
    } catch (_error: unknown) {
      return {
        kind: 'map-validation-error-report',
        rawText,
        prettyText: rawText
      };
    }
  }
}
