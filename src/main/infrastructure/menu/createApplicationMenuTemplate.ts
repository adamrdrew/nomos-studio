import type { MenuItemConstructorOptions } from 'electron';

import type { MapDoorVisibility, MapGridSettings, MapRenderMode, MapSectorSurface } from '../../../shared/domain/models';

export type CreateApplicationMenuTemplateOptions = Readonly<{
  appName: string;
  platform: NodeJS.Platform;
  canSave: boolean;
  canUndo: boolean;
  canRedo: boolean;
  recentMapPaths: readonly string[];
  mapRenderMode: MapRenderMode;
  mapSectorSurface: MapSectorSurface;
  mapGridSettings: MapGridSettings;
  mapHighlightPortals: boolean;
  mapDoorVisibility: MapDoorVisibility;
  onOpenSettings: () => void;
  onNewMap: () => void;
  onOpenMap: () => void;
  onOpenRecentMap: (mapPath: string) => void;
  onSave: () => void;
  onSaveAs: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onRefreshAssetsIndex: () => void;
  onSetMapRenderMode: (mode: MapRenderMode) => void;
  onSetMapSectorSurface: (surface: MapSectorSurface) => void;
  onToggleMapHighlightPortals: () => void;
  onToggleMapDoorVisibility: () => void;
  onToggleMapGrid: () => void;
  onIncreaseMapGridOpacity: () => void;
  onDecreaseMapGridOpacity: () => void;
}>;

export function createApplicationMenuTemplate(
  options: CreateApplicationMenuTemplateOptions
): MenuItemConstructorOptions[] {
  const editMenu: MenuItemConstructorOptions = {
    label: 'Edit',
    submenu: [
      { label: 'Undo', enabled: options.canUndo, accelerator: 'CommandOrControl+Z', click: () => options.onUndo() },
      {
        label: 'Redo',
        enabled: options.canRedo,
        accelerator: options.platform === 'darwin' ? 'Shift+CommandOrControl+Z' : 'CommandOrControl+Y',
        click: () => options.onRedo()
      }
    ]
  };

  const fileMenu: MenuItemConstructorOptions = {
    label: 'File',
    submenu: [
      { label: 'New Map', accelerator: 'CommandOrControl+N', click: () => options.onNewMap() },
      { label: 'Open Map…', click: () => options.onOpenMap() },
      {
        label: 'Recent Maps',
        submenu:
          options.recentMapPaths.length === 0
            ? [{ label: 'No Recent Maps', enabled: false }]
            : options.recentMapPaths.map((mapPath) => ({
                label: mapPath,
                click: () => options.onOpenRecentMap(mapPath)
              }))
      },
      { type: 'separator' },
      { label: 'Save', enabled: options.canSave, click: () => options.onSave() },
      {
        label: 'Save As…',
        enabled: options.canSave,
        accelerator: 'CommandOrControl+Shift+S',
        click: () => options.onSaveAs()
      },
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

  template.push(editMenu);

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
      },
      { type: 'separator' },
      {
        label: 'Floor Textures',
        type: 'radio',
        checked: options.mapSectorSurface === 'floor',
        click: () => options.onSetMapSectorSurface('floor')
      },
      {
        label: 'Ceiling Textures',
        type: 'radio',
        checked: options.mapSectorSurface === 'ceiling',
        click: () => options.onSetMapSectorSurface('ceiling')
      },
      { type: 'separator' },
      {
        label: 'Highlight Portals',
        type: 'checkbox',
        checked: options.mapHighlightPortals,
        click: () => options.onToggleMapHighlightPortals()
      },
      {
        label: 'Toggle Door Visibility',
        type: 'checkbox',
        checked: options.mapDoorVisibility === 'hidden',
        click: () => options.onToggleMapDoorVisibility()
      },
      { type: 'separator' },
      {
        label: 'Toggle Grid',
        type: 'checkbox',
        checked: options.mapGridSettings.isGridVisible,
        click: () => options.onToggleMapGrid()
      },
      {
        label: 'Increase Grid Opacity',
        click: () => options.onIncreaseMapGridOpacity()
      },
      {
        label: 'Decrease Grid Opacity',
        click: () => options.onDecreaseMapGridOpacity()
      }
    ]
  });

  if (options.platform !== 'darwin') {
    template.push({
      label: 'Settings',
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
