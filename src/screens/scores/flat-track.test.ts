import { describe, expect, it } from 'vitest';
import { FLAT_ROW, flatTrackLayout } from './flat-track';

const player = (id: string, score: number) => ({ id, name: id.toUpperCase(), color: '#3d8fe0', score });

describe('flatTrackLayout', () => {
  it('has a stone for the start and every step to the finish', () => {
    const t = flatTrackLayout(30, []);
    expect(t.stones.map((s) => s.n)).toEqual(Array.from({ length: 31 }, (_, i) => i));
  });

  it('winds back and forth in rows', () => {
    const { stones } = flatTrackLayout(30, []);
    const row = (n: number) => stones[n].y;
    // The first row runs left to right, the second right to left, under it.
    expect(row(FLAT_ROW - 1)).toBe(row(0));
    expect(stones[1].x).toBeGreaterThan(stones[0].x);
    expect(row(FLAT_ROW)).toBeGreaterThan(row(FLAT_ROW - 1));
    expect(stones[FLAT_ROW].x).toBe(stones[FLAT_ROW - 1].x);
    expect(stones[FLAT_ROW + 1].x).toBeLessThan(stones[FLAT_ROW].x);
  });

  it('numbers every fifth stone', () => {
    const { stones } = flatTrackLayout(12, []);
    expect(stones.filter((s) => s.numbered).map((s) => s.n)).toEqual([0, 5, 10]);
  });

  it('puts each player on their stone, and a score past the finish on the finish', () => {
    const t = flatTrackLayout(30, [player('a', 4), player('b', 33), player('c', 0)]);
    expect(t.markers.map((m) => [m.id, m.stone])).toEqual([['a', 4], ['b', 30], ['c', 0]]);
    expect(t.markers[0]).toMatchObject({ x: t.stones[4].x, y: t.stones[4].y });
  });

  it('gives players on one stone their own spots, around the stone', () => {
    const t = flatTrackLayout(30, ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => player(id, 7)));
    const spots = new Set(t.markers.map((m) => `${m.x},${m.y}`));
    expect(spots.size).toBe(6);
    const meanX = t.markers.reduce((sum, m) => sum + m.x, 0) / 6;
    expect(meanX).toBeCloseTo(t.stones[7].x);
  });

  it('assumes no player count: eight players on one stone still each get a spot', () => {
    const t = flatTrackLayout(30, Array.from({ length: 8 }, (_, i) => player(`p${i}`, 3)));
    expect(new Set(t.markers.map((m) => `${m.x},${m.y}`)).size).toBe(8);
  });

  it('is tall enough for every row', () => {
    const t = flatTrackLayout(30, []);
    expect(Math.max(...t.stones.map((s) => s.y))).toBeLessThan(t.height);
  });
});
