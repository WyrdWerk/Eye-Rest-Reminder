import React, { useState, useEffect } from 'react';
import { ReminderState } from '../../core/types';
import './ActiveReminders.css';

const electron = window.electronAPI;

const ActiveReminders: React.FC = () => {
  const [reminder, setReminder] = useState<ReminderState | null>(null);

  useEffect(() => {
    const loadActive = async () => {
      try {
        const active = await electron.getActiveReminder();
        if (active.active) {
          setReminder(active);
        }
      } catch (err) {
        console.error('Failed to get active reminder:', err);
      }
    };
    loadActive();

    const unsubStart = electron.onReminderStarted((state: ReminderState) => {
      setReminder(state);
    });

    const unsubTick = electron.onReminderTick((remaining: number) => {
      setReminder((prev) =>
        prev ? { ...prev, remainingSeconds: remaining } : prev
      );
    });

    const unsubDismiss = electron.onReminderDismissed(() => {
      setReminder(null);
    });

    return () => {
      unsubStart();
      unsubTick();
      unsubDismiss();
    };
  }, []);

  const handleDismiss = async () => {
    await electron.dismissReminder();
  };

  if (!reminder || !reminder.active) return null;

  const progressPercent =
    ((reminder.totalDurationSeconds - reminder.remainingSeconds) /
      reminder.totalDurationSeconds) *
    100;

  return (
    <div className="reminder-overlay">
      <div className="reminder-content">
        <div className="reminder-header">
          <h2>Time to Rest!</h2>
          <span className="reminder-schedule-name">{reminder.scheduleName}</span>
        </div>
        <div className="reminder-countdown">{reminder.remainingSeconds}s</div>
        <div className="reminder-progress-bar">
          <div
            className="reminder-progress-fill"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <p className="reminder-hint">
          Look away from the screen and focus on something 20+ feet away
        </p>
        <button className="reminder-dismiss-btn" onClick={handleDismiss}>
          I have rested
        </button>
      </div>
    </div>
  );
};

export default ActiveReminders;
