import { describe, expect, it } from 'vitest';
import { buildTrack, isNumberedStone, MAX_TURN_DEGREES, STONE_RADIUS, STONE_SPACING } from './track';

describe('buildTrack', () => {
  it.each([10, 20, 30, 40, 60])('makes %i steps as that many stones plus the start', (len) => {
    const track = buildTrack(len);
    expect(track.length).toBe(len);
    expect(track.stones).toHaveLength(len + 1);
    expect(track.stones.map((s) => s.index)).toEqual([...Array(len + 1).keys()]);
  });

  it.each([10, 30, 60])('spaces stones evenly and never lets them touch (length %i)', (len) => {
    const { stones } = buildTrack(len);
    for (let i = 1; i < stones.length; i += 1) {
      const d = Math.hypot(stones[i].x - stones[i - 1].x, stones[i].z - stones[i - 1].z);
      expect(d).toBeGreaterThan(STONE_SPACING * 0.9);
      expect(d).toBeLessThanOrEqual(STONE_SPACING * 1.001);
    }
    // No two stones overlap, even across the bends.
    for (let i = 0; i < stones.length; i += 1) {
      for (let j = i + 1; j < stones.length; j += 1) {
        const d = Math.hypot(stones[i].x - stones[j].x, stones[i].z - stones[j].z);
        expect(d).toBeGreaterThan(2 * STONE_RADIUS);
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
  });

  it('runs from near the camera (start) to far away (finish)', () => {
    const { stones } = buildTrack(30);
    expect(stones[0].z).toBeGreaterThan(stones[30].z);
  });

  it.each([10, 30, 60, 100])('never turns more than 30 degrees off straight up (length %i)', (len) => {
    for (const s of buildTrack(len).stones) {
      expect(Math.abs(s.dirX)).toBeLessThanOrEqual(Math.sin((MAX_TURN_DEGREES * Math.PI) / 180) + 1e-6);
    }
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
