import { describe, expect, it } from 'vitest';
import { loadHistory, loadSavedGame } from './game-data';
import { HISTORY_LIMIT } from './types';

/** Real version-1 data, as this build saves it: round 1 played, round 2 undone, a vote entered for round 2. */
const V1_GAME = {
  version: 1,
  game: {
    seats: [
      { id: 'a', name: 'Ada', colour: 'sky' },
      { id: 'b', name: 'Bo', colour: 'lilac' },
      { id: 'c', name: 'Cy', colour: 'sunny' },
    ],
    trackLength: 30,
    storyteller: 'b',
    rounds: [
      {
        storyteller: 'a',
        scores: [
          { player: 'a', points: 3, reasons: [{ kind: 'storyteller-some-found', points: 3, text: 'some found the storyteller: +3' }] },
          { player: 'b', points: 3, reasons: [{ kind: 'found-storyteller', points: 3, text: 'found the storyteller: +3' }] },
          { player: 'c', points: 0, reasons: [] },
        ],
      },
    ],
    endedByHand: false,
    redo: [
      {
        kind: 'round',
        round: {
          storyteller: 'b',
          scores: [
            { player: 'a', points: 0, reasons: [] },
            { player: 'b', points: 0, reasons: [] },
            { player: 'c', points: 0, reasons: [] },
          ],
        },
      },
    ],
  },
  view: 'round',
  draft: { storyteller: 'b', votes: { a: 'b' } },
};

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
/** V1_GAME with one change made by `edit`. */
// Loosely typed on purpose: these tests save data of the wrong shape.
function broken(edit: (data: any) => void) {
  const data = clone(V1_GAME);
  edit(data);
  return data;
}

describe('loadSavedGame', () => {
  it('reads real version-1 data: game, view and draft', () => {
    const { saved, keepSaved } = loadSavedGame(clone(V1_GAME));
    const { version: _version, ...rest } = V1_GAME;
    expect(saved).toEqual(rest);
    expect(keepSaved).toBeNull();
  });

  it('has no player limit in the format: 8 seats load', () => {
    const data = broken((d) => {
      d.game.seats = 'abcdefgh'.split('').map((id) => ({ id, name: id, colour: 'sky' }));
      d.game.rounds = [];
      d.game.redo = [];
    });
    expect(loadSavedGame(data).saved?.game.seats).toHaveLength(8);
  });

  // [label, saved data]
  const nothing: [string, unknown][] = [
    ['nothing saved', null],
    ['a number', 42],
    ['an array', [V1_GAME]],
    ['no game', { version: 1, view: 'round' }],
    ['seats missing', broken((d) => delete d.game.seats)],
    ['a seat without an id', broken((d) => (d.game.seats[0].id = ''))],
    ['the same seat twice', broken((d) => (d.game.seats[2].id = 'a'))],
    ['a seat without a name', broken((d) => (d.game.seats[1].name = '  '))],
    ['a track length that is not a number', broken((d) => (d.game.trackLength = '30'))],
    ['no storyteller', broken((d) => delete d.game.storyteller)],
    ['rounds not a list', broken((d) => (d.game.rounds = {}))],
    ['a round without scores', broken((d) => delete d.game.rounds[0].scores)],
    ['points that are not a number', broken((d) => (d.game.rounds[0].scores[0].points = null))],
    ['a reason without text', broken((d) => delete d.game.rounds[0].scores[0].reasons[0].text)],
  ];
  it.each(nothing)('drops the game, never throwing, for %s', (_label, raw) => {
    expect(loadSavedGame(raw).saved).toBeNull();
  });

  it('drops only the Redo list when a step in it is broken', () => {
    const { saved } = loadSavedGame(broken((d) => (d.game.redo[0].round.scores = 'x')));
    expect(saved?.game.rounds).toEqual(V1_GAME.game.rounds);
    expect(saved?.game.redo).toEqual([]);
  });

  it('keeps an End game step in the Redo list', () => {
    const { saved } = loadSavedGame(broken((d) => (d.game.redo = [{ kind: 'end' }])));
    expect(saved?.game.redo).toEqual([{ kind: 'end' }]);
  });

  it('drops a draft told by someone not seated', () => {
    expect(loadSavedGame(broken((d) => (d.draft.storyteller = 'z'))).saved?.draft).toBeNull();
  });

  it('keeps only votes by and for seated players, never for themselves or by the storyteller', () => {
    const { saved } = loadSavedGame(broken((d) => (d.draft.votes = { a: 'b', c: 'c', b: 'a', z: 'a', x: 1 } as never)));
    expect(saved?.draft).toEqual({ storyteller: 'b', votes: { a: 'b' } });
  });

  it('reads when the game ended, and drops a bad value', () => {
    expect(loadSavedGame({ ...clone(V1_GAME), endedAt: 1234 }).saved?.endedAt).toBe(1234);
    expect(loadSavedGame({ ...clone(V1_GAME), endedAt: 'Friday' }).saved).not.toHaveProperty('endedAt');
  });

  it('goes back to the round screen for an unknown view', () => {
    expect(loadSavedGame(broken((d) => (d.view = 'board'))).saved?.view).toBe('round');
  });

  it('gives a seat with an unknown colour the first colour', () => {
    expect(loadSavedGame(broken((d) => (d.game.seats[0].colour = 'plaid'))).saved?.game.seats[0]?.colour).toBe('clover');
  });

  it('reads data from a newer app as best it can and says to keep it', () => {
    const { saved, keepSaved } = loadSavedGame({ ...clone(V1_GAME), version: 2 });
    expect(saved?.game.rounds).toHaveLength(1);
    expect(keepSaved).toBe('newer-version');
  });

  it('says to keep data a migration fails on', () => {
    const failing = { 1: () => { throw new Error('bad'); } };
    expect(loadSavedGame(clone(V1_GAME), failing, 2).keepSaved).toBe('migration-failed');
  });
});

