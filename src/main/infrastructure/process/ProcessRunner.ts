export type ProcessRunRequest = Readonly<{
  command: string;
  args: readonly string[];
}>;

export type ProcessRunResult = Readonly<{
  exitCode: number | null;
  stdout: string;
  stderr: string;
}>;

export type ProcessRunner = Readonly<{
  run: (request: ProcessRunRequest) => Promise<ProcessRunResult>;
}>;
