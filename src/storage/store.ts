import { app, BrowserWindow, ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import Store from 'electron-store';
import { Schedule, AppSettings, DEFAULT_SETTINGS } from '../core/types';
import { IPC } from '../ipc-channels';
import { MIN_REMINDER_DURATION_S, MAX_REMINDER_DURATION_S } from '../constants';
import { logMain } from '../logger';

type AppStore = Store<AppSettings> & {
  get<K extends keyof AppSettings>(key: K, defaultValue: AppSettings[K]): AppSettings[K];
  set<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void;
};

let store: AppStore | null = null;

function getConfigPath(): string {
  return path.join(app.getPath('userData'), 'config.json');
}

function createStore(): AppStore {
  return new Store<AppSettings>({
    defaults: DEFAULT_SETTINGS,
  }) as AppStore;
}

export function ensureStoreReady(): void {
  if (store) return;

  const configPath = getConfigPath();

  try {
    store = createStore();
    logMain('store.init.ok', { configPath });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logMain('store.init.failed', { configPath, error: err.message });

    try {
      if (fs.existsSync(configPath)) {
        const backupPath = `${configPath}.corrupt-${Date.now()}.bak`;
        fs.renameSync(configPath, backupPath);
        logMain('store.config.backed_up', { configPath, backupPath });
      }
    } catch (backupError) {
      const backupErr = backupError instanceof Error ? backupError : new Error(String(backupError));
      logMain('store.config.backup_failed', { configPath, error: backupErr.message });
    }

    store = createStore();
    logMain('store.recovery.defaults_loaded', { configPath });
  }
}

function getStore(): AppStore {
  ensureStoreReady();
  return store as AppStore;
}

export function getSchedules(): Schedule[] {
  return getStore().get('schedules', DEFAULT_SETTINGS.schedules);
}

export function saveSchedules(schedules: Schedule[]): void {
  getStore().set('schedules', schedules);
}

export function getSettings(): AppSettings {
  const currentStore = getStore();
  return {
    schedules: currentStore.get('schedules', DEFAULT_SETTINGS.schedules),
    volume: currentStore.get('volume', DEFAULT_SETTINGS.volume),
    muted: currentStore.get('muted', DEFAULT_SETTINGS.muted),
    reminderDurationSeconds: currentStore.get('reminderDurationSeconds', DEFAULT_SETTINGS.reminderDurationSeconds),
    audioMode: currentStore.get('audioMode', DEFAULT_SETTINGS.audioMode),
    showSystemNotification: currentStore.get('showSystemNotification', DEFAULT_SETTINGS.showSystemNotification),
  };
}

export function saveSettings(settings: Partial<AppSettings>): AppSettings {
  const currentStore = getStore();
  if (settings.schedules !== undefined) currentStore.set('schedules', settings.schedules);
  if (settings.volume !== undefined) currentStore.set('volume', settings.volume);
  if (settings.muted !== undefined) currentStore.set('muted', settings.muted);
  if (settings.reminderDurationSeconds !== undefined) {
    const clamped = Math.max(MIN_REMINDER_DURATION_S, Math.min(MAX_REMINDER_DURATION_S, Math.round(settings.reminderDurationSeconds)));
    currentStore.set('reminderDurationSeconds', clamped);
  }
  if (settings.audioMode !== undefined) currentStore.set('audioMode', settings.audioMode);
  if (settings.showSystemNotification !== undefined) currentStore.set('showSystemNotification', settings.showSystemNotification);
  return getSettings();
}

function broadcast(mainWindow: BrowserWindow, channel: string, payload?: unknown): void {
  if (!mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

export function registerStoreHandlers(mainWindow: BrowserWindow): void {
  ensureStoreReady();

  ipcMain.handle(IPC.GET_SETTINGS, () => getSettings());

  ipcMain.handle(IPC.SAVE_SETTINGS, (_event, settings: Partial<AppSettings>) => {
    const updated = saveSettings(settings);
    broadcast(mainWindow, IPC.SETTINGS_UPDATED, updated);
    return updated;
  });

  ipcMain.handle(IPC.GET_SCHEDULES, () => getSchedules());

  ipcMain.handle(IPC.SAVE_SCHEDULES, (_event, schedules: Schedule[]) => {
    saveSchedules(schedules);
    broadcast(mainWindow, IPC.SETTINGS_UPDATED, getSettings());
    return getSchedules();
  });
}
