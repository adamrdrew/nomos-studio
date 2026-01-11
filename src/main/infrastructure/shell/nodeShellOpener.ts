import { shell } from 'electron';

import type { ShellOpener } from '../../application/assets/OpenAssetService';

export const nodeShellOpener: ShellOpener = {
  openPath: async (absolutePath: string): Promise<string> => {
    return shell.openPath(absolutePath);
  }
};
