import './style.css';
import { APP_NAME, APP_TAGLINE } from './app/branding';
import { gameOver, nextRedo, redoNext, restoreGame, undoLast, type Game, type RoundDraft } from './game';
import { button, h } from './screens/dom';
import { showHistoryScreen } from './screens/history/history-screen';
import { showPlayersScreen } from './screens/players/players-screen';
import { showRoundScreen } from './screens/round/round-screen';
import type { PlayMode } from './screens/scores/board-input';
import { showScoresScreen } from './screens/scores/scores-screen';
import { showSetupScreen } from './screens/setup/setup-screen';
import { createGameStore } from './storage/game-store';
import { createPlayerStore } from './storage/player-store';

const app = document.querySelector<HTMLElement>('#app');
const store = createPlayerStore();
const games = createGameStore();
let leaveScreen: (() => void) | null = null;

/** The game in progress. Saved after every step, so it survives closing the app. */
let game: Game | null = null;
/** Where Resume goes back to. */
let gameView: 'round' | 'scores' = 'round';
/** Votes entered before Home was tapped mid-round. */
let roundDraft: RoundDraft | undefined;
/** When the game became over, so the history shows that date even if Done comes later. */
let endedAt: number | undefined;

loadSavedGame();

/**
 * Picks up the game saved last time. A game that breaks a rule is dropped (the players are
 * kept on their own key); one that was already over goes into the history, unless it is kept
 * safe for a newer app: it cannot be cleared, so it would be recorded again on every visit.
 */
function loadSavedGame() {
  const saved = games.savedGame();
  if (!saved) return;
  const restored = restoreGame(saved.game);
  if (!restored) {
    games.clearGame();
  } else if (gameOver(restored)) {
    if (!games.gameKeptSafe) finishGame(restored, saved.endedAt);
  } else {
    game = restored;
    gameView = saved.view;
    roundDraft = saved.draft ?? undefined;
  }
}

function saveGame() {
  if (!game) return games.clearGame();
  // Stamped once when the game becomes over; Undo reopening it clears the stamp.
  endedAt = gameOver(game) ? (endedAt ?? Date.now()) : undefined;
  games.saveGame({ game, view: gameView, draft: roundDraft ?? null, endedAt });
}

/** Moves a finished game into the history, dated when it ended (now if unknown), and clears it. */
function finishGame(finished: Game, at = Date.now()) {
  games.recordFinished({
    trackLength: finished.trackLength,
    rounds: finished.rounds.length,
    endedByHand: finished.endedByHand,
    players: finished.seats.map((s) => ({ name: s.name, colour: s.colour, score: finished.totals[s.id] ?? 0 })),
  }, at);
  games.clearGame();
}

function open(show: () => () => void) {
  leaveScreen?.();
  leaveScreen = show();
  guardGame();
}

function inProgress(): boolean {
  return game !== null && !gameOver(game);
}

/**
 * While a game is in progress: no pull-to-refresh (html.in-game in style.css), and the browser
 * asks before leaving. The game is saved, but the prompt is kept on purpose (HS-07): votes
 * being entered are not saved until Home, and storage can be blocked or full.
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
  if (games.history().length > 0) {
    parts.push(button('Past games', 'btn btn-ghost home-link', () =>
      open(() => showHistoryScreen(root, games, { onBack: () => showHome(root) }))));
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
      endedAt = undefined;
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
  saveGame();
  const onHome = () => showHome(root);
  if (view === 'round') {
    open(() => showRoundScreen(root, current, {
      draft: roundDraft,
      onHome: (draft) => {
        roundDraft = draft;
        saveGame();
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
        finishGame(current, endedAt);
        game = null;
        endedAt = undefined;
        showHome(root);
      },
      onUndo: () => {
        game = undoLast(current);
        roundDraft = undefined;
        showGame(root, 'scores', { undoneFrom: current });
      },
      onRedo: () => {
        const step = nextRedo(current);
        game = redoNext(current);
        roundDraft = undefined;
        showGame(root, 'scores', step?.kind === 'end' ? 'finale' : 'round');
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
