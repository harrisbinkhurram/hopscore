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

/** Centre-to-centre gap between bunnies that share a stone. Wider than a bunny. */
export const BUNNY_GAP = 0.92;

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
 * Where each bunny stands. Bunnies on the same stone line up side by side, left to
 * right on screen, in the order the players were given.
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
    // Side by side along x, which is left to right on screen: the camera never turns.
    group.forEach((p, slot) => {
      const offset = (slot - (group.length - 1) / 2) * BUNNY_GAP;
      spots.set(p.id, {
        id: p.id,
        stone: stoneIndex,
        x: stone.x + offset,
        z: stone.z,
        slot,
        shared: group.length,
      });
    });
  }
  return players.map((p) => spots.get(p.id)!);
}
