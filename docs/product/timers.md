# Focus, Countdown, And Alarms

Current behavior from `lib/pomodoro.ts`, `lib/pomodoro-controller.ts`,
`lib/timer.ts`, `lib/timer-controller.ts`, `lib/alarm.ts`,
`lib/alarm-controller.ts`, `entrypoints/background.ts`.

None of these persist across devices. All phase timing uses `chrome.alarms`.

## Focus (pomodoro)

State: `idle | work | rest`, durations, `phaseEndsAt`, optional pause remainder.

Defaults: 25 / 5 minutes. Presets: `classic` (25/5), `deep` (50/10). Durations
clamp to 1–120 minutes. Applying new durations resets to idle; callers must
only do that while idle.

Cycle: `idle → work → rest → work → …`. Start / stop / pause / resume go
through background messages. Phase end: notification plus offscreen sound
(`work-start` / `rest-start`), then the next phase.

**Work phase enables site blocking** even outside the schedule. Rest does not.
The countdown timer does not.

Popup auto-opens the Focus tab when a session is live, unless a countdown is
running or just finished (timer wins).

## Countdown timer

Independent of pomodoro. Default 5 minutes, sound on, clamp 1 second–24 hours.
Legacy `durationMinutes` is migrated to `durationSeconds`.

Clicking the timer notification resets the timer (`onTimerNotificationClick`).

Does not change block state.

## Wall-clock alarms

Items: label, `HH:MM` local, `once` (with `YYYY-MM-DD`) or `weekly` (ISO days
Mon=1…Sun=7), `enabled`, `lastFiredKey` for dedupe across worker restarts.

The 1-minute scheduler also runs `checkAlarms`. Due alarms notify, play
`rest-start` five times (once per batch, not per alarm), set `lastFiredKey`,
disable one-time alarms (kept in the list), and add ids to
`local:ringingAlarms`.

Toolbar badge shows ringing count (color `#d92d20`). Popup shows a dismiss
banner. Notification click on `alarm-<id>` dismisses that id. Deleting a
ringing alarm must clear ringing state so the badge does not stick.

`local:ringingAlarms` is runtime-only and is not part of backup.
