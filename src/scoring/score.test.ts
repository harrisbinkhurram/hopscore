import { describe, expect, it } from 'vitest';
import { STANDARD_RULES, THREE_PLAYER_RULES, rulesFor } from './rules';
import { scoreRound } from './score';
import type { RoundInput } from './types';
import { RoundInputError } from './validate';

const SEATS = ['A', 'B', 'C', 'D', 'E', 'F'];

function round(players: number, storyteller: string, votes: Record<string, string>): RoundInput {
  return { seats: SEATS.slice(0, players), storyteller, votes };
}

function pointsOf(input: RoundInput, rules = rulesFor(input.seats.length)): Record<string, number> {
  return Object.fromEntries(scoreRound(input, rules).scores.map((s) => [s.player, s.points]));
}

describe('scoreRound: the scoring table', () => {
  // [label, players, storyteller, votes (voter -> card owner), expected points]
  const cases: [string, number, string, Record<string, string>, Record<string, number>][] = [
    // 3 players (3-player rules)
    ['3p everyone found', 3, 'A', { B: 'A', C: 'A' }, { A: 0, B: 2, C: 2 }],
    ['3p nobody found', 3, 'A', { B: 'C', C: 'B' }, { A: 0, B: 3, C: 3 }],
    ['3p some found', 3, 'A', { B: 'A', C: 'B' }, { A: 3, B: 4, C: 0 }],
    // 4 players
    ['4p everyone found', 4, 'A', { B: 'A', C: 'A', D: 'A' }, { A: 0, B: 2, C: 2, D: 2 }],
    ['4p nobody found, votes spread', 4, 'A', { B: 'C', C: 'D', D: 'B' }, { A: 0, B: 3, C: 3, D: 3 }],
    ['4p nobody found, votes stacked', 4, 'A', { B: 'C', C: 'B', D: 'C' }, { A: 0, B: 3, C: 4, D: 2 }],
    ['4p some found, finder gets a vote', 4, 'A', { B: 'A', C: 'A', D: 'B' }, { A: 3, B: 4, C: 3, D: 0 }],
    ['4p some found, missers get votes', 4, 'A', { B: 'A', C: 'D', D: 'C' }, { A: 3, B: 3, C: 1, D: 1 }],
    ['4p storyteller not in seat 1', 4, 'C', { A: 'C', B: 'D', D: 'B' }, { A: 3, B: 1, C: 3, D: 1 }],
    // 5 players
    ['5p everyone found', 5, 'A', { B: 'A', C: 'A', D: 'A', E: 'A' }, { A: 0, B: 2, C: 2, D: 2, E: 2 }],
    ['5p nobody found', 5, 'A', { B: 'C', C: 'B', D: 'B', E: 'B' }, { A: 0, B: 5, C: 3, D: 2, E: 2 }],
    ['5p some found', 5, 'A', { B: 'A', C: 'A', D: 'B', E: 'B' }, { A: 3, B: 5, C: 3, D: 0, E: 0 }],
    // 6 players
    ['6p everyone found', 6, 'F', { A: 'F', B: 'F', C: 'F', D: 'F', E: 'F' }, { A: 2, B: 2, C: 2, D: 2, E: 2, F: 0 }],
    ['6p nobody found', 6, 'A', { B: 'C', C: 'D', D: 'C', E: 'C', F: 'B' }, { A: 0, B: 3, C: 5, D: 3, E: 2, F: 2 }],
    ['6p some found, one finder', 6, 'A', { B: 'A', C: 'B', D: 'B', E: 'B', F: 'B' }, { A: 3, B: 7, C: 0, D: 0, E: 0, F: 0 }],
    ['6p some found, all but one', 6, 'A', { B: 'A', C: 'A', D: 'A', E: 'A', F: 'E' }, { A: 3, B: 3, C: 3, D: 3, E: 4, F: 0 }],
  ];

  it.each(cases)('%s', (_label, players, storyteller, votes, expected) => {
    expect(pointsOf(round(players, storyteller, votes))).toEqual(expected);
  });
});

