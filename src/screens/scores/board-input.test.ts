import { describe, expect, it } from 'vitest';
import { applyRound, endGame, newGame, scorePending, undoLast, type Game, type SeatedPlayer } from '../../game';
import { boardPlayers, finalePlay, roundPlay, undoPlay, winnerIds } from './board-input';

const SEATS: SeatedPlayer[] = [
  { id: 'a', name: 'Ada', colour: 'berry' },
  { id: 'b', name: 'Bo', colour: 'sky' },
  { id: 'c', name: 'Cy', colour: 'snow' },
  { id: 'd', name: 'Di', colour: 'clover' },
];

/** a tells; b and c find the card, d votes for b. a +3, b +3 (+1 bonus), c +3, d 0. */
function oneRound(game: Game): Game {
  return applyRound(game, scorePending(game, game.storyteller, { b: 'a', c: 'a', d: 'b' }));
}

describe('boardPlayers', () => {
  it('maps seats to board players with their colour and total, in seat order', () => {
    const game = oneRound(newGame(SEATS, 30));
    expect(boardPlayers(game)).toEqual([
      { id: 'a', name: 'Ada', color: '#d6406d', score: 3 },
      { id: 'b', name: 'Bo', color: '#3d8fe0', score: 4 },
      { id: 'c', name: 'Cy', color: '#f1ede6', score: 3 },
      { id: 'd', name: 'Di', color: '#4caf6a', score: 0 },
    ]);
  });
});

describe('roundPlay', () => {
  it('is null before the first round', () => {
    expect(roundPlay(newGame(SEATS, 30))).toBeNull();
  });

  it('starts from the totals before the last round and gains its points', () => {
    const first = oneRound(newGame(SEATS, 30));
    const second = applyRound(first, scorePending(first, first.storyteller, { a: 'c', c: 'd', d: 'b' }));
    const play = roundPlay(second)!;
    expect(play.before.map((p) => p.score)).toEqual(boardPlayers(first).map((p) => p.score));
    expect(play.round.storyteller).toBe('b');
    for (const p of play.round.players) {
      const before = play.before.find((b) => b.id === p.id)!.score;
      expect(p.score).toBe(before + (play.round.gains[p.id] ?? 0));
    }
    expect(play.round.winners).toEqual([]);
  });

  it('names the winner when the round reaches the end of the track', () => {
    let game = newGame(SEATS, 10);
    while (!winnerIds(game).length) game = oneRound({ ...game, storyteller: 'a' });
    const play = roundPlay(game)!;
    expect(play.round.winners).toEqual(winnerIds(game));
    expect(play.round.winners.length).toBeGreaterThan(0);
  });
});

describe('winnerIds', () => {
  it('is empty while the game goes on', () => {
    expect(winnerIds(oneRound(newGame(SEATS, 30)))).toEqual([]);
  });

  it('names the leader after End game', () => {
    expect(winnerIds(endGame(oneRound(newGame(SEATS, 30))))).toEqual(['b']);
  });
});

describe('finalePlay', () => {
  it('moves nobody and names the winners', () => {
    const game = endGame(oneRound(newGame(SEATS, 30)));
    expect(finalePlay(game)).toEqual({ players: boardPlayers(game), gains: {}, storyteller: '', winners: ['b'] });
  });
});

describe('undoPlay', () => {
  it('starts from the totals before Undo and hops back by the undone points', () => {
    const one = oneRound(newGame(SEATS, 30));
    // a tells again, with the same votes.
    const two = applyRound(one, scorePending(one, 'a', { b: 'a', c: 'a', d: 'b' }));
    const undone = undoLast(two);
    const play = undoPlay(two, undone)!;
    expect(play.before.map((p) => p.score)).toEqual([two.totals.a, two.totals.b, two.totals.c, two.totals.d]);
    expect(play.round.players).toEqual(boardPlayers(undone));
    expect(play.round.gains).toEqual({ a: -3, b: -4, c: -3, d: 0 });
    expect(play.round.storyteller).toBe('');
    expect(play.round.winners).toEqual([]);
  });

  it('is null when nobody moves (Undo of End game)', () => {
    const ended = endGame(oneRound(newGame(SEATS, 30)));
    expect(undoPlay(ended, undoLast(ended))).toBeNull();
  });
});
