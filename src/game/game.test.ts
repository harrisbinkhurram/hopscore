import { describe, expect, it } from 'vitest';
import { scoreRound, THREE_PLAYER_RULES } from '../scoring';
import {
  applyRound,
  canUndo,
  endGame,
  gameOver,
  newGame,
  nextRedo,
  redoNext,
  restoreGame,
  scorePending,
  setupProblems,
  standings,
  undoLast,
  voteChoices,
  type Game,
  type SavedGameParts,
  type SeatedPlayer,
} from './index';

const seat = (id: string): SeatedPlayer => ({ id, name: id.toUpperCase(), colour: 'sky' });
const FOUR = ['a', 'b', 'c', 'd'].map(seat);

describe('setupProblems', () => {
  // [label, seat ids, track length, expected problems]
  const cases: [string, string[], number, string[]][] = [
    ['2 players', ['a', 'b'], 30, ['A game needs 3 to 6 players, not 2.']],
    ['7 players', ['a', 'b', 'c', 'd', 'e', 'f', 'g'], 30, ['A game needs 3 to 6 players, not 7.']],
    ['the same player twice', ['a', 'b', 'a'], 30, ['a is seated more than once.']],
    ['a track under 10', ['a', 'b', 'c'], 9, ['The track needs 10 to 60 steps.']],
    ['a track over 60', ['a', 'b', 'c'], 61, ['The track needs 10 to 60 steps.']],
    ['a track that is not a whole number', ['a', 'b', 'c'], 12.5, ['The track needs 10 to 60 steps.']],
  ];
  it.each(cases)('rejects %s', (_label, ids, length, expected) => {
    expect(setupProblems(ids, length)).toEqual(expected);
  });

  it.each([10, 30, 60])('accepts 3 to 6 players with a track of %i', (length) => {
    expect(setupProblems(['a', 'b', 'c'], length)).toEqual([]);
    expect(setupProblems(['a', 'b', 'c', 'd', 'e', 'f'], length)).toEqual([]);
  });
});

describe('newGame', () => {
  it('starts with seat 1 telling and every total at 0', () => {
    const game = newGame(FOUR, 30);
    expect(game.storyteller).toBe('a');
    expect(game.totals).toEqual({ a: 0, b: 0, c: 0, d: 0 });
    expect(game.rounds).toEqual([]);
    expect(game.endedByHand).toBe(false);
  });

  it('throws when the setup has problems', () => {
    expect(() => newGame(FOUR.slice(0, 2), 30)).toThrow('A game needs 3 to 6 players, not 2.');
  });
});

describe('voteChoices', () => {
  it('offers everyone but the voter, storyteller included', () => {
    const game = newGame(FOUR, 30);
    expect(voteChoices(game, 'c').map((s) => s.id)).toEqual(['a', 'b', 'd']);
  });
});

describe('applyRound', () => {
  const play = (game: Game, storyteller: string, votes: Record<string, string>) =>
    applyRound(game, scorePending(game, storyteller, votes));

  it('adds the engine\'s points over two rounds', () => {
    let game = newGame(FOUR, 30);
    // Some found a: a 3, b 3 + 1 vote, c 3, d 0.
    game = play(game, 'a', { b: 'a', c: 'a', d: 'b' });
    // Some found b: b 3, a 3 + 1 vote, c 3, d 0.
    game = play(game, 'b', { a: 'b', c: 'b', d: 'a' });
    expect(game.totals).toEqual({ a: 7, b: 7, c: 6, d: 0 });
    expect(game.rounds).toHaveLength(2);
  });

  it('rotates the storyteller in seat order and wraps', () => {
    let game = newGame(FOUR.slice(0, 3), 30);
    const tellers = [game.storyteller];
    for (let i = 0; i < 3; i += 1) {
      const t = game.storyteller;
      const voters = game.seats.map((s) => s.id).filter((id) => id !== t);
      game = play(game, t, Object.fromEntries(voters.map((v) => [v, t])));
      tellers.push(game.storyteller);
    }
    expect(tellers).toEqual(['a', 'b', 'c', 'a']);
  });

  it('follows on from a changed storyteller', () => {
    const game = play(newGame(FOUR, 30), 'c', { a: 'c', b: 'c', d: 'a' });
    expect(game.storyteller).toBe('d');
  });

  it('uses the 3-player rules for 3 players', () => {
    const game = newGame(FOUR.slice(0, 3), 30);
    const votes = { b: 'a', c: 'b' };
    expect(scorePending(game, 'a', votes)).toEqual(
      scoreRound({ seats: ['a', 'b', 'c'], storyteller: 'a', votes }, THREE_PLAYER_RULES),
    );
  });

  it('does not change the game it is given', () => {
    const game = newGame(FOUR, 30);
    play(game, 'a', { b: 'a', c: 'a', d: 'b' });
    expect(game.totals).toEqual({ a: 0, b: 0, c: 0, d: 0 });
    expect(game.rounds).toEqual([]);
    expect(game.storyteller).toBe('a');
  });
});

