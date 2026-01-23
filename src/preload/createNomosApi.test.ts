import { NOMOS_IPC_CHANNELS } from '../shared/ipc/nomosIpc';

import { createNomosApi, type IpcRendererLike } from './createNomosApi';

describe('createNomosApi', () => {
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
});
