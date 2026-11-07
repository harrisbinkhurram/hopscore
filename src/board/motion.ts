import type { Beat } from './choreography';

/**
 * Timing and motion curves for a round, as plain numbers, so they can be tested.
 * Every effect and camera move is a timed event here; board.ts only carries them out.
 */

/** Time per stone for a normal hop, ms. */
export const HOP_MS = 300;
/** Fastest a hop gets when a round has many stones to cover, ms. */
export const MIN_HOP_MS = 160;
/** Time per stone for a reduced-motion glide, ms. */
export const GLIDE_MS = 120;
/** Most time all the hops of a round take together, ms. Past it, each hop gets quicker. */
export const MOVE_BUDGET_MS = 8000;
/** Gap between two bunnies' turns, ms. */
export const PAUSE_MS = 250;
/** Spin and petals after a big gain, ms. */
export const BIG_MS = 900;
export const DROOP_MS = 1000;
export const FINALE_MS = 2400;

export interface TimedBeat {
  beat: Beat;
  start: number;
  duration: number;
  /** Hops only: time per stone. */
  stepMs: number;
  /** True when the beat is a plain glide (reduced motion). */
  glide: boolean;
}

export type TimedEvent =
  | { at: number; kind: 'dust'; id: string }
  | { at: number; kind: 'petals'; id: string }
  /** The camera follows this bunny. */
  | { at: number; kind: 'follow'; id: string }
  /** The camera goes back to the whole track. */
  | { at: number; kind: 'settle' };

export interface Timeline {
  beats: TimedBeat[];
  /** In time order. */
  events: TimedEvent[];
  duration: number;
}

/**
 * Lays the beats out one after another. With `reduced`, hops become glides and there are no
 * effects, celebrations or camera moves at all.
 */
export function timeline(beats: readonly Beat[], options: { reduced: boolean }): Timeline {
  const { reduced } = options;
  const stoneCount = beats.reduce((n, b) => n + (b.kind === 'hop' ? b.stones.length : 0), 0);
  const fair = stoneCount > 0 ? MOVE_BUDGET_MS / stoneCount : HOP_MS;
  const stepMs = reduced ? Math.min(GLIDE_MS, fair) : Math.max(MIN_HOP_MS, Math.min(HOP_MS, fair));

  const out: TimedBeat[] = [];
  const events: TimedEvent[] = [];
  let t = 0;
  const add = (beat: Beat, duration: number, glide = false) => {
    if (out.length > 0) t += PAUSE_MS;
    out.push({ beat, start: t, duration, stepMs: beat.kind === 'hop' ? stepMs : 0, glide });
    const start = t;
    t += duration;
    return start;
  };

  for (const beat of beats) {
    if (beat.kind === 'hop') {
      const moving = beat.stones.length * stepMs;
      const extra = beat.big && !reduced ? BIG_MS : 0;
      const start = add(beat, moving + extra, reduced);
      if (reduced) continue;
      events.push({ at: start, kind: 'follow', id: beat.id });
      beat.stones.forEach((_, k) => events.push({ at: start + (k + 1) * stepMs, kind: 'dust', id: beat.id }));
      if (beat.big) events.push({ at: start + moving, kind: 'petals', id: beat.id });
    } else if (reduced) {
      continue;
    } else if (beat.kind === 'cheer') {
      const start = add(beat, BIG_MS);
      events.push({ at: start, kind: 'follow', id: beat.id }, { at: start, kind: 'petals', id: beat.id });
    } else if (beat.kind === 'droop') {
      const start = add(beat, DROOP_MS);
      events.push({ at: start, kind: 'follow', id: beat.id });
    } else {
      // Close enough on the (first) winner to see the dance; the whole track comes after.
      const start = add(beat, FINALE_MS);
      events.push({ at: start, kind: 'follow', id: beat.winners[0] });
    }
  }
  if (!reduced && out.length > 0) events.push({ at: t, kind: 'settle' });
  events.sort((a, b) => a.at - b.at);
  return { beats: out, events, duration: t };
}

/** Height of a hop at `t` (0..1), from 0 at take-off up to 1 and back to 0 on landing. */
export function hopHeight(t: number): number {
  const u = clamp01(t);
  return 4 * u * (1 - u);
}

/** A bump from 0 up to 1 and back over `a..b`, 0 outside. */
function bump(t: number, a: number, b: number): number {
  if (t <= a || t >= b) return 0;
  return Math.sin((Math.PI * (t - a)) / (b - a));
}

/**
 * Squash and stretch over a hop at `t` (0..1): squashed at take-off and landing, stretched in
 * the air. Width shrinks as height grows, so the bunny keeps its volume.
 */
export function squash(t: number): { x: number; y: number; z: number } {
  const u = clamp01(t);
  const y = 1 + 0.18 * Math.sin(Math.PI * u) - 0.22 * bump(u, 0, 0.16) - 0.26 * bump(u, 0.84, 1);
  const side = 1 / Math.sqrt(y);
  return { x: side, y, z: side };
}

/** Smooth start and end, 0..1. */
export function easeInOut(t: number): number {
  const u = clamp01(t);
  return u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
}

/** How far the ears droop at `t` (0..1) of a droop: down quickly, hold, back up. */
export function droopAmount(t: number): number {
  const u = clamp01(t);
  return easeInOut(Math.min(1, u / 0.25, (1 - u) / 0.25));
}

function clamp01(t: number): number {
  return Math.min(1, Math.max(0, t));
}
