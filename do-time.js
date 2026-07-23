/* ============================================================================
 *  do-time.js — Dō's time layer.
 *  ----------------------------------------------------------------------------
 *  ONE place that decides what "a day" means. Everything date-related in the app
 *  should go through this file.
 *
 *  WHY THIS EXISTS
 *  The app used to derive dates with `d.toISOString().slice(0,10)`, which reads
 *  the date in UTC. In Finland (UTC+2 winter / +3 summer) UTC lags local time,
 *  so:
 *    - `new Date(2026, 6, 5)` (local midnight, 5 July) became "2026-07-04" —
 *      the whole calendar grid, every scheduled slot, and every recurring date
 *      was shifted one day earlier, all day, every day.
 *    - `today()` returned YESTERDAY between 00:00 and 03:00 local.
 *  Every function here reads the date in the user's OWN timezone instead.
 *
 *  THE MODEL
 *    dayKey  "YYYY-MM-DD"  a calendar day in local time (the app's day bucket)
 *    hhmm    "HH:MM"       a wall-clock time of day, 24h
 *  A dayKey + an hhmm resolve to a real instant via toDate(). Keeping "which
 *  day" separate from "which instant" is what makes imported calendar events
 *  (which arrive as instants, in their own timezones) land on the right day.
 *
 *  DST SAFETY
 *  Never add days by adding 86_400_000 ms — on DST-change days that is 23 or 25
 *  hours and silently drifts. addDays() uses calendar arithmetic; diffDays()
 *  compares calendar components. Both are exact across DST.
 * ==========================================================================*/
(function (global) {
  'use strict';

  const pad = (n) => String(n).padStart(2, '0');
  const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
  const TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;

  const DoTime = {

    /* ---- days ---------------------------------------------------------- */

    // Date -> "YYYY-MM-DD" in LOCAL time. (Replaces the old dateStr().)
    dayKey(d) {
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    },

    // Today's local date as "YYYY-MM-DD".
    today() {
      return DoTime.dayKey(new Date());
    },

    // "YYYY-MM-DD" -> Date at LOCAL midnight.
    // Note: new Date("2026-07-05") would parse as UTC midnight — don't use it.
    parseDay(key) {
      const [y, m, d] = String(key).split('-').map(Number);
      return new Date(y, m - 1, d);
    },

    isDayKey(s) {
      return typeof s === 'string' && DAY_RE.test(s);
    },

    // Shift a dayKey by n calendar days (n may be negative). DST-safe.
    addDays(key, n) {
      const d = DoTime.parseDay(key);
      d.setDate(d.getDate() + n);
      return DoTime.dayKey(d);
    },

    // Whole calendar days from a to b (b - a). Exact across DST.
    diffDays(a, b) {
      const [ay, am, ad] = String(a).split('-').map(Number);
      const [by, bm, bd] = String(b).split('-').map(Number);
      return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
    },

    // Days from today to key: negative = past, 0 = today, positive = future.
    daysFromToday(key) {
      return DoTime.diffDays(DoTime.today(), key);
    },

    // 0 = Monday … 6 = Sunday (the app's WEEKDAYS array order).
    weekdayMon0(key) {
      return (DoTime.parseDay(key).getDay() + 6) % 7;
    },

    // dayKey of the Monday of that key's week.
    startOfWeek(key) {
      return DoTime.addDays(key, -DoTime.weekdayMon0(key));
    },

    isToday(key) {
      return key === DoTime.today();
    },

    isPast(key) {
      return DoTime.diffDays(DoTime.today(), key) < 0;
    },

    /* ---- times of day -------------------------------------------------- */

    isTime(s) {
      return typeof s === 'string' && TIME_RE.test(s);
    },

    // "07:30" -> 450
    toMinutes(hhmm) {
      if (!DoTime.isTime(hhmm)) return null;
      const [h, m] = hhmm.split(':').map(Number);
      return h * 60 + m;
    },

    // 450 -> "07:30" (wraps within a single day)
    toHHMM(mins) {
      const m = ((Math.round(mins) % 1440) + 1440) % 1440;
      return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
    },

    nowHHMM() {
      const n = new Date();
      return `${pad(n.getHours())}:${pad(n.getMinutes())}`;
    },

    /* ---- instants (bridge to real calendar events) --------------------- */

    // dayKey + optional hhmm -> real Date. This is what you compare against
    // timestamps coming from Google Calendar, Fitbit, etc.
    toDate(key, hhmm) {
      const d = DoTime.parseDay(key);
      if (DoTime.isTime(hhmm)) {
        const [h, m] = hhmm.split(':').map(Number);
        d.setHours(h, m, 0, 0);
      }
      return d;
    },

    // Real Date (or ISO string) -> { day, time } in LOCAL time.
    // Use this when importing external events so they land on the right day.
    fromDate(input) {
      const d = input instanceof Date ? input : new Date(input);
      return { day: DoTime.dayKey(d), time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
    },

    /* ---- formatting ---------------------------------------------------- */

    // "2026-07-05" -> "Sun 5 Jul"
    fmtDay(key, opts) {
      if (!key) return '';
      return DoTime.parseDay(key).toLocaleDateString('en-GB',
        opts || { weekday: 'short', day: 'numeric', month: 'short' });
    },

    // "14:05" -> "2:05 PM"
    fmtTime(hhmm) {
      if (!hhmm) return '';
      const [h, m] = String(hhmm).split(':').map(Number);
      return `${h % 12 || 12}:${pad(m)} ${h >= 12 ? 'PM' : 'AM'}`;
    },
  };

  global.DoTime = DoTime;

  // CommonJS export so the test suite can require() this file in Node.
  if (typeof module !== 'undefined' && module.exports) module.exports = DoTime;

})(typeof globalThis !== 'undefined' ? globalThis : this);
