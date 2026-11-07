import type { PlayerId, RoundResult, Totals } from '../scoring';

/** A player in a game. Name and colour are copied in at the start, so later edits to saved players do not reach a game in progress. */
export interface SeatedPlayer {
  readonly id: PlayerId;
  readonly name: string;
  /** One of the bunny colour ids. */
  readonly colour: string;
}

/** A game in progress or finished. Never changed in place: each step returns a new one. */
export interface Game {
  /** Seat order. The storyteller rotates in this order. */
  readonly seats: readonly SeatedPlayer[];
  readonly trackLength: number;
  /** Who tells the next story. */
  readonly storyteller: PlayerId;
  /** Every confirmed round, oldest first. */
  readonly rounds: readonly RoundResult[];
  readonly totals: Totals;
  /** True once the scorekeeper tapped End game. */
  readonly endedByHand: boolean;
}

/** A row of the score list. */
export interface Standing {
  readonly player: SeatedPlayer;
  readonly total: number;
  /** 1 is the leader. Tied players share a rank. */
  readonly rank: number;
  readonly winner: boolean;
}

/** Track length choices on the setup screen. A setup option, not a scoring rule. */
export const TRACK_LENGTH = {
  default: 30,
  min: 10,
  max: 60,
  step: 5,
} as const;
