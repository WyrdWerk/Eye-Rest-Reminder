import React, { useState } from 'react';
import { Schedule } from '../../core/types';
import { MIN_INTERVAL_MINUTES, MAX_INTERVAL_MINUTES, DEFAULT_INTERVAL_MINUTES, DEFAULT_START_TIME, DEFAULT_END_TIME } from '../../constants';
import './ScheduleForm.css';

interface ScheduleFormProps {
  schedule?: Schedule;
  onSave: (schedule: Schedule) => void;
  onCancel: () => void;
}

interface FormErrors {
  name?: string;
  time?: string;
  interval?: string;
}

const ScheduleForm: React.FC<ScheduleFormProps> = React.memo(({ schedule, onSave, onCancel }) => {
  const [name, setName] = useState(schedule?.name ?? '');
  const [startTime, setStartTime] = useState(schedule?.startTime ?? DEFAULT_START_TIME);
  const [endTime, setEndTime] = useState(schedule?.endTime ?? DEFAULT_END_TIME);
  const [intervalMinutes, setIntervalMinutes] = useState(
    schedule?.intervalMinutes ?? DEFAULT_INTERVAL_MINUTES
  );

  const validate = (): FormErrors => {
    const errors: FormErrors = {};
    if (!name.trim()) {
      errors.name = 'Name is required';
    }
    if (startTime >= endTime) {
      errors.time = 'End time must be after start time';
    }
    if (intervalMinutes < MIN_INTERVAL_MINUTES || intervalMinutes > MAX_INTERVAL_MINUTES) {
      errors.interval = `Interval must be between ${MIN_INTERVAL_MINUTES} and ${MAX_INTERVAL_MINUTES} minutes`;
    }
    return errors;
  };

  const errors = validate();
  const isValid = Object.keys(errors).length === 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    onSave({
      id: schedule?.id ?? `schedule-${Date.now()}`,
      name: name.trim(),
      startTime,
      endTime,
      intervalMinutes,
      enabled: schedule?.enabled ?? true,
    });
  };

  return (
    <form className="schedule-form" onSubmit={handleSubmit} noValidate>
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
              aria-required="true"
              aria-invalid={!!errors.name}
            />
            {errors.name && <span className="form-error">{errors.name}</span>}
          </div>

          <div className="form-grid-two">
            <div className="form-group">
              <label htmlFor="start-time">Start time</label>
              <input
                id="start-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                aria-invalid={!!errors.time}
              />
            </div>
            <div className="form-group">
              <label htmlFor="end-time">End time</label>
              <input
                id="end-time"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                aria-invalid={!!errors.time}
              />
            </div>
          </div>
          {errors.time && <span className="form-error">{errors.time}</span>}

          <div className="form-group">
            <label htmlFor="interval">Interval (minutes)</label>
            <input
              id="interval"
              type="number"
              min={MIN_INTERVAL_MINUTES}
              max={MAX_INTERVAL_MINUTES}
              value={intervalMinutes}
              onChange={(e) => setIntervalMinutes(parseInt(e.target.value, 10) || DEFAULT_INTERVAL_MINUTES)}
              aria-invalid={!!errors.interval}
            />
            {errors.interval && <span className="form-error">{errors.interval}</span>}
          </div>

          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={!isValid}>
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
});

ScheduleForm.displayName = 'ScheduleForm';

export default ScheduleForm;
