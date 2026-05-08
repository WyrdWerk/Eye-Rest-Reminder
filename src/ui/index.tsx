import { createRoot } from 'react-dom/client';
import App from './App';
import { playBeep, stopAllAudio } from './audio-manager';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}

const electron = window.electronAPI;

if (electron) {
  electron.onPlaySound((opts: { volume: number }) => {
    playBeep(opts.volume);
  });

  electron.onStopSound(() => {
    stopAllAudio();
  });
}
