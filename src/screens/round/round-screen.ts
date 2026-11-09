import { button, h, swatch } from '../dom';
import './round.css';
import { applyRound, scorePending, voteChoices, type Game, type RoundDraft, type SeatedPlayer } from '../../game';
import type { PlayerId } from '../../scoring';

export interface RoundScreenOptions {
  /** Where to start; defaults to the game's storyteller and no votes. */
  draft?: RoundDraft;
  /** The round was confirmed: `game` has it added. */
  onConfirm: (game: Game) => void;
  /** Home was tapped: `draft` is what had been entered. */
  onHome: (draft: RoundDraft) => void;
  /** A vote or the storyteller changed: `draft` is what is entered now, to save as it is tapped. */
  onDraftChange?: (draft: RoundDraft) => void;
}

/**
 * Entering one round: storyteller, each vote, then a review of the points before Confirm.
 * Returns a no-op unsubscribe, like the other screens: this one reads no store.
 */
export function showRoundScreen(root: HTMLElement, game: Game, options: RoundScreenOptions) {
  let storyteller: PlayerId = options.draft?.storyteller ?? game.storyteller;
  let votes: Record<PlayerId, PlayerId> = { ...options.draft?.votes };
  let step: 'entry' | 'review' = 'entry';
  let changingTeller = false;
  /** The step on screen now, so a step change can scroll to the top. */
  let shownStep: 'entry' | 'review' | null = null;
  let focusKey: string | null = null;

  const roundNumber = game.rounds.length + 1;
  const byId = new Map(game.seats.map((s) => [s.id, s]));
  const name = (id: PlayerId) => byId.get(id)?.name ?? '';
  const voters = () => game.seats.filter((s) => s.id !== storyteller);
  const allVoted = () => voters().every((s) => Object.hasOwn(votes, s.id));

  const update = (change: () => void) => {
    change();
    render();
  };

  function render() {
    root.classList.add('screen-root');
    const screen = h('div', { className: 'screen round-screen' },
      h('header', { className: 'screen-header' }, button('Home', 'btn btn-ghost', () => options.onHome({ storyteller, votes })),
        h('h1', { textContent: step === 'entry' ? `Round ${roundNumber}` : `Round ${roundNumber}: points` })));
    if (step === 'entry') screen.append(tellerSection(), ...voteSections(), reviewButton());
    else screen.append(...reviewSections());

    const active = document.activeElement;
    const keep = focusKey ?? (active instanceof HTMLElement && root.contains(active) ? active.dataset.focus : null);
    focusKey = null;
    // Swapping the whole screen briefly empties the page: keep the scroll, unless the step changed.
    const scrollY = step === shownStep ? window.scrollY : 0;
    shownStep = step;
    root.replaceChildren(screen);
    window.scrollTo(0, scrollY);
    if (keep) {
      [...screen.querySelectorAll<HTMLElement>('[data-focus]')].find((e) => e.dataset.focus === keep)
        ?.focus({ preventScroll: true });
    }
  }

  function tellerSection() {
    const teller = byId.get(storyteller)!;
    const change = button(changingTeller ? 'Keep' : 'Change', 'btn', () => update(() => {
      changingTeller = !changingTeller;
    }));
    change.dataset.focus = 'change-teller';
    change.setAttribute('aria-expanded', String(changingTeller));
    const line = h('div', { className: 'rd-teller' },
      swatch(teller.colour),
      h('span', { className: 'rd-teller-name' },
        h('span', { className: 'screen-hint', textContent: 'Storyteller' }),
        h('span', { textContent: teller.name })),
      change);
    const section = h('section', { className: 'screen-section' }, line);
    if (changingTeller) {
      const chips = h('div', { className: 'chips' });
      chips.setAttribute('role', 'group');
      chips.setAttribute('aria-label', 'Who told the story?');
      for (const seat of game.seats) {
        chips.append(chip(seat, seat.id === storyteller, `teller:${seat.id}`, () => update(() => {
          storyteller = seat.id;
          // The storyteller does not vote; every other vote is still valid.
          const { [seat.id]: _dropped, ...rest } = votes;
          votes = rest;
          changingTeller = false;
          focusKey = 'change-teller';
          options.onDraftChange?.({ storyteller, votes });
        })));
      }
      section.append(chips);
    }
    return section;
  }

  function voteSections() {
    return voters().map((voter) => {
      const chips = h('div', { className: 'chips', role: 'group' });
      chips.setAttribute('aria-label', `${voter.name} voted for`);
      for (const choice of voteChoices(game, voter.id)) {
        const c = chip(choice, votes[voter.id] === choice.id, `vote:${voter.id}:${choice.id}`, () => update(() => {
          votes = { ...votes, [voter.id]: choice.id };
          options.onDraftChange?.({ storyteller, votes });
        }));
        if (choice.id === storyteller) {
          c.classList.add('is-teller');
          c.append(h('span', { className: 'rd-tag', textContent: 'storyteller' }));
        }
        chips.append(c);
      }
      const heading = h('h2', { className: 'rd-voter' }, swatch(voter.colour),
        h('span', { textContent: `${voter.name} voted for` }));
      const section = h('section', { className: 'screen-section rd-vote' }, heading, chips);
      return section;
    });
  }

  function reviewButton() {
    const left = voters().filter((s) => !Object.hasOwn(votes, s.id)).length;
    const b = button('Review points', 'btn btn-primary btn-wide rd-main', () => update(() => {
      step = 'review';
    }));
    b.disabled = !allVoted();
    const hint = left === 0 ? 'Everyone has voted.' : `${left} still to vote.`;
    return h('section', { className: 'screen-section screen-actions' }, b, h('p', { className: 'screen-hint rd-center', textContent: hint }));
  }

  function reviewSections() {
    const result = scorePending(game, storyteller, votes);
    const list = h('ul', { className: 'rd-review' });
    for (const score of result.scores) {
      const seat = byId.get(score.player)!;
      const reasons = h('ul', { className: 'rd-reasons' },
        ...score.reasons.map((r) => h('li', { textContent: r.text })));
      const before = game.totals[score.player] ?? 0;
      list.append(h('li', { className: 'rd-review-row' },
        h('div', { className: 'rd-review-head' },
          swatch(seat.colour),
          h('span', { className: 'rd-review-name', textContent: score.player === storyteller ? `${seat.name} (storyteller)` : seat.name }),
          h('span', { className: 'rd-points', textContent: `+${score.points}` })),
        reasons,
        h('p', { className: 'screen-hint', textContent: `${before} → ${before + score.points}` })));
    }
    const confirm = button('Confirm', 'btn btn-primary btn-wide rd-main', () => options.onConfirm(applyRound(game, result)));
    const back = button('Change votes', 'btn btn-wide', () => update(() => {
      step = 'entry';
    }));
    return [
      h('p', { className: 'screen-hint', textContent: `${name(storyteller)} told the story.` }),
      list,
      h('section', { className: 'screen-section screen-actions' }, confirm, back),
    ];
  }

  function chip(seat: SeatedPlayer, pressed: boolean, focus: string, onClick: () => void) {
    const c = button('', 'chip', onClick);
    c.append(swatch(seat.colour), h('span', { textContent: seat.name }));
    c.setAttribute('aria-pressed', String(pressed));
    c.dataset.focus = focus;
    return c;
  }

  render();
  return () => {};
}
