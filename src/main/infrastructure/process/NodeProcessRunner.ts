import { spawn } from 'node:child_process';

import type { ProcessRunRequest, ProcessRunResult, ProcessRunner } from './ProcessRunner';

export const nodeProcessRunner: ProcessRunner = {
  run: async (request: ProcessRunRequest): Promise<ProcessRunResult> => {
    return new Promise<ProcessRunResult>((resolve, reject) => {
      const child = spawn(request.command, [...request.args], {
        windowsHide: true
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (chunk: Buffer | string) => {
        stdout += chunk.toString();
      });

      child.stderr?.on('data', (chunk: Buffer | string) => {
        stderr += chunk.toString();
      });

      child.on('error', (error) => {
        reject(error);
      });

      child.on('close', (code) => {
        resolve({ exitCode: code, stdout, stderr });
      });
    });
  }
};
