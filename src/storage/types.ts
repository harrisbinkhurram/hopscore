/** A saved player. The name and bunny colour are what the app remembers between games. */
export interface Player {
  id: string;
  name: string;
  /** One of the ids in `BUNNY_COLOURS`. */
  colour: string;
  /** When this player last joined a game, in ms since 1970. 0 means never. */
  lastUsedAt: number;
}

/** A named set of players, for example "Friday crew". */
export interface Group {
  id: string;
  name: string;
  playerIds: string[];
}

/** The version this build reads and writes. Bump it and add a migration when the shape changes. */
export const CURRENT_VERSION = 1;

/** Everything saved under the players key. */
export interface SavedData {
  version: number;
  players: Player[];
  groups: Group[];
}

/** Name and group-size limits, shared by the store and the screen. */
export const LIMITS = {
  playerNameMax: 20,
  groupNameMax: 30,
  groupMin: 3,
  groupMax: 6,
} as const;

/** The version of the saved game (`hopscore.game`). Bump it and add a migration when the shape changes. */
export const GAME_VERSION = 1;
/** The version of the saved history (`hopscore.history`). */
export const HISTORY_VERSION = 1;
/** How many finished games the history keeps, newest first. */
export const HISTORY_LIMIT = 10;

/** One player's score in one round, with its reasons, as saved. */
export interface SavedScore {
  readonly player: string;
  readonly points: number;
  readonly reasons: readonly { readonly kind: string; readonly points: number; readonly text: string }[];
}

export interface SavedRound {
  readonly storyteller: string;
  /** One per seat, in seat order. */
  readonly scores: readonly SavedScore[];
}

/** A step taken back with Undo, kept so Redo can put it back. */
export type SavedStep = { readonly kind: 'end' } | { readonly kind: 'round'; readonly round: SavedRound };

/**
 * The game in progress, as saved. Storage checks only its shape; the game rules (seat count,
 * reasons, totals) are checked by `restoreGame` in `src/game`. No player count is fixed here.
 */
export interface SavedGame {
  readonly game: {
    readonly seats: readonly { readonly id: string; readonly name: string; readonly colour: string }[];
    readonly trackLength: number;
    readonly storyteller: string;
    readonly rounds: readonly SavedRound[];
    readonly endedByHand: boolean;
    readonly redo: readonly SavedStep[];
  };
  /** The screen Resume goes back to. */
  readonly view: 'round' | 'scores';
  /** Votes entered for the next round before Home was tapped. */
  readonly draft: { readonly storyteller: string; readonly votes: Readonly<Record<string, string>> } | null;
}

/** A finished game, as the history shows it. */
export interface HistoryEntry {
  readonly id: string;
  /** When it finished, in ms since 1970. */
  readonly finishedAt: number;
  readonly trackLength: number;
  /** How many rounds were played. */
  readonly rounds: number;
  readonly endedByHand: boolean;
  /** In seat order. */
  readonly players: readonly { readonly name: string; readonly colour: string; readonly score: number }[];
}
