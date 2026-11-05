import './players.css';
import { BUNNY_COLOURS, bunnyColour } from '../../storage/colours';
import type { PlayerStore, Result } from '../../storage/player-store';
import { LIMITS, type Group, type Player } from '../../storage/types';

export interface PlayersScreenOptions {
  onBack: () => void;
}

/** Which part of the screen is open. Only one editor at a time keeps it simple on a phone. */
type Open =
  | { kind: 'none' }
  | { kind: 'player'; id: string }
  | { kind: 'group'; id: string | null; picked: Set<string> };

/**
 * The players and groups screen. Renders into `root` and re-renders after every change.
 * Returns a function that unsubscribes from the store.
 */
export function showPlayersScreen(root: HTMLElement, store: PlayerStore, options: PlayersScreenOptions) {
  let open: Open = { kind: 'none' };
  let confirmDelete: string | null = null;
  /** An error to show, and which form it belongs to ('add' or 'editor'). */
  let message: { at: 'add' | 'editor'; text: string } | null = null;
  /** Text typed but not saved yet, so a failed save does not wipe it. Cleared when `open` changes. */
  let drafts: Record<string, string> = {};
  /** The draft key of the input to focus after the next render. */
  let focusKey: string | null = null;

  const set = (next: Partial<{ open: Open; confirmDelete: string | null; message: { at: 'add' | 'editor'; text: string } | null }>) => {
    if (next.open) {
      open = next.open;
      drafts = {};
    }
    confirmDelete = next.confirmDelete === undefined ? null : next.confirmDelete;
    message = next.message ?? null;
    render();
  };

  /** Shows the error from a failed change, or closes the editor on success. */
  const apply = <T>(result: Result<T>, after: Open = { kind: 'none' }, at: 'add' | 'editor' = 'editor') => {
    if (result.ok) set({ open: after });
    else set({ message: { at, text: result.error } });
  };

  function render() {
    root.classList.add('screen-root');
    const screen = h('div', { className: 'players-screen' });

    const back = button('Back', 'btn btn-ghost', options.onBack);
    screen.append(h('header', { className: 'ps-header' }, back, h('h1', { textContent: 'Players' })));

    const reason = store.notSavedReason;
    if (reason) {
      screen.append(
        h('p', {
          className: 'ps-notice',
          role: 'status',
          textContent:
            reason === 'storage-off'
              ? "Names won't be remembered on this device. Storage is off or full."
              : "Changes won't be saved, to keep your saved names safe. Reload the page to update Hopscore.",
        }),
      );
    }

    screen.append(addPlayerForm(), playerList(), groupSection());
    root.replaceChildren(screen);
    if (focusKey) screen.querySelector<HTMLInputElement>(`[data-draft="${focusKey}"]`)?.focus();
    focusKey = null;
  }

  /** A text input whose value survives re-renders until the editor closes. */
  function textInput(key: string, initial: string, label: string, max: number, placeholder = '') {
    const input = h('input', {
      className: 'ps-input',
      type: 'text',
      value: drafts[key] ?? initial,
      placeholder,
      maxLength: max,
      autocomplete: 'off',
    });
    input.dataset.draft = key;
    input.setAttribute('aria-label', label);
    input.addEventListener('input', () => {
      drafts[key] = input.value;
    });
    return input;
  }

  function addPlayerForm() {
    const input = textInput('add', '', 'New player name', LIMITS.playerNameMax, 'New player name');
    const form = h('form', { className: 'ps-add' }, input, h('button', {
      className: 'btn btn-primary',
      type: 'submit',
      textContent: 'Add',
    }));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const result = store.addPlayer(input.value);
      if (result.ok) {
        // Clear only this field (an open group editor keeps its typed name) and get ready for the next.
        delete drafts.add;
        focusKey = 'add';
        set({});
      } else {
        set({ message: { at: 'add', text: result.error } });
      }
    });
    const parts: HTMLElement[] = [form];
    if (message?.at === 'add') parts.push(errorLine(message.text));
    return h('section', { className: 'ps-section' }, ...parts);
  }

  function playerList() {
    const players = store.players();
    const section = h('section', { className: 'ps-section' });
    if (players.length === 0) {
      section.append(h('p', { className: 'ps-empty', textContent: 'No players yet. Add the first one above.' }));
      return section;
    }
    const list = h('ul', { className: 'ps-list' });
    for (const player of players) {
      const isOpen = open.kind === 'player' && open.id === player.id;
      const row = button('', 'ps-row', () =>
        set({ open: isOpen ? { kind: 'none' } : { kind: 'player', id: player.id } }),
      );
      row.setAttribute('aria-expanded', String(isOpen));
      row.append(swatch(player.colour), h('span', { className: 'ps-name', textContent: player.name }),
        h('span', { className: 'ps-meta', textContent: bunnyColour(player.colour).name }));
      const item = h('li', {}, row);
      if (isOpen) item.append(playerEditor(player));
      list.append(item);
    }
    section.append(list);
    return section;
  }

  function playerEditor(player: Player) {
    const editor = h('div', { className: 'ps-editor' });

    const input = textInput('rename', player.name, `Rename ${player.name}`, LIMITS.playerNameMax);
    const rename = h('form', { className: 'ps-add' }, input,
      h('button', { className: 'btn', type: 'submit', textContent: 'Rename' }));
    rename.addEventListener('submit', (e) => {
      e.preventDefault();
      apply(store.renamePlayer(player.id, input.value), { kind: 'player', id: player.id });
    });
    editor.append(rename);
    if (message?.at === 'editor') editor.append(errorLine(message.text));

    const colours = h('div', { className: 'ps-colours', role: 'radiogroup' });
    colours.setAttribute('aria-label', 'Bunny colour');
    for (const c of BUNNY_COLOURS) {
      const chosen = c.id === player.colour;
      const b = button('', `ps-colour${chosen ? ' is-chosen' : ''}`, () =>
        apply(store.recolourPlayer(player.id, c.id), { kind: 'player', id: player.id }),
      );
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(chosen));
      b.append(swatch(c.id), h('span', { textContent: c.name }));
      colours.append(b);
    }
    editor.append(colours);

    editor.append(deleteButton(`player:${player.id}`, `Delete ${player.name}`, () => {
      store.deletePlayer(player.id);
      set({ open: { kind: 'none' } });
    }));
    return editor;
  }

  function groupSection() {
    const section = h('section', { className: 'ps-section' }, h('h2', { textContent: 'Groups' }));
    const groups = store.groups();
    const list = h('ul', { className: 'ps-list' });
    for (const group of groups) {
      const isOpen = open.kind === 'group' && open.id === group.id;
      const short = group.playerIds.length < LIMITS.groupMin;
      const row = button('', 'ps-row ps-group-row', () =>
        set({ open: isOpen ? { kind: 'none' } : { kind: 'group', id: group.id, picked: new Set(group.playerIds) } }),
      );
      row.setAttribute('aria-expanded', String(isOpen));
      const names = group.playerIds.map((id) => store.player(id)?.name ?? '').filter(Boolean).join(', ');
      row.append(
        h('span', { className: 'ps-name', textContent: group.name }),
        h('span', { className: 'ps-meta', textContent: names || 'No players' }),
      );
      if (short) row.append(h('span', { className: 'ps-warn', textContent: `Needs ${LIMITS.groupMin} players` }));
      const item = h('li', {}, row);
      if (isOpen) item.append(groupEditor(group));
      list.append(item);
    }
    if (groups.length) section.append(list);

    if (open.kind === 'group' && open.id === null) {
      section.append(groupEditor(null));
    } else if (store.players().length >= LIMITS.groupMin) {
      section.append(button('New group', 'btn btn-primary btn-wide', () =>
        set({ open: { kind: 'group', id: null, picked: new Set() } })));
    } else {
      section.append(h('p', {
        className: 'ps-empty',
        textContent: `Add at least ${LIMITS.groupMin} players to make a group.`,
      }));
    }
    return section;
  }

  function groupEditor(group: Group | null) {
    if (open.kind !== 'group') return h('div');
    const picked = open.picked;
    const editor = h('form', { className: 'ps-editor' });

    const name = textInput('group', group?.name ?? '', 'Group name', LIMITS.groupNameMax,
      'e.g. Friday crew');
    editor.append(name);

    const count = h('p', { className: 'ps-meta' });
    const updateCount = () => {
      count.textContent = `${picked.size} picked (${LIMITS.groupMin} to ${LIMITS.groupMax})`;
    };
    updateCount();

    const checks = h('div', { className: 'ps-checks' });
    for (const player of store.players()) {
      const box = h('input', { type: 'checkbox', checked: picked.has(player.id) });
      box.addEventListener('change', () => {
        if (box.checked) picked.add(player.id);
        else picked.delete(player.id);
        updateCount();
      });
      checks.append(h('label', { className: 'ps-check' }, box, swatch(player.colour),
        h('span', { textContent: player.name })));
    }
    editor.append(count, checks);
    if (message?.at === 'editor') editor.append(errorLine(message.text));

    const actions = h('div', { className: 'ps-actions' },
      h('button', { className: 'btn btn-primary', type: 'submit', textContent: group ? 'Save' : 'Create group' }),
      button('Cancel', 'btn btn-ghost', () => set({ open: { kind: 'none' } })));
    editor.append(actions);
    editor.addEventListener('submit', (e) => {
      e.preventDefault();
      const ids = [...picked];
      apply(group ? store.updateGroup(group.id, { name: name.value, playerIds: ids }) : store.createGroup(name.value, ids));
    });

    if (group) {
      editor.append(deleteButton(`group:${group.id}`, `Delete ${group.name}`, () => {
        store.deleteGroup(group.id);
        set({ open: { kind: 'none' } });
      }));
    }
    return editor;
  }

  /** Delete needs two taps: the first turns the button into "Tap again to delete". */
  function deleteButton(key: string, label: string, onDelete: () => void) {
    const armed = confirmDelete === key;
    return button(armed ? 'Tap again to delete' : label, `btn btn-danger${armed ? ' is-armed' : ''}`, () => {
      if (armed) onDelete();
      else set({ confirmDelete: key });
    });
  }

  render();
  return store.subscribe(render);
}

function swatch(colourId: string) {
  const s = h('span', { className: 'ps-swatch' });
  s.style.background = bunnyColour(colourId).hex;
  s.setAttribute('aria-hidden', 'true');
  return s;
}

function errorLine(text: string) {
  return h('p', { className: 'ps-error', role: 'alert', textContent: text });
}

function button(text: string, className: string, onClick: () => void) {
  const b = h('button', { type: 'button', className, textContent: text });
  b.addEventListener('click', onClick);
  return b;
}

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> & { role?: string } = {},
  ...children: Node[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  const { role, ...rest } = props;
  Object.assign(el, rest);
  if (role) el.setAttribute('role', role);
  el.append(...children);
  return el;
}
