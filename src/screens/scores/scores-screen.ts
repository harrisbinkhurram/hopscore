import { button, h, SECOND_TAP_DELAY_MS, swatch } from '../dom';
import './scores.css';
import type { Board, BoardQuality } from '../../board/board';
import { canUndo, endGame, gameOver, nextRedo, standings, type Game } from '../../game';
import { boardPlayers, finalePlay, roundPlay, undoPlay, type PlayMode } from './board-input';
import { showFlatTrack } from './flat-track';

/**
 * How much board this phone gets, for the rest of the session: lowered when rounds played too
 * slowly, so the next scores screen starts there. `flat` is the 2D track.
 */
let sessionQuality: BoardQuality | 'flat' = 'full';

export interface ScoresScreenOptions {
  /**
   * `round` plays the last round on the board, `finale` only the winner's dance, `undoneFrom`
   * hops the bunnies back after an Undo, `none` shows the scores.
   */
  play: PlayMode;
  onNextRound: () => void;
  /** End game was tapped twice: `game` is now over. */
  onEnd: (game: Game) => void;
  onHome: () => void;
  /** Winner view only: leave the finished game. */
  onDone: () => void;
  /** Undo was tapped: take back the last round, or End game. */
  onUndo: () => void;
  /** Redo was tapped: put back the step undone last. */
  onRedo: () => void;
}

/**
 * The garden board with a compact score readout after a round, or the winner view once the
 * game is over. Returns an unsubscribe that disposes the board.
 */
export function showScoresScreen(root: HTMLElement, game: Game, options: ScoresScreenOptions) {
  const over = gameOver(game);
  const lastRound = game.rounds.at(-1);
  const lastPoints = new Map(lastRound?.scores.map((s) => [s.player, s.points]));
  let confirmEnd = false;
  let armedAt = 0;
  let firstRender = true;
  /**
   * Undo, Redo and Done act on one tap and open a new screen with another button in the same
   * place, so a tap this soon after opening is the second half of a double tap: ignore it.
   */
  const openedAt = Date.now();
  const once = (action: () => void) => () => {
    if (Date.now() - openedAt >= SECOND_TAP_DELAY_MS) action();
  };

  // The board lives for this screen visit. Re-renders move the same stage, so it never replays.
  const stage = h('div', { className: 'sc-stage' });
  const skip = button('Skip', 'btn sc-skip', () => board?.skip());
  skip.setAttribute('aria-label', 'Skip the animation');
  skip.hidden = true;
  stage.append(skip);
  let board: Board | null = null;
  let left = false;
  if (sessionQuality === 'flat') showFlat();
  else startBoard();

  /** The 2D track instead of the board: no animation, final positions only. */
  function showFlat() {
    board?.dispose();
    board = null;
    skip.hidden = true;
    stage.classList.add('is-flat');
    showFlatTrack(stage, game.trackLength, boardPlayers(game));
  }

  function startBoard() {
    const { play } = options;
    const rp = play === 'round' ? roundPlay(game) : typeof play === 'object' ? undoPlay(play.undoneFrom, game) : null;
    import('../../board/board')
      .then(({ createBoard }) => {
        if (left) return;
        board = createBoard(stage, {
          trackLength: game.trackLength,
          players: rp ? rp.before : boardPlayers(game),
          quality: sessionQuality === 'lite' ? 'lite' : 'full',
          onPlayingChange: (playing) => {
            if (board) skip.hidden = !playing;
          },
          onSlow: (next) => {
            sessionQuality = next;
            if (next === 'flat') showFlat();
          },
        });
        if (rp) void board.play(rp.round);
        else if (play === 'finale') void board.play(finalePlay(game));
      })
      .catch(() => {
        // No WebGL, or the board's file could not load (for example an old version after an
        // update): the 2D track shows the same positions.
        if (!left) showFlat();
      });
  }

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
    screen.append(stage);

    const list = h('ol', { className: 'sc-list' });
    list.setAttribute('aria-label', 'Scores');
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
      screen.append(button('Done', 'btn btn-primary btn-wide sc-main', once(options.onDone)));
      screen.append(undoRow());
    } else {
      const next = game.seats.find((s) => s.id === game.storyteller)!;
      screen.append(
        h('p', { className: 'sc-next', textContent: `Next storyteller: ${next.name}` }),
        button(game.rounds.length === 0 ? 'Score the first round' : 'Score next round', 'btn btn-primary btn-wide sc-main', options.onNextRound),
        undoRow(),
        endButton(),
      );
    }
    // A new screen starts at the top; arming End game keeps the scroll where it was.
    const scrollY = window.scrollY;
    root.replaceChildren(screen);
    window.scrollTo(0, firstRender ? 0 : scrollY);
    firstRender = false;
  }

  /** Undo and Redo, one tap each; empty when there is nothing to undo or redo. */
  function undoRow() {
    const row = h('div', { className: 'sc-undo' });
    if (canUndo(game)) {
      const label = game.endedByHand ? 'Undo End game' : `Undo round ${game.rounds.length}`;
      row.append(button(label, 'btn', once(options.onUndo)));
    }
    const redo = nextRedo(game);
    if (redo) {
      const label = redo.kind === 'end' ? 'Redo End game' : `Redo round ${game.rounds.length + 1}`;
      row.append(button(label, 'btn', once(options.onRedo)));
    }
    return row;
  }

  /** End game needs two deliberate taps, so a stray tap does not end the game. */
  function endButton() {
    const b = button(confirmEnd ? 'Tap again to end the game' : 'End game', `btn btn-danger btn-wide${confirmEnd ? ' is-armed' : ''}`, () => {
      if (confirmEnd) {
        if (Date.now() - armedAt >= SECOND_TAP_DELAY_MS) options.onEnd(endGame(game));
      } else {
        confirmEnd = true;
        armedAt = Date.now();
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
  return () => {
    left = true;
    board?.dispose();
    board = null;
  };
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function joinNames(names: string[]) {
  return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}
