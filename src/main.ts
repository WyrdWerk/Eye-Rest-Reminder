import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  ipcMain,
  nativeImage,
} from 'electron';
import fs from 'fs';
import path from 'path';
import { ensureStoreReady, registerStoreHandlers, getSettings } from './storage/store';
import { calculateNextReminder } from './core/scheduler';
import { IPC } from './ipc-channels';
import { WINDOW_WIDTH, WINDOW_HEIGHT, SCHEDULER_POLL_INTERVAL_MS, REMINDER_DUE_SOON_THRESHOLD_MS, MINUTE_BUCKET_MS } from './constants';
import { ReminderManager } from './reminder-manager';
import { getMainLogFilePath, logMain } from './logger';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let schedulerInterval: ReturnType<typeof setInterval> | null = null;
let isQuitting = false;

const reminder = new ReminderManager();
const lastTriggeredMinuteBySchedule = new Map<string, number>();
const isDev = !app.isPackaged;

logMain('app.process.start', {
  pid: process.pid,
  isPackaged: app.isPackaged,
  platform: process.platform,
  cwd: process.cwd(),
});

process.on('uncaughtException', (error) => {
  logMain('process.uncaughtException', { message: error.message, stack: error.stack });
});

process.on('unhandledRejection', (reason) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  logMain('process.unhandledRejection', { message: error.message, stack: error.stack });
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

function createWindow(): void {
  const preloadPath = path.join(__dirname, 'preload.js');
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
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    resizable: true,
    icon: getAssetPath('icon.png'),
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.webContents.on('did-finish-load', () => logMain('window.did_finish_load'));

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    logMain('window.did_fail_load', { errorCode, errorDescription, validatedURL, isMainFrame });
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    logMain('window.render_process_gone', { reason: details.reason, exitCode: details.exitCode });
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
      click: () => { mainWindow?.show(); mainWindow?.focus(); },
    },
    {
      label: 'Test Reminder',
      click: () => triggerTestReminder(),
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => { isQuitting = true; app.quit(); },
    },
  ]);

  tray.setToolTip('Eye Rest Reminder');
  tray.setContextMenu(contextMenu);
  tray.on('click', () => { mainWindow?.show(); mainWindow?.focus(); });
}

function triggerTestReminder(): void {
  if (!mainWindow) return;
  reminder.start(
    { id: 'test', name: 'Test Reminder', startTime: '00:00', endTime: '23:59', intervalMinutes: 20, enabled: true },
    mainWindow
  );
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
      const minuteBucket = Math.floor(now.getTime() / MINUTE_BUCKET_MS);
      const lastTriggeredMinute = lastTriggeredMinuteBySchedule.get(event.scheduleId);

      if (lastTriggeredMinute === minuteBucket) return;

      const schedule = enabledSchedules.find((s) => s.id === event.scheduleId);
      if (schedule && mainWindow) {
        lastTriggeredMinuteBySchedule.set(event.scheduleId, minuteBucket);
        logMain('scheduler.fire', { scheduleId: schedule.id, scheduleName: schedule.name, minuteBucket, at: now.toISOString() });
        reminder.start(schedule, mainWindow);
      }
    } else if (event && event.type === 'wait' && event.ms <= REMINDER_DUE_SOON_THRESHOLD_MS) {
      logMain('scheduler.due_soon', { scheduleId: event.scheduleId, waitMs: event.ms, at: now.toISOString() });
    }
  }, SCHEDULER_POLL_INTERVAL_MS);
}

function registerIpcHandlers(): void {
  if (!mainWindow) return;

  registerStoreHandlers(mainWindow);

  ipcMain.handle(IPC.GET_ACTIVE_REMINDER, () => reminder.getState());

  ipcMain.handle(IPC.DISMISS_REMINDER, () => {
    if (mainWindow) reminder.dismiss(mainWindow);
    return true;
  });

  ipcMain.handle(IPC.TEST_REMINDER, () => {
    triggerTestReminder();
    return true;
  });

  ipcMain.handle(IPC.TEST_SOUND, () => {
    const settings = getSettings();
    if (!settings.muted && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC.PLAY_SOUND, { volume: settings.volume / 100 });
    }
    return true;
  });

  ipcMain.on(IPC.RENDERER_READY, () => {
    if (reminder.isActive() && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC.REMINDER_STARTED, reminder.getState());
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
  if (mainWindow) reminder.cleanup(mainWindow);
});
