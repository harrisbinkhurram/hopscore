import { describe, expect, it } from 'vitest';
import { BUNNY_FOOTPRINT, BUNNY_GAP, layoutBunnies, stoneForScore, type BoardPlayer } from './layout';
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

function minGap(spots: { x: number; z: number }[]): number {
  let min = Infinity;
  for (let i = 0; i < spots.length; i += 1) {
    for (let j = i + 1; j < spots.length; j += 1) {
      min = Math.min(min, Math.hypot(spots[i].x - spots[j].x, spots[i].z - spots[j].z));
    }
  }
  return min;
}

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

  it.each([2, 3, 4, 5, 6])('stands %i bunnies on one stone side by side without overlap', (n) => {
    for (const stone of [0, 3, 8, 15, 30]) {
      const spots = layoutBunnies(players(Array(n).fill(stone)), track);
      expect(new Set(spots.map((s) => s.slot)).size).toBe(n);
      expect(minGap(spots)).toBeGreaterThanOrEqual(BUNNY_GAP - 1e-9);
      expect(anyTouching(spots)).toBe(false);
      // The group is centred on the stone.
      const cx = spots.reduce((a, s) => a + s.x, 0) / n;
      const cz = spots.reduce((a, s) => a + s.z, 0) / n;
      expect(cx).toBeCloseTo(track.stones[stone].x);
      expect(cz).toBeCloseTo(track.stones[stone].z);
    }
  });

  it.each([10, 30, 60])('keeps crowded neighbouring stones apart (length %i)', (len) => {
    const t = buildTrack(len);
    for (let stone = 0; stone < len; stone += 1) {
      const spots = layoutBunnies(players([stone, stone, stone, stone + 1, stone + 1, stone + 1]), t);
      expect(anyTouching(spots)).toBe(false);
    }
  });

  it('lines a shared stone up left to right on screen', () => {
    for (let stone = 0; stone <= 30; stone += 1) {
      const spots = layoutBunnies(players([stone, stone, stone]), track);
      expect(spots[0].x).toBeLessThanOrEqual(spots[2].x + 1e-9);
    }
  });
});
