import { app } from 'electron';
import fs from 'fs';
import os from 'os';
import path from 'path';

function resolveLogDir(): string {
  try {
    return path.join(app.getPath('userData'), 'logs');
  } catch {
    return path.join(os.tmpdir(), 'eye-rest-reminder-logs');
  }
}

export function getMainLogFilePath(): string {
  return path.join(resolveLogDir(), 'main.log');
}

export function logMain(message: string, meta?: Record<string, unknown>): void {
  const logDir = resolveLogDir();
  const line = `${new Date().toISOString()} ${message}${meta ? ` ${JSON.stringify(meta)}` : ''}\n`;

  try {
    fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(path.join(logDir, 'main.log'), line, 'utf8');
  } catch {
    // Logging must never crash app startup.
  }
}
