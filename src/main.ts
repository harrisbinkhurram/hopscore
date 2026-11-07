import './style.css';
import { APP_NAME, APP_TAGLINE } from './app/branding';
import { gameOver, type Game } from './game';
import { button, h } from './screens/dom';
import { showPlayersScreen } from './screens/players/players-screen';
import { showRoundScreen, type RoundDraft } from './screens/round/round-screen';
import type { PlayMode } from './screens/scores/board-input';
import { showScoresScreen } from './screens/scores/scores-screen';
import { showSetupScreen } from './screens/setup/setup-screen';
import { createPlayerStore } from './storage/player-store';

const app = document.querySelector<HTMLElement>('#app');
const store = createPlayerStore();
let leaveScreen: (() => void) | null = null;

/** The game in progress, kept for this page visit only (saving it is task 07). */
let game: Game | null = null;
/** Where Resume goes back to. */
let gameView: 'round' | 'scores' = 'round';
/** Votes entered before Home was tapped mid-round. */
let roundDraft: RoundDraft | undefined;

function open(show: () => () => void) {
  leaveScreen?.();
  leaveScreen = show();
  guardGame();
}

function inProgress(): boolean {
  return game !== null && !gameOver(game);
}

/**
 * Until task 07 saves the game, a reload or leaving the page loses it. While a game is in
 * progress: no pull-to-refresh (html.in-game in style.css), and the browser asks before leaving.
 */
function guardGame() {
  document.documentElement.classList.toggle('in-game', inProgress());
}

window.addEventListener('beforeunload', (event) => {
  if (inProgress()) event.preventDefault();
});

function showHome(root: HTMLElement) {
  leaveScreen?.();
  leaveScreen = null;
  guardGame();
  root.classList.remove('screen-root');

  const parts: HTMLElement[] = [
    h('h1', { className: 'title', textContent: APP_NAME }),
    h('p', { className: 'tagline', textContent: APP_TAGLINE }),
    button('New game', 'btn btn-primary home-link', () => showSetup(root)),
  ];
  if (inProgress()) {
    parts.push(button('Resume game', 'btn home-link', () => showGame(root, gameView)));
  }
  parts.push(button('Players & groups', 'btn btn-ghost home-link', () =>
    open(() => showPlayersScreen(root, store, { onBack: () => showHome(root) }))));
  root.replaceChildren(...parts);
}

function showSetup(root: HTMLElement) {
  open(() => showSetupScreen(root, store, {
    replacing: inProgress(),
    onBack: () => showHome(root),
    onStart: (started) => {
      game = started;
      roundDraft = undefined;
      showGame(root, 'round');
    },
  }));
}

/** `play` says what the board plays when the scores open: only straight after Confirm or End game. */
function showGame(root: HTMLElement, view: 'round' | 'scores', play: PlayMode = 'none') {
  const current = game;
  if (!current) return showHome(root);
  gameView = view;
  const onHome = () => showHome(root);
  if (view === 'round') {
    open(() => showRoundScreen(root, current, {
      draft: roundDraft,
      onHome: (draft) => {
        roundDraft = draft;
        onHome();
      },
      onConfirm: (next) => {
        game = next;
        roundDraft = undefined;
        showGame(root, 'scores', 'round');
      },
    }));
  } else {
    open(() => showScoresScreen(root, current, {
      play,
      onHome,
      onNextRound: () => showGame(root, 'round'),
      onEnd: (ended) => {
        game = ended;
        showGame(root, 'scores', 'finale');
      },
      onDone: () => {
        game = null;
        showHome(root);
      },
    }));
  }
}

if (app && new URLSearchParams(window.location.search).has('board')) {
  // Debug view of the 3D board. Loaded on demand, so Three.js stays out of the first load.
  void import('./board/debug').then((m) => m.mountDebugBoard(app));
} else if (app) {
  showHome(app);
}
