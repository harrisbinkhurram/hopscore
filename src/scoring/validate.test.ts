import { describe, expect, it } from 'vitest';
import type { RoundInput } from './types';
import { RoundInputError, validateRound, validateSeats } from './validate';

const good: RoundInput = { seats: ['A', 'B', 'C', 'D'], storyteller: 'A', votes: { B: 'A', C: 'D', D: 'B' } };

describe('validateRound', () => {
  it('accepts a valid round', () => {
    expect(validateRound(good)).toEqual([]);
  });

  // [label, input, expected problems]
  const cases: [string, RoundInput, string[]][] = [
    ['too few players', { seats: ['A', 'B'], storyteller: 'A', votes: { B: 'A' } }, ['A game needs 3 to 6 players, not 2.']],
    [
      'too many players',
      { seats: ['A', 'B', 'C', 'D', 'E', 'F', 'G'], storyteller: 'A', votes: { B: 'A', C: 'A', D: 'A', E: 'A', F: 'A', G: 'A' } },
      ['A game needs 3 to 6 players, not 7.'],
    ],
    ['blank name', { seats: ['A', ' ', 'C'], storyteller: 'A', votes: { ' ': 'A', C: 'A' } }, ['Every player needs a name.']],
    ['seated twice', { seats: ['A', 'B', 'B'], storyteller: 'A', votes: { B: 'A' } }, ['B is seated more than once.']],
    ['storyteller not seated', { ...good, storyteller: 'Z' }, ['The storyteller Z is not in this game.', 'A has not voted yet.']],
    ['storyteller votes', { ...good, votes: { ...good.votes, A: 'B' } }, ['A is the storyteller and does not vote.']],
    ['vote for own card', { ...good, votes: { ...good.votes, C: 'C' } }, ['C cannot vote for their own card.']],
    ['missing vote', { ...good, votes: { B: 'A', C: 'D' } }, ['D has not voted yet.']],
    ['no votes at all', { ...good, votes: {} }, ['B has not voted yet.', 'C has not voted yet.', 'D has not voted yet.']],
    ['voter not seated', { ...good, votes: { ...good.votes, Z: 'A' } }, ['Z is not in this game, so cannot vote.']],
    ['vote for someone not seated', { ...good, votes: { ...good.votes, D: 'Z' } }, ['D voted for Z, who is not in this game.']],
  ];

  it.each(cases)('rejects: %s', (_label, input, expected) => {
    expect(validateRound(input)).toEqual(expected);
  });
});

describe('validateSeats', () => {
  it.each([
    [['A', 'B', 'C']],
    [['A', 'B', 'C', 'D', 'E', 'F']],
  ])('accepts %j', (seats) => {
    expect(validateSeats(seats)).toEqual([]);
  });
});

describe('RoundInputError', () => {
  it('joins the problems into its message', () => {
    const e = new RoundInputError(['One.', 'Two.']);
    expect(e.message).toBe('One. Two.');
    expect(e.name).toBe('RoundInputError');
    expect(e).toBeInstanceOf(Error);
  });
});
