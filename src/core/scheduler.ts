import { ReminderSchedule, ReminderEvent, SchedulerState, ValidationResult } from './types';

export type ReminderCheckResult =
  | { type: 'fire'; scheduleId: string }
  | { type: 'wait'; scheduleId: string; ms: number };

function timeStringToMinutes(timeString: string): number {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
}

function getWaitForSchedule(schedule: ReminderSchedule, fromTime: Date): number | null {
  if (!schedule.enabled) {
    return null;
  }

  const nowMinutes = fromTime.getHours() * 60 + fromTime.getMinutes();
  const startMinutes = timeStringToMinutes(schedule.startTime);
  const endMinutes = timeStringToMinutes(schedule.endTime);

  if (nowMinutes < startMinutes) {
    return startMinutes * 60_000 - (nowMinutes * 60_000 + fromTime.getSeconds() * 1000 + fromTime.getMilliseconds());
  }

  if (nowMinutes >= endMinutes) {
    return null;
  }

  const elapsedMinutes = nowMinutes - startMinutes;
  const remainderMinutes = elapsedMinutes % schedule.intervalMinutes;
  const elapsedMsInMinute = fromTime.getSeconds() * 1000 + fromTime.getMilliseconds();

  // Treat the whole interval-boundary minute as due. The main-process scheduler
  // polls once per second and may not land exactly on second 0 / millisecond 0.
  // Per-schedule dedupe in main prevents repeat firing within the same minute.
  if (remainderMinutes === 0) {
    return 0;
  }

  const minutesUntilNextBoundary = remainderMinutes === 0
    ? schedule.intervalMinutes
    : schedule.intervalMinutes - remainderMinutes;
  const nextBoundaryMinutes = nowMinutes + minutesUntilNextBoundary;

  if (nextBoundaryMinutes >= endMinutes) {
    return null;
  }

  return minutesUntilNextBoundary * 60_000 - elapsedMsInMinute;
}

export function calculateNextReminder(
  schedules: ReminderSchedule[],
  fromTime: Date = new Date()
): ReminderCheckResult | null {
  let soonestWait: ReminderCheckResult | null = null;

  for (const schedule of schedules) {
    const waitMs = getWaitForSchedule(schedule, fromTime);
    if (waitMs === null) {
      continue;
    }

    if (waitMs === 0) {
      return { type: 'fire', scheduleId: schedule.id };
    }

    if (!soonestWait || waitMs < soonestWait.ms) {
      soonestWait = { type: 'wait', scheduleId: schedule.id, ms: waitMs };
    }
  }

  return soonestWait;
}

export class SchedulerCore {
  private state: SchedulerState = {
    schedules: [],
    nextReminder: null,
    activeReminder: null,
    isMuted: false,
    volume: 100,
  };

