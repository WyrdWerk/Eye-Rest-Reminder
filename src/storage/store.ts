import { app, BrowserWindow, ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import Store from 'electron-store';
import { Schedule, AppSettings, DEFAULT_SETTINGS } from '../core/types';
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
    const clamped = Math.max(5, Math.min(300, Math.round(settings.reminderDurationSeconds)));
    currentStore.set('reminderDurationSeconds', clamped);
  }
  if (settings.audioMode !== undefined) currentStore.set('audioMode', settings.audioMode);
  if (settings.showSystemNotification !== undefined) currentStore.set('showSystemNotification', settings.showSystemNotification);
  return getSettings();
}

export function registerStoreHandlers(mainWindow: BrowserWindow): void {
  ensureStoreReady();

  ipcMain.handle('get-settings', () => getSettings());

  ipcMain.handle('save-settings', (_event, settings: Partial<AppSettings>) => {
    const updated = saveSettings(settings);
    mainWindow.webContents.send('settings-updated', updated);
    return updated;
  });

  ipcMain.handle('get-schedules', () => getSchedules());

  ipcMain.handle('save-schedules', (_event, schedules: Schedule[]) => {
    saveSchedules(schedules);
    mainWindow.webContents.send('settings-updated', getSettings());
    return getSchedules();
  });
}
