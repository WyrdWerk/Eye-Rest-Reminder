import {
  app,
  BrowserWindow,
  Notification,
  Tray,
  Menu,
  ipcMain,
  nativeImage,
  shell,
} from 'electron';
import fs from 'fs';
import path from 'path';
import { Schedule, ReminderState } from './core/types';
import { ensureStoreReady, registerStoreHandlers, getSettings } from './storage/store';
import { calculateNextReminder } from './core/scheduler';
import { getMainLogFilePath, logMain } from './logger';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let schedulerInterval: ReturnType<typeof setInterval> | null = null;

let activeReminder: ReminderState = {
  active: false,
  scheduleId: null,
  scheduleName: '',
  remainingSeconds: 0,
  totalDurationSeconds: 0,
};

let reminderCountdownInterval: ReturnType<typeof setInterval> | null = null;
let audioRepeatInterval: ReturnType<typeof setInterval> | null = null;
let isQuitting = false;
const lastTriggeredMinuteBySchedule = new Map<string, number>();

const isDev = !app.isPackaged;

logMain('app.process.start', {
  pid: process.pid,
  isPackaged: app.isPackaged,
  platform: process.platform,
  cwd: process.cwd(),
});

process.on('uncaughtException', (error) => {
  logMain('process.uncaughtException', {
    message: error.message,
    stack: error.stack,
  });
});

process.on('unhandledRejection', (reason) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  logMain('process.unhandledRejection', {
    message: error.message,
    stack: error.stack,
  });
});

const singleInstanceLock = app.requestSingleInstanceLock();

if (!singleInstanceLock) {
  logMain('app.single_instance.lock_denied');
  app.quit();
}

