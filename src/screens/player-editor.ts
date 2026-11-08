import { button, h, swatch } from './dom';
import './player-editor.css';
import { BUNNY_COLOURS, colourLocked } from '../storage/colours';
import type { PlayerStore } from '../storage/player-store';
import { LIMITS, type Player } from '../storage/types';

export interface PlayerEditorOptions {
  /** The name typed and not saved yet, kept by the screen across re-renders; undefined when untouched. */
  draft: string | undefined;
  onDraft: (text: string) => void;
  /** `data-focus` key of the name field, so the screen can give it focus back after a re-render. */
  focusKey: string;
  /**
   * After a save: `error` is null when it worked (the typed name is now saved, so the screen can
   * forget its draft). The screen re-renders.
   */
  onChange: (error: string | null) => void;
}

/**
 * The name field and colour picker for one saved player, shared by the players and the new game
 * screens. Picking a colour also saves a name typed but not saved yet, so it is never lost.
 */
export function playerEditor(store: PlayerStore, player: Player, options: PlayerEditorOptions) {
  const input = h('input', {
    className: 'pe-input',
    type: 'text',
    value: options.draft ?? player.name,
    maxLength: LIMITS.playerNameMax,
    autocomplete: 'off',
  });
  input.dataset.focus = options.focusKey;
  input.setAttribute('aria-label', `Rename ${player.name}`);
  input.addEventListener('input', () => options.onDraft(input.value));

  const rename = h('form', { className: 'pe-rename' }, input,
    h('button', { className: 'btn', type: 'submit', textContent: 'Rename' }));
  rename.addEventListener('submit', (e) => {
    e.preventDefault();
    const result = store.renamePlayer(player.id, input.value);
    options.onChange(result.ok ? null : result.error);
  });

  const colours = h('div', { className: 'pe-colours', role: 'radiogroup' });
  colours.setAttribute('aria-label', 'Bunny colour');
  const others = store.players().filter((p) => p.id !== player.id);
  const otherColours = others.map((p) => p.colour);
  for (const c of BUNNY_COLOURS) {
    const chosen = c.id === player.colour;
    const holders = others.filter((p) => p.colour === c.id).map((p) => p.name);
    const locked = !chosen && colourLocked(c.id, otherColours);
    const b = button('', `pe-colour${chosen ? ' is-chosen' : ''}${holders.length > 0 ? ' is-taken' : ''}`, () => {
      if (locked) return;
      let error: string | null = null;
      if (input.value.trim() !== player.name) {
        const renamed = store.renamePlayer(player.id, input.value);
        if (!renamed.ok) error = renamed.error;
      }
      if (!chosen) {
        const recoloured = store.recolourPlayer(player.id, c.id);
        if (!recoloured.ok) error ??= recoloured.error;
      }
      options.onChange(error);
    });
    b.dataset.focus = `colour:${c.id}`;
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(chosen));
    b.append(swatch(c.id), h('span', { textContent: c.name }));
    if (holders.length > 0) {
      // Who has it. While a free colour is left, a taken one cannot be picked.
      b.append(h('span', { className: 'pe-holder', textContent: holders.join(', ') }));
      b.setAttribute('aria-label', `${c.name}, taken by ${holders.join(', ')}`);
    }
    if (locked) b.setAttribute('aria-disabled', 'true');
    colours.append(b);
  }
  return { rename, colours };
}
