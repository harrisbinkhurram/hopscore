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