  validateSchedule(schedule: ReminderSchedule): ValidationResult {
    const errors: string[] = [];

    if (!schedule.id) {
      errors.push('Schedule ID is required');
    }

    if (!schedule.startTime || !/^(\d{2}):(\d{2})$/.test(schedule.startTime)) {
      errors.push('Start time must be in HH:mm format');
    }

    if (!schedule.endTime || !/^(\d{2}):(\d{2})$/.test(schedule.endTime)) {
      errors.push('End time must be in HH:mm format');
    }

    if (schedule.intervalMinutes <= 0) {
      errors.push('Interval must be positive');
    }

    if (schedule.intervalMinutes > 24 * 60) {
      errors.push('Interval cannot exceed 24 hours');
    }

    if (schedule.startTime && schedule.endTime) {
      const startMinutes = timeStringToMinutes(schedule.startTime);
      const endMinutes = timeStringToMinutes(schedule.endTime);

      if (endMinutes <= startMinutes) {
        errors.push('End time must be after start time');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private getTodayAt(minutesFromMidnight: number, fromTime: Date = new Date()): Date {
    const date = new Date(fromTime.getFullYear(), fromTime.getMonth(), fromTime.getDate());
    date.setMinutes(minutesFromMidnight);
    return date;
  }

  computeNextReminder(schedule: ReminderSchedule, fromTime: Date = new Date()): ReminderEvent | null {
    if (!schedule.enabled) {
      return null;
    }

    const now = new Date(fromTime);
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = timeStringToMinutes(schedule.startTime);
    const endMinutes = timeStringToMinutes(schedule.endTime);

    if (nowMinutes < startMinutes) {
      return {
        scheduleId: schedule.id,
        scheduledTime: this.getTodayAt(startMinutes, now),
      };
    }

    if (nowMinutes >= endMinutes) {
      return null;
    }

    const elapsedMinutes = nowMinutes - startMinutes;
    const intervalsElapsed = Math.floor(elapsedMinutes / schedule.intervalMinutes);
    const nextIntervalMinutes = startMinutes + (intervalsElapsed + 1) * schedule.intervalMinutes;

    if (nextIntervalMinutes >= endMinutes) {
      return null;
    }

    return {
      scheduleId: schedule.id,
      scheduledTime: this.getTodayAt(nextIntervalMinutes, now),
    };
  }

  computeAllNextReminders(fromTime: Date = new Date()): Map<string, ReminderEvent> {
    const reminders = new Map<string, ReminderEvent>();

    for (const schedule of this.state.schedules) {
      const reminder = this.computeNextReminder(schedule, fromTime);
      if (reminder) {
        reminders.set(schedule.id, reminder);
      }
    }

    return reminders;
  }

  getNextGlobalReminder(fromTime: Date = new Date()): ReminderEvent | null {
    const allReminders = this.computeAllNextReminders(fromTime);
    let earliest: ReminderEvent | null = null;

    for (const reminder of allReminders.values()) {
      if (!earliest || reminder.scheduledTime < earliest.scheduledTime) {
        earliest = reminder;
      }
    }

    return earliest;
  }

  addSchedule(schedule: ReminderSchedule): ValidationResult {
    const validation = this.validateSchedule(schedule);
    if (!validation.valid) {
      return validation;
    }

    const existingIndex = this.state.schedules.findIndex((s) => s.id === schedule.id);
    if (existingIndex >= 0) {
      this.state.schedules[existingIndex] = schedule;
    } else {
      this.state.schedules.push(schedule);
    }

    this.state.nextReminder = this.getNextGlobalReminder();
    return { valid: true, errors: [] };
  }

  removeSchedule(scheduleId: string): boolean {
    const index = this.state.schedules.findIndex((s) => s.id === scheduleId);
    if (index >= 0) {
      this.state.schedules.splice(index, 1);
      this.state.nextReminder = this.getNextGlobalReminder();
      return true;
    }
    return false;
  }

  getSchedule(scheduleId: string): ReminderSchedule | undefined {
    return this.state.schedules.find((s) => s.id === scheduleId);
  }

  getAllSchedules(): ReminderSchedule[] {
    return [...this.state.schedules];
  }

  setMuted(muted: boolean): void {
    this.state.isMuted = muted;
  }

  isMuted(): boolean {
    return this.state.isMuted;
  }

  setVolume(volume: number): void {
    this.state.volume = Math.max(0, Math.min(100, volume));
  }

  getVolume(): number {
    return this.state.volume;
  }

  getState(): SchedulerState {
    return { ...this.state };
  }

  setActiveReminder(reminder: ReminderEvent | null): void {
    this.state.activeReminder = reminder;
  }

  getActiveReminder(): ReminderEvent | null {
    return this.state.activeReminder;
  }

  shouldFireReminder(reminder: ReminderEvent, currentTime: Date = new Date()): boolean {
    const diff = Math.abs(reminder.scheduledTime.getTime() - currentTime.getTime());
    return diff < 1000;
  }

  handleWake(currentTime: Date = new Date()): void {
    this.state.nextReminder = this.getNextGlobalReminder(currentTime);
  }

  hydrateState(schedules: ReminderSchedule[], isMuted: boolean, volume: number): void {
    this.state.schedules = schedules;
    this.state.isMuted = isMuted;
    this.state.volume = volume;
    this.state.nextReminder = this.getNextGlobalReminder();
  }
}
