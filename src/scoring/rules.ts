/**
 * Every scoring rule number lives here, so a rulebook check is a one-line edit.
 * See the Scoring section of docs/plan/spec.md.
 */
export interface Rules {
  /** Name shown in tests and messages. */
  readonly name: 'standard' | 'three-player';
  /** Storyteller points when some, but not all, voters found their card. */
  readonly storytellerWhenSomeFound: number;
  /** Points for a voter who found the storyteller's card, when only some did. */
  readonly finderWhenSomeFound: number;
  /** Points for each other player when everyone or nobody found the storyteller's card. */
  readonly othersWhenAllOrNoneFound: number;
  /** Bonus per vote on a non-storyteller's card. */
  readonly bonusPerVote: number;
  /** Most bonus points one player can get in a round. null means no cap. */
  readonly bonusCap: number | null;
  /** Cards each non-storyteller puts in. Informational: a vote names whose card it was. */
  readonly cardsPerNonStoryteller: number;
}

export const STANDARD_RULES: Rules = {
  name: 'standard',
  storytellerWhenSomeFound: 3,
  finderWhenSomeFound: 3,
  othersWhenAllOrNoneFound: 2,
  bonusPerVote: 1,
  bonusCap: null,
  cardsPerNonStoryteller: 1,
};

/**
 * 3-player rules. TO VERIFY against a rulebook before this ships,
 * including whether the bonus has a cap (set `bonusCap` if it does).
 * Each non-storyteller puts in 2 cards; votes on either count toward their bonus.
 */
export const THREE_PLAYER_RULES: Rules = {
  ...STANDARD_RULES,
  name: 'three-player',
  cardsPerNonStoryteller: 2,
  bonusCap: null,
};

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 6;

/** The rules for a game with this many players. 3 players switches on the 3-player rules. */
export function rulesFor(playerCount: number): Rules {
  return playerCount === 3 ? THREE_PLAYER_RULES : STANDARD_RULES;
}
