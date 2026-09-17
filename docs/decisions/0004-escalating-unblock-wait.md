# 0004 Escalating Daily Unblock Wait

Date: 2026-09-17

## Status

Accepted

## Context

The original spec used a fixed 30s wait before password unblock. Repeat unblocks
in one day need more friction without making the first unblock harsher.

## Decision

Wait = `min(300, 30 * 2^n)` seconds where `n` is successful grants today
(local midnight reset): 30, 60, 120, 240, then cap 300. Counted only after a
grant succeeds. Blocked-page load freezes the wait so refresh cannot shorten
it.

## Alternatives Considered

1. Fixed 30s forever.
2. Lock out after N unblocks.

## Consequences

Positive:

- First unblock stays 30s; repeats get slower.

Tradeoffs:

- Wait is per calendar day, not per domain.

## Follow-Up

- None.
