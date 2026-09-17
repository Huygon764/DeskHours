# Backup

Current behavior from `lib/backup.ts`. Schema version **2**. App id
`deskhours`; imports still accept legacy `site-blocker`.

## Export

JSON file `deskhours-backup-YYYY-MM-DD.json` containing:

- blocklist, schedule, auth record, unblock minutes
- theme, locale
- pomodoro **preferences** (work/rest minutes only, not live phase)
- timer **preferences** (duration + sound; not live countdown)
- alarms (normalized list)

Not exported: `tempUnblocks`, `unblockTimestamps`, `unmaskedDomains`,
`ringingAlarms`, live pomodoro/timer phase, `optionsTab`.

## Import

Rejects invalid JSON/shape, unknown app id, newer schema, or masked entries
without an auth record.

`applyBackupData` replaces the exported fields, **clears** temp unblocks and
session unmask, and clears pomodoro/timer Chrome alarms so imported prefs start
idle. Masked entries stay unenforced until the user unlocks with the imported
password.
