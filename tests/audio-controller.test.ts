import { AudioController } from '../src/audio-controller';
import { IPC } from '../src/ipc-channels';
import { AUDIO_REPEAT_INTERVAL_MS } from '../src/constants';

type WebContentsStub = {
  send: jest.Mock;
  isDestroyed: jest.Mock<boolean, []>;
};

function createWebContents(overrides: Partial<WebContentsStub> = {}): WebContentsStub {
  return {
    send: jest.fn(),
    isDestroyed: jest.fn(() => false),
    ...overrides,
  };
}

describe('AudioController', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  test('sends a single normalized play event in single mode', () => {
    const controller = new AudioController();
    const webContents = createWebContents();

    controller.startPlayback(70, 'single', false, webContents as never, () => true);

    expect(webContents.send).toHaveBeenCalledTimes(1);
    expect(webContents.send).toHaveBeenCalledWith(IPC.PLAY_SOUND, { volume: 0.7 });
  });

  test('replays audio on the repeat interval while the reminder is active', () => {
    const controller = new AudioController();
    const webContents = createWebContents();

    controller.startPlayback(40, 'repeat_for_duration', false, webContents as never, () => true);
    jest.advanceTimersByTime(AUDIO_REPEAT_INTERVAL_MS * 2);

    expect(webContents.send).toHaveBeenCalledTimes(3);
    expect(webContents.send).toHaveBeenNthCalledWith(1, IPC.PLAY_SOUND, { volume: 0.4 });
    expect(webContents.send).toHaveBeenNthCalledWith(2, IPC.PLAY_SOUND, { volume: 0.4 });
    expect(webContents.send).toHaveBeenNthCalledWith(3, IPC.PLAY_SOUND, { volume: 0.4 });
  });

  test('stops repeating audio once playback is stopped', () => {
    const controller = new AudioController();
    const webContents = createWebContents();

    controller.startPlayback(55, 'repeat_for_duration', false, webContents as never, () => true);
    controller.stopPlayback(webContents as never);
    jest.advanceTimersByTime(AUDIO_REPEAT_INTERVAL_MS * 2);

    expect(webContents.send).toHaveBeenCalledTimes(2);
    expect(webContents.send).toHaveBeenNthCalledWith(1, IPC.PLAY_SOUND, { volume: 0.55 });
    expect(webContents.send).toHaveBeenNthCalledWith(2, IPC.STOP_SOUND);
  });

  test('does not emit IPC when muted or when the webContents is destroyed', () => {
    const controller = new AudioController();
    const destroyedWebContents = createWebContents({
      isDestroyed: jest.fn(() => true),
    });
    const mutedWebContents = createWebContents();

    controller.startPlayback(80, 'single', true, mutedWebContents as never, () => true);
    controller.startPlayback(80, 'single', false, destroyedWebContents as never, () => true);
    controller.stopPlayback(destroyedWebContents as never);

    expect(mutedWebContents.send).not.toHaveBeenCalled();
    expect(destroyedWebContents.send).not.toHaveBeenCalled();
  });
});
