import { DEFAULT_SETTINGS, Schedule } from '../src/core/types';
import { IPC } from '../src/ipc-channels';

const mockStartPlayback = jest.fn();
const mockStopPlayback = jest.fn();
const mockGetSettings = jest.fn();
const mockLogMain = jest.fn();
const mockNotificationShow = jest.fn();
const mockNotificationOn = jest.fn();
const mockNotificationIsSupported = jest.fn(() => true);
const mockNotification = jest.fn().mockImplementation(() => ({
  on: mockNotificationOn,
  show: mockNotificationShow,
}));

jest.mock('../src/audio-controller', () => ({
  AudioController: jest.fn().mockImplementation(() => ({
    startPlayback: mockStartPlayback,
    stopPlayback: mockStopPlayback,
  })),
}));

jest.mock('../src/storage/store', () => ({
  getSettings: mockGetSettings,
}));

jest.mock('../src/logger', () => ({
  logMain: mockLogMain,
}));

jest.mock('electron', () => ({
  Notification: Object.assign(mockNotification, {
    isSupported: mockNotificationIsSupported,
  }),
}));

import { ReminderManager } from '../src/reminder-manager';

type WindowStub = {
  isDestroyed: jest.Mock<boolean, []>;
  show: jest.Mock;
  focus: jest.Mock;
  webContents: {
    send: jest.Mock;
  };
};

function createWindow(overrides: Partial<WindowStub> = {}): WindowStub {
  return {
    isDestroyed: jest.fn(() => false),
    show: jest.fn(),
    focus: jest.fn(),
    webContents: {
      send: jest.fn(),
    },
    ...overrides,
  };
}

function makeSchedule(overrides: Partial<Schedule> = {}): Schedule {
  return {
    id: 'schedule-1',
    name: 'Focus Session',
    startTime: '08:00',
    endTime: '18:00',
    intervalMinutes: 20,
    enabled: true,
    ...overrides,
  };
}

describe('ReminderManager', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockGetSettings.mockReturnValue({
      ...DEFAULT_SETTINGS,
      reminderDurationSeconds: 2,
      volume: 65,
      audioMode: 'repeat_for_duration',
      showSystemNotification: true,
    });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  test('starts a reminder, shows the window, emits state, and starts audio', () => {
    const manager = new ReminderManager();
    const mainWindow = createWindow();
    const schedule = makeSchedule();

    manager.start(schedule, mainWindow as never);

    expect(manager.getState()).toEqual({
      active: true,
      scheduleId: schedule.id,
      scheduleName: schedule.name,
      remainingSeconds: 2,
      totalDurationSeconds: 2,
    });
    expect(mainWindow.webContents.send).toHaveBeenCalledWith(IPC.REMINDER_STARTED, manager.getState());
    expect(mainWindow.show).toHaveBeenCalledTimes(1);
    expect(mainWindow.focus).toHaveBeenCalledTimes(1);
    expect(mockStartPlayback).toHaveBeenCalledTimes(1);
    expect(mockStartPlayback).toHaveBeenCalledWith(
      65,
      'repeat_for_duration',
      false,
      mainWindow.webContents,
      expect.any(Function)
    );
    expect(mockNotificationIsSupported).toHaveBeenCalledTimes(1);
    expect(mockNotification).toHaveBeenCalledWith({
      title: 'Eye Rest Reminder',
      body: `Time to rest your eyes! (${schedule.name})`,
      silent: true,
    });
    expect(mockNotificationShow).toHaveBeenCalledTimes(1);
  });

  test('does nothing when start is called while a reminder is already active', () => {
    const manager = new ReminderManager();
    const mainWindow = createWindow();

    manager.start(makeSchedule({ id: 'one' }), mainWindow as never);
    manager.start(makeSchedule({ id: 'two', name: 'Second Reminder' }), mainWindow as never);

    expect(mainWindow.webContents.send).toHaveBeenCalledTimes(1);
    expect(mockStartPlayback).toHaveBeenCalledTimes(1);
    expect(manager.getState().scheduleId).toBe('one');
  });

  test('emits ticks and auto-dismisses when the countdown reaches zero', () => {
    const manager = new ReminderManager();
    const mainWindow = createWindow();

    manager.start(makeSchedule(), mainWindow as never);
    jest.advanceTimersByTime(1000);

    expect(mainWindow.webContents.send).toHaveBeenCalledWith(IPC.REMINDER_TICK, 1);

    jest.advanceTimersByTime(1000);

    expect(mockStopPlayback).toHaveBeenCalledWith(mainWindow.webContents);
    expect(mainWindow.webContents.send).toHaveBeenCalledWith(IPC.REMINDER_DISMISSED);
    expect(manager.getState()).toEqual({
      active: false,
      scheduleId: null,
      scheduleName: '',
      remainingSeconds: 0,
      totalDurationSeconds: 0,
    });
  });

  test('dismiss resets state and cleanup stops audio safely', () => {
    const manager = new ReminderManager();
    const mainWindow = createWindow();

    manager.start(makeSchedule(), mainWindow as never);
    const isActive = mockStartPlayback.mock.calls[0][4] as () => boolean;

    expect(isActive()).toBe(true);

    manager.dismiss(mainWindow as never);

    expect(isActive()).toBe(false);
    expect(mockStopPlayback).toHaveBeenCalledWith(mainWindow.webContents);
    expect(mainWindow.webContents.send).toHaveBeenCalledWith(IPC.REMINDER_DISMISSED);

    manager.cleanup(mainWindow as never);

    expect(mockStopPlayback).toHaveBeenCalledTimes(2);
  });

  test('skips notifications when disabled in settings or unsupported by Electron', () => {
    const manager = new ReminderManager();
    const mainWindow = createWindow();

    mockGetSettings.mockReturnValue({
      ...DEFAULT_SETTINGS,
      reminderDurationSeconds: 2,
      showSystemNotification: false,
    });
    manager.start(makeSchedule(), mainWindow as never);

    expect(mockNotification).not.toHaveBeenCalled();

    jest.clearAllMocks();
    mockGetSettings.mockReturnValue({
      ...DEFAULT_SETTINGS,
      reminderDurationSeconds: 2,
      showSystemNotification: true,
    });
    mockNotificationIsSupported.mockReturnValue(false);

    manager.dismiss(mainWindow as never);
    manager.start(makeSchedule({ id: 'supported-check' }), mainWindow as never);

    expect(mockNotificationIsSupported).toHaveBeenCalledTimes(1);
    expect(mockNotification).not.toHaveBeenCalled();
  });
});
