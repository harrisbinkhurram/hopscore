import { describe, expect, it } from 'vitest';
import { parseDebugParams, randomScores } from './debug-params';

describe('parseDebugParams', () => {
  it('defaults to 4 players on a 30-step track', () => {
    const setup = parseDebugParams('?board');
    expect(setup.trackLength).toBe(30);
    expect(setup.players).toHaveLength(4);
    expect(new Set(setup.players.map((p) => p.color)).size).toBe(4);
  });

  it('reads players, length and scores', () => {
    const setup = parseDebugParams('?board&players=6&length=40&scores=0,41,20,20');
    expect(setup.trackLength).toBe(40);
    expect(setup.players.map((p) => p.score)).toEqual([0, 41, 20, 20, 14, 22]);
  });

  it('takes the player count from the scores when players is missing', () => {
    expect(parseDebugParams('?board&scores=1,2').players).toHaveLength(2);
  });

  it('ignores junk and caps values', () => {
    const setup = parseDebugParams('?board&players=99&length=abc&scores=x,5');
    expect(setup.players).toHaveLength(6);
    expect(setup.trackLength).toBe(30);
    expect(setup.players[0].score).toBe(5);
  });
});

describe('randomScores', () => {
  it('stays between 0 and a little past the finish', () => {
    let s = 0;
    const scores = randomScores(50, 30, () => ((s += 0.37) % 1));
    expect(Math.min(...scores)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...scores)).toBeLessThanOrEqual(32);
  });
});
