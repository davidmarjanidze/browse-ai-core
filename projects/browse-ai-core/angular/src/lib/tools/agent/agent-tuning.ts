/**
 * Switches for the T-011 speed changes. Off by default: with Gemini Nano
 * (T-003, 2026-11-12) runs with them on did worse on forms, Google Calendar
 * and screenshot tasks. Turn one on at a time to test it.
 */
export const AGENT_TUNING = {
  /** Send only page changes after the first step. */
  pageDiffs: false,
  /** One short line per tool in the system prompt. */
  shortToolLines: false,
  /** Answer schema with one `anyOf` branch per tool. */
  strictSchema: false,
  /** Treat a page with no change for 150 ms after an action as settled. */
  quickSettle: false,
  /** Reuse the last page list while no DOM, scroll or input event happened. */
  reuseSnapshot: false
}
