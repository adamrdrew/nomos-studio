import type { MenuItemConstructorOptions } from 'electron';

export type CreateApplicationMenuTemplateOptions = Readonly<{
  appName: string;
  platform: NodeJS.Platform;
  canSave: boolean;
  onOpenSettings: () => void;
  onOpenMap: () => void;
  onSave: () => void;
  onRefreshAssetsIndex: () => void;
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
