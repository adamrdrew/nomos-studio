import { createApplicationMenuTemplate } from './createApplicationMenuTemplate';

const DEFAULT_MAP_GRID_SETTINGS = { isGridVisible: true, gridOpacity: 0.3, isSnapToGridEnabled: true } as const;

describe('createApplicationMenuTemplate', () => {
  it('creates a macOS app menu with Preferences… (Cmd+,) entrypoint', () => {
    const template = createApplicationMenuTemplate({
      appName: 'Nomos Studio',
      platform: 'darwin',
      canSave: false,
      canUndo: false,
      canRedo: false,
      recentMapPaths: [],
      mapRenderMode: 'wireframe',
      mapSectorSurface: 'floor',
      mapGridSettings: DEFAULT_MAP_GRID_SETTINGS,
      mapHighlightPortals: false,
      mapHighlightToggleWalls: false,
      mapDoorVisibility: 'visible',
      onOpenSettings: () => {},
      onNewMap: () => {},
      onOpenMap: () => {},
      onOpenRecentMap: () => {},
      onSave: () => {},
      onSaveAs: () => {},
      onUndo: () => {},
      onRedo: () => {},
      onRefreshAssetsIndex: () => {},
      onSetMapRenderMode: () => {},
      onSetMapSectorSurface: () => {},
      onToggleMapHighlightPortals: () => {},
      onToggleMapHighlightToggleWalls: () => {},
      onToggleMapDoorVisibility: () => {},
      onToggleMapGrid: () => {},
      onToggleMapSnapToGrid: () => {},
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
      recentMapPaths: [],
      mapRenderMode: 'wireframe',
      mapSectorSurface: 'floor',
      mapGridSettings: DEFAULT_MAP_GRID_SETTINGS,
      mapHighlightPortals: false,
      mapHighlightToggleWalls: false,
      mapDoorVisibility: 'visible',
      onOpenSettings: () => {},
      onNewMap: () => {},
      onOpenMap: () => {},
      onOpenRecentMap: () => {},
      onSave: () => {},
      onSaveAs: () => {},
      onUndo: () => {},
      onRedo: () => {},
      onRefreshAssetsIndex: () => {},
      onSetMapRenderMode: () => {},
      onSetMapSectorSurface: () => {},
      onToggleMapHighlightPortals: () => {},
      onToggleMapHighlightToggleWalls: () => {},
      onToggleMapDoorVisibility: () => {},
      onToggleMapGrid: () => {},
      onToggleMapSnapToGrid: () => {},
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
      recentMapPaths: [],
      mapRenderMode: 'wireframe',
      mapSectorSurface: 'floor',
      mapGridSettings: DEFAULT_MAP_GRID_SETTINGS,
      mapHighlightPortals: false,
      mapHighlightToggleWalls: false,
      mapDoorVisibility: 'visible',
      onOpenSettings: () => {},
      onNewMap: () => {},
      onOpenMap: () => {},
      onOpenRecentMap: () => {},
      onSave: () => {},
      onSaveAs: () => {},
      onUndo: () => {},
      onRedo: () => {},
      onRefreshAssetsIndex: () => {},
      onSetMapRenderMode: () => {},
      onSetMapSectorSurface: () => {},
      onToggleMapHighlightPortals: () => {},
      onToggleMapHighlightToggleWalls: () => {},
      onToggleMapDoorVisibility: () => {},
      onToggleMapGrid: () => {},
      onToggleMapSnapToGrid: () => {},
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
      recentMapPaths: [],
      mapRenderMode: 'wireframe',
      mapSectorSurface: 'floor',
      mapGridSettings: DEFAULT_MAP_GRID_SETTINGS,
      mapHighlightPortals: false,
      mapHighlightToggleWalls: false,
      mapDoorVisibility: 'visible',
      onOpenSettings: () => {},
      onNewMap: () => {},
      onOpenMap: () => {},
      onOpenRecentMap: () => {},
      onSave: () => {},
      onSaveAs: () => {},
      onUndo: () => {},
      onRedo: () => {},
      onRefreshAssetsIndex: () => {},
      onSetMapRenderMode: () => {},
      onSetMapSectorSurface: () => {},
      onToggleMapHighlightPortals: () => {},
      onToggleMapHighlightToggleWalls: () => {},
      onToggleMapDoorVisibility: () => {},
      onToggleMapGrid: () => {},
      onToggleMapSnapToGrid: () => {},
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

  it('enables Save As… when canSave is true', () => {
    const template = createApplicationMenuTemplate({
      appName: 'Nomos Studio',
      platform: 'darwin',
      canSave: true,
      canUndo: false,
      canRedo: false,
      recentMapPaths: [],
      mapRenderMode: 'wireframe',
      mapSectorSurface: 'floor',
      mapGridSettings: DEFAULT_MAP_GRID_SETTINGS,
      mapHighlightPortals: false,
      mapHighlightToggleWalls: false,
      mapDoorVisibility: 'visible',
      onOpenSettings: () => {},
      onNewMap: () => {},
      onOpenMap: () => {},
      onOpenRecentMap: () => {},
      onSave: () => {},
      onSaveAs: () => {},
      onUndo: () => {},
      onRedo: () => {},
      onRefreshAssetsIndex: () => {},
      onSetMapRenderMode: () => {},
      onSetMapSectorSurface: () => {},
      onToggleMapHighlightPortals: () => {},
      onToggleMapHighlightToggleWalls: () => {},
      onToggleMapDoorVisibility: () => {},
      onToggleMapGrid: () => {},
      onToggleMapSnapToGrid: () => {},
      onIncreaseMapGridOpacity: () => {},
      onDecreaseMapGridOpacity: () => {}
    });

    const fileMenu = template.find((item) => item.label === 'File');
    if (fileMenu === undefined || fileMenu.submenu === undefined || !Array.isArray(fileMenu.submenu)) {
      throw new Error('Expected File menu submenu');
    }

    const saveAsItem = fileMenu.submenu.find(
      (item) => typeof item === 'object' && item !== null && 'label' in item && (item as { label?: string }).label === 'Save As…'
    ) as { enabled?: boolean } | undefined;

    expect(saveAsItem?.enabled).toBe(true);
  });

  it('disables Save As… when canSave is false', () => {
    const template = createApplicationMenuTemplate({
      appName: 'Nomos Studio',
      platform: 'darwin',
      canSave: false,
      canUndo: false,
      canRedo: false,
      recentMapPaths: [],
      mapRenderMode: 'wireframe',
      mapSectorSurface: 'floor',
      mapGridSettings: DEFAULT_MAP_GRID_SETTINGS,
      mapHighlightPortals: false,
      mapHighlightToggleWalls: false,
      mapDoorVisibility: 'visible',
      onOpenSettings: () => {},
      onNewMap: () => {},
      onOpenMap: () => {},
      onOpenRecentMap: () => {},
      onSave: () => {},
      onSaveAs: () => {},
      onUndo: () => {},
      onRedo: () => {},
      onRefreshAssetsIndex: () => {},
      onSetMapRenderMode: () => {},
      onSetMapSectorSurface: () => {},
      onToggleMapHighlightPortals: () => {},
      onToggleMapHighlightToggleWalls: () => {},
      onToggleMapDoorVisibility: () => {},
      onToggleMapGrid: () => {},
      onToggleMapSnapToGrid: () => {},
      onIncreaseMapGridOpacity: () => {},
      onDecreaseMapGridOpacity: () => {}
    });

    const fileMenu = template.find((item) => item.label === 'File');
    if (fileMenu === undefined || fileMenu.submenu === undefined || !Array.isArray(fileMenu.submenu)) {
      throw new Error('Expected File menu submenu');
    }

    const saveAsItem = fileMenu.submenu.find(
      (item) => typeof item === 'object' && item !== null && 'label' in item && (item as { label?: string }).label === 'Save As…'
    ) as { enabled?: boolean } | undefined;

    expect(saveAsItem?.enabled).toBe(false);
  });

  it('includes Run → Save & Run (F5)', () => {
    const onSaveAndRun = jest.fn();

    const template = createApplicationMenuTemplate({
      appName: 'Nomos Studio',
      platform: 'darwin',
      canSave: true,
      canUndo: false,
      canRedo: false,
      recentMapPaths: [],
      mapRenderMode: 'wireframe',
      mapSectorSurface: 'floor',
      mapGridSettings: DEFAULT_MAP_GRID_SETTINGS,
      mapHighlightPortals: false,
      mapHighlightToggleWalls: false,
      mapDoorVisibility: 'visible',
      onOpenSettings: () => {},
      onNewMap: () => {},
      onOpenMap: () => {},
      onOpenRecentMap: () => {},
      onSave: () => {},
      onSaveAs: () => {},
      onSaveAndRun,
      onUndo: () => {},
      onRedo: () => {},
      onRefreshAssetsIndex: () => {},
      onSetMapRenderMode: () => {},
      onSetMapSectorSurface: () => {},
      onToggleMapHighlightPortals: () => {},
      onToggleMapHighlightToggleWalls: () => {},
      onToggleMapDoorVisibility: () => {},
      onToggleMapGrid: () => {},
      onToggleMapSnapToGrid: () => {},
      onIncreaseMapGridOpacity: () => {},
      onDecreaseMapGridOpacity: () => {}
    });

    const runMenu = template.find((item) => item.label === 'Run');
    if (runMenu === undefined || runMenu.submenu === undefined || !Array.isArray(runMenu.submenu)) {
      throw new Error('Expected Run menu submenu');
    }

    const saveAndRunItem = runMenu.submenu.find(
      (item) => typeof item === 'object' && item !== null && 'label' in item && (item as { label?: string }).label === 'Save & Run'
    ) as { label?: string; accelerator?: string; enabled?: boolean; click?: () => void } | undefined;

    expect(saveAndRunItem).toBeDefined();
    expect(saveAndRunItem?.accelerator).toBe('F5');
    expect(saveAndRunItem?.enabled).toBe(true);

    saveAndRunItem?.click?.();
    expect(onSaveAndRun).toHaveBeenCalledTimes(1);
  });

  it('disables Run → Save & Run when canSave is false', () => {
    const template = createApplicationMenuTemplate({
      appName: 'Nomos Studio',
      platform: 'darwin',
      canSave: false,
      canUndo: false,
      canRedo: false,
      recentMapPaths: [],
      mapRenderMode: 'wireframe',
      mapSectorSurface: 'floor',
      mapGridSettings: DEFAULT_MAP_GRID_SETTINGS,
      mapHighlightPortals: false,
      mapHighlightToggleWalls: false,
      mapDoorVisibility: 'visible',
      onOpenSettings: () => {},
      onNewMap: () => {},
      onOpenMap: () => {},
      onOpenRecentMap: () => {},
      onSave: () => {},
      onSaveAs: () => {},
      onUndo: () => {},
      onRedo: () => {},
      onRefreshAssetsIndex: () => {},
      onSetMapRenderMode: () => {},
      onSetMapSectorSurface: () => {},
      onToggleMapHighlightPortals: () => {},
      onToggleMapHighlightToggleWalls: () => {},
      onToggleMapDoorVisibility: () => {},
      onToggleMapGrid: () => {},
      onToggleMapSnapToGrid: () => {},
      onIncreaseMapGridOpacity: () => {},
      onDecreaseMapGridOpacity: () => {}
    });

    const runMenu = template.find((item) => item.label === 'Run');
    if (runMenu === undefined || runMenu.submenu === undefined || !Array.isArray(runMenu.submenu)) {
      throw new Error('Expected Run menu submenu');
    }

    const saveAndRunItem = runMenu.submenu.find(
      (item) => typeof item === 'object' && item !== null && 'label' in item && (item as { label?: string }).label === 'Save & Run'
    ) as { enabled?: boolean } | undefined;

    expect(saveAndRunItem?.enabled).toBe(false);
  });

  it('includes File → Save As… (Shift+Cmd/Ctrl+S)', () => {
    const template = createApplicationMenuTemplate({
      appName: 'Nomos Studio',
      platform: 'darwin',
      canSave: true,
      canUndo: false,
      canRedo: false,
      recentMapPaths: [],
      mapRenderMode: 'wireframe',
      mapSectorSurface: 'floor',
      mapGridSettings: DEFAULT_MAP_GRID_SETTINGS,
      mapHighlightPortals: false,
      mapHighlightToggleWalls: false,
      mapDoorVisibility: 'visible',
      onOpenSettings: () => {},
      onNewMap: () => {},
      onOpenMap: () => {},
      onOpenRecentMap: () => {},
      onSave: () => {},
      onSaveAs: () => {},
      onUndo: () => {},
      onRedo: () => {},
      onRefreshAssetsIndex: () => {},
      onSetMapRenderMode: () => {},
      onSetMapSectorSurface: () => {},
      onToggleMapHighlightPortals: () => {},
      onToggleMapHighlightToggleWalls: () => {},
      onToggleMapDoorVisibility: () => {},
      onToggleMapGrid: () => {},
      onToggleMapSnapToGrid: () => {},
      onIncreaseMapGridOpacity: () => {},
      onDecreaseMapGridOpacity: () => {}
    });

    const fileMenu = template.find((item) => item.label === 'File');
    if (fileMenu === undefined || fileMenu.submenu === undefined || !Array.isArray(fileMenu.submenu)) {
      throw new Error('Expected File menu submenu');
    }

    const saveAsItem = fileMenu.submenu.find(
      (item) => typeof item === 'object' && item !== null && 'label' in item && (item as { label?: string }).label === 'Save As…'
    ) as { label?: string; accelerator?: string; enabled?: boolean } | undefined;

    expect(saveAsItem).toBeDefined();
    expect(saveAsItem?.enabled).toBe(true);
    expect(saveAsItem?.accelerator).toBe('CommandOrControl+Shift+S');
  });

  it('includes File → Recent Maps submenu populated from recentMapPaths', () => {
    const onOpenRecentMap = jest.fn();
    const recentMapPaths = ['/maps/a.json', '/maps/b.json'] as const;

    const template = createApplicationMenuTemplate({
      appName: 'Nomos Studio',
      platform: 'darwin',
      canSave: false,
      canUndo: false,
      canRedo: false,
      recentMapPaths,
      mapRenderMode: 'wireframe',
      mapSectorSurface: 'floor',
      mapGridSettings: DEFAULT_MAP_GRID_SETTINGS,
      mapHighlightPortals: false,
      mapHighlightToggleWalls: false,
      mapDoorVisibility: 'visible',
      onOpenSettings: () => {},
      onNewMap: () => {},
      onOpenMap: () => {},
      onOpenRecentMap,
      onSave: () => {},
      onSaveAs: () => {},
      onUndo: () => {},
      onRedo: () => {},
      onRefreshAssetsIndex: () => {},
      onSetMapRenderMode: () => {},
      onSetMapSectorSurface: () => {},
      onToggleMapHighlightPortals: () => {},
      onToggleMapHighlightToggleWalls: () => {},
      onToggleMapDoorVisibility: () => {},
      onToggleMapGrid: () => {},
      onToggleMapSnapToGrid: () => {},
      onIncreaseMapGridOpacity: () => {},
      onDecreaseMapGridOpacity: () => {}
    });

    const fileMenu = template.find((item) => item.label === 'File');
    if (fileMenu === undefined || fileMenu.submenu === undefined || !Array.isArray(fileMenu.submenu)) {
      throw new Error('Expected File menu submenu');
    }

    const recentMapsMenu = fileMenu.submenu.find(
      (item) => typeof item === 'object' && item !== null && 'label' in item && (item as { label?: string }).label === 'Recent Maps'
    ) as { submenu?: unknown } | undefined;

    expect(recentMapsMenu).toBeDefined();
    expect(Array.isArray(recentMapsMenu?.submenu)).toBe(true);
    const submenu = recentMapsMenu?.submenu;
    if (!Array.isArray(submenu)) {
      throw new Error('Expected Recent Maps submenu');
    }

    const labels = submenu
      .filter((item) => typeof item === 'object' && item !== null && 'label' in item)
      .map((item) => (item as { label?: string }).label);
    expect(labels).toEqual(['/maps/a.json', '/maps/b.json']);

    const firstItem = submenu[0] as { click?: () => void } | undefined;
    firstItem?.click?.();
    expect(onOpenRecentMap).toHaveBeenCalledWith('/maps/a.json');
  });

  it('includes File → New Map (Cmd/Ctrl+N)', () => {
    const template = createApplicationMenuTemplate({
      appName: 'Nomos Studio',
      platform: 'darwin',
      canSave: false,
      canUndo: false,
      canRedo: false,
      recentMapPaths: [],
      mapRenderMode: 'wireframe',
      mapSectorSurface: 'floor',
      mapGridSettings: DEFAULT_MAP_GRID_SETTINGS,
      mapHighlightPortals: false,
      mapHighlightToggleWalls: false,
      mapDoorVisibility: 'visible',
      onOpenSettings: () => {},
      onNewMap: () => {},
      onOpenMap: () => {},
      onOpenRecentMap: () => {},
      onSave: () => {},
      onSaveAs: () => {},
      onUndo: () => {},
      onRedo: () => {},
      onRefreshAssetsIndex: () => {},
      onSetMapRenderMode: () => {},
      onSetMapSectorSurface: () => {},
      onToggleMapHighlightPortals: () => {},
      onToggleMapHighlightToggleWalls: () => {},
      onToggleMapDoorVisibility: () => {},
      onToggleMapGrid: () => {},
      onToggleMapSnapToGrid: () => {},
      onIncreaseMapGridOpacity: () => {},
      onDecreaseMapGridOpacity: () => {}
    });

    const fileMenu = template.find((item) => item.label === 'File');
    if (fileMenu === undefined || fileMenu.submenu === undefined || !Array.isArray(fileMenu.submenu)) {
      throw new Error('Expected File menu submenu');
    }

    const newMapItem = fileMenu.submenu.find(
      (item) => typeof item === 'object' && item !== null && 'label' in item && (item as { label?: string }).label === 'New Map'
    ) as { label?: string; accelerator?: string } | undefined;

    expect(newMapItem).toBeDefined();
    expect(newMapItem?.accelerator).toBe('CommandOrControl+N');
  });

  it('includes a View menu with Wireframe/Textured radio items', () => {
    const template = createApplicationMenuTemplate({
      appName: 'Nomos Studio',
      platform: 'darwin',
      canSave: false,
      canUndo: false,
      canRedo: false,
      recentMapPaths: [],
      mapRenderMode: 'textured',
      mapSectorSurface: 'floor',
      mapGridSettings: DEFAULT_MAP_GRID_SETTINGS,
      mapHighlightPortals: false,
      mapHighlightToggleWalls: false,
      mapDoorVisibility: 'visible',
      onOpenSettings: () => {},
      onNewMap: () => {},
      onOpenMap: () => {},
      onOpenRecentMap: () => {},
      onSave: () => {},
      onSaveAs: () => {},
      onUndo: () => {},
      onRedo: () => {},
      onRefreshAssetsIndex: () => {},
      onSetMapRenderMode: () => {},
      onSetMapSectorSurface: () => {},
      onToggleMapHighlightPortals: () => {},
      onToggleMapHighlightToggleWalls: () => {},
      onToggleMapDoorVisibility: () => {},
      onToggleMapGrid: () => {},
      onToggleMapSnapToGrid: () => {},
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

  it('includes View grid items and checked state reflects options', () => {
    const template = createApplicationMenuTemplate({
      appName: 'Nomos Studio',
      platform: 'darwin',
      canSave: false,
      canUndo: false,
      canRedo: false,
      recentMapPaths: [],
      mapRenderMode: 'wireframe',
      mapSectorSurface: 'floor',
      mapGridSettings: { isGridVisible: false, gridOpacity: 0.3, isSnapToGridEnabled: true },
      mapHighlightPortals: false,
      mapHighlightToggleWalls: false,
      mapDoorVisibility: 'visible',
      onOpenSettings: () => {},
      onNewMap: () => {},
      onOpenMap: () => {},
      onOpenRecentMap: () => {},
      onSave: () => {},
      onSaveAs: () => {},
      onUndo: () => {},
      onRedo: () => {},
      onRefreshAssetsIndex: () => {},
      onSetMapRenderMode: () => {},
      onSetMapSectorSurface: () => {},
      onToggleMapHighlightPortals: () => {},
      onToggleMapHighlightToggleWalls: () => {},
      onToggleMapDoorVisibility: () => {},
      onToggleMapGrid: () => {},
      onToggleMapSnapToGrid: () => {},
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

    const snapToGridItem = viewMenu.submenu.find(
      (item) => typeof item === 'object' && item !== null && 'label' in item && (item as { label?: string }).label === 'Snap to Grid'
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

    expect(snapToGridItem?.type).toBe('checkbox');
    expect(snapToGridItem?.checked).toBe(true);

    const viewLabels = viewMenu.submenu
      .filter((item): item is { label?: string } => typeof item === 'object' && item !== null && 'label' in item)
      .map((item) => item.label);

    const toggleGridIndex = viewLabels.indexOf('Toggle Grid');
    const snapToGridIndex = viewLabels.indexOf('Snap to Grid');
    expect(toggleGridIndex).toBeGreaterThanOrEqual(0);
    expect(snapToGridIndex).toBe(toggleGridIndex + 1);

    expect(increaseOpacityItem).toBeDefined();
    expect(decreaseOpacityItem).toBeDefined();
  });

  it('reflects snap-to-grid checked state from mapGridSettings', () => {
    const template = createApplicationMenuTemplate({
      appName: 'Nomos Studio',
      platform: 'darwin',
      canSave: false,
      canUndo: false,
      canRedo: false,
      recentMapPaths: [],
      mapRenderMode: 'wireframe',
      mapSectorSurface: 'floor',
      mapGridSettings: { isGridVisible: true, gridOpacity: 0.3, isSnapToGridEnabled: false },
      mapHighlightPortals: false,
      mapHighlightToggleWalls: false,
      mapDoorVisibility: 'visible',
      onOpenSettings: () => {},
      onNewMap: () => {},
      onOpenMap: () => {},
      onOpenRecentMap: () => {},
      onSave: () => {},
      onSaveAs: () => {},
      onUndo: () => {},
      onRedo: () => {},
      onRefreshAssetsIndex: () => {},
      onSetMapRenderMode: () => {},
      onSetMapSectorSurface: () => {},
      onToggleMapHighlightPortals: () => {},
      onToggleMapHighlightToggleWalls: () => {},
      onToggleMapDoorVisibility: () => {},
      onToggleMapGrid: () => {},
      onToggleMapSnapToGrid: () => {},
      onIncreaseMapGridOpacity: () => {},
      onDecreaseMapGridOpacity: () => {}
    });

    const viewMenu = template.find((item) => item.label === 'View');
    if (viewMenu === undefined || viewMenu.submenu === undefined || !Array.isArray(viewMenu.submenu)) {
      throw new Error('Expected View menu submenu');
    }

    const snapToGridItem = viewMenu.submenu.find(
      (item) => typeof item === 'object' && item !== null && 'label' in item && (item as { label?: string }).label === 'Snap to Grid'
    ) as { checked?: boolean; type?: string } | undefined;

    expect(snapToGridItem?.type).toBe('checkbox');
    expect(snapToGridItem?.checked).toBe(false);
  });

  it('includes View floor/ceiling surface radio items and click calls through', () => {
    const onSetMapSectorSurface = jest.fn();

    const template = createApplicationMenuTemplate({
      appName: 'Nomos Studio',
      platform: 'darwin',
      canSave: false,
      canUndo: false,
      canRedo: false,
      recentMapPaths: [],
      mapRenderMode: 'textured',
      mapSectorSurface: 'ceiling',
      mapGridSettings: DEFAULT_MAP_GRID_SETTINGS,
      mapHighlightPortals: false,
      mapHighlightToggleWalls: false,
      mapDoorVisibility: 'visible',
      onOpenSettings: () => {},
      onNewMap: () => {},
      onOpenMap: () => {},
      onOpenRecentMap: () => {},
      onSave: () => {},
      onSaveAs: () => {},
      onUndo: () => {},
      onRedo: () => {},
      onRefreshAssetsIndex: () => {},
      onSetMapRenderMode: () => {},
      onSetMapSectorSurface,
      onToggleMapHighlightPortals: () => {},
      onToggleMapHighlightToggleWalls: () => {},
      onToggleMapDoorVisibility: () => {},
      onToggleMapGrid: () => {},
      onToggleMapSnapToGrid: () => {},
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
    const onToggleMapSnapToGrid = jest.fn();
    const onIncreaseMapGridOpacity = jest.fn();
    const onDecreaseMapGridOpacity = jest.fn();

    const template = createApplicationMenuTemplate({
      appName: 'Nomos Studio',
      platform: 'darwin',
      canSave: false,
      canUndo: false,
      canRedo: false,
      recentMapPaths: [],
      mapRenderMode: 'wireframe',
      mapSectorSurface: 'floor',
      mapGridSettings: DEFAULT_MAP_GRID_SETTINGS,
      mapHighlightPortals: false,
      mapHighlightToggleWalls: false,
      mapDoorVisibility: 'visible',
      onOpenSettings: () => {},
      onNewMap: () => {},
      onOpenMap: () => {},
      onOpenRecentMap: () => {},
      onSave: () => {},
      onSaveAs: () => {},
      onUndo: () => {},
      onRedo: () => {},
      onRefreshAssetsIndex: () => {},
      onSetMapRenderMode: () => {},
      onSetMapSectorSurface: () => {},
      onToggleMapHighlightPortals: () => {},
      onToggleMapHighlightToggleWalls: () => {},
      onToggleMapDoorVisibility: () => {},
      onToggleMapGrid,
      onToggleMapSnapToGrid,
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

    const snapToGridItem = viewMenu.submenu.find(
      (item) => typeof item === 'object' && item !== null && 'label' in item && (item as { label?: string }).label === 'Snap to Grid'
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
    snapToGridItem?.click?.();
    increaseOpacityItem?.click?.();
    decreaseOpacityItem?.click?.();

    expect(onToggleMapGrid).toHaveBeenCalledTimes(1);
    expect(onToggleMapSnapToGrid).toHaveBeenCalledTimes(1);
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
      recentMapPaths: [],
      mapRenderMode: 'wireframe',
      mapSectorSurface: 'floor',
      mapGridSettings: DEFAULT_MAP_GRID_SETTINGS,
      mapHighlightPortals: true,
      mapHighlightToggleWalls: true,
      mapDoorVisibility: 'hidden',
      onOpenSettings: () => {},
      onNewMap: () => {},
      onOpenMap: () => {},
      onOpenRecentMap: () => {},
      onSave: () => {},
      onSaveAs: () => {},
      onUndo: () => {},
      onRedo: () => {},
      onRefreshAssetsIndex: () => {},
      onSetMapRenderMode: () => {},
      onSetMapSectorSurface: () => {},
      onToggleMapHighlightPortals: () => {},
      onToggleMapHighlightToggleWalls: () => {},
      onToggleMapDoorVisibility: () => {},
      onToggleMapGrid: () => {},
      onToggleMapSnapToGrid: () => {},
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

    const highlightToggleWallsItem = viewMenu.submenu.find(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        'label' in item &&
        (item as { label?: string }).label === 'Highlight Toggle Walls'
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
    expect(highlightToggleWallsItem?.type).toBe('checkbox');
    expect(highlightToggleWallsItem?.checked).toBe(true);
    expect(toggleDoorVisibilityItem?.type).toBe('checkbox');
    expect(toggleDoorVisibilityItem?.checked).toBe(true);
  });

  it('wires View highlight item clicks to the provided callbacks', () => {
    const onToggleMapHighlightPortals = jest.fn();
    const onToggleMapHighlightToggleWalls = jest.fn();
    const onToggleMapDoorVisibility = jest.fn();

    const template = createApplicationMenuTemplate({
      appName: 'Nomos Studio',
      platform: 'darwin',
      canSave: false,
      canUndo: false,
      canRedo: false,
      recentMapPaths: [],
      mapRenderMode: 'wireframe',
      mapSectorSurface: 'floor',
      mapGridSettings: DEFAULT_MAP_GRID_SETTINGS,
      mapHighlightPortals: false,
      mapHighlightToggleWalls: false,
      mapDoorVisibility: 'visible',
      onOpenSettings: () => {},
      onNewMap: () => {},
      onOpenMap: () => {},
      onOpenRecentMap: () => {},
      onSave: () => {},
      onSaveAs: () => {},
      onUndo: () => {},
      onRedo: () => {},
      onRefreshAssetsIndex: () => {},
      onSetMapRenderMode: () => {},
      onSetMapSectorSurface: () => {},
      onToggleMapHighlightPortals,
      onToggleMapHighlightToggleWalls,
      onToggleMapDoorVisibility,
      onToggleMapGrid: () => {},
      onToggleMapSnapToGrid: () => {},
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

    const highlightToggleWallsItem = viewMenu.submenu.find(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        'label' in item &&
        (item as { label?: string }).label === 'Highlight Toggle Walls'
    ) as { click?: () => void } | undefined;

    const toggleDoorVisibilityItem = viewMenu.submenu.find(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        'label' in item &&
        (item as { label?: string }).label === 'Toggle Door Visibility'
    ) as { click?: () => void } | undefined;

    highlightPortalsItem?.click?.();
    highlightToggleWallsItem?.click?.();
    toggleDoorVisibilityItem?.click?.();

    expect(onToggleMapHighlightPortals).toHaveBeenCalledTimes(1);
    expect(onToggleMapHighlightToggleWalls).toHaveBeenCalledTimes(1);
    expect(onToggleMapDoorVisibility).toHaveBeenCalledTimes(1);
  });
});
