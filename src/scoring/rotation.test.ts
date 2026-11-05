import { describe, expect, it } from 'vitest';
import { nextStoryteller } from './rotation';

describe('nextStoryteller', () => {
  const seats = ['Ana', 'Ben', 'Cy', 'Dee'];

  it.each([
    ['Ana', 'Ben'],
    ['Ben', 'Cy'],
    ['Cy', 'Dee'],
    ['Dee', 'Ana'],
  ])('after %s comes %s', (current, next) => {
    expect(nextStoryteller(seats, current)).toBe(next);
  });

  it('goes all the way round the table', () => {
    let s = 'Ana';
    const order: string[] = [];
    for (let i = 0; i < 5; i++) {
      s = nextStoryteller(seats, s);
      order.push(s);
    }
    expect(order).toEqual(['Ben', 'Cy', 'Dee', 'Ana', 'Ben']);
  });

  it('rejects a storyteller who is not seated', () => {
    expect(() => nextStoryteller(seats, 'Zed')).toThrow('The storyteller Zed is not in this game.');
  });
});
