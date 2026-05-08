let audioContext: AudioContext | null = null;
let currentOscillator: OscillatorNode | null = null;

export function playBeep(volume: number): void {
  try {
    if (!audioContext) {
      audioContext = new AudioContext();
    }

    if (currentOscillator) {
      currentOscillator.stop();
      currentOscillator.disconnect();
    }

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 880;
    oscillator.type = 'sine';

    const now = audioContext.currentTime;
    const safeVolume = Math.max(0, Math.min(1, volume));
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(safeVolume * 0.3, now + 0.05);
    gainNode.gain.linearRampToValueAtTime(0, now + 0.5);

    oscillator.start(now);
    oscillator.stop(now + 0.5);

    currentOscillator = oscillator;
  } catch (err) {
    console.error('Audio playback error:', err);
  }
}

export function stopAllAudio(): void {
  if (currentOscillator) {
    try {
      currentOscillator.stop();
    } catch (_) {
      // Already stopped
    }
    currentOscillator.disconnect();
    currentOscillator = null;
  }
}
