import { createApplicationMenuTemplate } from './createApplicationMenuTemplate';

describe('createApplicationMenuTemplate', () => {
  it('creates a macOS app menu with Preferences… (Cmd+,) entrypoint', () => {
    const template = createApplicationMenuTemplate({
      appName: 'Nomos Studio',
      platform: 'darwin',
      canSave: false,
      onOpenSettings: () => {},
      onOpenMap: () => {},
      onSave: () => {},
      onRefreshAssetsIndex: () => {}
    });

    expect(template[0]?.label).toBe('Nomos Studio');

    const appMenu = template[0];
    if (appMenu === undefined || appMenu.submenu === undefined || !Array.isArray(appMenu.submenu)) {
      throw new Error('Expected app menu submenu');
    }

    const preferencesItem = appMenu.submenu.find(
      (item) => typeof item === 'object' && item !== null && 'label' in item && (item as { label?: string }).label === 'Preferences…'
    ) as { label?: string; accelerator?: string } | undefined;

    expect(preferencesItem).toBeDefined();
    expect(preferencesItem?.label).toBe('Preferences…');
    expect(preferencesItem?.accelerator).toBe('CommandOrControl+,');
  });

  it('creates a Windows/Linux Edit menu with Settings… (Ctrl+,) entrypoint', () => {
    const template = createApplicationMenuTemplate({
      appName: 'Nomos Studio',
      platform: 'win32',
      canSave: false,
      onOpenSettings: () => {},
      onOpenMap: () => {},
      onSave: () => {},
      onRefreshAssetsIndex: () => {}
    });

    expect(template.some((item) => item.label === 'Edit')).toBe(true);

    const editMenu = template.find((item) => item.label === 'Edit');
    if (editMenu === undefined || editMenu.submenu === undefined || !Array.isArray(editMenu.submenu)) {
      throw new Error('Expected Edit menu submenu');
    }

    const settingsItem = editMenu.submenu.find(
      (item) => typeof item === 'object' && item !== null && 'label' in item && (item as { label?: string }).label === 'Settings…'
    ) as { label?: string; accelerator?: string } | undefined;

    expect(settingsItem).toBeDefined();
    expect(settingsItem?.accelerator).toBe('CommandOrControl+,');
  });

  it('enables Save when canSave is true', () => {
    const template = createApplicationMenuTemplate({
      appName: 'Nomos Studio',
      platform: 'darwin',
      canSave: true,
      onOpenSettings: () => {},
      onOpenMap: () => {},
      onSave: () => {},
      onRefreshAssetsIndex: () => {}
    });

    const fileMenu = template.find((item) => item.label === 'File');
    if (fileMenu === undefined || fileMenu.submenu === undefined || !Array.isArray(fileMenu.submenu)) {
      throw new Error('Expected File menu submenu');
    }

    const saveItem = fileMenu.submenu.find(
      (item) => typeof item === 'object' && item !== null && 'label' in item && (item as { label?: string }).label === 'Save'
    ) as { enabled?: boolean } | undefined;

    expect(saveItem?.enabled).toBe(true);
  });

  it('disables Save when canSave is false', () => {
    const template = createApplicationMenuTemplate({
      appName: 'Nomos Studio',
      platform: 'darwin',
      canSave: false,
      onOpenSettings: () => {},
      onOpenMap: () => {},
      onSave: () => {},
      onRefreshAssetsIndex: () => {}
    });

    const fileMenu = template.find((item) => item.label === 'File');
    if (fileMenu === undefined || fileMenu.submenu === undefined || !Array.isArray(fileMenu.submenu)) {
      throw new Error('Expected File menu submenu');
    }

    const saveItem = fileMenu.submenu.find(
      (item) => typeof item === 'object' && item !== null && 'label' in item && (item as { label?: string }).label === 'Save'
    ) as { enabled?: boolean } | undefined;

    expect(saveItem?.enabled).toBe(false);
  });
});
