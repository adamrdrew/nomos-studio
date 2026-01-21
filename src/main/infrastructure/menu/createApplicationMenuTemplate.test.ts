import { createApplicationMenuTemplate } from './createApplicationMenuTemplate';

describe('createApplicationMenuTemplate', () => {
  it('creates a macOS app menu with Preferences… (Cmd+,) entrypoint', () => {
    const template = createApplicationMenuTemplate({
      appName: 'Nomos Studio',
      platform: 'darwin',
      canSave: false,
      canUndo: false,
      canRedo: false,
      mapRenderMode: 'wireframe',
      mapSectorSurface: 'floor',
      mapGridSettings: { isGridVisible: true, gridOpacity: 0.3 },
      mapHighlightPortals: false,
      mapDoorVisibility: 'visible',
      onOpenSettings: () => {},
      onOpenMap: () => {},
      onSave: () => {},
      onUndo: () => {},
      onRedo: () => {},
      onRefreshAssetsIndex: () => {},
      onSetMapRenderMode: () => {},
      onSetMapSectorSurface: () => {},
      onToggleMapHighlightPortals: () => {},
      onToggleMapDoorVisibility: () => {},
      onToggleMapGrid: () => {},
      onIncreaseMapGridOpacity: () => {},
      onDecreaseMapGridOpacity: () => {}
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

  it('creates a Windows/Linux Settings menu with Settings… (Ctrl+,) entrypoint', () => {
    const template = createApplicationMenuTemplate({
      appName: 'Nomos Studio',
      platform: 'win32',
      canSave: false,
      canUndo: false,
      canRedo: false,
      mapRenderMode: 'wireframe',
      mapSectorSurface: 'floor',
      mapGridSettings: { isGridVisible: true, gridOpacity: 0.3 },
      mapHighlightPortals: false,
      mapDoorVisibility: 'visible',
      onOpenSettings: () => {},
      onOpenMap: () => {},
      onSave: () => {},
      onUndo: () => {},
      onRedo: () => {},
      onRefreshAssetsIndex: () => {},
      onSetMapRenderMode: () => {},
      onSetMapSectorSurface: () => {},
      onToggleMapHighlightPortals: () => {},
      onToggleMapDoorVisibility: () => {},
      onToggleMapGrid: () => {},
      onIncreaseMapGridOpacity: () => {},
      onDecreaseMapGridOpacity: () => {}
    });

    expect(template.some((item) => item.label === 'Settings')).toBe(true);

    const settingsMenu = template.find((item) => item.label === 'Settings');
    if (settingsMenu === undefined || settingsMenu.submenu === undefined || !Array.isArray(settingsMenu.submenu)) {
      throw new Error('Expected Settings menu submenu');
    }

    const settingsItem = settingsMenu.submenu.find(
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
      canUndo: false,
      canRedo: false,
      mapRenderMode: 'wireframe',
      mapSectorSurface: 'floor',
      mapGridSettings: { isGridVisible: true, gridOpacity: 0.3 },
      mapHighlightPortals: false,
      mapDoorVisibility: 'visible',
      onOpenSettings: () => {},
      onOpenMap: () => {},
      onSave: () => {},
      onUndo: () => {},
      onRedo: () => {},
      onRefreshAssetsIndex: () => {},
      onSetMapRenderMode: () => {},
      onSetMapSectorSurface: () => {},
      onToggleMapHighlightPortals: () => {},
      onToggleMapDoorVisibility: () => {},
      onToggleMapGrid: () => {},
      onIncreaseMapGridOpacity: () => {},
      onDecreaseMapGridOpacity: () => {}
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
      canUndo: false,
      canRedo: false,
      mapRenderMode: 'wireframe',
      mapSectorSurface: 'floor',
      mapGridSettings: { isGridVisible: true, gridOpacity: 0.3 },
      mapHighlightPortals: false,
      mapDoorVisibility: 'visible',
      onOpenSettings: () => {},
      onOpenMap: () => {},
      onSave: () => {},
      onUndo: () => {},
      onRedo: () => {},
      onRefreshAssetsIndex: () => {},
      onSetMapRenderMode: () => {},
      onSetMapSectorSurface: () => {},
      onToggleMapHighlightPortals: () => {},
      onToggleMapDoorVisibility: () => {},
      onToggleMapGrid: () => {},
      onIncreaseMapGridOpacity: () => {},
      onDecreaseMapGridOpacity: () => {}
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

  it('includes a View menu with Wireframe/Textured radio items', () => {
    const template = createApplicationMenuTemplate({
      appName: 'Nomos Studio',
      platform: 'darwin',
      canSave: false,
      canUndo: false,
      canRedo: false,
      mapRenderMode: 'textured',
      mapSectorSurface: 'floor',
      mapGridSettings: { isGridVisible: true, gridOpacity: 0.3 },
      mapHighlightPortals: false,
      mapDoorVisibility: 'visible',
      onOpenSettings: () => {},
      onOpenMap: () => {},
      onSave: () => {},
      onUndo: () => {},
      onRedo: () => {},
      onRefreshAssetsIndex: () => {},
      onSetMapRenderMode: () => {},
      onSetMapSectorSurface: () => {},
      onToggleMapHighlightPortals: () => {},
      onToggleMapDoorVisibility: () => {},
      onToggleMapGrid: () => {},
      onIncreaseMapGridOpacity: () => {},
      onDecreaseMapGridOpacity: () => {}
    });

    const viewMenu = template.find((item) => item.label === 'View');
    expect(viewMenu).toBeDefined();
    if (viewMenu === undefined || viewMenu.submenu === undefined || !Array.isArray(viewMenu.submenu)) {
      throw new Error('Expected View menu submenu');
    }

    const wireframeItem = viewMenu.submenu.find(
      (item) => typeof item === 'object' && item !== null && 'label' in item && (item as { label?: string }).label === 'Wireframe'
    ) as { checked?: boolean; type?: string } | undefined;

    const texturedItem = viewMenu.submenu.find(
      (item) => typeof item === 'object' && item !== null && 'label' in item && (item as { label?: string }).label === 'Textured'
    ) as { checked?: boolean; type?: string } | undefined;

    expect(wireframeItem?.type).toBe('radio');
    expect(texturedItem?.type).toBe('radio');

    expect(wireframeItem?.checked).toBe(false);
    expect(texturedItem?.checked).toBe(true);
  });

  it('includes View grid items and Toggle Grid checked reflects state', () => {
    const template = createApplicationMenuTemplate({
      appName: 'Nomos Studio',
      platform: 'darwin',
      canSave: false,
      canUndo: false,
      canRedo: false,
      mapRenderMode: 'wireframe',
      mapSectorSurface: 'floor',
      mapGridSettings: { isGridVisible: false, gridOpacity: 0.3 },
      mapHighlightPortals: false,
      mapDoorVisibility: 'visible',
      onOpenSettings: () => {},
      onOpenMap: () => {},
      onSave: () => {},
      onUndo: () => {},
      onRedo: () => {},
      onRefreshAssetsIndex: () => {},
      onSetMapRenderMode: () => {},
      onSetMapSectorSurface: () => {},
      onToggleMapHighlightPortals: () => {},
      onToggleMapDoorVisibility: () => {},
      onToggleMapGrid: () => {},
      onIncreaseMapGridOpacity: () => {},
      onDecreaseMapGridOpacity: () => {}
    });

    const viewMenu = template.find((item) => item.label === 'View');
    if (viewMenu === undefined || viewMenu.submenu === undefined || !Array.isArray(viewMenu.submenu)) {
      throw new Error('Expected View menu submenu');
    }

    const toggleGridItem = viewMenu.submenu.find(
      (item) => typeof item === 'object' && item !== null && 'label' in item && (item as { label?: string }).label === 'Toggle Grid'
    ) as { checked?: boolean; type?: string } | undefined;

    const increaseOpacityItem = viewMenu.submenu.find(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        'label' in item &&
        (item as { label?: string }).label === 'Increase Grid Opacity'
    ) as { label?: string } | undefined;

    const decreaseOpacityItem = viewMenu.submenu.find(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        'label' in item &&
        (item as { label?: string }).label === 'Decrease Grid Opacity'
    ) as { label?: string } | undefined;

    expect(toggleGridItem?.type).toBe('checkbox');
    expect(toggleGridItem?.checked).toBe(false);
    expect(increaseOpacityItem).toBeDefined();
    expect(decreaseOpacityItem).toBeDefined();
  });

  it('includes View floor/ceiling surface radio items and click calls through', () => {
    const onSetMapSectorSurface = jest.fn();

    const template = createApplicationMenuTemplate({
      appName: 'Nomos Studio',
      platform: 'darwin',
      canSave: false,
      canUndo: false,
      canRedo: false,
      mapRenderMode: 'textured',
      mapSectorSurface: 'ceiling',
      mapGridSettings: { isGridVisible: true, gridOpacity: 0.3 },
      mapHighlightPortals: false,
      mapDoorVisibility: 'visible',
      onOpenSettings: () => {},
      onOpenMap: () => {},
      onSave: () => {},
      onUndo: () => {},
      onRedo: () => {},
      onRefreshAssetsIndex: () => {},
      onSetMapRenderMode: () => {},
      onSetMapSectorSurface,
      onToggleMapHighlightPortals: () => {},
      onToggleMapDoorVisibility: () => {},
      onToggleMapGrid: () => {},
      onIncreaseMapGridOpacity: () => {},
      onDecreaseMapGridOpacity: () => {}
    });

    const viewMenu = template.find((item) => item.label === 'View');
    expect(viewMenu).toBeDefined();
    if (viewMenu === undefined || viewMenu.submenu === undefined || !Array.isArray(viewMenu.submenu)) {
      throw new Error('Expected View menu submenu');
    }

    const floorTexturesItem = viewMenu.submenu.find(
      (item) => typeof item === 'object' && item !== null && 'label' in item && (item as { label?: string }).label === 'Floor Textures'
    ) as { checked?: boolean; type?: string; click?: () => void } | undefined;

    const ceilingTexturesItem = viewMenu.submenu.find(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        'label' in item &&
        (item as { label?: string }).label === 'Ceiling Textures'
    ) as { checked?: boolean; type?: string; click?: () => void } | undefined;

    expect(floorTexturesItem?.type).toBe('radio');
    expect(ceilingTexturesItem?.type).toBe('radio');

    expect(floorTexturesItem?.checked).toBe(false);
    expect(ceilingTexturesItem?.checked).toBe(true);

    ceilingTexturesItem?.click?.();
    expect(onSetMapSectorSurface).toHaveBeenCalledWith('ceiling');

    floorTexturesItem?.click?.();
    expect(onSetMapSectorSurface).toHaveBeenCalledWith('floor');
  });

  it('wires View grid menu item clicks to the provided callbacks', () => {
    const onToggleMapGrid = jest.fn();
    const onIncreaseMapGridOpacity = jest.fn();
    const onDecreaseMapGridOpacity = jest.fn();

    const template = createApplicationMenuTemplate({
      appName: 'Nomos Studio',
      platform: 'darwin',
      canSave: false,
      canUndo: false,
      canRedo: false,
      mapRenderMode: 'wireframe',
      mapSectorSurface: 'floor',
      mapGridSettings: { isGridVisible: true, gridOpacity: 0.3 },
      mapHighlightPortals: false,
      mapDoorVisibility: 'visible',
      onOpenSettings: () => {},
      onOpenMap: () => {},
      onSave: () => {},
      onUndo: () => {},
      onRedo: () => {},
      onRefreshAssetsIndex: () => {},
      onSetMapRenderMode: () => {},
      onSetMapSectorSurface: () => {},
      onToggleMapHighlightPortals: () => {},
      onToggleMapDoorVisibility: () => {},
      onToggleMapGrid,
      onIncreaseMapGridOpacity,
      onDecreaseMapGridOpacity
    });

    const viewMenu = template.find((item) => item.label === 'View');
    if (viewMenu === undefined || viewMenu.submenu === undefined || !Array.isArray(viewMenu.submenu)) {
      throw new Error('Expected View menu submenu');
    }

    const toggleGridItem = viewMenu.submenu.find(
      (item) => typeof item === 'object' && item !== null && 'label' in item && (item as { label?: string }).label === 'Toggle Grid'
    ) as { click?: () => void } | undefined;

    const increaseOpacityItem = viewMenu.submenu.find(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        'label' in item &&
        (item as { label?: string }).label === 'Increase Grid Opacity'
    ) as { click?: () => void } | undefined;

    const decreaseOpacityItem = viewMenu.submenu.find(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        'label' in item &&
        (item as { label?: string }).label === 'Decrease Grid Opacity'
    ) as { click?: () => void } | undefined;

    toggleGridItem?.click?.();
    increaseOpacityItem?.click?.();
    decreaseOpacityItem?.click?.();

    expect(onToggleMapGrid).toHaveBeenCalledTimes(1);
    expect(onIncreaseMapGridOpacity).toHaveBeenCalledTimes(1);
    expect(onDecreaseMapGridOpacity).toHaveBeenCalledTimes(1);
  });

  it('includes View highlight items and checked state reflects options', () => {
    const template = createApplicationMenuTemplate({
      appName: 'Nomos Studio',
      platform: 'darwin',
      canSave: false,
      canUndo: false,
      canRedo: false,
      mapRenderMode: 'wireframe',
      mapSectorSurface: 'floor',
      mapGridSettings: { isGridVisible: true, gridOpacity: 0.3 },
      mapHighlightPortals: true,
      mapDoorVisibility: 'hidden',
      onOpenSettings: () => {},
      onOpenMap: () => {},
      onSave: () => {},
      onUndo: () => {},
      onRedo: () => {},
      onRefreshAssetsIndex: () => {},
      onSetMapRenderMode: () => {},
      onSetMapSectorSurface: () => {},
      onToggleMapHighlightPortals: () => {},
      onToggleMapDoorVisibility: () => {},
      onToggleMapGrid: () => {},
      onIncreaseMapGridOpacity: () => {},
      onDecreaseMapGridOpacity: () => {}
    });

    const viewMenu = template.find((item) => item.label === 'View');
    if (viewMenu === undefined || viewMenu.submenu === undefined || !Array.isArray(viewMenu.submenu)) {
      throw new Error('Expected View menu submenu');
    }

    const highlightPortalsItem = viewMenu.submenu.find(
      (item) => typeof item === 'object' && item !== null && 'label' in item && (item as { label?: string }).label === 'Highlight Portals'
    ) as { checked?: boolean; type?: string } | undefined;

    const toggleDoorVisibilityItem = viewMenu.submenu.find(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        'label' in item &&
        (item as { label?: string }).label === 'Toggle Door Visibility'
    ) as { checked?: boolean; type?: string } | undefined;

    expect(highlightPortalsItem?.type).toBe('checkbox');
    expect(highlightPortalsItem?.checked).toBe(true);
    expect(toggleDoorVisibilityItem?.type).toBe('checkbox');
    expect(toggleDoorVisibilityItem?.checked).toBe(true);
  });

  it('wires View highlight item clicks to the provided callbacks', () => {
    const onToggleMapHighlightPortals = jest.fn();
    const onToggleMapDoorVisibility = jest.fn();

    const template = createApplicationMenuTemplate({
      appName: 'Nomos Studio',
      platform: 'darwin',
      canSave: false,
      canUndo: false,
      canRedo: false,
      mapRenderMode: 'wireframe',
      mapSectorSurface: 'floor',
      mapGridSettings: { isGridVisible: true, gridOpacity: 0.3 },
      mapHighlightPortals: false,
      mapDoorVisibility: 'visible',
      onOpenSettings: () => {},
      onOpenMap: () => {},
      onSave: () => {},
      onUndo: () => {},
      onRedo: () => {},
      onRefreshAssetsIndex: () => {},
      onSetMapRenderMode: () => {},
      onSetMapSectorSurface: () => {},
      onToggleMapHighlightPortals,
      onToggleMapDoorVisibility,
      onToggleMapGrid: () => {},
      onIncreaseMapGridOpacity: () => {},
      onDecreaseMapGridOpacity: () => {}
    });

    const viewMenu = template.find((item) => item.label === 'View');
    if (viewMenu === undefined || viewMenu.submenu === undefined || !Array.isArray(viewMenu.submenu)) {
      throw new Error('Expected View menu submenu');
    }

    const highlightPortalsItem = viewMenu.submenu.find(
      (item) => typeof item === 'object' && item !== null && 'label' in item && (item as { label?: string }).label === 'Highlight Portals'
    ) as { click?: () => void } | undefined;

    const toggleDoorVisibilityItem = viewMenu.submenu.find(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        'label' in item &&
        (item as { label?: string }).label === 'Toggle Door Visibility'
    ) as { click?: () => void } | undefined;

    highlightPortalsItem?.click?.();
    toggleDoorVisibilityItem?.click?.();

    expect(onToggleMapHighlightPortals).toHaveBeenCalledTimes(1);
    expect(onToggleMapDoorVisibility).toHaveBeenCalledTimes(1);
  });
});
