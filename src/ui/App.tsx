import { useState, useEffect, useCallback } from 'react';
import { AppSettings, DEFAULT_SETTINGS, Schedule } from '../core/types';
import ActiveReminders from './components/ActiveReminders';
import ScheduleList from './components/ScheduleList';
import ScheduleForm from './components/ScheduleForm';
import AudioSettings from './components/AudioSettings';
import './App.css';

const electron = window.electronAPI;

function App() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | undefined>(undefined);
  const [activeView, setActiveView] = useState<'schedules' | 'settings'>('schedules');

  const loadSettings = useCallback(async () => {
    try {
      const loaded = await electron.getSettings();
      setSettings(loaded);
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
    electron.rendererReady();

    const unsubSettings = electron.onSettingsUpdated((updated) => {
      setSettings(updated);
    });

    return () => {
      unsubSettings();
    };
  }, [loadSettings]);

  const handleSaveSchedules = async (schedules: Schedule[]) => {
    const updated = await electron.saveSettings({ schedules });
    setSettings(updated);
  };

  const handleAddSchedule = () => {
    setEditingSchedule(undefined);
    setShowScheduleForm(true);
  };

  const handleEditSchedule = (schedule: Schedule) => {
    setEditingSchedule(schedule);
    setShowScheduleForm(true);
  };

  const handleSaveSchedule = async (schedule: Schedule) => {
    const existing = settings.schedules;
    const idx = existing.findIndex((s) => s.id === schedule.id);
    let updated: Schedule[];
    if (idx >= 0) {
      updated = [...existing];
      updated[idx] = schedule;
    } else {
      updated = [...existing, schedule];
    }
    await handleSaveSchedules(updated);
    setShowScheduleForm(false);
    setEditingSchedule(undefined);
  };

  const handleDeleteSchedule = async (id: string) => {
    const updated = settings.schedules.filter((s) => s.id !== id);
    await handleSaveSchedules(updated);
  };

  const handleToggleSchedule = async (id: string) => {
    const updated = settings.schedules.map((s) =>
      s.id === id ? { ...s, enabled: !s.enabled } : s
    );
    await handleSaveSchedules(updated);
  };

  const handleUpdateSettings = async (partial: Partial<AppSettings>) => {
    const updated = await electron.saveSettings(partial);
    setSettings(updated);
  };

  const handleTestReminder = async () => {
    await electron.testReminder();
  };

  const handleTestSound = async () => {
    await electron.testSound();
  };

  return (
    <div className="app">
      <ActiveReminders />
      <header className="app-header">
        <div className="app-header-inner">
          <div className="app-header-copy">
            <h1>Eye Rest Reminder</h1>
            <p>Quiet reminders during your workday.</p>
          </div>
        </div>
      </header>

      <nav className="app-nav">
        <div className="app-nav-inner">
          <button
            className={activeView === 'schedules' ? 'nav-active' : ''}
            onClick={() => setActiveView('schedules')}
          >
            Schedules
          </button>
          <button
            className={activeView === 'settings' ? 'nav-active' : ''}
            onClick={() => setActiveView('settings')}
          >
            Settings
          </button>
        </div>
      </nav>

      {isLoading ? (
        <div className="app-content app-loading">
          <span className="loading-indicator" aria-label="Loading…" />
        </div>
      ) : (
        <>
          {activeView === 'schedules' && (
            <div className="app-content app-content-schedules">
              {showScheduleForm ? (
                <ScheduleForm
                  schedule={editingSchedule}
                  onSave={handleSaveSchedule}
                  onCancel={() => {
                    setShowScheduleForm(false);
                    setEditingSchedule(undefined);
                  }}
                />
              ) : (
                <>
                  <ScheduleList
                    schedules={settings.schedules}
                    onEdit={handleEditSchedule}
                    onDelete={handleDeleteSchedule}
                    onToggle={handleToggleSchedule}
                    onAdd={handleAddSchedule}
                  />
                  <div className="test-controls">
                    <button className="btn-test" onClick={handleTestReminder}>
                      Test Reminder
                    </button>
                    <button className="btn-test" onClick={handleTestSound}>
                      Test Sound
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {activeView === 'settings' && (
            <div className="app-content app-content-settings">
              <AudioSettings
                settings={settings}
                onUpdate={handleUpdateSettings}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default App;
