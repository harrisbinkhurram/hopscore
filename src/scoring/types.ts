/** A player's id. Task 03's saved players supply these. */
export type PlayerId = string;

export interface RoundInput {
  /** Players in seat order. */
  readonly seats: readonly PlayerId[];
  readonly storyteller: PlayerId;
  /** For each player except the storyteller: whose card they voted for. */
  readonly votes: Readonly<Record<PlayerId, PlayerId>>;
}

/** Every reason kind, for checking reasons read back from a saved game. */
export const SCORE_REASON_KINDS = [
  'storyteller-some-found',
  'storyteller-all-found',
  'storyteller-none-found',
  'found-storyteller',
  'missed-storyteller',
  'all-found-storyteller',
  'none-found-storyteller',
  'votes-on-card',
] as const;

export type ScoreReasonKind = (typeof SCORE_REASON_KINDS)[number];

export interface ScoreReason {
  /** Stable code, for styling or translation. */
  readonly kind: ScoreReasonKind;
  readonly points: number;
  /** Short English text, e.g. "found the storyteller: +3". */
  readonly text: string;
}

export interface PlayerRoundScore {
  readonly player: PlayerId;
  readonly points: number;
  readonly reasons: readonly ScoreReason[];
}

export interface RoundResult {
  readonly storyteller: PlayerId;
  /** One entry per player, in seat order. */
  readonly scores: readonly PlayerRoundScore[];
}

/** Running totals by player. */
export type Totals = Readonly<Record<PlayerId, number>>;
