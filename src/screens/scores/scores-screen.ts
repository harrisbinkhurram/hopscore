import { button, h, swatch } from '../dom';
import './scores.css';
import { endGame, gameOver, standings, type Game } from '../../game';

export interface ScoresScreenOptions {
  onNextRound: () => void;
  /** End game was tapped twice: `game` is now over. */
  onEnd: (game: Game) => void;
  onHome: () => void;
  /** Winner view only: leave the finished game. */
  onDone: () => void;
}

/**
 * The plain score list after a round, or the winner view once the game is over.
 * Task 06 puts the board in place of this list. Returns a no-op unsubscribe: this screen reads no store.
 */
export function showScoresScreen(root: HTMLElement, game: Game, options: ScoresScreenOptions) {
  const over = gameOver(game);
  const lastRound = game.rounds.at(-1);
  const lastPoints = new Map(lastRound?.scores.map((s) => [s.player, s.points]));
  let confirmEnd = false;
  let firstRender = true;

  function render() {
    root.classList.add('screen-root');
    const rows = standings(game);
    const screen = h('div', { className: `screen scores-screen${over ? ' is-over' : ''}` });

    if (over) {
      const names = rows.filter((r) => r.winner).map((r) => r.player.name);
      const title = names.length === 1 ? `${names[0]} wins!` : `${joinNames(names)} share the win!`;
      screen.append(h('p', { className: 'sc-trophy', textContent: '🏆' }), h('h1', { className: 'sc-winner', textContent: title }));
      screen.append(h('p', { className: 'screen-hint sc-center', textContent: overReason() }));
    } else {
      screen.append(h('header', { className: 'screen-header' },
        button('Home', 'btn btn-ghost', options.onHome),
        h('h1', { textContent: game.rounds.length === 0 ? 'Scores' : `After round ${game.rounds.length}` })));
    }

    const list = h('ol', { className: 'sc-list' });
    for (const row of rows) {
      const gained = lastPoints.get(row.player.id);
      const item = h('li', { className: `sc-row${row.winner && over ? ' is-winner' : ''}` },
        h('span', { className: 'sc-rank', textContent: String(row.rank) }),
        swatch(row.player.colour),
        h('span', { className: 'sc-name', textContent: row.player.name }));
      if (gained !== undefined && !over) item.append(h('span', { className: 'sc-gained', textContent: `+${gained}` }));
      item.append(h('span', { className: 'sc-total', textContent: String(row.total) }));
      list.append(item);
    }
    screen.append(list, h('p', { className: 'screen-hint sc-center', textContent: `First to ${game.trackLength} wins.` }));

    if (over) {
      screen.append(button('Done', 'btn btn-primary btn-wide sc-main', options.onDone));
    } else {
      const next = game.seats.find((s) => s.id === game.storyteller)!;
      screen.append(
        h('p', { className: 'sc-next', textContent: `Next storyteller: ${next.name}` }),
        button(game.rounds.length === 0 ? 'Score the first round' : 'Score next round', 'btn btn-primary btn-wide sc-main', options.onNextRound),
        endButton(),
      );
    }
    // A new screen starts at the top; arming End game keeps the scroll where it was.
    const scrollY = window.scrollY;
    root.replaceChildren(screen);
    window.scrollTo(0, firstRender ? 0 : scrollY);
    firstRender = false;
  }

  /** End game needs two taps: there is no undo yet. */
  function endButton() {
    const b = button(confirmEnd ? 'Tap again to end the game' : 'End game', `btn btn-danger btn-wide${confirmEnd ? ' is-armed' : ''}`, () => {
      if (confirmEnd) {
        options.onEnd(endGame(game));
      } else {
        confirmEnd = true;
        render();
        root.querySelector<HTMLElement>('.btn-danger')?.focus({ preventScroll: true });
      }
    });
    return b;
  }

  function overReason() {
    if (game.endedByHand) return `Game ended after ${plural(game.rounds.length, 'round')}.`;
    return `Reached the end of the track in ${plural(game.rounds.length, 'round')}.`;
  }

  render();
  return () => {};
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function joinNames(names: string[]) {
  return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}
