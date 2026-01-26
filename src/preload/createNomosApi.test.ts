import { NOMOS_IPC_CHANNELS } from '../shared/ipc/nomosIpc';

import { createNomosApi, type IpcRendererLike } from './createNomosApi';

describe('createNomosApi', () => {
  it('menu.onSaveRequested registers and unregisters an IPC listener', () => {
    const invoke = jest.fn(async () => ({ ok: true as const, value: null }));
    const on = jest.fn();
    const removeListener = jest.fn();

    const ipcRenderer: IpcRendererLike = {
      invoke,
      on,
      removeListener
    };

    const api = createNomosApi(ipcRenderer);

    const listener = jest.fn();
    const dispose = api.menu.onSaveRequested(listener);

    expect(on).toHaveBeenCalledTimes(1);
    expect(on).toHaveBeenCalledWith(NOMOS_IPC_CHANNELS.menuSaveRequested, expect.any(Function));

    const handler = on.mock.calls[0]?.[1] as (() => void) | undefined;
    expect(handler).toBeDefined();
    handler?.();
    expect(listener).toHaveBeenCalledTimes(1);

    dispose();
    expect(removeListener).toHaveBeenCalledTimes(1);
    expect(removeListener).toHaveBeenCalledWith(NOMOS_IPC_CHANNELS.menuSaveRequested, handler);
  });

  it('map.new invokes the mapNew channel and returns the response', async () => {
    const invoke = jest.fn(async () => ({ ok: true as const, value: null }));

    const ipcRenderer: IpcRendererLike = {
      invoke,
      on: () => {},
      removeListener: () => {}
    };

    const api = createNomosApi(ipcRenderer);

    const result = await api.map.new();

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith(NOMOS_IPC_CHANNELS.mapNew);
    expect(result).toEqual({ ok: true, value: null });
  });

  it('map.saveAndRun invokes the mapSaveAndRun channel and returns the response', async () => {
    const invoke = jest.fn(async () => ({ ok: true as const, value: null }));

    const ipcRenderer: IpcRendererLike = {
      invoke,
      on: () => {},
      removeListener: () => {}
    };

    const api = createNomosApi(ipcRenderer);

    const result = await api.map.saveAndRun();

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith(NOMOS_IPC_CHANNELS.mapSaveAndRun);
    expect(result).toEqual({ ok: true, value: null });
  });

  it('assets.readJsonText invokes the assetsReadJsonText channel and returns the response', async () => {
    const invoke = jest.fn(async () => ({ ok: true as const, value: '{"x":1}' }));

    const ipcRenderer: IpcRendererLike = {
      invoke,
      on: () => {},
      removeListener: () => {}
    };

    const api = createNomosApi(ipcRenderer);

    const result = await api.assets.readJsonText({ relativePath: 'Data/file.json' });

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith(NOMOS_IPC_CHANNELS.assetsReadJsonText, { relativePath: 'Data/file.json' });
    expect(result).toEqual({ ok: true, value: '{"x":1}' });
  });

  it('assets.writeJsonText invokes the assetsWriteJsonText channel and returns the response', async () => {
    const invoke = jest.fn(async () => ({ ok: true as const, value: null }));

    const ipcRenderer: IpcRendererLike = {
      invoke,
      on: () => {},
      removeListener: () => {}
    };

    const api = createNomosApi(ipcRenderer);

    const result = await api.assets.writeJsonText({ relativePath: 'Data/file.json', text: '{"x":2}' });

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith(NOMOS_IPC_CHANNELS.assetsWriteJsonText, {
      relativePath: 'Data/file.json',
      text: '{"x":2}'
    });
    expect(result).toEqual({ ok: true, value: null });
  });
});
