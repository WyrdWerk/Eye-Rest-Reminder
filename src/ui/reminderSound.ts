/**
 * Short synthesized tone — no external audio sample (see assets/sounds/LICENSE.md).
 */
export function playReminderBeep(volumePercent: number, muted: boolean): void {
  if (muted || volumePercent <= 0) return;
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const gain = ctx.createGain();
    gain.gain.value = Math.min(1, Math.max(0, volumePercent / 100)) * 0.28;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.22);
    osc.onended = () => {
      void ctx.close();
    };
  } catch (e) {
    console.warn('reminder beep failed:', e);
  }
}
