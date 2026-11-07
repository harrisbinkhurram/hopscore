import type { BoardPlayer } from './layout';

/** Test players for the debug board. Not a game rule: the real player count comes from task 03. */
export const DEBUG_COLOURS = ['#e85d75', '#4a90d9', '#f2b33d', '#8e6bd1', '#3fb07f', '#f2f2f2'];
const DEBUG_NAMES = ['Ada', 'Ben', 'Cleo', 'Dev', 'Eli', 'Fatima Zahra'];
const DEBUG_SCORES = [3, 8, 8, 14, 14, 22];

export interface DebugSetup {
  trackLength: number;
  players: BoardPlayer[];
}

function int(value: string | null, fallback: number, min: number, max: number): number {
  const n = value === null ? Number.NaN : Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/**
 * Reads the debug board's URL params: `players` (1 to 6, capped by the test colours),
 * `length` (5 to 100, default 30) and `scores` (comma separated).
 */
export function parseDebugParams(search: string): DebugSetup {
  const q = new URLSearchParams(search);
  const scores = (q.get('scores') ?? '')
    .split(',')
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n));
  const count = int(q.get('players'), scores.length || 4, 1, DEBUG_COLOURS.length);
  const trackLength = int(q.get('length'), 30, 5, 100);
  const players = Array.from({ length: count }, (_, i) => ({
    id: `debug-${i}`,
    name: DEBUG_NAMES[i],
    color: DEBUG_COLOURS[i],
    score: scores[i] ?? DEBUG_SCORES[i],
  }));
  return { trackLength, players };
}

/** Random scores for the "Random" button, from a supplied random source. */
export function randomScores(count: number, trackLength: number, random: () => number): number[] {
  return Array.from({ length: count }, () => Math.floor(random() * (trackLength + 3)));
}
