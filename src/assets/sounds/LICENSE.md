# Reminder audio — licensing

## Built-in tone (default)

The app plays a **short sine tone generated in the renderer** via the Web Audio API (`src/ui/reminderSound.ts`). It is not a sampled recording and has **no separate sample license**.

## Bundled WAV/MP3 (optional / future)

If you add files under `src/assets/sounds/` (e.g. a CC0 chime from Wikimedia Commons or Freesound), document each file here:

| File | Source | License | Retrieved |
|------|--------|---------|-----------|
| _(none bundled)_ | — | — | — |

Keep attribution and license text with any third-party audio you ship.
