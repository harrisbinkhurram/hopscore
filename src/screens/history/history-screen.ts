import { button, h, SECOND_TAP_DELAY_MS, swatch } from '../dom';
import './history.css';
import type { GameStore } from '../../storage/game-store';
import type { HistoryEntry } from '../../storage/types';

export interface HistoryScreenOptions {
  onBack: () => void;
}

/**
 * Past games, newest first: date, players by final score with the winner marked, and a
 * two-tap Delete each. Returns a no-op unsubscribe: the screen re-renders itself after a delete.
 */
export function showHistoryScreen(root: HTMLElement, store: GameStore, options: HistoryScreenOptions) {
  let confirmDelete: string | null = null;
  let armedAt = 0;
  let firstRender = true;

  function render() {
    root.classList.add('screen-root');
    const entries = store.history();
    const screen = h('div', { className: 'screen history-screen' },
      h('header', { className: 'screen-header' },
        button('Home', 'btn btn-ghost', options.onBack),
        h('h1', { textContent: 'Past games' })));

    if (entries.length === 0) {
      screen.append(h('p', { className: 'screen-hint', textContent: 'Finished games show up here.' }));
    } else {
      const list = h('ol', { className: 'hs-list' });
      list.setAttribute('aria-label', 'Past games');
      for (const entry of entries) list.append(entryItem(entry));
      screen.append(list);
    }

    const active = document.activeElement;
    const keep = active instanceof HTMLElement && root.contains(active) ? active.dataset.focus : undefined;
    const scrollY = window.scrollY;
    root.replaceChildren(screen);
    window.scrollTo(0, firstRender ? 0 : scrollY);
    firstRender = false;
    if (keep) root.querySelector<HTMLElement>(`[data-focus="${keep}"]`)?.focus({ preventScroll: true });
  }

  function entryItem(entry: HistoryEntry) {
    const top = Math.max(...entry.players.map((p) => p.score));
    const rows = [...entry.players].sort((a, b) => b.score - a.score);
    const players = h('ol', { className: 'hs-players' });
    for (const p of rows) {
      const winner = p.score === top;
      const row = h('li', { className: `hs-player${winner ? ' is-winner' : ''}` },
        swatch(p.colour),
        h('span', { className: 'hs-name', textContent: p.name }));
      if (winner) row.append(h('span', { className: 'hs-crown', textContent: '🏆' }));
      row.append(h('span', { className: 'hs-score', textContent: String(p.score) }));
      players.append(row);
    }
    const rounds = `${entry.rounds} round${entry.rounds === 1 ? '' : 's'}`;
    const how = entry.endedByHand ? 'ended early' : `first to ${entry.trackLength}`;
    return h('li', { className: 'hs-entry' },
      h('p', { className: 'hs-date', textContent: formatDate(entry.finishedAt) }),
      h('p', { className: 'hs-meta', textContent: `${rounds}, ${how}` }),
      players,
      deleteButton(entry.id));
  }

  /** Delete needs two taps: the first turns the button into "Tap again to delete". */
  function deleteButton(id: string) {
    const armed = confirmDelete === id;
    const b = button(armed ? 'Tap again to delete' : 'Delete', `btn btn-danger${armed ? ' is-armed' : ''}`, () => {
      if (armed) {
        if (Date.now() - armedAt < SECOND_TAP_DELAY_MS) return;
        store.deleteHistory(id);
        confirmDelete = null;
      } else {
        confirmDelete = id;
        armedAt = Date.now();
      }
      render();
    });
    b.dataset.focus = `delete:${id}`;
    b.setAttribute('aria-label', armed ? 'Tap again to delete this game' : 'Delete this game');
    return b;
  }

  render();
  return () => {};
}

function formatDate(ms: number): string {
  try {
    return new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return new Date(ms).toDateString();
  }
}
