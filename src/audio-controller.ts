import { WebContents } from 'electron';
import { AudioMode } from './core/types';
import { IPC } from './ipc-channels';
import { AUDIO_REPEAT_INTERVAL_MS } from './constants';

export class AudioController {
  private repeatInterval: ReturnType<typeof setInterval> | null = null;

  startPlayback(volume: number, mode: AudioMode, muted: boolean, webContents: WebContents, isActive: () => boolean): void {
    if (!muted) {
      this.sendPlay(volume, webContents);
    }

    if (mode === 'repeat_for_duration' && !muted) {
      this.repeatInterval = setInterval(() => {
        if (isActive()) {
          this.sendPlay(volume, webContents);
        } else {
          this.stopPlayback(webContents);
        }
      }, AUDIO_REPEAT_INTERVAL_MS);
    }
  }

  stopPlayback(webContents: WebContents): void {
    if (this.repeatInterval !== null) {
      clearInterval(this.repeatInterval);
      this.repeatInterval = null;
    }
    if (!webContents.isDestroyed()) {
      webContents.send(IPC.STOP_SOUND);
    }
  }

  private sendPlay(volume: number, webContents: WebContents): void {
    if (!webContents.isDestroyed()) {
      webContents.send(IPC.PLAY_SOUND, { volume: volume / 100 });
    }
  }
}