describe('scoreRound: reasons', () => {
  it('explains each line with its points', () => {
    const result = scoreRound(round(5, 'A', { B: 'A', C: 'A', D: 'B', E: 'B' }));
    const texts = Object.fromEntries(result.scores.map((s) => [s.player, s.reasons.map((r) => r.text)]));
    expect(texts).toEqual({
      A: ['some found your card: +3'],
      B: ['found the storyteller: +3', '2 votes on your card: +2'],
      C: ['found the storyteller: +3'],
      D: ['missed the storyteller: +0'],
      E: ['missed the storyteller: +0'],
    });
  });

  it.each([
    ['everyone found', { B: 'A', C: 'A', D: 'A' }, 'everyone found your card: +0', 'everyone found the storyteller: +2'],
    ['nobody found', { B: 'C', C: 'B', D: 'B' }, 'nobody found your card: +0', 'nobody found the storyteller: +2'],
  ])('%s', (_label, votes, storytellerText, otherText) => {
    const [a, , , d] = scoreRound(round(4, 'A', votes)).scores;
    expect(a!.reasons.map((r) => r.text)).toEqual([storytellerText]);
    expect(d!.reasons[0]!.text).toBe(otherText);
  });

  it('uses the singular for one vote', () => {
    const [, b] = scoreRound(round(4, 'A', { B: 'A', C: 'B', D: 'A' })).scores;
    expect(b!.reasons.map((r) => r.text)).toEqual(['found the storyteller: +3', '1 vote on your card: +1']);
    expect(b!.reasons.map((r) => r.kind)).toEqual(['found-storyteller', 'votes-on-card']);
  });

  it('points always equal the sum of the reasons', () => {
    for (const s of scoreRound(round(6, 'A', { B: 'C', C: 'D', D: 'C', E: 'C', F: 'B' })).scores) {
      expect(s.points).toBe(s.reasons.reduce((sum, r) => sum + r.points, 0));
    }
  });

  it('lists scores in seat order and names the storyteller', () => {
    const result = scoreRound(round(4, 'C', { A: 'C', B: 'D', D: 'B' }));
    expect(result.storyteller).toBe('C');
    expect(result.scores.map((s) => s.player)).toEqual(['A', 'B', 'C', 'D']);
  });
});

describe('scoreRound: the bonus', () => {
  it('never gives the storyteller bonus points', () => {
    const [a] = scoreRound(round(4, 'A', { B: 'A', C: 'A', D: 'A' })).scores;
    expect(a!.reasons.some((r) => r.kind === 'votes-on-card')).toBe(false);
  });

  it('applies a bonus cap when the rules set one', () => {
    const capped = { ...STANDARD_RULES, bonusCap: 1 };
    // C found the storyteller (+3) and got 2 votes, capped to +1.
    const points = pointsOf(round(4, 'A', { B: 'C', C: 'A', D: 'C' }), capped);
    expect(points).toEqual({ A: 3, B: 0, C: 4, D: 0 });
  });
});

describe('rulesFor', () => {
  it.each([
    [3, THREE_PLAYER_RULES],
    [4, STANDARD_RULES],
    [5, STANDARD_RULES],
    [6, STANDARD_RULES],
  ])('%i players', (players, rules) => {
    expect(rulesFor(players)).toBe(rules);
  });

  it('3-player rules put in 2 cards per non-storyteller and score by the same table', () => {
    expect(THREE_PLAYER_RULES.cardsPerNonStoryteller).toBe(2);
    expect(THREE_PLAYER_RULES.storytellerWhenSomeFound).toBe(STANDARD_RULES.storytellerWhenSomeFound);
    expect(THREE_PLAYER_RULES.finderWhenSomeFound).toBe(STANDARD_RULES.finderWhenSomeFound);
    expect(THREE_PLAYER_RULES.othersWhenAllOrNoneFound).toBe(STANDARD_RULES.othersWhenAllOrNoneFound);
    expect(THREE_PLAYER_RULES.bonusPerVote).toBe(STANDARD_RULES.bonusPerVote);
  });
});

describe('scoreRound: bad input', () => {
  it('throws RoundInputError listing every problem', () => {
    const bad = round(4, 'A', { B: 'B' });
    expect(() => scoreRound(bad)).toThrow(RoundInputError);
    try {
      scoreRound(bad);
    } catch (e) {
      expect((e as RoundInputError).problems).toEqual([
        'B cannot vote for their own card.',
        'C has not voted yet.',
        'D has not voted yet.',
      ]);
    }
  });
});
