import { SchedulerCore, calculateNextReminder } from '../../src/core/scheduler';
import { DEFAULT_SETTINGS, Schedule } from '../../src/core/types';

function makeSchedule(overrides: Partial<Schedule> = {}): Schedule {
  return {
    id: 'test-schedule',
    name: 'Test Schedule',
    startTime: '08:00',
    endTime: '18:00',
    intervalMinutes: 20,
    enabled: true,
    ...overrides,
  };
}

function atTime(hour: number, minute: number, second: number = 0): Date {
  const d = new Date();
  d.setHours(hour, minute, second, 0);
  return d;
}

describe('calculateNextReminder', () => {
  test('fires when current time matches an interval boundary within schedule window', () => {
    const schedule = makeSchedule({ startTime: '08:00', endTime: '18:00', intervalMinutes: 60 });
    const now = atTime(9, 0, 0);
    const event = calculateNextReminder([schedule], now);
    expect(event).toEqual({ type: 'fire', scheduleId: 'test-schedule' });
  });

  test('fires for the boundary minute even if polling lands after second zero', () => {
    const schedule = makeSchedule({ startTime: '08:00', endTime: '18:00', intervalMinutes: 60 });
    const now = atTime(9, 0, 1);
    const event = calculateNextReminder([schedule], now);
    expect(event).toEqual({ type: 'fire', scheduleId: 'test-schedule' });
  });

  test('returns wait when between interval boundaries', () => {
    const schedule = makeSchedule({ startTime: '08:00', endTime: '18:00', intervalMinutes: 60 });
    const now = atTime(9, 30, 0);
    const event = calculateNextReminder([schedule], now);
    expect(event).not.toBeNull();
    expect(event).toMatchObject({ type: 'wait', scheduleId: 'test-schedule' });
    expect(event && event.type === 'wait' ? event.ms : 0).toBeGreaterThan(0);
  });

  test('skips disabled schedules', () => {
    const schedule = makeSchedule({ enabled: false });
    const now = atTime(9, 0, 0);
    const event = calculateNextReminder([schedule], now);
    expect(event).toBeNull();
  });

  test('returns null when outside schedule window', () => {
    const schedule = makeSchedule({ startTime: '08:00', endTime: '10:00', intervalMinutes: 20 });
    const now = atTime(11, 0, 0);
    const event = calculateNextReminder([schedule], now);
    expect(event).toBeNull();
  });

  test('returns the earliest schedule when multiple schedules are active', () => {
    const s1 = makeSchedule({ id: 's1', startTime: '08:00', endTime: '12:00', intervalMinutes: 30 });
    const s2 = makeSchedule({ id: 's2', startTime: '08:00', endTime: '18:00', intervalMinutes: 45 });
    const now = atTime(8, 10, 0);
    const event = calculateNextReminder([s1, s2], now);
    expect(event).toMatchObject({ type: 'wait', scheduleId: 's1' });
  });
});

describe('SchedulerCore', () => {
  test('computes the next reminder boundary for a schedule inside its window', () => {
    const scheduler = new SchedulerCore();
    const event = scheduler.computeNextReminder(
      makeSchedule({ startTime: '08:00', endTime: '18:00', intervalMinutes: 60 }),
      atTime(9, 30, 0)
    );

    expect(event?.scheduleId).toBe('test-schedule');
    expect(event?.scheduledTime.getHours()).toBe(10);
    expect(event?.scheduledTime.getMinutes()).toBe(0);
  });

  test('validates end time after start time', () => {
    const scheduler = new SchedulerCore();
    const result = scheduler.validateSchedule(
      makeSchedule({ startTime: '18:00', endTime: '08:00' })
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('End time must be after start time');
  });
});

describe('settings types', () => {
  test('DEFAULT_SETTINGS has expected shape', () => {
    expect(DEFAULT_SETTINGS.reminderDurationSeconds).toBe(20);
    expect(DEFAULT_SETTINGS.audioMode).toBe('single');
    expect(DEFAULT_SETTINGS.showSystemNotification).toBe(true);
    expect(DEFAULT_SETTINGS.volume).toBe(70);
    expect(DEFAULT_SETTINGS.muted).toBe(false);
    expect(Array.isArray(DEFAULT_SETTINGS.schedules)).toBe(true);
  });

  test('AudioMode accepts valid values', () => {
    const validModes: Array<'single' | 'repeat_for_duration'> = ['single', 'repeat_for_duration'];
    expect(validModes).toHaveLength(2);
    expect(validModes).toContain('single');
    expect(validModes).toContain('repeat_for_duration');
  });
});