const entry = (id: string, finishedAt: number) => ({
  id,
  finishedAt,
  trackLength: 30,
  rounds: 7,
  endedByHand: false,
  players: [
    { name: 'Ada', colour: 'sky', score: 30 },
    { name: 'Bo', colour: 'lilac', score: 21 },
  ],
});

describe('loadHistory', () => {
  it('reads real version-1 data, newest first', () => {
    const { entries, keepSaved } = loadHistory({ version: 1, entries: [entry('old', 1000), entry('new', 2000)] });
    expect(entries.map((e) => e.id)).toEqual(['new', 'old']);
    expect(entries[0]).toEqual(entry('new', 2000));
    expect(keepSaved).toBeNull();
  });

  it('drops broken entries one by one and keeps the rest', () => {
    const entries = [
      entry('good', 3000),
      { ...entry('no-date', 0) },
      { ...entry('no-players', 2000), players: [] },
      { ...entry('bad-score', 2000), players: [{ name: 'Ada', colour: 'sky', score: 'x' }] },
      'junk',
      entry('good', 1000), // the same id twice
    ];
    expect(loadHistory({ version: 1, entries }).entries.map((e) => e.id)).toEqual(['good']);
  });

  it(`keeps at most ${HISTORY_LIMIT} entries, the newest`, () => {
    const many = Array.from({ length: HISTORY_LIMIT + 3 }, (_, i) => entry(`g${i}`, 1000 + i));
    const { entries } = loadHistory({ version: 1, entries: many });
    expect(entries).toHaveLength(HISTORY_LIMIT);
    expect(entries.at(-1)?.id).toBe('g3');
  });

  it.each([null, 'text', [], { version: 1, entries: 'x' }])('never throws for %j', (raw) => {
    expect(loadHistory(raw).entries).toEqual([]);
  });

  it('says to keep history from a newer app', () => {
    expect(loadHistory({ version: 9, entries: [] }).keepSaved).toBe('newer-version');
  });
});
