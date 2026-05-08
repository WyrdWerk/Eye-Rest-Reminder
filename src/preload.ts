import { contextBridge, ipcRenderer } from 'electron';
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

type IpcRendererLike = Pick<
  typeof ipcRenderer,
  'invoke' | 'send' | 'on' | 'removeListener'
>;

// Keep preload self-contained: sandboxed preload scripts cannot rely on
// loading arbitrary local runtime modules like `./ipc-channels`.
const PRELOAD_IPC = {
  GET_SETTINGS: 'get-settings',
  SAVE_SETTINGS: 'save-settings',
  GET_SCHEDULES: 'get-schedules',
  SAVE_SCHEDULES: 'save-schedules',
  GET_ACTIVE_REMINDER: 'get-active-reminder',
  DISMISS_REMINDER: 'dismiss-reminder',
  TEST_REMINDER: 'test-reminder',
  TEST_SOUND: 'test-sound',
  RENDERER_READY: 'renderer-ready',
  PLAY_SOUND: 'play-sound',
  STOP_SOUND: 'stop-sound',
  REMINDER_STARTED: 'reminder-started',
  REMINDER_TICK: 'reminder-tick',
  REMINDER_DISMISSED: 'reminder-dismissed',
  SETTINGS_UPDATED: 'settings-updated',
} as const;

export function createElectronAPI(renderer: IpcRendererLike): ElectronAPI {
  return {
    getSettings: () => renderer.invoke(PRELOAD_IPC.GET_SETTINGS),
    saveSettings: (settings: Partial<AppSettings>) => renderer.invoke(PRELOAD_IPC.SAVE_SETTINGS, settings),
    getSchedules: () => renderer.invoke(PRELOAD_IPC.GET_SCHEDULES),
    saveSchedules: (schedules: Schedule[]) => renderer.invoke(PRELOAD_IPC.SAVE_SCHEDULES, schedules),
    getActiveReminder: () => renderer.invoke(PRELOAD_IPC.GET_ACTIVE_REMINDER),
    dismissReminder: () => renderer.invoke(PRELOAD_IPC.DISMISS_REMINDER),
    testReminder: () => renderer.invoke(PRELOAD_IPC.TEST_REMINDER),
    testSound: () => renderer.invoke(PRELOAD_IPC.TEST_SOUND),
    rendererReady: () => renderer.send(PRELOAD_IPC.RENDERER_READY),

    onReminderStarted: (callback: (state: ReminderState) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, state: ReminderState) => callback(state);
      renderer.on(PRELOAD_IPC.REMINDER_STARTED, handler);
      return () => renderer.removeListener(PRELOAD_IPC.REMINDER_STARTED, handler);
    },
    onReminderTick: (callback: (remaining: number) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, remaining: number) => callback(remaining);
      renderer.on(PRELOAD_IPC.REMINDER_TICK, handler);
      return () => renderer.removeListener(PRELOAD_IPC.REMINDER_TICK, handler);
    },
    onReminderDismissed: (callback: () => void) => {
      const handler = () => callback();
      renderer.on(PRELOAD_IPC.REMINDER_DISMISSED, handler);
      return () => renderer.removeListener(PRELOAD_IPC.REMINDER_DISMISSED, handler);
    },
    onSettingsUpdated: (callback: (settings: AppSettings) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, settings: AppSettings) => callback(settings);
      renderer.on(PRELOAD_IPC.SETTINGS_UPDATED, handler);
      return () => renderer.removeListener(PRELOAD_IPC.SETTINGS_UPDATED, handler);
    },
    onPlaySound: (callback: (opts: { volume: number }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, opts: { volume: number }) => callback(opts);
      renderer.on(PRELOAD_IPC.PLAY_SOUND, handler);
      return () => renderer.removeListener(PRELOAD_IPC.PLAY_SOUND, handler);
    },
    onStopSound: (callback: () => void) => {
      const handler = () => callback();
      renderer.on(PRELOAD_IPC.STOP_SOUND, handler);
      return () => renderer.removeListener(PRELOAD_IPC.STOP_SOUND, handler);
    },
  };
}

const electronAPI = createElectronAPI(ipcRenderer);

contextBridge.exposeInMainWorld('electronAPI', electronAPI satisfies ElectronAPI);
