import { IPC } from '../../src/ipc-channels';
import { DEFAULT_SETTINGS } from '../../src/core/types';
import { MAX_REMINDER_DURATION_S, MIN_REMINDER_DURATION_S } from '../../src/constants';

const mockHandle = jest.fn();
const mockAppGetPath = jest.fn(() => '/tmp/eye-rest-reminder');
const mockStoreInstances: Array<{
  get: jest.Mock;
  set: jest.Mock;
}> = [];
const mockLogMain = jest.fn();

jest.mock('electron', () => ({
  app: {
    getPath: mockAppGetPath,
  },
  ipcMain: {
    handle: mockHandle,
  },
}));

jest.mock('electron-store', () =>
  jest.fn().mockImplementation(({ defaults }) => {
    const data = { ...defaults };
    const store = {
      get: jest.fn((key: string, defaultValue: unknown) => (key in data ? data[key as keyof typeof data] : defaultValue)),
      set: jest.fn((key: string, value: unknown) => {
        data[key as keyof typeof data] = value as never;
      }),
    };
    mockStoreInstances.push(store);
    return store;
  })
);

jest.mock('../../src/logger', () => ({
  logMain: mockLogMain,
}));

function loadStoreModule() {
  jest.resetModules();
  mockHandle.mockClear();
  mockAppGetPath.mockClear();
  mockLogMain.mockClear();
  mockStoreInstances.length = 0;

  return require('../../src/storage/store') as typeof import('../../src/storage/store');
}

function createWindow() {
  return {
    isDestroyed: jest.fn(() => false),
    webContents: {
      send: jest.fn(),
    },
  };
}

describe('storage/store', () => {
  test('clamps reminderDurationSeconds before persisting settings', () => {
    const { saveSettings } = loadStoreModule();

    const maxClamped = saveSettings({ reminderDurationSeconds: MAX_REMINDER_DURATION_S + 10 });
    expect(maxClamped.reminderDurationSeconds).toBe(MAX_REMINDER_DURATION_S);
    expect(mockStoreInstances[0].set).toHaveBeenLastCalledWith(
      'reminderDurationSeconds',
      MAX_REMINDER_DURATION_S
    );

    const minClamped = saveSettings({ reminderDurationSeconds: MIN_REMINDER_DURATION_S - 2 });
    expect(minClamped.reminderDurationSeconds).toBe(MIN_REMINDER_DURATION_S);
    expect(mockStoreInstances[0].set).toHaveBeenLastCalledWith(
      'reminderDurationSeconds',
      MIN_REMINDER_DURATION_S
    );
  });

  test('registers store handlers and broadcasts updated settings snapshots', () => {
    const { registerStoreHandlers } = loadStoreModule();
    const mainWindow = createWindow();
    const schedules = [
      {
        id: 'schedule-1',
        name: 'Focus',
        startTime: '08:00',
        endTime: '18:00',
        intervalMinutes: 20,
        enabled: true,
      },
    ];

    registerStoreHandlers(mainWindow as never);

    const handlerByChannel = new Map<string, (...args: unknown[]) => unknown>(
      mockHandle.mock.calls.map(([channel, handler]) => [channel, handler])
    );

    expect(handlerByChannel.has(IPC.GET_SETTINGS)).toBe(true);
    expect(handlerByChannel.has(IPC.SAVE_SETTINGS)).toBe(true);
    expect(handlerByChannel.has(IPC.GET_SCHEDULES)).toBe(true);
    expect(handlerByChannel.has(IPC.SAVE_SCHEDULES)).toBe(true);

    const updatedSettings = handlerByChannel.get(IPC.SAVE_SETTINGS)?.({}, { muted: true });
    expect(updatedSettings).toEqual(expect.objectContaining({ ...DEFAULT_SETTINGS, muted: true }));
    expect(mainWindow.webContents.send).toHaveBeenCalledWith(IPC.SETTINGS_UPDATED, updatedSettings);

    mainWindow.webContents.send.mockClear();

    const savedSchedules = handlerByChannel.get(IPC.SAVE_SCHEDULES)?.({}, schedules);
    expect(savedSchedules).toEqual(schedules);
    expect(mainWindow.webContents.send).toHaveBeenCalledWith(
      IPC.SETTINGS_UPDATED,
      expect.objectContaining({ ...DEFAULT_SETTINGS, muted: true, schedules })
    );
  });
});