app.on('second-instance', () => {
  logMain('app.second_instance');
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

function getAssetPath(filename: string): string {
  if (isDev) {
    return path.join(__dirname, 'assets', filename);
  }
  return path.join(process.resourcesPath, 'assets', filename);
}

function getPreloadPath(): string {
  return path.join(__dirname, 'preload.js');
}

function createWindow(): void {
  const preloadPath = getPreloadPath();
  const productionHtmlPath = path.join(__dirname, 'index.html');

  logMain('window.create.start', {
    isDev,
    dirname: __dirname,
    preloadPath,
    preloadExists: fs.existsSync(preloadPath),
    productionHtmlPath,
    productionHtmlExists: fs.existsSync(productionHtmlPath),
    logFile: getMainLogFilePath(),
  });

  mainWindow = new BrowserWindow({
    width: 480,
    height: 600,
    resizable: true,
    icon: getAssetPath('icon.png'),
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.webContents.on('did-finish-load', () => {
    logMain('window.did_finish_load');
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    logMain('window.did_fail_load', {
      errorCode,
      errorDescription,
      validatedURL,
      isMainFrame,
    });
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    logMain('window.render_process_gone', {
      reason: details.reason,
      exitCode: details.exitCode,
    });
  });

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    logMain('window.console_message', { level, message, line, sourceId });
  });

  if (isDev) {
    logMain('window.load.dev', { url: 'http://localhost:9000' });
    mainWindow.loadURL('http://localhost:9000');
    mainWindow.webContents.openDevTools();
  } else {
    logMain('window.load.production', { file: productionHtmlPath });
    mainWindow.loadFile(productionHtmlPath);
  }

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
}

function createTray(): void {
  const iconPath = getAssetPath('icon.png');
  const trayIcon = nativeImage.createFromPath(iconPath);
  tray = new Tray(trayIcon.resize({ width: 16, height: 16 }));

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show',
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    {
      label: 'Test Reminder',
      click: () => {
        triggerTestReminder();
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip('Eye Rest Reminder');
  tray.setContextMenu(contextMenu);
  tray.on('click', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
}

function playReminderSound(): void {
  const settings = getSettings();
  if (settings.muted) return;

  const volume = settings.volume / 100;

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('play-sound', { volume });
  }
}

function startAudioPlayback(): void {
  const settings = getSettings();

  playReminderSound();

  if (settings.audioMode === 'repeat_for_duration' && !settings.muted) {
    const repeatIntervalMs = 4000;
    audioRepeatInterval = setInterval(() => {
      if (activeReminder.active) {
        playReminderSound();
      } else {
        stopAudioPlayback();
      }
    }, repeatIntervalMs);
  }
}

function stopAudioPlayback(): void {
  if (audioRepeatInterval !== null) {
    clearInterval(audioRepeatInterval);
    audioRepeatInterval = null;
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('stop-sound');
  }
}

function showSystemNotification(scheduleName: string): void {
  const settings = getSettings();
  if (!settings.showSystemNotification) return;
  if (!Notification.isSupported()) return;

  const notification = new Notification({
    title: 'Eye Rest Reminder',
    body: `Time to rest your eyes! (${scheduleName})`,
    silent: true,
  });

  notification.on('click', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });

  notification.show();
}

function startReminder(schedule: Schedule): void {
  if (activeReminder.active) return;

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

  activeReminder = {
    active: true,
    scheduleId: schedule.id,
    scheduleName: schedule.name,
    remainingSeconds: durationSeconds,
    totalDurationSeconds: durationSeconds,
  };

  mainWindow?.webContents.send('reminder-started', activeReminder);
  mainWindow?.show();
  mainWindow?.focus();

  showSystemNotification(schedule.name);
  startAudioPlayback();

  reminderCountdownInterval = setInterval(() => {
    if (!activeReminder.active) {
      clearReminderCountdown();
      return;
    }

    activeReminder.remainingSeconds -= 1;

    if (activeReminder.remainingSeconds <= 0) {
      dismissReminder();
    } else {
      mainWindow?.webContents.send('reminder-tick', activeReminder.remainingSeconds);
    }
  }, 1000);
}

function dismissReminder(): void {
  logMain('reminder.dismiss', {
    scheduleId: activeReminder.scheduleId,
    scheduleName: activeReminder.scheduleName,
  });

  activeReminder = {
    active: false,
    scheduleId: null,
    scheduleName: '',
    remainingSeconds: 0,
    totalDurationSeconds: 0,
  };

  clearReminderCountdown();
  stopAudioPlayback();
  mainWindow?.webContents.send('reminder-dismissed');
}

function clearReminderCountdown(): void {
  if (reminderCountdownInterval !== null) {
    clearInterval(reminderCountdownInterval);
    reminderCountdownInterval = null;
  }
}

function triggerTestReminder(): void {
  const testSchedule: Schedule = {
    id: 'test',
    name: 'Test Reminder',
    startTime: '00:00',
    endTime: '23:59',
    intervalMinutes: 20,
    enabled: true,
  };
  startReminder(testSchedule);
}

function startScheduler(): void {
  if (schedulerInterval) clearInterval(schedulerInterval);

  schedulerInterval = setInterval(() => {
    const settings = getSettings();
    const enabledSchedules = settings.schedules.filter((s) => s.enabled);
    if (enabledSchedules.length === 0) return;

    const now = new Date();
    const event = calculateNextReminder(enabledSchedules, now);

    if (event && event.type === 'fire') {
      const minuteBucket = Math.floor(now.getTime() / 60_000);
      const lastTriggeredMinute = lastTriggeredMinuteBySchedule.get(event.scheduleId);

      if (lastTriggeredMinute === minuteBucket) {
        return;
      }

      const schedule = enabledSchedules.find((s) => s.id === event.scheduleId);
      if (schedule) {
        lastTriggeredMinuteBySchedule.set(event.scheduleId, minuteBucket);
        logMain('scheduler.fire', {
          scheduleId: schedule.id,
          scheduleName: schedule.name,
          minuteBucket,
          at: now.toISOString(),
        });
        startReminder(schedule);
      }
    } else if (event && event.type === 'wait' && event.ms <= 5_000) {
      logMain('scheduler.due_soon', {
        scheduleId: event.scheduleId,
        waitMs: event.ms,
        at: now.toISOString(),
      });
    }
  }, 1000);
}

function registerIpcHandlers(): void {
  if (!mainWindow) return;

  registerStoreHandlers(mainWindow);

  ipcMain.handle('get-active-reminder', () => {
    return activeReminder;
  });

  ipcMain.handle('dismiss-reminder', () => {
    dismissReminder();
    return true;
  });

  ipcMain.handle('test-reminder', () => {
    triggerTestReminder();
    return true;
  });

  ipcMain.handle('test-sound', () => {
    playReminderSound();
    return true;
  });

  ipcMain.on('renderer-ready', () => {
    if (activeReminder.active) {
      mainWindow?.webContents.send('reminder-started', activeReminder);
    }
  });
}

app.whenReady().then(() => {
  logMain('app.whenReady');
  ensureStoreReady();
  createWindow();
  createTray();
  registerIpcHandlers();
  startScheduler();
  logMain('app.startup.complete');
});

app.on('window-all-closed', () => {
  // Keep app running in tray
});

app.on('before-quit', () => {
  isQuitting = true;
  if (schedulerInterval) clearInterval(schedulerInterval);
  clearReminderCountdown();
  stopAudioPlayback();
});
