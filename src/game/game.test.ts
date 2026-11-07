import { describe, expect, it } from 'vitest';
import { scoreRound, THREE_PLAYER_RULES } from '../scoring';
import {
  applyRound,
  endGame,
  gameOver,
  newGame,
  scorePending,
  setupProblems,
  standings,
  voteChoices,
  type Game,
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
