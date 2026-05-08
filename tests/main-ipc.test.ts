import { IPC } from '../src/ipc-channels';
import { registerMainIpcHandlers } from '../src/main-ipc';
import { DEFAULT_SETTINGS } from '../src/core/types';

type Handler = (...args: any[]) => any;

type IpcMainStub = {
  handle: jest.Mock;
  on: jest.Mock;
};

function createIpcMain() {
  const handlers = new Map<string, Handler>();
  const listeners = new Map<string, Handler>();
  const ipcMain: IpcMainStub = {
    handle: jest.fn((channel: string, handler: Handler) => {
      handlers.set(channel, handler);
    }),
    on: jest.fn((channel: string, listener: Handler) => {
      listeners.set(channel, listener);
    }),
  };

  return { ipcMain, handlers, listeners };
}

function createWindow(overrides: Record<string, unknown> = {}) {
  return {
    isDestroyed: jest.fn(() => false),
    webContents: {
      send: jest.fn(),
    },
    ...overrides,
  };
}

describe('registerMainIpcHandlers', () => {
  test('registers handlers and delegates active reminder, dismiss, and test reminder behavior', () => {
    const { ipcMain, handlers, listeners } = createIpcMain();
    const mainWindow = createWindow();
    const registerStoreHandlers = jest.fn();
    const reminder = {
      getState: jest.fn(() => ({
        active: true,
        scheduleId: 'schedule-1',
        scheduleName: 'Focus',
        remainingSeconds: 10,
        totalDurationSeconds: 20,
      })),
      dismiss: jest.fn(),
      isActive: jest.fn(() => false),
    };
    const triggerTestReminder = jest.fn();
    const getSettings = jest.fn(() => ({ ...DEFAULT_SETTINGS, muted: false, volume: 80 }));

    registerMainIpcHandlers({
      ipcMain,
      mainWindow: mainWindow as never,
      reminder,
      getSettings,
      registerStoreHandlers,
      triggerTestReminder,
    });

    expect(registerStoreHandlers).toHaveBeenCalledWith(mainWindow);
    expect(handlers.get(IPC.GET_ACTIVE_REMINDER)?.()).toEqual(
      expect.objectContaining({ active: true, scheduleId: 'schedule-1' })
    );
    expect(handlers.get(IPC.DISMISS_REMINDER)?.()).toBe(true);
    expect(reminder.dismiss).toHaveBeenCalledWith(mainWindow);
    expect(handlers.get(IPC.TEST_REMINDER)?.()).toBe(true);
    expect(triggerTestReminder).toHaveBeenCalledTimes(1);
    expect(listeners.has(IPC.RENDERER_READY)).toBe(true);
  });

  test('sends test sound only when unmuted and the window is not destroyed', () => {
    const { ipcMain, handlers } = createIpcMain();
    const mainWindow = createWindow();

    registerMainIpcHandlers({
      ipcMain,
      mainWindow: mainWindow as never,
      reminder: {
        getState: jest.fn(() => ({
          active: false,
          scheduleId: null,
          scheduleName: '',
          remainingSeconds: 0,
          totalDurationSeconds: 0,
        })),
        dismiss: jest.fn(),
        isActive: jest.fn(() => false),
      },
      getSettings: jest.fn(() => ({ ...DEFAULT_SETTINGS, muted: false, volume: 65 })),
      registerStoreHandlers: jest.fn(),
      triggerTestReminder: jest.fn(),
    });

    expect(handlers.get(IPC.TEST_SOUND)?.()).toBe(true);
    expect(mainWindow.webContents.send).toHaveBeenCalledWith(IPC.PLAY_SOUND, { volume: 0.65 });
  });

  test('does not send test sound when audio is muted', () => {
    const { ipcMain, handlers } = createIpcMain();
    const mainWindow = createWindow();

    registerMainIpcHandlers({
      ipcMain,
      mainWindow: mainWindow as never,
      reminder: {
        getState: jest.fn(() => ({
          active: false,
          scheduleId: null,
          scheduleName: '',
          remainingSeconds: 0,
          totalDurationSeconds: 0,
        })),
        dismiss: jest.fn(),
        isActive: jest.fn(() => false),
      },
      getSettings: jest.fn(() => ({ ...DEFAULT_SETTINGS, muted: true, volume: 65 })),
      registerStoreHandlers: jest.fn(),
      triggerTestReminder: jest.fn(),
    });

    expect(handlers.get(IPC.TEST_SOUND)?.()).toBe(true);
    expect(mainWindow.webContents.send).not.toHaveBeenCalled();
  });

  test('does not send test sound when the window is destroyed', () => {
    const { ipcMain, handlers } = createIpcMain();
    const destroyedWindow = createWindow({
      isDestroyed: jest.fn(() => true),
    });

    registerMainIpcHandlers({
      ipcMain,
      mainWindow: destroyedWindow as never,
      reminder: {
        getState: jest.fn(() => ({
          active: false,
          scheduleId: null,
          scheduleName: '',
          remainingSeconds: 0,
          totalDurationSeconds: 0,
        })),
        dismiss: jest.fn(),
        isActive: jest.fn(() => false),
      },
      getSettings: jest.fn(() => ({ ...DEFAULT_SETTINGS, muted: false, volume: 65 })),
      registerStoreHandlers: jest.fn(),
      triggerTestReminder: jest.fn(),
    });

    expect(handlers.get(IPC.TEST_SOUND)?.()).toBe(true);
    expect(destroyedWindow.webContents.send).not.toHaveBeenCalled();
  });

  test('replays active reminder state on renderer-ready when the window is healthy', () => {
    const { ipcMain, listeners } = createIpcMain();
    const mainWindow = createWindow();
    const reminderState = {
      active: true,
      scheduleId: 'schedule-1',
      scheduleName: 'Focus',
      remainingSeconds: 10,
      totalDurationSeconds: 20,
    };
    const reminder = {
      getState: jest.fn(() => reminderState),
      dismiss: jest.fn(),
      isActive: jest.fn(() => true),
    };

    registerMainIpcHandlers({
      ipcMain,
      mainWindow: mainWindow as never,
      reminder,
      getSettings: jest.fn(() => ({ ...DEFAULT_SETTINGS, muted: false, volume: 65 })),
      registerStoreHandlers: jest.fn(),
      triggerTestReminder: jest.fn(),
    });

    listeners.get(IPC.RENDERER_READY)?.();

    expect(mainWindow.webContents.send).toHaveBeenCalledWith(IPC.REMINDER_STARTED, reminderState);
  });
});
