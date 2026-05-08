# Changelog

All notable changes to this project will be documented in this file.

## [1.0.1] - 2026-05-08

### Refactor & Architecture Improvements

- **Modular Architecture**: Extracted `AudioController`, `ReminderManager`, and IPC handlers from monolithic `main.ts`
- **Centralized Constants**: All magic numbers moved to `src/constants.ts`
- **Type Safety**: Eliminated all `any` types; added proper TypeScript coverage
- **Test Coverage**: Added 5 new test suites covering audio, reminders, IPC, preload, and storage
- **UI Improvements**: Inline form validation, two-step delete confirmation, loading states, React.memo optimizations
- **CSS Modernization**: Added CSS custom properties, focus-visible styles, design system tokens
- **Dead Code Removal**: Removed unused `SchedulerCore` class and duplicate `reminderSound.ts`

## [1.0.0] - 2026-05-08

### Initial Release

- **Multiple Reminder Schedules**: Configure different schedules for different times of day
- **Customizable Intervals**: Set how often you want to be reminded (default: every 20 minutes)
- **Configurable Rest Duration**: Set how long each reminder lasts (5–300 seconds, default 20 seconds)
- **Audio Modes**: Choose between a single notification sound or repeating audio for the full rest duration
- **System Notifications**: Optional OS-level notifications (Windows toast / Linux notifications)
- **Volume & Mute Controls**: Adjust reminder volume or mute entirely
- **Test Controls**: Test reminders and sounds immediately without waiting for a schedule
- **Background Operation**: Reminders work even when the app is minimized to system tray
- **Overlap Policy**: If multiple reminders would fire at once, only one is shown
