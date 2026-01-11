import type { MenuItemConstructorOptions } from 'electron';

import type { MapRenderMode } from '../../../shared/domain/models';

export type CreateApplicationMenuTemplateOptions = Readonly<{
  appName: string;
  platform: NodeJS.Platform;
  canSave: boolean;
  mapRenderMode: MapRenderMode;
  onOpenSettings: () => void;
  onOpenMap: () => void;
  onSave: () => void;
  onRefreshAssetsIndex: () => void;
  onSetMapRenderMode: (mode: MapRenderMode) => void;
}>;

export function createApplicationMenuTemplate(
  options: CreateApplicationMenuTemplateOptions
): MenuItemConstructorOptions[] {
  const fileMenu: MenuItemConstructorOptions = {
    label: 'File',
    submenu: [
      { label: 'Open Map…', click: () => options.onOpenMap() },
      { label: 'Save', enabled: options.canSave, click: () => options.onSave() },
      { type: 'separator' },
      { label: 'Refresh Assets Index', click: () => options.onRefreshAssetsIndex() }
    ]
  };

  const template: MenuItemConstructorOptions[] = [];

  if (options.platform === 'darwin') {
    template.push({
      label: options.appName,
      submenu: [
        {
          label: 'Preferences…',
          accelerator: 'CommandOrControl+,',
          click: () => options.onOpenSettings()
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    });
  }

  template.push(fileMenu);

  template.push({
    label: 'View',
    submenu: [
      {
        label: 'Wireframe',
        type: 'radio',
        checked: options.mapRenderMode === 'wireframe',
        click: () => options.onSetMapRenderMode('wireframe')
      },
      {
        label: 'Textured',
        type: 'radio',
        checked: options.mapRenderMode === 'textured',
        click: () => options.onSetMapRenderMode('textured')
      }
    ]
  });

  if (options.platform !== 'darwin') {
    template.push({
      label: 'Edit',
      submenu: [
        {
          label: 'Settings…',
          accelerator: 'CommandOrControl+,',
          click: () => options.onOpenSettings()
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    });
  }

  return template;
}
