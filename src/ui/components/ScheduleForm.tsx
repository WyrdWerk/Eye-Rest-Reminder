import React, { useState } from 'react';
import { Schedule } from '../../core/types';
import './ScheduleForm.css';

interface ScheduleFormProps {
  schedule?: Schedule;
  onSave: (schedule: Schedule) => void;
  onCancel: () => void;
}

const ScheduleForm: React.FC<ScheduleFormProps> = ({ schedule, onSave, onCancel }) => {
  const [name, setName] = useState(schedule?.name || '');
  const [startTime, setStartTime] = useState(schedule?.startTime || '08:00');
  const [endTime, setEndTime] = useState(schedule?.endTime || '18:00');
  const [intervalMinutes, setIntervalMinutes] = useState(
    schedule?.intervalMinutes || 20
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: schedule?.id || `schedule-${Date.now()}`,
      name: name || 'Unnamed Schedule',
      startTime,
      endTime,
      intervalMinutes,
      enabled: schedule?.enabled ?? true,
    });
  };

  return (
    <form className="schedule-form" onSubmit={handleSubmit}>
      <div className="schedule-form-shell">
        <button type="button" className="form-back-link" onClick={onCancel}>
          ← Back to schedules
        </button>

        <div className="form-page-intro">
          <h1>{schedule ? 'Edit schedule' : 'Add schedule'}</h1>
          <p>
            {schedule
              ? 'Update timing or interval for this reminder window.'
              : 'Create a reminder window for a specific part of your day.'}
          </p>
        </div>

        <div className="schedule-form-card">
          <div className="form-group">
            <label htmlFor="schedule-name">Name</label>
            <input
              id="schedule-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Work Hours"
            />
          </div>

          <div className="form-grid-two">
            <div className="form-group">
              <label htmlFor="start-time">Start time</label>
              <input
                id="start-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="end-time">End time</label>
              <input
                id="end-time"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="interval">Interval (minutes)</label>
            <input
              id="interval"
              type="number"
              min={1}
              max={120}
              value={intervalMinutes}
              onChange={(e) => setIntervalMinutes(parseInt(e.target.value, 10) || 20)}
            />
          </div>

          <div className="form-actions">
            <button type="submit" className="btn-primary">
              {schedule ? 'Save changes' : 'Save schedule'}
            </button>
            <button type="button" className="btn-secondary" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </form>
  );
};

export default ScheduleForm;
