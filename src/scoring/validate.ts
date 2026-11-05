import { MAX_PLAYERS, MIN_PLAYERS } from './rules';
import type { RoundInput } from './types';

/** Thrown when a round cannot happen as entered. `problems` lists every reason. */
export class RoundInputError extends Error {
  readonly problems: readonly string[];

  constructor(problems: readonly string[]) {
    super(problems.join(' '));
    this.name = 'RoundInputError';
    this.problems = problems;
  }
}

/** Checks the seat list alone. Returns plain-English problems; empty means fine. */
export function validateSeats(seats: readonly string[]): string[] {
  const problems: string[] = [];
  if (seats.length < MIN_PLAYERS || seats.length > MAX_PLAYERS) {
    problems.push(`A game needs ${MIN_PLAYERS} to ${MAX_PLAYERS} players, not ${seats.length}.`);
  }
  if (seats.some((p) => p.trim() === '')) {
    problems.push('Every player needs a name.');
  }
  const seen = new Set<string>();
  for (const p of seats) {
    if (seen.has(p)) problems.push(`${p} is seated more than once.`);
    seen.add(p);
  }
  return problems;
}

/** Checks a round. Returns plain-English problems; empty means the round can be scored. */
export function validateRound(input: RoundInput): string[] {
  const { seats, storyteller, votes } = input;
  const problems = validateSeats(seats);
  const seated = new Set(seats);

  if (!seated.has(storyteller)) {
    problems.push(`The storyteller ${storyteller} is not in this game.`);
  }

  for (const [voter, cardOwner] of Object.entries(votes)) {
    if (!seated.has(voter)) {
      problems.push(`${voter} is not in this game, so cannot vote.`);
    } else if (voter === storyteller) {
      problems.push(`${voter} is the storyteller and does not vote.`);
    } else if (!seated.has(cardOwner)) {
      problems.push(`${voter} voted for ${cardOwner}, who is not in this game.`);
    } else if (voter === cardOwner) {
      problems.push(`${voter} cannot vote for their own card.`);
    }
  }

  for (const p of seats) {
    if (p !== storyteller && !Object.hasOwn(votes, p)) {
      problems.push(`${p} has not voted yet.`);
    }
  }

  return problems;
}
