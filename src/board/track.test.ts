import { describe, expect, it } from 'vitest';
import {
  buildTrack,
  END_STONE_RADIUS,
  isNumberedStone,
  MIN_STEP_GAP,
  MIN_STONE_GAP,
  STONE_RADIUS,
  STONE_SPACING,
  stonesKeepApart,
} from './track';

describe('buildTrack', () => {
  it.each([5, 10, 20, 30, 40, 60])('makes %i steps as that many stones plus the start', (len) => {
    const track = buildTrack(len);
    expect(track.length).toBe(len);
    expect(track.stones).toHaveLength(len + 1);
    expect(track.stones.map((s) => s.index)).toEqual([...Array(len + 1).keys()]);
  });

  it('makes the start and finish the big stones', () => {
    const { stones } = buildTrack(30);
    expect(stones[0].radius).toBe(END_STONE_RADIUS);
    expect(stones[30].radius).toBe(END_STONE_RADIUS);
    expect(stones.slice(1, 30).every((s) => s.radius === STONE_RADIUS)).toBe(true);
  });

  it.each([10, 30, 60])('leaves a gap between neighbouring stones (length %i)', (len) => {
    const { stones } = buildTrack(len);
    for (let i = 1; i < stones.length; i += 1) {
      const a = stones[i - 1];
      const b = stones[i];
      const d = Math.hypot(a.x - b.x, a.z - b.z);
      expect(d).toBeGreaterThanOrEqual(a.radius + b.radius + MIN_STEP_GAP);
      expect(d).toBeLessThanOrEqual(STONE_SPACING + 2 * (END_STONE_RADIUS - STONE_RADIUS) + 1e-6);
    }
  });

  it.each([5, 10, 20, 30, 40, 60, 100])('never lets stones crowd across a bend (length %i)', (len) => {
    const { stones } = buildTrack(len);
    expect(stonesKeepApart(stones)).toBe(true);
    for (let i = 0; i < stones.length; i += 1) {
      for (let j = i + 2; j < stones.length; j += 1) {
        const d = Math.hypot(stones[i].x - stones[j].x, stones[i].z - stones[j].z);
        expect(d).toBeGreaterThanOrEqual(stones[i].radius + stones[j].radius + MIN_STONE_GAP);
      }
    }
  });

  it.each([20, 30, 40])('is taller than wide, to suit a portrait screen (length %i)', (len) => {
    const { stones } = buildTrack(len);
    const xs = stones.map((s) => s.x);
    const zs = stones.map((s) => s.z);
    const width = Math.max(...xs) - Math.min(...xs);
    const height = Math.max(...zs) - Math.min(...zs);
    expect(height).toBeGreaterThan(width);
    // ...but it winds across the screen instead of running in a thin line.
    expect(width).toBeGreaterThan(height * 0.25);
  });

  it('runs from near the camera (start) to far away (finish)', () => {
    const { stones } = buildTrack(30);
    expect(stones[0].z).toBeGreaterThan(stones[30].z);
  });

  it('gives each stone a unit direction of travel', () => {
    for (const s of buildTrack(30).stones) {
      expect(Math.hypot(s.dirX, s.dirZ)).toBeCloseTo(1, 5);
    }
  });
});

describe('isNumberedStone', () => {
  it('numbers every 5th stone and the finish, not the start', () => {
    const numbered = [...Array(33).keys()].filter((i) => isNumberedStone(i, 32));
    expect(numbered).toEqual([5, 10, 15, 20, 25, 30, 32]);
  });

  it('does not double-number a finish that is a multiple of 5', () => {
    const numbered = [...Array(31).keys()].filter((i) => isNumberedStone(i, 30));
    expect(numbered).toEqual([5, 10, 15, 20, 25, 30]);
  });
});
