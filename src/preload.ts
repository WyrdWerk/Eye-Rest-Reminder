import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from './ipc-channels';
import type { AppSettings, Schedule, ReminderState } from './core/types';

export interface ElectronAPI {
  getSettings(): Promise<AppSettings>;
  saveSettings(settings: Partial<AppSettings>): Promise<AppSettings>;
  getSchedules(): Promise<Schedule[]>;
  saveSchedules(schedules: Schedule[]): Promise<Schedule[]>;
  getActiveReminder(): Promise<ReminderState>;
  dismissReminder(): Promise<boolean>;
  testReminder(): Promise<boolean>;
  testSound(): Promise<boolean>;
  rendererReady(): void;
  onReminderStarted(callback: (state: ReminderState) => void): () => void;
  onReminderTick(callback: (remaining: number) => void): () => void;
  onReminderDismissed(callback: () => void): () => void;
  onSettingsUpdated(callback: (settings: AppSettings) => void): () => void;
  onPlaySound(callback: (opts: { volume: number }) => void): () => void;
  onStopSound(callback: () => void): () => void;
}

contextBridge.exposeInMainWorld('electronAPI', {
  getSettings: () => ipcRenderer.invoke(IPC.GET_SETTINGS),
  saveSettings: (settings: Partial<AppSettings>) => ipcRenderer.invoke(IPC.SAVE_SETTINGS, settings),
  getSchedules: () => ipcRenderer.invoke(IPC.GET_SCHEDULES),
  saveSchedules: (schedules: Schedule[]) => ipcRenderer.invoke(IPC.SAVE_SCHEDULES, schedules),
  getActiveReminder: () => ipcRenderer.invoke(IPC.GET_ACTIVE_REMINDER),
  dismissReminder: () => ipcRenderer.invoke(IPC.DISMISS_REMINDER),
  testReminder: () => ipcRenderer.invoke(IPC.TEST_REMINDER),
  testSound: () => ipcRenderer.invoke(IPC.TEST_SOUND),
  rendererReady: () => ipcRenderer.send(IPC.RENDERER_READY),

  onReminderStarted: (callback: (state: ReminderState) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, state: ReminderState) => callback(state);
    ipcRenderer.on(IPC.REMINDER_STARTED, handler);
    return () => ipcRenderer.removeListener(IPC.REMINDER_STARTED, handler);
  },
  onReminderTick: (callback: (remaining: number) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, remaining: number) => callback(remaining);
    ipcRenderer.on(IPC.REMINDER_TICK, handler);
    return () => ipcRenderer.removeListener(IPC.REMINDER_TICK, handler);
  },
  onReminderDismissed: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on(IPC.REMINDER_DISMISSED, handler);
    return () => ipcRenderer.removeListener(IPC.REMINDER_DISMISSED, handler);
  },
  onSettingsUpdated: (callback: (settings: AppSettings) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, settings: AppSettings) => callback(settings);
    ipcRenderer.on(IPC.SETTINGS_UPDATED, handler);
    return () => ipcRenderer.removeListener(IPC.SETTINGS_UPDATED, handler);
  },
  onPlaySound: (callback: (opts: { volume: number }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, opts: { volume: number }) => callback(opts);
    ipcRenderer.on(IPC.PLAY_SOUND, handler);
    return () => ipcRenderer.removeListener(IPC.PLAY_SOUND, handler);
  },
  onStopSound: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on(IPC.STOP_SOUND, handler);
    return () => ipcRenderer.removeListener(IPC.STOP_SOUND, handler);
  },
} satisfies ElectronAPI);
