import type { PlayerId, RoundResult, Totals } from './types';

/** Totals of zero for every seated player. */
export function startingTotals(seats: readonly PlayerId[]): Totals {
  return Object.fromEntries(seats.map((p) => [p, 0]));
}

/** New totals with a round's points added. Does not change `totals`. */
export function addRound(totals: Totals, result: RoundResult): Totals {
  const next: Record<PlayerId, number> = { ...totals };
  for (const { player, points } of result.scores) {
    next[player] = (next[player] ?? 0) + points;
  }
  return next;
}

/** The game is over when a bunny reaches the end of the track, or it was ended by hand. */
export function isGameOver(totals: Totals, trackLength: number, endedByHand = false): boolean {
  return endedByHand || Object.values(totals).some((t) => t >= trackLength);
}

/** Every player with the highest total. Ties share the win. Empty for no players. */
export function winners(totals: Totals): PlayerId[] {
  const entries = Object.entries(totals);
  if (entries.length === 0) return [];
  const top = Math.max(...entries.map(([, t]) => t));
  return entries.filter(([, t]) => t === top).map(([p]) => p);
}
