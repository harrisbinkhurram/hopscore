// Types only from the board: Three.js must stay out of the first load.
import type { BoardPlayer } from '../../board/layout';
import type { RoundPlay } from '../../board/choreography';
import { gameOver, standings, type Game } from '../../game';
import type { Totals } from '../../scoring';
import { bunnyColour } from '../../storage/colours';

/** What the scores screen plays on the board when it opens. */
export type PlayMode = 'round' | 'finale' | 'none';

/** The game's players as the board shows them, in seat order. */
export function boardPlayers(game: Game, totals: Totals = game.totals): BoardPlayer[] {
  return game.seats.map((s) => ({
    id: s.id,
    name: s.name,
    color: bunnyColour(s.colour).hex,
    score: totals[s.id] ?? 0,
  }));
}

/** Who won, or nobody while the game goes on. */
export function winnerIds(game: Game): string[] {
  if (!gameOver(game)) return [];
  return standings(game).filter((r) => r.winner).map((r) => r.player.id);
}

/**
 * The last round as the board plays it: where everyone was before it, and the round itself.
 * Null when no round has been played.
 */
export function roundPlay(game: Game): { before: BoardPlayer[]; round: RoundPlay } | null {
  const last = game.rounds.at(-1);
  if (!last) return null;
  const gains: Record<string, number> = {};
  for (const s of last.scores) gains[s.player] = s.points;
  const before: Record<string, number> = {};
  for (const seat of game.seats) before[seat.id] = (game.totals[seat.id] ?? 0) - (gains[seat.id] ?? 0);
  return {
    before: boardPlayers(game, before),
    round: { players: boardPlayers(game), gains, storyteller: last.storyteller, winners: winnerIds(game) },
  };
}

/** Only the finale, for a game just ended with End game: nobody moves. */
export function finalePlay(game: Game): RoundPlay {
  return { players: boardPlayers(game), gains: {}, storyteller: '', winners: winnerIds(game) };
}