describe('gameOver', () => {
  const withTotals = (totals: Record<string, number>): Game => ({ ...newGame(FOUR, 10), totals });

  it('is false at the start', () => {
    expect(gameOver(newGame(FOUR, 10))).toBe(false);
  });

  it('is true when a total reaches the track length', () => {
    expect(gameOver(withTotals({ a: 9, b: 10, c: 0, d: 0 }))).toBe(true);
    expect(gameOver(withTotals({ a: 9, b: 9, c: 0, d: 0 }))).toBe(false);
  });

  it('is true after End game', () => {
    expect(gameOver(endGame(newGame(FOUR, 10)))).toBe(true);
  });
});

describe('standings', () => {
  it('ranks by total; tied leaders share rank 1 and both win', () => {
    const game: Game = { ...newGame(FOUR, 30), totals: { a: 4, b: 9, c: 9, d: 2 } };
    expect(standings(game).map((s) => [s.player.id, s.total, s.rank, s.winner])).toEqual([
      ['b', 9, 1, true],
      ['c', 9, 1, true],
      ['a', 4, 3, false],
      ['d', 2, 4, false],
    ]);
  });
});

/** Plays a round where everyone finds the storyteller except the last voter, who picks the first voter. */
function someFind(game: Game, teller = game.storyteller): Game {
  const voters = game.seats.map((s) => s.id).filter((id) => id !== teller);
  const votes: Record<string, string> = Object.fromEntries(voters.map((v) => [v, teller]));
  votes[voters.at(-1)!] = voters[0]!;
  return applyRound(game, scorePending(game, teller, votes));
}

describe('undoLast', () => {
  it('takes off the last round: totals and storyteller go back', () => {
    const one = someFind(newGame(FOUR, 30));
    const two = someFind(one);
    const undone = undoLast(two);
    expect(undone.totals).toEqual(one.totals);
    expect(undone.rounds).toEqual(one.rounds);
    expect(undone.storyteller).toBe('b');
  });

  it('gives the round back to a storyteller changed on the round screen', () => {
    const game = someFind(newGame(FOUR, 30), 'c');
    expect(game.storyteller).toBe('d');
    expect(undoLast(game).storyteller).toBe('c');
  });

  it('can undo again and again, down to no rounds', () => {
    const start = newGame(FOUR, 30);
    const three = someFind(someFind(someFind(start)));
    const back = undoLast(undoLast(undoLast(three)));
    expect(back.rounds).toEqual([]);
    expect(back.totals).toEqual(start.totals);
    expect(back.storyteller).toBe('a');
    expect(canUndo(back)).toBe(false);
  });

  it('does nothing with no rounds', () => {
    const start = newGame(FOUR, 30);
    expect(undoLast(start)).toBe(start);
  });

  it('after End game, only reopens the game', () => {
    const played = someFind(newGame(FOUR, 30));
    const reopened = undoLast(endGame(played));
    expect(gameOver(reopened)).toBe(false);
    expect(reopened.rounds).toEqual(played.rounds);
    expect(reopened.totals).toEqual(played.totals);
  });

  it('after a win at the finish, takes off the winning round', () => {
    let game = newGame(FOUR, 10);
    while (!gameOver(game)) game = someFind(game);
    const reopened = undoLast(game);
    expect(gameOver(reopened)).toBe(false);
    expect(reopened.rounds).toHaveLength(game.rounds.length - 1);
  });

  it('does not change the game it is given', () => {
    const game = someFind(newGame(FOUR, 30));
    undoLast(game);
    expect(game.rounds).toHaveLength(1);
    expect(game.redo).toEqual([]);
  });
});

