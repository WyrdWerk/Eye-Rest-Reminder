import React, { useState } from 'react';
import { Schedule } from '../../core/types';
import './ScheduleList.css';

interface ScheduleListProps {
  schedules: Schedule[];
  onEdit: (schedule: Schedule) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string) => void;
  onAdd: () => void;
}

const ScheduleList: React.FC<ScheduleListProps> = React.memo(({
  schedules,
  onEdit,
  onDelete,
  onToggle,
  onAdd,
}) => {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleDeleteClick = (id: string) => {
    setConfirmDeleteId(id);
  };

  const handleDeleteConfirm = (id: string) => {
    onDelete(id);
    setConfirmDeleteId(null);
  };

  const handleDeleteCancel = () => {
    setConfirmDeleteId(null);
  };

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
                <label
                  className="toggle-switch"
                  aria-label={`${schedule.enabled ? 'Disable' : 'Enable'} ${schedule.name}`}
                >
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
                {confirmDeleteId === schedule.id ? (
                  <span className="delete-confirm">
                    <button
                      className="schedule-action-link schedule-action-danger"
                      onClick={() => handleDeleteConfirm(schedule.id)}
                      aria-label={`Confirm delete ${schedule.name}`}
                    >
                      Confirm
                    </button>
                    <button
                      className="schedule-action-link"
                      onClick={handleDeleteCancel}
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    className="schedule-action-link schedule-action-danger"
                    onClick={() => handleDeleteClick(schedule.id)}
                    aria-label={`Delete ${schedule.name}`}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

ScheduleList.displayName = 'ScheduleList';

export default ScheduleList;
