import { button, errorLine, h, SECOND_TAP_DELAY_MS, swatch } from '../dom';
import './setup.css';
import { newGame, setupProblems, TRACK_LENGTH, type Game, type SeatedPlayer } from '../../game';
import { MAX_PLAYERS, MIN_PLAYERS } from '../../scoring';
import type { PlayerStore } from '../../storage/player-store';
import { LIMITS } from '../../storage/types';
import { playerEditor } from '../player-editor';

export interface SetupScreenOptions {
  /** True while an unfinished game exists: Start then warns and needs two taps. */
  replacing?: boolean;
  onBack: () => void;
  onStart: (game: Game) => void;
}

/**
 * New game: pick a group or players, set the seat order and the track length.
 * Returns a function that unsubscribes from the store.
 */
export function showSetupScreen(root: HTMLElement, store: PlayerStore, options: SetupScreenOptions) {
  /** Player ids in seat order. */
  let seated: string[] = [];
  let trackLength: number = TRACK_LENGTH.default;
  let addError: string | null = null;
  /** When Start was armed (replacing a game only); 0 means not armed. */
  let startArmedAt = 0;
  let addDraft = '';
  /** The seated player whose name and colour are open for editing, with what was typed and any error. */
  let editing: { id: string; draft?: string; error: string | null } | null = null;
  /** The `data-focus` key to focus after the next render. */
  let focusKey: string | null = null;

  /** Any change clears the last add error; the add handler sets it again when it fails. */
  const update = (change: () => void) => {
    addError = null;
    startArmedAt = 0;
    change();
    render();
  };

  function render() {
    // Drop anyone deleted from the saved players since they were seated.
    seated = seated.filter((id) => store.player(id));
    if (editing && !seated.includes(editing.id)) editing = null;
    root.classList.add('screen-root');
    const screen = h('div', { className: 'screen setup-screen' },
      h('header', { className: 'screen-header' }, button('Back', 'btn btn-ghost', options.onBack),
        h('h1', { textContent: 'New game' })),
      groupSection(), playerSection(), seatSection(), trackSection(), ...startSection());

    const active = document.activeElement;
    const keep = focusKey ?? (active instanceof HTMLElement && root.contains(active) ? active.dataset.focus : null);
    focusKey = null;
    // Swapping the whole screen briefly empties the page, which would jump the scroll to the top.
    const scrollY = window.scrollY;
    root.replaceChildren(screen);
    window.scrollTo(0, scrollY);
    if (keep) {
      const all = [...screen.querySelectorAll<HTMLElement>('[data-focus]')];
      const byKey = (key: string | null) => all.find((e) => e.dataset.focus === key);
      let target = byKey(keep);
      // A button that just reached the end of its range is disabled and cannot take focus.
      if (target instanceof HTMLButtonElement && target.disabled) target = byKey(partnerKey(keep));
      target?.focus({ preventScroll: true });
    }
  }

  function groupSection() {
    const groups = store.groups();
    if (groups.length === 0) return h('div');
    const chips = h('div', { className: 'chips' });
    for (const group of groups) {
      const ids = group.playerIds.filter((id) => store.player(id));
      const usable = ids.length >= LIMITS.groupMin && ids.length <= LIMITS.groupMax;
      const chosen = usable && ids.length === seated.length && ids.every((id, i) => seated[i] === id);
      const chip = button('', 'chip', () => update(() => {
        seated = [...ids];
      }));
      chip.append(h('span', { textContent: usable ? group.name : `${group.name} (needs ${LIMITS.groupMin})` }));
      chip.disabled = !usable;
      chip.setAttribute('aria-pressed', String(chosen));
      chip.dataset.focus = `group:${group.id}`;
      chips.append(chip);
    }
    return h('section', { className: 'screen-section' }, h('h2', { textContent: 'Groups' }),
      h('p', { className: 'screen-hint', textContent: 'Tap a group to seat everyone in it.' }), chips);
  }

  function playerSection() {
    const section = h('section', { className: 'screen-section' }, h('h2', { textContent: 'Players' }));
    const players = store.players();
    if (players.length > 0) {
      const full = seated.length >= MAX_PLAYERS;
      const chips = h('div', { className: 'chips' });
      for (const player of players) {
        const isSeated = seated.includes(player.id);
        const chip = button('', 'chip', () => update(() => {
          seated = isSeated ? seated.filter((id) => id !== player.id) : [...seated, player.id];
        }));
        chip.append(swatch(player.colour), h('span', { textContent: player.name }));
        chip.setAttribute('aria-pressed', String(isSeated));
        chip.disabled = full && !isSeated;
        chip.dataset.focus = `player:${player.id}`;
        chips.append(chip);
      }
      section.append(chips);
    }

    const input = h('input', {
      className: 'su-input',
      type: 'text',
      value: addDraft,
      placeholder: 'New player name',
      maxLength: LIMITS.playerNameMax,
      autocomplete: 'off',
    });
    input.setAttribute('aria-label', 'New player name');
    input.dataset.focus = 'add';
    input.addEventListener('input', () => {
      addDraft = input.value;
    });
    const form = h('form', { className: 'su-add' }, input,
      h('button', { className: 'btn btn-primary', type: 'submit', textContent: 'Add' }));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const result = store.addPlayer(input.value);
      update(() => {
        if (result.ok) {
          addDraft = '';
          addError = null;
          if (seated.length < MAX_PLAYERS) seated = [...seated, result.value.id];
          focusKey = 'add';
        } else {
          addError = result.error;
        }
      });
    });
    section.append(form);
    if (addError) section.append(errorLine(addError));
    return section;
  }

  function seatSection() {
    const section = h('section', { className: 'screen-section' }, h('h2', { textContent: 'Seat order' }));
    if (seated.length === 0) {
      section.append(h('p', { className: 'screen-hint', textContent: `Pick ${MIN_PLAYERS} to ${MAX_PLAYERS} players above.` }));
      return section;
    }
    section.append(h('p', { className: 'screen-hint', textContent: 'The storyteller goes round in this order. Drag ☰ to move a player. Tap a name to rename it or change its colour.' }));
    const list = h('ol', { className: 'su-seats' });
    seated.forEach((id, i) => {
      const player = store.player(id)!;
      const handle = h('span', { className: 'su-handle', textContent: '☰' });
      handle.setAttribute('aria-hidden', 'true');
      const up = button('↑', 'btn su-move', () => update(() => move(i, i - 1)));
      up.setAttribute('aria-label', `Move ${player.name} up`);
      up.disabled = i === 0;
      up.dataset.focus = `up:${id}`;
      const down = button('↓', 'btn su-move', () => update(() => move(i, i + 1)));
      down.setAttribute('aria-label', `Move ${player.name} down`);
      down.disabled = i === seated.length - 1;
      down.dataset.focus = `down:${id}`;
      const isEditing = editing?.id === id;
      const label = button('', 'su-seat-name', () => update(() => {
        editing = isEditing ? null : { id, error: null };
      }));
      label.append(swatch(player.colour), h('span', { className: 'su-seat-text' }, h('span', { textContent: player.name })));
      if (i === 0) label.lastElementChild!.append(h('span', { className: 'screen-hint', textContent: 'Tells the first story' }));
      label.setAttribute('aria-expanded', String(isEditing));
      label.setAttribute('aria-label', `${player.name}: rename or change colour`);
      label.dataset.focus = `edit:${id}`;
      const item = h('li', { className: 'su-seat' }, handle, label, up, down);
      item.dataset.id = id;
      if (isEditing) item.append(seatEditor(id));
      dragByHandle(handle, item, list);
      list.append(item);
    });
    section.append(list);
    if (seated.length === MIN_PLAYERS) {
      section.append(h('p', { className: 'su-note', textContent: '3 players: the 3-player rules are on. Each player puts in 2 cards.' }));
    }
    return section;
  }

  /** The shared name and colour editor, under the seated player's row. */
  function seatEditor(id: string) {
    const player = store.player(id)!;
    const { rename, colours } = playerEditor(store, player, {
      draft: editing?.draft,
      onDraft: (text) => {
        if (editing) editing.draft = text;
      },
      focusKey: `edit-name:${id}`,
      onChange: (error) => {
        // On success the typed name is saved: forget it, keep the editor open for more changes.
        editing = { id, draft: error ? editing?.draft : undefined, error };
        render();
      },
    });
    const parts: HTMLElement[] = [rename];
    if (editing?.error) parts.push(errorLine(editing.error));
    parts.push(colours);
    return h('div', { className: 'su-editor' }, ...parts);
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= seated.length) return;
    const next = [...seated];
    const [id] = next.splice(from, 1);
    next.splice(to, 0, id!);
    seated = next;
  }

  /**
   * Dragging reorders the rows in the DOM as the finger goes, without re-rendering. The new order
   * is read back from the DOM when the finger lifts. The dragged row itself never moves: taking
   * it out of the DOM would drop the pointer capture, so its neighbours move around it instead.
   */
  function dragByHandle(handle: HTMLElement, item: HTMLElement, list: HTMLElement) {
    handle.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      handle.setPointerCapture(e.pointerId);
      item.classList.add('is-dragging');
      const onMove = (ev: PointerEvent) => {
        // A fast finger can pass several rows between two events.
        for (;;) {
          const above = item.previousElementSibling;
          const below = item.nextElementSibling;
          if (above && ev.clientY < middleOf(above)) item.after(above);
          else if (below && ev.clientY > middleOf(below)) item.before(below);
          else break;
        }
      };
      const onEnd = () => {
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onEnd);
        handle.removeEventListener('pointercancel', onEnd);
        handle.removeEventListener('lostpointercapture', onEnd);
        update(() => {
          seated = [...list.children].map((li) => (li as HTMLElement).dataset.id!);
        });
      };
      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onEnd);
      handle.addEventListener('pointercancel', onEnd);
      handle.addEventListener('lostpointercapture', onEnd);
    });
  }

  function middleOf(el: Element) {
    const box = el.getBoundingClientRect();
    return box.top + box.height / 2;
  }

  function trackSection() {
    const less = button('−', 'btn su-step', () => update(() => {
      trackLength = Math.max(TRACK_LENGTH.min, trackLength - TRACK_LENGTH.step);
    }));
    less.setAttribute('aria-label', 'Shorter track');
    less.disabled = trackLength <= TRACK_LENGTH.min;
    less.dataset.focus = 'track-less';
    const more = button('+', 'btn su-step', () => update(() => {
      trackLength = Math.min(TRACK_LENGTH.max, trackLength + TRACK_LENGTH.step);
    }));
    more.setAttribute('aria-label', 'Longer track');
    more.disabled = trackLength >= TRACK_LENGTH.max;
    more.dataset.focus = 'track-more';
    const value = h('output', { className: 'su-track-value', textContent: `${trackLength} steps` });
    value.setAttribute('aria-live', 'polite');
    return h('section', { className: 'screen-section' }, h('h2', { textContent: 'Track length' }),
      h('div', { className: 'su-stepper' }, less, value, more),
      h('p', { className: 'screen-hint', textContent: `The first bunny to reach ${trackLength} wins.` }));
  }

  function startSection() {
    const ready = setupProblems(seated, trackLength).length === 0;
    const armed = startArmedAt > 0;
    const label = armed ? 'Tap again to start a new game' : 'Start game';
    const start = button(label, `btn btn-primary btn-wide su-start${armed ? ' is-armed' : ''}`, () => {
      if (options.replacing && !armed) {
        startArmedAt = Date.now();
        focusKey = 'start';
        render();
        return;
      }
      if (armed && Date.now() - startArmedAt < SECOND_TAP_DELAY_MS) return;
      const seats: SeatedPlayer[] = seated.map((id) => {
        const p = store.player(id)!;
        return { id: p.id, name: p.name, colour: p.colour };
      });
      const game = newGame(seats, trackLength);
      store.markUsed(seated);
      options.onStart(game);
    });
    start.disabled = !ready;
    start.dataset.focus = 'start';
    const hint = ready
      ? `${seated.length} players`
      : `${seated.length} picked. A game needs ${MIN_PLAYERS} to ${MAX_PLAYERS} players.`;
    const parts: HTMLElement[] = [];
    if (options.replacing) {
      parts.push(h('p', { className: 'su-note su-warn', textContent: 'A game is in progress. Starting a new one ends it.' }));
    }
    // Only Start and its hint stay pinned: the warning would make the bar too tall on a short window.
    parts.push(h('section', { className: 'screen-section screen-actions' },
      start, h('p', { className: 'screen-hint su-center', textContent: hint })));
    return parts;
  }

  render();
  return store.subscribe(render);
}

/** The opposite button of a pair, which keeps focus when the pressed one becomes disabled. */
function partnerKey(key: string): string | null {
  if (key.startsWith('up:')) return `down:${key.slice('up:'.length)}`;
  if (key.startsWith('down:')) return `up:${key.slice('down:'.length)}`;
  if (key === 'track-less') return 'track-more';
  if (key === 'track-more') return 'track-less';
  return null;
}
