import { loadHistory, loadSavedGame } from './game-data';
import type { LoadResult } from './migrate';
import { newId } from './player-store';
import { SafeStorage, type StorageLike } from './safe-storage';
import { GAME_VERSION, HISTORY_LIMIT, HISTORY_VERSION, type HistoryEntry, type SavedGame } from './types';

/** The game in progress. Its own key, so a broken game never costs the players or the history. */
export const GAME_KEY = 'hopscore.game';
/** Finished games. */
export const HISTORY_KEY = 'hopscore.history';

/** A finished game to add to the history; the store adds the id and the date. */
export type FinishedGame = Omit<HistoryEntry, 'id' | 'finishedAt'>;

export interface GameStore {
  /** False when changes will be lost on reload. `notSavedReason` says why. */
  readonly persistent: boolean;
  /** As for the player store: 'storage-off', or 'kept-safe' when saved data is from a newer app or could not be upgraded. */
  readonly notSavedReason: 'storage-off' | 'kept-safe' | null;
  /**
   * True when the saved game is from a newer app or could not be upgraded: it is never written
   * over or cleared, so it must not be moved into the history either (it would come back again).
   */
  readonly gameKeptSafe: boolean;
  /** The game saved last, or null when there is none or it was broken. */
  savedGame(): SavedGame | null;
  saveGame(saved: SavedGame): void;
  clearGame(): void;
  /** Newest first, at most `HISTORY_LIMIT`. */
  history(): HistoryEntry[];
  /** Adds a finished game; past the limit the oldest goes. */
  recordFinished(game: FinishedGame, now?: number): void;
  deleteHistory(id: string): void;
  /**
   * Calls `listener` after another tab changed the saved game (or cleared all storage), once this
   * store has read it again. Returns a function that stops it.
   */
  onGameChanged(listener: () => void): () => void;
}

/**
 * Creates the store for the game in progress and the history. With no argument it uses
 * `localStorage`; pass a fake (or `null` for memory only) in tests. Changes never throw.
 * Create one per page, as for the player store.
 */
export function createGameStore(backend?: StorageLike | null): GameStore {
  const storage = new SafeStorage(backend);
  let game = readGame(storage);
  let history = readHistory(storage);
  const gameListeners = new Set<() => void>();

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('storage', (event) => {
      if (event.key === HISTORY_KEY || event.key === null) history = readHistory(storage);
      if (event.key === GAME_KEY || event.key === null) {
        game = readGame(storage);
        for (const listener of [...gameListeners]) listener();
      }
    });
  }

  const writeHistory = (entries: HistoryEntry[]) => {
    history = { ...history, entries };
    // Never write over history from a newer app, or one a migration failed on.
    if (!history.keepSaved) storage.set(HISTORY_KEY, JSON.stringify({ version: HISTORY_VERSION, entries }));
  };

  return {
    get persistent() {
      return storage.persistent && !game.keepSaved && !history.keepSaved;
    },

    get notSavedReason() {
      if (!storage.persistent) return 'storage-off';
      return game.keepSaved || history.keepSaved ? 'kept-safe' : null;
    },

    get gameKeptSafe() {
      return game.keepSaved !== null;
    },

    savedGame: () => game.saved,

    saveGame(saved) {
      // Only the saved fields: anything else on the objects passed in (such as totals) stays out.
      const { seats, trackLength, storyteller, rounds, endedByHand, redo } = saved.game;
      const clean: SavedGame = {
        game: { seats, trackLength, storyteller, rounds, endedByHand, redo },
        view: saved.view,
        draft: saved.draft,
        ...(saved.endedAt !== undefined ? { endedAt: saved.endedAt } : {}),
      };
      game = { ...game, saved: clean };
      if (!game.keepSaved) storage.set(GAME_KEY, JSON.stringify({ version: GAME_VERSION, ...clean }));
    },

    clearGame() {
      game = { ...game, saved: null };
      if (!game.keepSaved) storage.remove(GAME_KEY);
    },

    history: () => [...history.entries],

    recordFinished(finished, now = Date.now()) {
      const entry: HistoryEntry = { ...finished, id: newId(), finishedAt: now };
      writeHistory([entry, ...history.entries].slice(0, HISTORY_LIMIT));
    },

    deleteHistory(id) {
      if (!history.entries.some((e) => e.id === id)) return;
      writeHistory(history.entries.filter((e) => e.id !== id));
    },

    onGameChanged(listener) {
      gameListeners.add(listener);
      return () => {
        gameListeners.delete(listener);
      };
    },
  };
}

function parse(storage: SafeStorage, key: string): unknown {
  const text = storage.get(key);
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function readGame(storage: SafeStorage): { saved: SavedGame | null; keepSaved: LoadResult['keepSaved'] } {
  return loadSavedGame(parse(storage, GAME_KEY));
}

function readHistory(storage: SafeStorage): { entries: HistoryEntry[]; keepSaved: LoadResult['keepSaved'] } {
  return loadHistory(parse(storage, HISTORY_KEY));
}
