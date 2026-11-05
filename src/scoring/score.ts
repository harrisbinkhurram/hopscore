import { rulesFor, type Rules } from './rules';
import type { PlayerRoundScore, RoundInput, RoundResult, ScoreReason, ScoreReasonKind } from './types';
import { RoundInputError, validateRound } from './validate';

function reason(kind: ScoreReasonKind, points: number, label: string): ScoreReason {
  return { kind, points, text: `${label}: +${points}` };
}

/**
 * Scores one round. Throws RoundInputError if the input is impossible.
 * `rules` defaults to the set for the number of players (3 players uses the 3-player rules).
 */
export function scoreRound(input: RoundInput, rules: Rules = rulesFor(input.seats.length)): RoundResult {
  const problems = validateRound(input);
  if (problems.length > 0) throw new RoundInputError(problems);

  const { seats, storyteller, votes } = input;
  const voters = seats.filter((p) => p !== storyteller);
  const finders = voters.filter((p) => votes[p] === storyteller);
  const allFound = finders.length === voters.length;
  const noneFound = finders.length === 0;

  const scores: PlayerRoundScore[] = seats.map((player) => {
    const reasons: ScoreReason[] = [];

    if (player === storyteller) {
      if (allFound) reasons.push(reason('storyteller-all-found', 0, 'everyone found your card'));
      else if (noneFound) reasons.push(reason('storyteller-none-found', 0, 'nobody found your card'));
      else reasons.push(reason('storyteller-some-found', rules.storytellerWhenSomeFound, 'some found your card'));
    } else {
      if (allFound) {
        reasons.push(reason('all-found-storyteller', rules.othersWhenAllOrNoneFound, 'everyone found the storyteller'));
      } else if (noneFound) {
        reasons.push(reason('none-found-storyteller', rules.othersWhenAllOrNoneFound, 'nobody found the storyteller'));
      } else if (votes[player] === storyteller) {
        reasons.push(reason('found-storyteller', rules.finderWhenSomeFound, 'found the storyteller'));
      } else {
        reasons.push(reason('missed-storyteller', 0, 'missed the storyteller'));
      }

      const votesOnCard = voters.filter((v) => votes[v] === player).length;
      if (votesOnCard > 0) {
        const raw = votesOnCard * rules.bonusPerVote;
        const bonus = rules.bonusCap === null ? raw : Math.min(raw, rules.bonusCap);
        const label = `${votesOnCard} ${votesOnCard === 1 ? 'vote' : 'votes'} on your card`;
        reasons.push(reason('votes-on-card', bonus, label));
      }
    }

    const points = reasons.reduce((sum, r) => sum + r.points, 0);
    return { player, points, reasons };
  });

  return { storyteller, scores };
}
