# Eye Rest Reminder

A desktop application that reminds you to take regular breaks from screen time to prevent eye strain.

## Download

Get the latest release for your platform from the [Releases](https://github.com/WyrdWerk/Eye-Rest-Reminder/releases) page:

- **Windows**: Download the `.exe` installer
- **Linux**: Download the `.AppImage`

## Current Status

This is **v1.0.0** — the initial stable release. All features described below are available from this baseline version.

For a history of changes and new features in future releases, see the [CHANGELOG.md](./CHANGELOG.md).

## Features

- **Multiple Reminder Schedules**: Configure different schedules for different times of day
- **Customizable Intervals**: Set how often you want to be reminded (default: every 20 minutes)
- **Configurable Rest Duration**: Set how long each reminder lasts (5–300 seconds, default 20 seconds)
- **Audio Modes**: Choose between a single notification sound or repeating audio for the full rest duration
- **System Notifications**: Optional OS-level notifications (Windows toast / Linux notifications)
- **Volume & Mute Controls**: Adjust reminder volume or mute entirely
- **Test Controls**: Test reminders and sounds immediately without waiting for a schedule
- **Background Operation**: Reminders work even when the app is minimized to system tray
- **Overlap Policy**: If multiple reminders would fire at once, only one is shown

## Usage

1. **Create a Schedule**: Click "Add Schedule" and configure your work hours and reminder interval
2. **Configure Rest Duration**: Go to Settings and set how long each reminder should last
3. **Choose Audio Mode**: In Settings, select "Single" for one beep or "Repeat for duration" for continuous audio
4. **Test Before Use**: Use "Test Reminder" and "Test Sound" buttons to verify your setup
5. **Enable Schedules**: Toggle schedules on/off as needed
6. **Minimize to Tray**: The app continues running in the system tray

### Default Behavior

- Start time: 8:00 AM
- End time: 6:00 PM
- Interval: 20 minutes
- Rest duration: 20 seconds
- Audio mode: single notification sound

When a reminder fires:

1. An in-app overlay appears with a countdown for the configured duration
2. A system notification may appear (if enabled and supported by the OS/runtime)
3. Audio plays according to the selected mode
4. Click "I have rested" to dismiss early (stops audio immediately)

## Development

### Prerequisites

- Node.js 20+
- npm

### Setup

```bash
# Clone the repository
git clone https://github.com/WyrdWerk/Eye-Rest-Reminder.git
cd Eye-Rest-Reminder

# Install dependencies
npm install

# Run tests
npm test

# Start development mode
npm run dev

# Build for production
npm run build

# Create distribution packages
npm run dist
```

## Architecture

```
src/
├── core/           # Pure TypeScript scheduler logic and types
│   ├── scheduler.ts
│   └── types.ts
├── storage/        # electron-store persistence layer
│   └── store.ts
├── ui/             # React frontend
│   ├── components/
│   │   ├── ActiveReminders.tsx    # Reminder overlay
│   │   ├── AudioSettings.tsx      # Duration, audio, notification settings
│   │   ├── ScheduleForm.tsx       # Schedule editor
│   │   └── ScheduleList.tsx       # Schedule list with toggles
│   ├── App.tsx                    # Main UI shell with navigation
│   ├── index.tsx                  # Entry point + audio playback
│   └── index.html
├── main.ts          # Electron main process
├── preload.ts       # Context bridge (renderer ↔ main)
└── global.d.ts      # TypeScript declarations

tests/
└── core/            # Unit tests for scheduler and settings

.github/
└── workflows/
    └── build.yml    # CI: tests + build for Windows and Linux
```

### Key Design Decisions

- **Main process owns reminder lifecycle**: Scheduling, countdown, and audio control all run in the main process. The renderer receives events via IPC.
- **Renderer handles audio output**: Uses Web Audio API for beep synthesis. The main process sends `play-sound`/`stop-sound` events.
- **Settings are persisted via electron-store**: All settings (schedules, volume, duration, audio mode) are stored with backward-compatible defaults.

## Tech Stack

- **Runtime**: Electron
- **Frontend**: React + TypeScript
- **Build**: Webpack + TypeScript
- **Testing**: Jest
- **CI/CD**: GitHub Actions
- **Persistence**: electron-store

## Automated Builds

This project uses GitHub Actions to automatically build installers for Windows and Linux:

- Every push to `master` branch runs tests
- Creating a tag (for example `v1.0.0`) triggers full builds and creates a GitHub Release
- Download artifacts from the [Releases page](https://github.com/WyrdWerk/Eye-Rest-Reminder/releases)

## License

MIT