describe('redoNext', () => {
  it('puts back the undone round, totals and storyteller included', () => {
    const two = someFind(someFind(newGame(FOUR, 30)));
    expect(redoNext(undoLast(two))).toEqual(two);
  });

  it('redoes several steps in the order they were undone', () => {
    const ended = endGame(someFind(someFind(newGame(FOUR, 30))));
    const back = undoLast(undoLast(undoLast(ended)));
    expect(nextRedo(back)).toEqual({ kind: 'round', round: ended.rounds[0] });
    const once = redoNext(back);
    expect(once.rounds).toHaveLength(1);
    const twice = redoNext(once);
    expect(nextRedo(twice)).toEqual({ kind: 'end' });
    expect(redoNext(twice)).toEqual(ended);
  });

  it('does nothing with nothing to redo', () => {
    const game = someFind(newGame(FOUR, 30));
    expect(nextRedo(game)).toBeUndefined();
    expect(redoNext(game)).toBe(game);
  });

  it('is cleared by a new round', () => {
    const undone = undoLast(someFind(someFind(newGame(FOUR, 30))));
    expect(someFind(undone).redo).toEqual([]);
  });

  it('is cleared by End game', () => {
    const undone = undoLast(someFind(someFind(newGame(FOUR, 30))));
    expect(endGame(undone).redo).toEqual([]);
  });
});

describe('restoreGame', () => {
  const played = undoLast(someFind(someFind(newGame(FOUR, 30))));
  const parts = (change: Partial<SavedGameParts> = {}): SavedGameParts => ({
    seats: played.seats,
    trackLength: played.trackLength,
    storyteller: played.storyteller,
    rounds: played.rounds,
    endedByHand: played.endedByHand,
    redo: played.redo,
    ...change,
  });

  it('rebuilds a saved game, working the totals out from the rounds', () => {
    expect(restoreGame(parts())).toEqual(played);
  });

  it('reads a game saved without a Redo list', () => {
    expect(restoreGame(parts({ redo: undefined }))?.redo).toEqual([]);
  });

  const round = played.rounds[0]!;
  const badScore = (change: object) => ({ ...round, scores: round.scores.map((s, i) => (i === 0 ? { ...s, ...change } : s)) });
  // [label, change that breaks a rule]
  const broken: [string, Partial<SavedGameParts>][] = [
    ['too few seats', { seats: FOUR.slice(0, 2) }],
    ['the same seat twice', { seats: [...FOUR.slice(0, 3), FOUR[0]!] }],
    ['a track out of range', { trackLength: 5 }],
    ['a storyteller who is not seated', { storyteller: 'z' }],
    ['a round told by someone not seated', { rounds: [{ ...round, storyteller: 'z' }] }],
    ['a round missing a score', { rounds: [{ ...round, scores: round.scores.slice(1) }] }],
    ['scores out of seat order', { rounds: [{ ...round, scores: [...round.scores].reverse() }] }],
    ['negative points', { rounds: [badScore({ points: -1, reasons: [] })] }],
    ['an unknown reason', { rounds: [badScore({ reasons: [{ kind: 'bribe', points: round.scores[0]!.points, text: '' }] })] }],
    ['reasons that do not add up', { rounds: [badScore({ points: round.scores[0]!.points + 1 })] }],
  ];
  it.each(broken)('returns null for %s', (_label, change) => {
    expect(restoreGame(parts(change))).toBeNull();
  });

  it('returns null for a round played after someone reached the finish', () => {
    let won = newGame(FOUR, 10);
    while (!gameOver(won)) won = someFind(won);
    const extra = scorePending(won, won.storyteller, Object.fromEntries(
      won.seats.filter((s) => s.id !== won.storyteller).map((s) => [s.id, won.storyteller])));
    const base = { seats: won.seats, trackLength: 10, storyteller: won.storyteller, endedByHand: false };
    expect(restoreGame({ ...base, rounds: won.rounds })).not.toBeNull();
    expect(restoreGame({ ...base, rounds: [...won.rounds, extra] })).toBeNull();
  });

  it('drops only the Redo list when a step in it is broken', () => {
    const game = restoreGame(parts({ redo: [{ kind: 'round', round: { ...round, storyteller: 'z' } }] }));
    expect(game?.rounds).toEqual(played.rounds);
    expect(game?.redo).toEqual([]);
  });

  it('drops a Redo list that would end an ended game again', () => {
    expect(restoreGame(parts({ endedByHand: true, redo: [{ kind: 'end' }] }))?.redo).toEqual([]);
  });
});
