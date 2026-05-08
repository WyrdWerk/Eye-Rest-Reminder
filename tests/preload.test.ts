import { IPC } from '../src/ipc-channels';

jest.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: jest.fn(),
  },
  ipcRenderer: {
    invoke: jest.fn(),
    send: jest.fn(),
    on: jest.fn(),
    removeListener: jest.fn(),
  },
}));

import { createElectronAPI } from '../src/preload';

type IpcRendererStub = {
  invoke: jest.Mock;
  send: jest.Mock;
  on: jest.Mock;
  removeListener: jest.Mock;
};

function getRegisteredHandler(ipcRenderer: IpcRendererStub, channel: string) {
  return ipcRenderer.on.mock.calls.find(([registeredChannel]) => registeredChannel === channel)?.[1];
}

function createIpcRenderer(): IpcRendererStub {
  return {
    invoke: jest.fn(),
    send: jest.fn(),
    on: jest.fn(),
    removeListener: jest.fn(),
  };
}

describe('createElectronAPI', () => {
  test('uses invoke for request-response APIs, returns the invoke result, and uses send for rendererReady', async () => {
    const ipcRenderer = createIpcRenderer();
    const invokeResults = [
      Promise.resolve({ muted: true }),
      Promise.resolve({ muted: true }),
      Promise.resolve([{ id: 'schedule-1' }]),
      Promise.resolve([{ id: 'schedule-1' }]),
      Promise.resolve({ active: false }),
      Promise.resolve(true),
      Promise.resolve(true),
      Promise.resolve(true),
    ];
    invokeResults.forEach((result) => ipcRenderer.invoke.mockReturnValueOnce(result));
    const api = createElectronAPI(ipcRenderer as never);
    const schedules = [{ id: 'schedule-1' }];

    await expect(api.getSettings()).resolves.toEqual({ muted: true });
    await expect(api.saveSettings({ muted: true })).resolves.toEqual({ muted: true });
    await expect(api.getSchedules()).resolves.toEqual([{ id: 'schedule-1' }]);
    await expect(api.saveSchedules(schedules as never)).resolves.toEqual([{ id: 'schedule-1' }]);
    await expect(api.getActiveReminder()).resolves.toEqual({ active: false });
    await expect(api.dismissReminder()).resolves.toBe(true);
    await expect(api.testReminder()).resolves.toBe(true);
    await expect(api.testSound()).resolves.toBe(true);
    api.rendererReady();

    expect(ipcRenderer.invoke).toHaveBeenNthCalledWith(1, IPC.GET_SETTINGS);
    expect(ipcRenderer.invoke).toHaveBeenNthCalledWith(2, IPC.SAVE_SETTINGS, { muted: true });
    expect(ipcRenderer.invoke).toHaveBeenNthCalledWith(3, IPC.GET_SCHEDULES);
    expect(ipcRenderer.invoke).toHaveBeenNthCalledWith(4, IPC.SAVE_SCHEDULES, schedules);
    expect(ipcRenderer.invoke).toHaveBeenNthCalledWith(5, IPC.GET_ACTIVE_REMINDER);
    expect(ipcRenderer.invoke).toHaveBeenNthCalledWith(6, IPC.DISMISS_REMINDER);
    expect(ipcRenderer.invoke).toHaveBeenNthCalledWith(7, IPC.TEST_REMINDER);
    expect(ipcRenderer.invoke).toHaveBeenNthCalledWith(8, IPC.TEST_SOUND);
    expect(ipcRenderer.send).toHaveBeenCalledWith(IPC.RENDERER_READY);
  });

  test('registers listeners and the returned cleanup removes the same handler', () => {
    const ipcRenderer = createIpcRenderer();
    const api = createElectronAPI(ipcRenderer as never);
    const callback = jest.fn();

    const unsubscribe = api.onReminderStarted(callback);
    const registeredHandler = ipcRenderer.on.mock.calls[0][1];
    const reminderState = { active: true, scheduleId: 'schedule-1', scheduleName: 'Focus', remainingSeconds: 10, totalDurationSeconds: 20 };

    registeredHandler({}, reminderState);
    unsubscribe();

    expect(ipcRenderer.on).toHaveBeenCalledWith(IPC.REMINDER_STARTED, expect.any(Function));
    expect(callback).toHaveBeenCalledWith(reminderState);
    expect(ipcRenderer.removeListener).toHaveBeenCalledWith(IPC.REMINDER_STARTED, registeredHandler);
  });

  test('passes through payloads for tick, settings, play, dismiss, and stop listeners', () => {
    const ipcRenderer = createIpcRenderer();
    const api = createElectronAPI(ipcRenderer as never);
    const onTick = jest.fn();
    const onSettingsUpdated = jest.fn();
    const onPlaySound = jest.fn();
    const onDismissed = jest.fn();
    const onStopSound = jest.fn();

    api.onReminderTick(onTick);
    api.onSettingsUpdated(onSettingsUpdated);
    api.onPlaySound(onPlaySound);
    api.onReminderDismissed(onDismissed);
    api.onStopSound(onStopSound);

    const tickHandler = getRegisteredHandler(ipcRenderer, IPC.REMINDER_TICK);
    const settingsHandler = getRegisteredHandler(ipcRenderer, IPC.SETTINGS_UPDATED);
    const playHandler = getRegisteredHandler(ipcRenderer, IPC.PLAY_SOUND);
    const dismissedHandler = getRegisteredHandler(ipcRenderer, IPC.REMINDER_DISMISSED);
    const stopHandler = getRegisteredHandler(ipcRenderer, IPC.STOP_SOUND);

    tickHandler({}, 15);
    settingsHandler({}, { muted: true });
    playHandler({}, { volume: 0.5 });
    dismissedHandler();
    stopHandler();

    expect(ipcRenderer.on).toHaveBeenCalledWith(IPC.REMINDER_TICK, expect.any(Function));
    expect(ipcRenderer.on).toHaveBeenCalledWith(IPC.SETTINGS_UPDATED, expect.any(Function));
    expect(ipcRenderer.on).toHaveBeenCalledWith(IPC.PLAY_SOUND, expect.any(Function));
    expect(ipcRenderer.on).toHaveBeenCalledWith(IPC.REMINDER_DISMISSED, expect.any(Function));
    expect(ipcRenderer.on).toHaveBeenCalledWith(IPC.STOP_SOUND, expect.any(Function));
    expect(onTick).toHaveBeenCalledWith(15);
    expect(onSettingsUpdated).toHaveBeenCalledWith({ muted: true });
    expect(onPlaySound).toHaveBeenCalledWith({ volume: 0.5 });
    expect(onDismissed).toHaveBeenCalledTimes(1);
    expect(onStopSound).toHaveBeenCalledTimes(1);
  });

  test('exposes the electron API on window at module load', () => {
    const { contextBridge } = jest.requireMock('electron') as {
      contextBridge: { exposeInMainWorld: jest.Mock };
    };

    expect(contextBridge.exposeInMainWorld).toHaveBeenCalledWith(
      'electronAPI',
      expect.objectContaining({
        getSettings: expect.any(Function),
        saveSettings: expect.any(Function),
        rendererReady: expect.any(Function),
      })
    );
  });
});
