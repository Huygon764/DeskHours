/** Escalating wait before a password-granted unblock is allowed.
 *
 * The wait grows with how many unblocks were already granted *today* (local time),
 * doubling from a 30s base and capped at 5 minutes. The count resets at local
 * midnight, so a fresh day always starts back at the base wait. */

/** Base wait for the first unblock of the day, in seconds. */
export const BASE_WAIT_SECONDS = 30;

/** Hard ceiling for the escalating wait, in seconds (5 minutes). */
export const MAX_WAIT_SECONDS = 300;

/** True when two epoch-ms timestamps fall on the same local calendar day. */
function sameLocalDay(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

/** Number of unblock timestamps that fall on the same local day as `now`. */
export function todayUnblockCount(timestamps: number[], now: number): number {
  return timestamps.filter((t) => sameLocalDay(t, now)).length;
}

/** Drop timestamps from previous days; keeps the stored list from growing forever. */
export function pruneToToday(timestamps: number[], now: number): number[] {
  return timestamps.filter((t) => sameLocalDay(t, now));
}

/** Wait in seconds given how many unblocks were already granted today.
 *  count 0 -> 30s, 1 -> 60s, 2 -> 120s, 3 -> 240s, 4+ -> 300s (capped). */
export function waitSeconds(priorCount: number): number {
  const n = Math.max(0, Math.floor(priorCount));
  return Math.min(MAX_WAIT_SECONDS, BASE_WAIT_SECONDS * 2 ** n);
}
