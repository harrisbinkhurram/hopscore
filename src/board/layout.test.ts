import { describe, expect, it } from 'vitest';
import { BUNNY_FOOTPRINT, clusterOffsets, layoutBunnies, stoneForScore, type BoardPlayer } from './layout';
import { buildTrack } from './track';

function players(scores: number[]): BoardPlayer[] {
  return scores.map((score, i) => ({ id: `p${i}`, name: `P${i}`, color: '#ffffff', score }));
}

/** True when two bunny footprints (axis-aligned boxes) overlap. */
function touching(a: { x: number; z: number }, b: { x: number; z: number }): boolean {
  return Math.abs(a.x - b.x) < BUNNY_FOOTPRINT.width && Math.abs(a.z - b.z) < BUNNY_FOOTPRINT.depth;
}

function anyTouching(spots: { x: number; z: number }[]): boolean {
  return spots.some((a, i) => spots.slice(i + 1).some((b) => touching(a, b)));
}

/** Every way to split six players over two stones. */
const SPLITS = [
  [6, 0],
  [5, 1],
  [4, 2],
  [3, 3],
];

describe('stoneForScore', () => {
  it('keeps scores on the track', () => {
    expect(stoneForScore(0, 30)).toBe(0);
    expect(stoneForScore(12, 30)).toBe(12);
    expect(stoneForScore(30, 30)).toBe(30);
    expect(stoneForScore(41, 30)).toBe(30);
    expect(stoneForScore(-2, 30)).toBe(0);
    expect(stoneForScore(Number.NaN, 30)).toBe(0);
  });
});

describe('clusterOffsets', () => {
  it.each([1, 2, 3, 4, 5, 6])('places %i bunnies without overlap, centred on the stone', (n) => {
    const offsets = clusterOffsets(n);
    expect(offsets).toHaveLength(n);
    expect(anyTouching(offsets)).toBe(false);
    const cx = offsets.reduce((a, o) => a + o.x, 0) / n;
    expect(cx).toBeCloseTo(0);
  });

  it.each([1, 2, 3, 4])('keeps %i bunnies standing on a stone on the way', (n) => {
    const track = buildTrack(30);
    for (const o of clusterOffsets(n)) {
      expect(Math.hypot(o.x, o.z)).toBeLessThan(track.stones[10].radius * 0.75);
    }
  });

  it.each([5, 6])('keeps %i bunnies standing on the big start stone', (n) => {
    const track = buildTrack(30);
    for (const o of clusterOffsets(n)) {
      expect(Math.hypot(o.x, o.z)).toBeLessThan(track.stones[0].radius * 0.85);
    }
  });
});

describe('layoutBunnies', () => {
  const track = buildTrack(30);

  it('returns one spot per player, in player order', () => {
    const spots = layoutBunnies(players([0, 5, 12]), track);
    expect(spots.map((s) => s.id)).toEqual(['p0', 'p1', 'p2']);
    expect(spots.map((s) => s.stone)).toEqual([0, 5, 12]);
  });

  it('puts a lone bunny on the middle of its stone', () => {
    const [spot] = layoutBunnies(players([7]), track);
    expect(spot.x).toBeCloseTo(track.stones[7].x);
    expect(spot.z).toBeCloseTo(track.stones[7].z);
    expect(spot.shared).toBe(1);
  });

  it('waits on the final stone when the score is past the end', () => {
    const spots = layoutBunnies(players([41, 30]), track);
    expect(spots.map((s) => s.stone)).toEqual([30, 30]);
    expect(spots[0].shared).toBe(2);
  });

  it.each([2, 3, 4, 5, 6])('gathers %i bunnies on one stone without overlap', (n) => {
    for (const stone of [0, 3, 8, 15, 30]) {
      const spots = layoutBunnies(players(Array(n).fill(stone)), track);
      expect(new Set(spots.map((s) => s.slot)).size).toBe(n);
      expect(anyTouching(spots)).toBe(false);
    }
  });

  it.each([5, 10, 20, 30, 40, 60])(
    'never lets bunnies on two different stones touch, for any split of six (length %i)',
    (len) => {
      const t = buildTrack(len);
      for (let a = 0; a <= len; a += 1) {
        for (let b = a + 1; b <= len; b += 1) {
          for (const [na, nb] of SPLITS) {
            const spots = layoutBunnies(players([...Array(na).fill(a), ...Array(nb).fill(b)]), t);
            expect(anyTouching(spots)).toBe(false);
          }
        }
      }
    },
  );
});
