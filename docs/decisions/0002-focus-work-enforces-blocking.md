# 0002 Focus Work Phase Enforces Blocking

Date: 2026-09-17

## Status

Accepted

## Context

The 2026-06-07 spec kept the blocker and pomodoro decoupled ("Pomodoro never
changes block state"). Shipping code and README do the opposite for focus
**work**: sites are blocked during work even outside the schedule.

## Decision

`isSiteBlockingEnabled = schedule window OR pomodoro phase === work`.
Rest, idle, and the countdown timer do not enable blocking.

## Alternatives Considered

1. Keep the original spec: timers never affect DNR.
2. Also block during rest.

## Consequences

Positive:

- Focus sessions can lock sites on demand without editing the weekly schedule.

Tradeoffs:

- Agents reading the old spec will get this wrong; that spec is not authority.

## Follow-Up

- None. Change only with an explicit product decision and test updates in
  `lib/schedule.ts` / `lib/pomodoro.ts`.
