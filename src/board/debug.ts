import './debug.css';
import { createBoard } from './board';
import type { BoardPlayer } from './layout';
import { parseDebugParams, randomGains, randomScores } from './debug-params';

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

  const board = createBoard(stage, {
    ...setup,
    onPlayingChange: (playing) => {
      skipButton.disabled = !playing;
    },
  });

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

  /** Plays a round with these gains; whoever reaches the finish wins. */
  const playRound = (gains: number[]) => {
    const after: BoardPlayer[] = players.map((p, i) => ({ ...p, score: p.score + gains[i] }));
    const top = Math.max(...after.map((p) => p.score));
    const winners = top >= setup.trackLength ? after.filter((p) => p.score === top).map((p) => p.id) : [];
    const storyteller = players[Math.floor(Math.random() * players.length)].id;
    players = after;
    void board.play({
      players: after,
      gains: Object.fromEntries(after.map((p, i) => [p.id, gains[i]])),
      storyteller,
      winners,
    });
  };

  button('Play round', () => playRound(randomGains(players.length, Math.random)));
  button('Final round', () => {
    const leader = players.reduce((best, p) => (p.score > best.score ? p : best), players[0]);
    const gains = randomGains(players.length, Math.random).map((g, i) =>
      players[i] === leader ? Math.max(1, setup.trackLength - leader.score) : Math.min(g, 3));
    playRound(gains);
  });
  const skipButton = button('Skip', () => board.skip());
  skipButton.disabled = true;
}
