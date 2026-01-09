import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('nomos', {
  version: '0.0.0'
});
