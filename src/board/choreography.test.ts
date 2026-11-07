import { describe, expect, it } from 'vitest';
import { BIG_ROUND, foldStones, planRound, type RoundPlay } from './choreography';
import { stoneForScore, type BoardPlayer } from './layout';

const LENGTH = 30;

function players(scores: number[]): BoardPlayer[] {
  return scores.map((score, i) => ({ id: `p${i}`, name: `P${i}`, color: '#ffffff', score }));
}

/** A round from before-scores and gains, in seat order. */
function round(before: number[], gains: number[], storyteller = 'p0', winners: string[] = []): RoundPlay {
  return {
    players: players(before.map((s, i) => s + gains[i])),
    gains: Object.fromEntries(gains.map((g, i) => [`p${i}`, g])),
    storyteller,
    winners,
  };
}

describe('planRound', () => {
  it('plays the smallest gain first, ties in seat order', () => {
    const beats = planRound(players([0, 0, 0, 0]), round([0, 0, 0, 0], [3, 1, 3, 2]), LENGTH);
    expect(beats.map((b) => (b.kind === 'hop' ? b.id : b.kind))).toEqual(['p1', 'p3', 'p0', 'p2']);
  });

  it('hops onto every stone between the old and new score', () => {
    const beats = planRound(players([4, 0, 0]), round([4, 0, 0], [3, 0, 0], 'p1'), LENGTH);
    expect(beats).toContainEqual({ kind: 'hop', id: 'p0', stones: [5, 6, 7], big: false });
  });

  it('gives no beat to a player who scored 0 and did not tell the story', () => {
    const beats = planRound(players([0, 0, 0]), round([0, 0, 0], [3, 0, 3], 'p0'), LENGTH);
    expect(beats.some((b) => 'id' in b && b.id === 'p1')).toBe(false);
  });

  it('droops the storyteller on 0, before anyone hops', () => {
    const beats = planRound(players([0, 0, 0]), round([0, 0, 0], [0, 2, 2], 'p0'), LENGTH);
    expect(beats[0]).toEqual({ kind: 'droop', id: 'p0' });
    expect(beats).toHaveLength(3);
  });

  // [gain, big]
  const bigCases: [number, boolean][] = [[BIG_ROUND - 1, false], [BIG_ROUND, true], [BIG_ROUND + 2, true]];
  it.each(bigCases)('a gain of %i is big: %s', (gain, big) => {
    const beats = planRound(players([0, 0, 0]), round([0, 0, 0], [gain, 0, 0], 'p0'), LENGTH);
    expect(beats[0]).toMatchObject({ kind: 'hop', big });
  });

  it('stops at the finish when the score goes past it', () => {
    const beats = planRound(players([27, 0, 0]), round([27, 0, 0], [6, 0, 0], 'p0'), LENGTH);
    expect(beats[0]).toEqual({ kind: 'hop', id: 'p0', stones: [28, 29, 30], big: true });
  });

  it('cheers a big gain that has no stone left to hop to', () => {
    const beats = planRound(players([31, 0, 0]), round([31, 0, 0], [5, 0, 0], 'p0'), LENGTH);
    expect(beats).toEqual([{ kind: 'cheer', id: 'p0' }]);
  });

  it('adds no beat for a small gain already at the finish', () => {
    expect(planRound(players([30, 0, 0]), round([30, 0, 0], [2, 0, 0], 'p0'), LENGTH)).toEqual([]);
  });

  it('ends with the finale when there are winners', () => {
    const beats = planRound(players([28, 3, 5]), round([28, 3, 5], [3, 1, 0], 'p2', ['p0']), LENGTH);
    expect(beats.at(-1)).toEqual({ kind: 'finale', winners: ['p0'], others: ['p1', 'p2'] });
  });

  it('has no finale without winners', () => {
    const beats = planRound(players([0, 0, 0]), round([0, 0, 0], [3, 1, 0]), LENGTH);
    expect(beats.some((b) => b.kind === 'finale')).toBe(false);
  });

  it('plays only the finale after End game', () => {
    const now = players([12, 9, 12]);
    const beats = planRound(now, { players: now, gains: {}, storyteller: '', winners: ['p0', 'p2'] }, LENGTH);
    expect(beats).toEqual([{ kind: 'finale', winners: ['p0', 'p2'], others: ['p1'] }]);
  });
});

describe('foldStones', () => {
  // [label, before scores, gains]
  const cases: [string, number[], number[]][] = [
    ['plain gains', [0, 4, 10, 2], [3, 0, 5, 1]],
    ['past the finish', [27, 29, 0], [6, 2, 3]],
    ['already at the finish', [30, 31, 5], [5, 2, 0]],
    ['eight players', [0, 1, 2, 3, 4, 5, 6, 7], [7, 6, 5, 4, 3, 2, 1, 0]],
  ];
  it.each(cases)('ends every bunny on its new score: %s', (_label, before, gains) => {
    const start = new Map(before.map((s, i) => [`p${i}`, stoneForScore(s, LENGTH)]));
    const r = round(before, gains, 'p0');
    const end = foldStones(start, planRound(players(before), r, LENGTH));
    expect(Object.fromEntries(end)).toEqual(
      Object.fromEntries(r.players.map((p) => [p.id, stoneForScore(p.score, LENGTH)])),
    );
  });
});
