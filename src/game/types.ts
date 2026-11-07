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
  /** Steps taken back with Undo, the most recent last. Redo puts them back; a new move clears them. */
  readonly redo: readonly UndoneStep[];
}

/** A step taken back with Undo: a round, or End game. */
export type UndoneStep = { readonly kind: 'round'; readonly round: RoundResult } | { readonly kind: 'end' };

/** A round entered but not confirmed yet, kept so Home then Resume does not lose it. */
export interface RoundDraft {
  readonly storyteller: PlayerId;
  readonly votes: Readonly<Record<PlayerId, PlayerId>>;
}

/** A game as read back from the device, before `restoreGame` checks it against the rules. */
export interface SavedGameParts {
  readonly seats: readonly SeatedPlayer[];
  readonly trackLength: number;
  readonly storyteller: PlayerId;
  readonly rounds: readonly SavedRoundParts[];
  readonly endedByHand: boolean;
  /** Steps that can be redone. Broken ones cost only the redo list, never the game. */
  readonly redo?: readonly ({ readonly kind: 'end' } | { readonly kind: 'round'; readonly round: SavedRoundParts })[];
}

/** One round as read back from the device. */
export interface SavedRoundParts {
  readonly storyteller: PlayerId;
  readonly scores: readonly {
    readonly player: PlayerId;
    readonly points: number;
    readonly reasons: readonly { readonly kind: string; readonly points: number; readonly text: string }[];
  }[];
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
