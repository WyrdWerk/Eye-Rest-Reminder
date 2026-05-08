import { ipcMain as electronIpcMain, BrowserWindow } from 'electron';
import { AppSettings, ReminderState } from './core/types';
import { IPC } from './ipc-channels';
import { registerStoreHandlers as registerStoreHandlersImpl, getSettings as getSettingsImpl } from './storage/store';
import { ReminderManager } from './reminder-manager';

type IpcMainLike = Pick<typeof electronIpcMain, 'handle' | 'on'>;

type ReminderLike = Pick<ReminderManager, 'getState' | 'dismiss' | 'isActive'>;

type Dependencies = {
  ipcMain: IpcMainLike;
  mainWindow: BrowserWindow;
  reminder: ReminderLike;
  getSettings: () => AppSettings;
  registerStoreHandlers: (mainWindow: BrowserWindow) => void;
  triggerTestReminder: () => void;
};

export function registerMainIpcHandlers({
  ipcMain,
  mainWindow,
  reminder,
  getSettings,
  registerStoreHandlers,
  triggerTestReminder,
}: Dependencies): void {
  registerStoreHandlers(mainWindow);

  ipcMain.handle(IPC.GET_ACTIVE_REMINDER, () => reminder.getState());

  ipcMain.handle(IPC.DISMISS_REMINDER, () => {
    reminder.dismiss(mainWindow);
    return true;
  });

  ipcMain.handle(IPC.TEST_REMINDER, () => {
    triggerTestReminder();
    return true;
  });

  ipcMain.handle(IPC.TEST_SOUND, () => {
    const settings = getSettings();
    if (!settings.muted && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC.PLAY_SOUND, { volume: settings.volume / 100 });
    }
    return true;
  });

  ipcMain.on(IPC.RENDERER_READY, () => {
    if (reminder.isActive() && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC.REMINDER_STARTED, reminder.getState() as ReminderState);
    }
  });
}

export function registerMainIpcHandlersWithDefaults(mainWindow: BrowserWindow, reminder: ReminderManager, triggerTestReminder: () => void): void {
  registerMainIpcHandlers({
    ipcMain: electronIpcMain,
    mainWindow,
    reminder,
    getSettings: getSettingsImpl,
    registerStoreHandlers: registerStoreHandlersImpl,
    triggerTestReminder,
  });
}
