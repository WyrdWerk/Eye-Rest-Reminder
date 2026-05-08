import { BrowserWindow, Notification } from 'electron';
import { Schedule, ReminderState } from './core/types';
import { IPC } from './ipc-channels';
import { AudioController } from './audio-controller';
import { getSettings } from './storage/store';
import { logMain } from './logger';

const IDLE_REMINDER: ReminderState = {
  active: false,
  scheduleId: null,
  scheduleName: '',
  remainingSeconds: 0,
  totalDurationSeconds: 0,
};

export class ReminderManager {
  private state: ReminderState = { ...IDLE_REMINDER };
  private countdownInterval: ReturnType<typeof setInterval> | null = null;
  private audio = new AudioController();

  getState(): ReminderState {
    return this.state;
  }

  isActive(): boolean {
    return this.state.active;
  }

  start(schedule: Schedule, mainWindow: BrowserWindow): void {
    if (this.state.active) return;

    const settings = getSettings();
    const durationSeconds = settings.reminderDurationSeconds;

    logMain('reminder.start', {
      scheduleId: schedule.id,
      scheduleName: schedule.name,
      durationSeconds,
      audioMode: settings.audioMode,
      muted: settings.muted,
      showSystemNotification: settings.showSystemNotification,
    });

    this.state = {
      active: true,
      scheduleId: schedule.id,
      scheduleName: schedule.name,
      remainingSeconds: durationSeconds,
      totalDurationSeconds: durationSeconds,
    };

    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC.REMINDER_STARTED, this.state);
      mainWindow.show();
      mainWindow.focus();
    }

    this.showNotification(schedule.name, mainWindow);
    this.audio.startPlayback(settings.volume, settings.audioMode, settings.muted, mainWindow.webContents, () => this.state.active);

    this.countdownInterval = setInterval(() => {
      if (!this.state.active) {
        this.clearCountdown();
        return;
      }

      this.state.remainingSeconds -= 1;

      if (this.state.remainingSeconds <= 0) {
        this.dismiss(mainWindow);
      } else if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IPC.REMINDER_TICK, this.state.remainingSeconds);
      }
    }, 1000);
  }

  dismiss(mainWindow: BrowserWindow): void {
    logMain('reminder.dismiss', {
      scheduleId: this.state.scheduleId,
      scheduleName: this.state.scheduleName,
    });

    this.state = { ...IDLE_REMINDER };
    this.clearCountdown();

    if (!mainWindow.isDestroyed()) {
      this.audio.stopPlayback(mainWindow.webContents);
      mainWindow.webContents.send(IPC.REMINDER_DISMISSED);
    }
  }

  cleanup(mainWindow: BrowserWindow): void {
    this.clearCountdown();
    if (!mainWindow.isDestroyed()) {
      this.audio.stopPlayback(mainWindow.webContents);
    }
  }

  private clearCountdown(): void {
    if (this.countdownInterval !== null) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }

  private showNotification(scheduleName: string, mainWindow: BrowserWindow): void {
    const settings = getSettings();
    if (!settings.showSystemNotification) return;
    if (!Notification.isSupported()) return;

    const notification = new Notification({
      title: 'Eye Rest Reminder',
      body: `Time to rest your eyes! (${scheduleName})`,
      silent: true,
    });

    notification.on('click', () => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.show();
        mainWindow.focus();
      }
    });

    notification.show();
  }
}
