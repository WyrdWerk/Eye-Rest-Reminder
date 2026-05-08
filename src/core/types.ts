export interface Schedule {
  id: string;
  name: string;
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  intervalMinutes: number;
  enabled: boolean;
}

export type AudioMode = 'single' | 'repeat_for_duration';

export interface AppSettings {
  schedules: Schedule[];
  volume: number; // 0-100
  muted: boolean;
  reminderDurationSeconds: number; // default 20, range 5-300
  audioMode: AudioMode; // default 'single'
  showSystemNotification: boolean; // default true
}

export interface ReminderState {
  active: boolean;
  scheduleId: string | null;
  scheduleName: string;
  remainingSeconds: number;
  totalDurationSeconds: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  schedules: [],
  volume: 70,
  muted: false,
  reminderDurationSeconds: 20,
  audioMode: 'single',
  showSystemNotification: true,
};
