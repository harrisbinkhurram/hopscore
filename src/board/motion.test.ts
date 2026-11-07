import { describe, expect, it } from 'vitest';
import type { Beat } from './choreography';
import {
  BIG_MS,
  droopAmount,
  GLIDE_MS,
  HOP_MS,
  hopHeight,
  MIN_HOP_MS,
  MOVE_BUDGET_MS,
  squash,
  timeline,
} from './motion';

const hop = (id: string, stones: number[], big = false): Beat => ({ kind: 'hop', id, stones, big });

const ROUND: Beat[] = [
  { kind: 'droop', id: 'a' },
  hop('b', [1, 2]),
  hop('c', [1, 2, 3, 4, 5], true),
  { kind: 'cheer', id: 'd' },
  { kind: 'finale', winners: ['c'], others: ['a', 'b', 'd'] },
];

describe('timeline', () => {
  it('plays the beats one after another, in order', () => {
    const tl = timeline(ROUND, { reduced: false });
    expect(tl.beats.map((b) => b.beat)).toEqual(ROUND);
    for (let i = 1; i < tl.beats.length; i += 1) {
      const prev = tl.beats[i - 1];
      expect(tl.beats[i].start).toBeGreaterThan(prev.start + prev.duration);
    }
    const last = tl.beats.at(-1)!;
    expect(tl.duration).toBe(last.start + last.duration);
  });

  it('puts a dust puff on every landing and petals after a big hop', () => {
    const tl = timeline([hop('c', [1, 2, 3, 4, 5], true)], { reduced: false });
    const dust = tl.events.filter((e) => e.kind === 'dust').map((e) => e.at);
    expect(dust).toEqual([1, 2, 3, 4, 5].map((k) => k * HOP_MS));
    expect(tl.events).toContainEqual({ at: 5 * HOP_MS, kind: 'petals', id: 'c' });
    expect(tl.beats[0].duration).toBe(5 * HOP_MS + BIG_MS);
  });

  it('follows each moving bunny and settles on the whole track at the end', () => {
    const tl = timeline([hop('a', [1]), hop('b', [1, 2])], { reduced: false });
    expect(tl.events.filter((e) => e.kind === 'follow').map((e) => 'id' in e && e.id)).toEqual(['a', 'b']);
    expect(tl.events.at(-1)).toEqual({ at: tl.duration, kind: 'settle' });
  });

  it('follows the winner through the finale, then settles on the whole track', () => {
    const tl = timeline(ROUND, { reduced: false });
    const finale = tl.beats.at(-1)!;
    expect(tl.events).toContainEqual({ at: finale.start, kind: 'follow', id: 'c' });
    expect(tl.events.filter((e) => e.kind === 'settle')).toEqual([{ at: tl.duration, kind: 'settle' }]);
  });

  it('with reduced motion, only glides: no effects, celebrations or camera moves', () => {
    const tl = timeline(ROUND, { reduced: true });
    expect(tl.events).toEqual([]);
    expect(tl.beats.map((b) => b.beat.kind)).toEqual(['hop', 'hop']);
    expect(tl.beats.every((b) => b.glide && b.stepMs <= GLIDE_MS)).toBe(true);
    expect(tl.beats[1].duration).toBe(5 * tl.beats[1].stepMs);
    expect(GLIDE_MS).toBeLessThan(HOP_MS);
  });

  it('keeps a long round within the budget by hopping faster', () => {
    const beats = Array.from({ length: 8 }, (_, i) => hop(`p${i}`, [1, 2, 3, 4, 5, 6, 7], true));
    const tl = timeline(beats, { reduced: false });
    const moving = tl.beats.reduce((n, b) => n + b.stepMs * (b.beat.kind === 'hop' ? b.beat.stones.length : 0), 0);
    expect(moving).toBeLessThanOrEqual(Math.max(MOVE_BUDGET_MS, 56 * MIN_HOP_MS));
    expect(tl.beats[0].stepMs).toBeGreaterThanOrEqual(MIN_HOP_MS);
    expect(tl.beats[0].stepMs).toBeLessThan(HOP_MS);
  });

  it('is empty for no beats', () => {
    expect(timeline([], { reduced: false })).toEqual({ beats: [], events: [], duration: 0 });
  });
});

describe('hopHeight', () => {
  it('starts and ends on the ground and peaks half-way', () => {
    expect(hopHeight(0)).toBe(0);
    expect(hopHeight(1)).toBe(0);
    expect(hopHeight(0.5)).toBe(1);
    expect(hopHeight(0.25)).toBeLessThan(1);
  });
});

describe('squash', () => {
  it('is at rest at take-off and landing', () => {
    expect(squash(0)).toEqual({ x: 1, y: 1, z: 1 });
    expect(squash(1).y).toBeCloseTo(1);
  });

  it('squashes near the ground and stretches in the air', () => {
    expect(squash(0.08).y).toBeLessThan(1);
    expect(squash(0.5).y).toBeGreaterThan(1);
    expect(squash(0.92).y).toBeLessThan(1);
  });

  it('keeps the volume', () => {
    for (const t of [0.05, 0.3, 0.5, 0.9]) {
      const s = squash(t);
      expect(s.x * s.y * s.z).toBeCloseTo(1);
    }
  });
});

describe('droopAmount', () => {
  it('goes down, holds, and comes back up', () => {
    expect(droopAmount(0)).toBe(0);
    expect(droopAmount(0.5)).toBe(1);
    expect(droopAmount(1)).toBe(0);
  });
});
