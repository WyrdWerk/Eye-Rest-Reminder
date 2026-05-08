import { Schedule } from './types';

export type ReminderCheckResult =
  | { type: 'fire'; scheduleId: string }
  | { type: 'wait'; scheduleId: string; ms: number };

function timeStringToMinutes(timeString: string): number {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
}

function getWaitForSchedule(schedule: Schedule, fromTime: Date): number | null {
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

  const minutesUntilNextBoundary = schedule.intervalMinutes - remainderMinutes;
  const nextBoundaryMinutes = nowMinutes + minutesUntilNextBoundary;

  if (nextBoundaryMinutes >= endMinutes) {
    return null;
  }

  return minutesUntilNextBoundary * 60_000 - elapsedMsInMinute;
}

export function calculateNextReminder(
  schedules: Schedule[],
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
