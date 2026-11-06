import type { PlayerId } from './types';

/** Who tells the story after `current`, going round the table in seat order. */
export function nextStoryteller(seats: readonly PlayerId[], current: PlayerId): PlayerId {
  const i = seats.indexOf(current);
  if (i === -1) throw new Error(`The storyteller ${current} is not in this game.`);
  return seats[(i + 1) % seats.length]!;
}
