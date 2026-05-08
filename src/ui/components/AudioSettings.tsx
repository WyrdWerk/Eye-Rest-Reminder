import React from 'react';
import { AppSettings, AudioMode } from '../../core/types';
import { MIN_REMINDER_DURATION_S, MAX_REMINDER_DURATION_S } from '../../constants';
import './AudioSettings.css';

interface AudioSettingsProps {
  settings: AppSettings;
  onUpdate: (partial: Partial<AppSettings>) => void;
}

const AUDIO_MODES: AudioMode[] = ['single', 'repeat_for_duration'];

const AudioSettings: React.FC<AudioSettingsProps> = React.memo(({ settings, onUpdate }) => {
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate({ volume: parseInt(e.target.value, 10) });
  };

  const handleMuteToggle = () => {
    onUpdate({ muted: !settings.muted });
  };

  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= MIN_REMINDER_DURATION_S && val <= MAX_REMINDER_DURATION_S) {
      onUpdate({ reminderDurationSeconds: val });
    }
  };

  const handleAudioModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if ((AUDIO_MODES as string[]).includes(value)) {
      onUpdate({ audioMode: value as AudioMode });
    }
  };

  const handleSystemNotificationToggle = () => {
    onUpdate({ showSystemNotification: !settings.showSystemNotification });
  };

  return (
    <div className="audio-settings">
      <div className="settings-intro">
        <span className="page-eyebrow">UTILITY</span>
        <h1 className="page-title">Settings</h1>
        <p className="page-description">
          Adjust reminder duration, audio, and notification behavior.
        </p>
      </div>

      <section className="settings-section settings-section-card">
        <h3>Reminder duration</h3>
        <div className="setting-stack">
          <div className="setting-row setting-row-split">
            <label htmlFor="reminder-duration">Rest duration (seconds)</label>
            <input
              id="reminder-duration"
              type="number"
              min={MIN_REMINDER_DURATION_S}
              max={MAX_REMINDER_DURATION_S}
              value={settings.reminderDurationSeconds}
              onChange={handleDurationChange}
            />
          </div>
          <p className="settings-note">
            The in-app reminder stays visible for this duration unless dismissed early.
          </p>
        </div>
      </section>

      <section className="settings-section settings-section-card">
        <h3>Audio</h3>
        <div className="setting-stack">
          <div className="setting-row setting-row-split">
            <label htmlFor="audio-mode">Audio mode</label>
            <select
              id="audio-mode"
              value={settings.audioMode}
              onChange={handleAudioModeChange}
            >
              <option value="single">Single notification sound</option>
              <option value="repeat_for_duration">Repeat for rest duration</option>
            </select>
          </div>

          <div className="setting-stack">
            <div className="setting-row setting-row-split">
              <label htmlFor="volume">Volume</label>
              <span className="volume-value">
                {settings.muted ? 'Muted' : `${settings.volume}%`}
              </span>
            </div>
            <input
              id="volume"
              className="volume-slider"
              type="range"
              min={0}
              max={100}
              value={settings.muted ? 0 : settings.volume}
              onChange={handleVolumeChange}
              disabled={settings.muted}
              aria-label={`Volume: ${settings.muted ? 'Muted' : `${settings.volume}%`}`}
              style={{
                ['--volume-fill' as string]: settings.muted ? 0 : settings.volume,
              }}
            />
          </div>

          <label className="settings-checkbox-row">
            <input
              type="checkbox"
              checked={settings.muted}
              onChange={handleMuteToggle}
              aria-label="Mute audio"
            />
            <span>Mute</span>
          </label>
        </div>
      </section>

      <section className="settings-section settings-section-card">
        <h3>Notifications</h3>
        <div className="setting-stack">
          <label className="settings-checkbox-row">
            <input
              type="checkbox"
              checked={settings.showSystemNotification}
              onChange={handleSystemNotificationToggle}
              aria-label="Show system notifications"
            />
            <span>Show system notifications</span>
          </label>
          <p className="settings-note settings-note-indented">
            System notifications appear in your OS notification center. The in-app overlay always shows for the full rest duration.
          </p>
        </div>
      </section>
    </div>
  );
});

AudioSettings.displayName = 'AudioSettings';

export default AudioSettings;
