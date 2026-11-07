import type { Track } from './track';

/** What the board needs to know about a player. Task 06 maps the game state onto this. */
export interface BoardPlayer {
  id: string;
  name: string;
  /** Any CSS colour, for example `#e85d75`. */
  color: string;
  score: number;
}

/**
 * A bunny's footprint on the ground, in world units, at its drawn size: ears and
 * body across, tail to toes front to back. bunny.ts draws to these sizes.
 */
export const BUNNY_FOOTPRINT = { width: 0.8, depth: 1.0 };

/** Side-to-side gap between the centres of bunnies on one stone. Wider than a bunny. */
export const BUNNY_GAP = 0.9;

/** Front-to-back gap between the two rows on a crowded stone. Deeper than a bunny. */
export const ROW_GAP = 1.05;

/**
 * Where bunnies stand on a stone, relative to its centre, by how many share it.
 * Up to four fit on the stone: a pair, a triangle, a square. Five and six use two
 * rows of three and stand a little over the edge. Each row reads left to right, the
 * back row (negative z, further from the camera) first.
 */
export function clusterOffsets(count: number): { x: number; z: number }[] {
  const g = BUNNY_GAP / 2;
  const r = ROW_GAP / 2;
  const row = (n: number, z: number) =>
    Array.from({ length: n }, (_, i) => ({ x: (i - (n - 1) / 2) * BUNNY_GAP, z }));
  switch (count) {
    case 0:
      return [];
    case 1:
      return [{ x: 0, z: 0 }];
    case 2:
      return [{ x: -g, z: 0 }, { x: g, z: 0 }];
    case 3:
      return [...row(2, -r), ...row(1, r)];
    case 4:
      return [...row(2, -r), ...row(2, r)];
    default: {
      // Five or more: rows of three, back to front.
      const rows = Math.ceil(count / 3);
      const out: { x: number; z: number }[] = [];
      for (let k = 0; k < rows; k += 1) {
        const n = Math.min(3, count - k * 3);
        out.push(...row(n, (k - (rows - 1) / 2) * ROW_GAP));
      }
      return out;
    }
  }
}

export interface BunnySpot {
  id: string;
  /** The stone the bunny stands on. */
  stone: number;
  x: number;
  z: number;
  /** 0-based position among the bunnies on the same stone, left to right. */
  slot: number;
  /** How many bunnies share this stone. */
  shared: number;
}

/** The stone a score lands on: scores below 0 stay at the start, scores past the end wait on the finish. */
export function stoneForScore(score: number, trackLength: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.min(trackLength, Math.max(0, Math.floor(score)));
}

/**
 * Where each bunny stands. Bunnies on the same stone gather in a small cluster
 * (see clusterOffsets), in the order the players were given.
 */
export function layoutBunnies(players: readonly BoardPlayer[], track: Track): BunnySpot[] {
  const byStone = new Map<number, BoardPlayer[]>();
  for (const p of players) {
    const stone = stoneForScore(p.score, track.length);
    const list = byStone.get(stone) ?? [];
    list.push(p);
    byStone.set(stone, list);
  }

  const spots = new Map<string, BunnySpot>();
  for (const [stoneIndex, group] of byStone) {
    const stone = track.stones[stoneIndex];
    // The camera never turns, so x is always left to right on screen.
    const offsets = clusterOffsets(group.length);
    group.forEach((p, slot) => {
      spots.set(p.id, {
        id: p.id,
        stone: stoneIndex,
        x: stone.x + offsets[slot].x,
        z: stone.z + offsets[slot].z,
        slot,
        shared: group.length,
      });
    });
  }
  return players.map((p) => spots.get(p.id)!);
}
