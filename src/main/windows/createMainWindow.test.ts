import { createMainWindow } from './createMainWindow';
import { createMainWindowWebPreferencesForForgeEnvironment } from './createMainWindowWebPreferences';

jest.mock('electron', () => {
  type ReadyToShowHandler = () => void;

  let lastInstance: unknown;

  const BrowserWindow = jest.fn().mockImplementation((options: unknown) => {
    const onceHandlers = new Map<string, ReadyToShowHandler>();

    const instance = {
      __options: options,
      __onceHandlers: onceHandlers,
      once: jest.fn((eventName: string, handler: ReadyToShowHandler) => {
        onceHandlers.set(eventName, handler);
      }),
      show: jest.fn(),
      loadURL: jest.fn(async (url: string) => {
        void url;
        return undefined;
      })
    };

    lastInstance = instance;

    return instance;
  });

  return {
    BrowserWindow,
    __getLastInstance: () => lastInstance
  };
});

jest.mock('./createMainWindowWebPreferences', () => ({
  createMainWindowWebPreferencesForForgeEnvironment: jest.fn()
}));

describe('createMainWindow', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (globalThis as unknown as { MAIN_WINDOW_WEBPACK_ENTRY: string }).MAIN_WINDOW_WEBPACK_ENTRY =
      'http://localhost:1234/test';
  });

  it('constructs a BrowserWindow with expected options, registers ready-to-show, and loads the Forge entry', async () => {
    const expectedWebPreferences = { sentinel: 'web-preferences' };

    const createWebPreferencesMock =
      createMainWindowWebPreferencesForForgeEnvironment as unknown as jest.Mock;
    createWebPreferencesMock.mockReturnValue(expectedWebPreferences);

    const electronMock = jest.requireMock('electron') as {
      BrowserWindow: jest.Mock;
      __getLastInstance: () => unknown;
    };

    const mainWindow = await createMainWindow();

    expect(createMainWindowWebPreferencesForForgeEnvironment).toHaveBeenCalledTimes(1);
    expect(electronMock.BrowserWindow).toHaveBeenCalledTimes(1);
    expect(electronMock.BrowserWindow).toHaveBeenCalledWith({
      width: 1200,
      height: 800,
      show: false,
      webPreferences: expectedWebPreferences
    });

    const instance = electronMock.__getLastInstance() as {
      __options: unknown;
      __onceHandlers: Map<string, () => void>;
      once: jest.Mock;
      show: jest.Mock;
      loadURL: jest.Mock;
    };

    expect(mainWindow).toBe(instance);

    expect(instance.once).toHaveBeenCalledWith('ready-to-show', expect.any(Function));
    expect(instance.loadURL).toHaveBeenCalledWith('http://localhost:1234/test');

    const readyToShowHandler = instance.__onceHandlers.get('ready-to-show');
    expect(readyToShowHandler).toBeDefined();

    readyToShowHandler?.();
    expect(instance.show).toHaveBeenCalledTimes(1);
  });
});
