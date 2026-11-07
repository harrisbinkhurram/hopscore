import { stoneForScore, type BoardPlayer } from './layout';

/**
 * What happens on the board after a round, as plain data (no Three.js), so it can be tested.
 * motion.ts gives the beats their timing; board.ts plays them.
 */

/** A gain this big earns a spin and a burst of petals. A celebration threshold, not a scoring rule. */
export const BIG_ROUND = 5;

/** One round, as the board needs it. The board's current scores are the "before". */
export interface RoundPlay {
  /** Scores after the round, in seat order. */
  players: readonly BoardPlayer[];
  /** Points each player gained this round, not clamped to the track. Missing means 0. */
  gains: Readonly<Record<string, number>>;
  /** Who told the story. Empty when there is no round (End game). */
  storyteller: string;
  /** Non-empty only when the game is over. */
  winners: readonly string[];
}

export type Beat =
  /** Hops onto each stone in `stones`, in order. */
  | { kind: 'hop'; id: string; stones: number[]; big: boolean }
  /** A big gain with no stone left to hop to (already at the finish). */
  | { kind: 'cheer'; id: string }
  /** The storyteller scored 0. */
  | { kind: 'droop'; id: string }
  | { kind: 'finale'; winners: string[]; others: string[] };

/**
 * The beats for one round, in play order: smallest gain first, ties in seat order. A player
 * with no gain has no beat, except a storyteller on 0, who droops. The finale comes last.
 */
export function planRound(before: readonly BoardPlayer[], round: RoundPlay, trackLength: number): Beat[] {
  const beforeScore = new Map(before.map((p) => [p.id, p.score]));
  const gainOf = (id: string) => round.gains[id] ?? 0;

  const movers = round.players
    .filter((p) => gainOf(p.id) > 0 || (p.id === round.storyteller && gainOf(p.id) === 0))
    // Array sort is stable, so equal gains keep seat order.
    .sort((a, b) => gainOf(a.id) - gainOf(b.id));

  const beats: Beat[] = [];
  for (const p of movers) {
    const gain = gainOf(p.id);
    if (gain === 0) {
      beats.push({ kind: 'droop', id: p.id });
      continue;
    }
    const from = stoneForScore(beforeScore.get(p.id) ?? 0, trackLength);
    const to = stoneForScore(p.score, trackLength);
    const stones: number[] = [];
    for (let s = from + 1; s <= to; s += 1) stones.push(s);
    const big = gain >= BIG_ROUND;
    if (stones.length > 0) beats.push({ kind: 'hop', id: p.id, stones, big });
    else if (big) beats.push({ kind: 'cheer', id: p.id });
  }

  const ids = new Set(round.players.map((p) => p.id));
  const winners = round.winners.filter((id) => ids.has(id));
  if (winners.length > 0) {
    const others = round.players.map((p) => p.id).filter((id) => !winners.includes(id));
    beats.push({ kind: 'finale', winners, others });
  }
  return beats;
}

/** The stone each bunny stands on after the beats, starting from `before`. */
export function foldStones(before: ReadonlyMap<string, number>, beats: readonly Beat[]): Map<string, number> {
  const out = new Map(before);
  for (const b of beats) {
    if (b.kind === 'hop') out.set(b.id, b.stones[b.stones.length - 1]);
  }
  return out;
}
