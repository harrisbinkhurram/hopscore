import {
  addRound,
  SCORE_REASON_KINDS,
  isGameOver,
  nextStoryteller,
  scoreRound,
  startingTotals,
  validateSeats,
  winners,
  type PlayerId,
  type RoundResult,
  type ScoreReasonKind,
  type Totals,
} from '../scoring';
import {
  TRACK_LENGTH,
  type Game,
  type SavedGameParts,
  type SavedRoundParts,
  type SeatedPlayer,
  type Standing,
  type UndoneStep,
} from './types';

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
    redo: [],
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

/** Adds a confirmed round. The next storyteller follows on from whoever told this one. A new round clears Redo. */
export function applyRound(game: Game, result: RoundResult): Game {
  return { ...addConfirmed(game, result), redo: [] };
}

function addConfirmed(game: Game, result: RoundResult): Game {
  return {
    ...game,
    storyteller: nextStoryteller(seatIds(game), result.storyteller),
    rounds: [...game.rounds, result],
    totals: addRound(game.totals, result),
  };
}

/** True when there is something to undo: a round, or End game. */
export function canUndo(game: Game): boolean {
  return game.endedByHand || game.rounds.length > 0;
}

/** The step Redo would put back, if any. */
export function nextRedo(game: Game): UndoneStep | undefined {
  return game.redo.at(-1);
}

/**
 * Takes back the last step and keeps it for Redo. After End game that is End game itself;
 * otherwise the last round goes, its points come off, and whoever told it is the storyteller
 * again. Nothing to undo returns the game as it is.
 */
export function undoLast(game: Game): Game {
  if (game.endedByHand) return { ...game, endedByHand: false, redo: [...game.redo, { kind: 'end' }] };
  const last = game.rounds.at(-1);
  if (!last) return game;
  const rounds = game.rounds.slice(0, -1);
  return {
    ...game,
    storyteller: last.storyteller,
    rounds,
    totals: totalsOf(seatIds(game), rounds),
    redo: [...game.redo, { kind: 'round', round: last }],
  };
}

/** Puts back the step undone last, keeping the rest of the Redo list. Nothing to redo returns the game as it is. */
export function redoNext(game: Game): Game {
  const step = nextRedo(game);
  if (!step) return game;
  const redo = game.redo.slice(0, -1);
  if (step.kind === 'end') return { ...game, endedByHand: true, redo };
  return { ...addConfirmed(game, step.round), redo };
}

/**
 * Rebuilds a saved game, or null when it breaks a rule: bad seats or track, a storyteller who
 * is not seated, a round without one score per seat in seat order, or reasons that are unknown
 * or do not add up. Totals are always worked out again from the rounds.
 */
export function restoreGame(saved: SavedGameParts): Game | null {
  const ids = saved.seats.map((s) => s.id);
  if (setupProblems(ids, saved.trackLength).length > 0) return null;
  if (!ids.includes(saved.storyteller)) return null;
  const rounds: RoundResult[] = [];
  for (const round of saved.rounds) {
    if (!validRound(round, ids)) return null;
    rounds.push(round);
  }
  return {
    seats: [...saved.seats],
    trackLength: saved.trackLength,
    storyteller: saved.storyteller,
    rounds,
    totals: totalsOf(ids, rounds),
    endedByHand: saved.endedByHand,
    redo: restoreRedo(saved, ids),
  };
}

/** The saved Redo list, or none at all if any step in it is broken or could not be redone. */
function restoreRedo(saved: SavedGameParts, ids: readonly PlayerId[]): UndoneStep[] {
  const out: UndoneStep[] = [];
  for (const step of saved.redo ?? []) {
    if (step.kind === 'end') out.push({ kind: 'end' });
    else if (validRound(step.round, ids)) out.push({ kind: 'round', round: step.round });
    else return [];
  }
  // End game can only be redone onto a game that is not ended.
  if (saved.endedByHand && out.length > 0) return [];
  return out;
}

function validRound(round: SavedRoundParts, ids: readonly PlayerId[]): round is RoundResult {
  if (!ids.includes(round.storyteller)) return false;
  if (round.scores.length !== ids.length || round.scores.some((s, i) => s.player !== ids[i])) return false;
  return round.scores.every((score) =>
    Number.isInteger(score.points) &&
    score.points >= 0 &&
    score.reasons.every((r) => isReasonKind(r.kind)) &&
    score.reasons.reduce((sum, r) => sum + r.points, 0) === score.points);
}

function totalsOf(ids: readonly PlayerId[], rounds: readonly RoundResult[]): Totals {
  return rounds.reduce(addRound, startingTotals(ids));
}

function isReasonKind(kind: string): kind is ScoreReasonKind {
  return (SCORE_REASON_KINDS as readonly string[]).includes(kind);
}

/** Ends the game by hand. A new move, so it clears Redo. */
export function endGame(game: Game): Game {
  return { ...game, endedByHand: true, redo: [] };
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
