import { describe, expect, it } from 'vitest';
import { addRound, isGameOver, startingTotals, winners } from './game';
import { scoreRound } from './score';
import type { Totals } from './types';

describe('totals', () => {
  it('start at zero for every player', () => {
    expect(startingTotals(['A', 'B', 'C'])).toEqual({ A: 0, B: 0, C: 0 });
  });

  it('add up round after round without changing the old totals', () => {
    const seats = ['A', 'B', 'C', 'D'];
    const start = startingTotals(seats);
    const after1 = addRound(start, scoreRound({ seats, storyteller: 'A', votes: { B: 'A', C: 'A', D: 'B' } }));
    const after2 = addRound(after1, scoreRound({ seats, storyteller: 'B', votes: { A: 'C', C: 'D', D: 'A' } }));
    expect(start).toEqual({ A: 0, B: 0, C: 0, D: 0 });
    expect(after1).toEqual({ A: 3, B: 4, C: 3, D: 0 });
    expect(after2).toEqual({ A: 6, B: 4, C: 6, D: 3 });
  });
});

describe('isGameOver', () => {
  // [label, totals, trackLength, endedByHand, expected]
  const cases: [string, Totals, number, boolean, boolean][] = [
    ['nobody at the end', { A: 29, B: 10 }, 30, false, false],
    ['exactly at the end', { A: 30, B: 10 }, 30, false, true],
    ['past the end', { A: 33, B: 10 }, 30, false, true],
    ['ended by hand', { A: 5, B: 10 }, 30, true, true],
    ['short track', { A: 10, B: 2 }, 10, false, true],
  ];

  it.each(cases)('%s', (_label, totals, trackLength, endedByHand, expected) => {
    expect(isGameOver(totals, trackLength, endedByHand)).toBe(expected);
  });

  it('is not over by default when nobody has reached the end', () => {
    expect(isGameOver({ A: 1 }, 30)).toBe(false);
  });
});

describe('winners', () => {
  // [label, totals, expected winners]
  const cases: [string, Totals, string[]][] = [
    ['one clear winner', { A: 31, B: 20, C: 25 }, ['A']],
    ['two-way tie', { A: 28, B: 28, C: 25 }, ['A', 'B']],
    ['everyone ties', { A: 12, B: 12, C: 12 }, ['A', 'B', 'C']],
    ['all at zero', { A: 0, B: 0, C: 0, D: 0 }, ['A', 'B', 'C', 'D']],
    ['no players', {}, []],
  ];

  it.each(cases)('%s', (_label, totals, expected) => {
    expect(winners(totals)).toEqual(expected);
  });
});
