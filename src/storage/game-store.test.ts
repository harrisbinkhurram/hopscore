import { describe, expect, it } from 'vitest';
import { createGameStore, GAME_KEY, HISTORY_KEY, type FinishedGame } from './game-store';
import { createPlayerStore, PLAYERS_KEY } from './player-store';
import { BlockedStorage, FakeStorage } from './test-helpers';
import { GAME_VERSION, HISTORY_LIMIT, type SavedGame } from './types';

const SAVED: SavedGame = {
  game: {
    seats: [
      { id: 'a', name: 'Ada', colour: 'sky' },
      { id: 'b', name: 'Bo', colour: 'lilac' },
      { id: 'c', name: 'Cy', colour: 'sunny' },
    ],
    trackLength: 30,
    storyteller: 'a',
    rounds: [],
    endedByHand: false,
    redo: [],
  },
  view: 'round',
  draft: { storyteller: 'a', votes: { b: 'a' } },
};

const FINISHED: FinishedGame = {
  trackLength: 30,
  rounds: 9,
  endedByHand: false,
  players: [
    { name: 'Ada', colour: 'sky', score: 31 },
    { name: 'Bo', colour: 'lilac', score: 20 },
  ],
};

describe('game store: the game in progress', () => {
  it('saves the game with a version, and a new store (the app opened again) reads it back', () => {
    const backend = new FakeStorage();
    createGameStore(backend).saveGame(SAVED);
    expect(JSON.parse(backend.getItem(GAME_KEY)!).version).toBe(GAME_VERSION);
    expect(createGameStore(backend).savedGame()).toEqual(SAVED);
  });

  it('keeps the screen and the votes entered, for Resume', () => {
    const backend = new FakeStorage();
    createGameStore(backend).saveGame({ ...SAVED, view: 'scores', draft: null });
    const saved = createGameStore(backend).savedGame();
    expect(saved?.view).toBe('scores');
    expect(saved?.draft).toBeNull();
  });

  it('keeps when the game ended', () => {
    const backend = new FakeStorage();
    createGameStore(backend).saveGame({ ...SAVED, endedAt: 99 });
    expect(createGameStore(backend).savedGame()?.endedAt).toBe(99);
  });

  it('saves only the saved fields, not totals', () => {
    const backend = new FakeStorage();
    const withTotals = { ...SAVED, game: { ...SAVED.game, totals: { a: 0, b: 0, c: 0 } } };
    createGameStore(backend).saveGame(withTotals);
    expect(JSON.parse(backend.getItem(GAME_KEY)!).game.totals).toBeUndefined();
  });

  it('clears the game', () => {
    const backend = new FakeStorage();
    const store = createGameStore(backend);
    store.saveGame(SAVED);
    store.clearGame();
    expect(store.savedGame()).toBeNull();
    expect(backend.getItem(GAME_KEY)).toBeNull();
  });

  it('keeps the players when the saved game is broken', () => {
    const backend = new FakeStorage();
    createPlayerStore(backend).addPlayer('Ada');
    backend.setItem(GAME_KEY, '{"version":1,"game":{"seats":"oops"');
    const store = createGameStore(backend);
    expect(store.savedGame()).toBeNull();
    store.saveGame(SAVED);
    expect(createPlayerStore(backend).players().map((p) => p.name)).toEqual(['Ada']);
    expect(JSON.parse(backend.getItem(PLAYERS_KEY)!).players).toHaveLength(1);
  });

  it('never writes over a game saved by a newer app', () => {
    const backend = new FakeStorage();
    const newer = JSON.stringify({ version: GAME_VERSION + 1, ...SAVED });
    backend.setItem(GAME_KEY, newer);
    const store = createGameStore(backend);
    expect(store.notSavedReason).toBe('kept-safe');
    expect(store.persistent).toBe(false);
    store.saveGame({ ...SAVED, view: 'scores' });
    store.clearGame();
    expect(store.gameKeptSafe).toBe(true);
    expect(backend.getItem(GAME_KEY)).toBe(newer);
  });

  it('says a game it may write is not kept safe', () => {
    expect(createGameStore(new FakeStorage()).gameKeptSafe).toBe(false);
  });

  it('keeps working in memory when storage is blocked', () => {
    const store = createGameStore(new BlockedStorage());
    expect(store.notSavedReason).toBe('storage-off');
    store.saveGame(SAVED);
    expect(store.savedGame()).toEqual(SAVED);
    store.recordFinished(FINISHED, 5);
    expect(store.history()).toHaveLength(1);
  });
});

describe('game store: history', () => {
  it('records a finished game with an id and the date, and keeps it', () => {
    const backend = new FakeStorage();
    createGameStore(backend).recordFinished(FINISHED, 1234);
    const [entry] = createGameStore(backend).history();
    expect(entry).toEqual({ ...FINISHED, id: entry!.id, finishedAt: 1234 });
    expect(entry!.id).not.toBe('');
  });

  it(`keeps the newest ${HISTORY_LIMIT}: the oldest goes`, () => {
    const store = createGameStore(new FakeStorage());
    for (let i = 1; i <= HISTORY_LIMIT + 1; i += 1) store.recordFinished(FINISHED, i);
    const dates = store.history().map((e) => e.finishedAt);
    expect(dates).toHaveLength(HISTORY_LIMIT);
    expect(dates[0]).toBe(HISTORY_LIMIT + 1);
    expect(dates).not.toContain(1);
  });

  it('deletes an entry and remembers it', () => {
    const backend = new FakeStorage();
    const store = createGameStore(backend);
    store.recordFinished(FINISHED, 1);
    store.recordFinished(FINISHED, 2);
    store.deleteHistory(store.history()[0]!.id);
    expect(createGameStore(backend).history().map((e) => e.finishedAt)).toEqual([1]);
  });

  it('ignores deleting an entry that is gone', () => {
    const store = createGameStore(new FakeStorage());
    expect(() => store.deleteHistory('missing')).not.toThrow();
  });

  it('never writes over history saved by a newer app', () => {
    const backend = new FakeStorage();
    const newer = JSON.stringify({ version: 99, entries: [] });
    backend.setItem(HISTORY_KEY, newer);
    createGameStore(backend).recordFinished(FINISHED, 1);
    expect(backend.getItem(HISTORY_KEY)).toBe(newer);
  });
});
