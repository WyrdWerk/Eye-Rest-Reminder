import React from 'react';
import { Schedule } from '../../core/types';
import './ScheduleList.css';

interface ScheduleListProps {
  schedules: Schedule[];
  onEdit: (schedule: Schedule) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string) => void;
  onAdd: () => void;
}

const ScheduleList: React.FC<ScheduleListProps> = ({
  schedules,
  onEdit,
  onDelete,
  onToggle,
  onAdd,
}) => {
  if (schedules.length === 0) {
    return (
      <div className="schedule-screen schedule-screen-empty">
        <div className="page-intro">
          <span className="page-eyebrow">UTILITY</span>
          <h1 className="page-title">Schedules</h1>
          <p className="page-description">
            Set work windows and reminder intervals.
          </p>
        </div>

        <div className="schedule-empty-card">
          <h3>No schedules yet</h3>
          <p>
            Create one schedule to start getting reminder prompts during work
            hours.
          </p>
          <button className="btn-primary" onClick={onAdd}>
            Create first schedule
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="schedule-screen">
      <div className="page-header-row">
        <div className="page-intro">
          <span className="page-eyebrow">UTILITY</span>
          <h1 className="page-title">Schedules</h1>
          <p className="page-description">
            Set work windows and reminder intervals.
          </p>
        </div>
        <button className="btn-primary page-header-action" onClick={onAdd}>
          Add schedule
        </button>
      </div>

      <div className="schedule-list">
        {schedules.map((schedule) => (
          <div
            key={schedule.id}
            className={`schedule-item ${schedule.enabled ? 'enabled' : 'disabled'}`}
          >
            <div className="schedule-card-main">
              <div className="schedule-info">
                <span className="schedule-name">{schedule.name}</span>
                <div className="schedule-meta-row">
                  <span className="schedule-time">
                    {schedule.startTime}–{schedule.endTime}
                  </span>
                  <span className="schedule-meta-separator">•</span>
                  <span className="schedule-interval">
                    Every {schedule.intervalMinutes} min
                  </span>
                </div>
              </div>

              <div className="schedule-actions">
                <label className="toggle-switch" aria-label={schedule.enabled ? 'Turn off' : 'Turn on'}>
                  <input
                    type="checkbox"
                    checked={schedule.enabled}
                    onChange={() => onToggle(schedule.id)}
                  />
                  <span className="toggle-slider" />
                </label>
                <button className="schedule-action-link" onClick={() => onEdit(schedule)}>
                  Edit
                </button>
                <button
                  className="schedule-action-link schedule-action-danger"
                  onClick={() => onDelete(schedule.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="quick-tests">
        <div className="quick-tests-label">Quick tests</div>
        <div className="quick-tests-note">
          Use these to verify the reminder UI and audio without waiting for a
          schedule boundary.
        </div>
      </div>
    </div>
  );
};

export default ScheduleList;
