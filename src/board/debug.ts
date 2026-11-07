import './debug.css';
import { createBoard } from './board';
import { parseDebugParams, randomScores } from './debug-params';

/**
 * A debug page that shows the board with test scores. Opened with `?board` on the
 * normal URL. See src/board/README.md for the params.
 */
export function mountDebugBoard(root: HTMLElement): void {
  const setup = parseDebugParams(window.location.search);
  let players = setup.players;

  const page = document.createElement('div');
  page.className = 'hs-debug';
  const stage = document.createElement('div');
  stage.className = 'hs-debug__stage';
  const bar = document.createElement('div');
  bar.className = 'hs-debug__bar';
  page.append(stage, bar);
  root.replaceChildren(page);

  const board = createBoard(stage, setup);

  const button = (text: string, onClick: () => void, colour?: string) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    if (colour) b.style.setProperty('--chip', colour);
    b.addEventListener('click', onClick);
    bar.append(b);
    return b;
  };

  button('Whole track', () => board.showWholeTrack());
  for (const p of players) button(p.name, () => board.focusOn(p.id), p.color);
  button('Random', () => {
    const scores = randomScores(players.length, setup.trackLength, Math.random);
    players = players.map((p, i) => ({ ...p, score: scores[i] }));
    board.setPlayers(players);
  });
}
