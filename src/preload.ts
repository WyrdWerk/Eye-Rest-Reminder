import { contextBridge, ipcRenderer } from 'electron';

export interface ElectronAPI {
  getSettings(): Promise<import('./core/types').AppSettings>;
  saveSettings(settings: Partial<import('./core/types').AppSettings>): Promise<import('./core/types').AppSettings>;
  getSchedules(): Promise<import('./core/types').Schedule[]>;
  saveSchedules(schedules: import('./core/types').Schedule[]): Promise<import('./core/types').Schedule[]>;
  getActiveReminder(): Promise<import('./core/types').ReminderState>;
  dismissReminder(): Promise<boolean>;
  testReminder(): Promise<boolean>;
  testSound(): Promise<boolean>;
  rendererReady(): void;
  onReminderStarted(callback: (state: import('./core/types').ReminderState) => void): () => void;
  onReminderTick(callback: (remaining: number) => void): () => void;
  onReminderDismissed(callback: () => void): () => void;
  onSettingsUpdated(callback: (settings: import('./core/types').AppSettings) => void): () => void;
  onPlaySound(callback: (opts: { volume: number }) => void): () => void;
  onStopSound(callback: () => void): () => void;
}

contextBridge.exposeInMainWorld('electronAPI', {
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: any) => ipcRenderer.invoke('save-settings', settings),
  getSchedules: () => ipcRenderer.invoke('get-schedules'),
  saveSchedules: (schedules: any) => ipcRenderer.invoke('save-schedules', schedules),
  getActiveReminder: () => ipcRenderer.invoke('get-active-reminder'),
  dismissReminder: () => ipcRenderer.invoke('dismiss-reminder'),
  testReminder: () => ipcRenderer.invoke('test-reminder'),
  testSound: () => ipcRenderer.invoke('test-sound'),
  rendererReady: () => ipcRenderer.send('renderer-ready'),

  onReminderStarted: (callback: any) => {
    const handler = (_event: any, state: any) => callback(state);
    ipcRenderer.on('reminder-started', handler);
    return () => ipcRenderer.removeListener('reminder-started', handler);
  },
  onReminderTick: (callback: any) => {
    const handler = (_event: any, remaining: number) => callback(remaining);
    ipcRenderer.on('reminder-tick', handler);
    return () => ipcRenderer.removeListener('reminder-tick', handler);
  },
  onReminderDismissed: (callback: any) => {
    const handler = () => callback();
    ipcRenderer.on('reminder-dismissed', handler);
    return () => ipcRenderer.removeListener('reminder-dismissed', handler);
  },
  onSettingsUpdated: (callback: any) => {
    const handler = (_event: any, settings: any) => callback(settings);
    ipcRenderer.on('settings-updated', handler);
    return () => ipcRenderer.removeListener('settings-updated', handler);
  },
  onPlaySound: (callback: any) => {
    const handler = (_event: any, opts: any) => callback(opts);
    ipcRenderer.on('play-sound', handler);
    return () => ipcRenderer.removeListener('play-sound', handler);
  },
  onStopSound: (callback: any) => {
    const handler = () => callback();
    ipcRenderer.on('stop-sound', handler);
    return () => ipcRenderer.removeListener('stop-sound', handler);
  },
});
