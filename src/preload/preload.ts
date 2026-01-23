import { contextBridge, ipcRenderer } from 'electron';

import { createNomosApi } from './createNomosApi';

const exposedNomosApi = createNomosApi(ipcRenderer);

try {
  contextBridge.exposeInMainWorld('nomos', exposedNomosApi);
} catch (error: unknown) {
  // eslint-disable-next-line no-console
  console.error('[preload] exposeInMainWorld failed:', error);
}
