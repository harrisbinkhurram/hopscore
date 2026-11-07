import {
  addRound,
  isGameOver,
  nextStoryteller,
  scoreRound,
  startingTotals,
  validateSeats,
  winners,
  type PlayerId,
  type RoundResult,
} from '../scoring';
import { TRACK_LENGTH, type Game, type SeatedPlayer, type Standing } from './types';

/** Plain-English reasons a game cannot start; empty means it can. */
export function setupProblems(seatIds: readonly PlayerId[], trackLength: number): string[] {
  const problems = validateSeats(seatIds);
  if (!Number.isInteger(trackLength) || trackLength < TRACK_LENGTH.min || trackLength > TRACK_LENGTH.max) {
    problems.push(`The track needs ${TRACK_LENGTH.min} to ${TRACK_LENGTH.max} steps.`);
  }
  return problems;
}

/** Starts a game. Seat 1 tells the first story. Throws if `setupProblems` finds anything. */
export function newGame(seats: readonly SeatedPlayer[], trackLength: number): Game {
  const ids = seats.map((s) => s.id);
  const problems = setupProblems(ids, trackLength);
  if (problems.length > 0) throw new Error(problems.join(' '));
  return {
    seats: [...seats],
    trackLength,
    storyteller: ids[0]!,
    rounds: [],
    totals: startingTotals(ids),
    endedByHand: false,
  };
}

export function seatIds(game: Game): PlayerId[] {
  return game.seats.map((s) => s.id);
}

/** The players `voter` may say they voted for: everyone but themselves. */
export function voteChoices(game: Game, voter: PlayerId): SeatedPlayer[] {
  return game.seats.filter((s) => s.id !== voter);
}

/** Scores a round without changing the game, for the review screen. Throws `RoundInputError` on impossible votes. */
export function scorePending(game: Game, storyteller: PlayerId, votes: Readonly<Record<PlayerId, PlayerId>>): RoundResult {
  return scoreRound({ seats: seatIds(game), storyteller, votes });
}

/** Adds a confirmed round. The next storyteller follows on from whoever told this one. */
export function applyRound(game: Game, result: RoundResult): Game {
  return {
    ...game,
    storyteller: nextStoryteller(seatIds(game), result.storyteller),
    rounds: [...game.rounds, result],
    totals: addRound(game.totals, result),
  };
}

export function endGame(game: Game): Game {
  return { ...game, endedByHand: true };
}

/** Over when a total reaches the track length, or after End game. */
export function gameOver(game: Game): boolean {
  return isGameOver(game.totals, game.trackLength, game.endedByHand);
}

/** Highest total first; ties keep seat order and share a rank. */
export function standings(game: Game): Standing[] {
  const top = new Set(winners(game.totals));
  const rows = game.seats
    .map((player) => ({ player, total: game.totals[player.id] ?? 0 }))
    .sort((a, b) => b.total - a.total);
  return rows.map((row) => ({
    ...row,
    rank: 1 + rows.filter((other) => other.total > row.total).length,
    winner: top.has(row.player.id),
  }));
}
