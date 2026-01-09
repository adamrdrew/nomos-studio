import { EventEmitter } from 'node:events';

type SpawnModule = typeof import('node:child_process');

type SpawnFn = SpawnModule['spawn'];

jest.mock('node:child_process', () => ({
  spawn: jest.fn()
}));

import { spawn } from 'node:child_process';

import { nodeProcessRunner } from './NodeProcessRunner';

type FakeChild = EventEmitter & {
  stdout?: EventEmitter;
  stderr?: EventEmitter;
};

function createFakeChild(): FakeChild {
  const child = new EventEmitter() as FakeChild;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  return child;
}

describe('nodeProcessRunner', () => {
  it('spawns the process, aggregates stdout/stderr, and returns exit code', async () => {
    const child = createFakeChild();

    const mockedSpawn = spawn as unknown as jest.MockedFunction<SpawnFn>;
    mockedSpawn.mockReturnValue(child as unknown as ReturnType<SpawnFn>);

    const promise = nodeProcessRunner.run({
      command: '/game',
      args: ['--validate-map', '/maps/test.json']
    });

    child.stdout?.emit('data', Buffer.from('out-'));
    child.stdout?.emit('data', '1');
    child.stderr?.emit('data', 'err');
    child.emit('close', 2);

    await expect(promise).resolves.toEqual({ exitCode: 2, stdout: 'out-1', stderr: 'err' });

    expect(mockedSpawn).toHaveBeenCalledWith('/game', ['--validate-map', '/maps/test.json'], {
      windowsHide: true
    });
  });

  it('rejects when the child process emits an error', async () => {
    const child = createFakeChild();

    const mockedSpawn = spawn as unknown as jest.MockedFunction<SpawnFn>;
    mockedSpawn.mockReturnValue(child as unknown as ReturnType<SpawnFn>);

    const promise = nodeProcessRunner.run({ command: '/game', args: [] });

    child.emit('error', new Error('spawn failed'));

    await expect(promise).rejects.toThrow('spawn failed');
  });
});
