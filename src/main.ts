import './style.css';
import { APP_NAME, APP_TAGLINE, DISCLAIMER } from './app/branding';
import { watchForUpdates } from './app/updates';
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
/** The screen on show, so a change from elsewhere (another tab, a new version) knows what to do. */
let current: 'home' | 'setup' | 'round' | 'scores' | 'other' = 'other';
/** Said once on the next Home, for example after another tab changed the game. */
let notice: string | null = null;
/** True while reloading into a new version: the game is saved, so the page may go without asking. */
let updating = false;

/** The game in progress. Saved after every step, so it survives closing the app. */
let game: Game | null = null;
/** Where Resume goes back to. */
let gameView: 'round' | 'scores' = 'round';
/** Votes entered for the next round so far; saved as they are tapped. */
let roundDraft: RoundDraft | undefined;
/** When the game became over, so the history shows that date even if Done comes later. */
let endedAt: number | undefined;

loadSavedGame();
games.onGameChanged(gameChangedElsewhere);

const updates = import.meta.env.PROD && 'serviceWorker' in navigator
  ? watchForUpdates(navigator.serviceWorker, `${import.meta.env.BASE_URL}sw.js`, import.meta.env.BASE_URL, () => {
    if (current === 'home' && app) showHome(app);
  }, reloadForUpdate)
  : null;
// An installed app can sit in the background for days without loading a page.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') updates?.check();
});

function reloadForUpdate() {
  updating = true;
  window.location.reload();
}

/**
 * Picks up the game saved last time. A game that breaks a rule is dropped (the players are
 * kept on their own key); one that was already over goes into the history. A game kept safe
 * for a newer app is left alone: it cannot be saved or cleared here, so playing or finishing it
 * would record it again on every visit (Home says why there is no Resume).
 */
function loadSavedGame() {
  const saved = games.savedGame();
  if (!saved || games.gameKeptSafe) return;
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

/**
 * Another tab changed the saved game. Take its game (one that is over there is left for that
 * tab to record) and never write back, so two tabs cannot set each other off. If only the votes
 * or the screen changed, stay put; otherwise go Home, so this tab's old copy is never saved over
 * the newer game.
 */
function gameChangedElsewhere() {
  const before = game;
  const saved = games.gameKeptSafe ? null : games.savedGame();
  const restored = saved ? restoreGame(saved.game) : null;
  if (saved && restored && !gameOver(restored)) {
    game = restored;
    gameView = saved.view;
    roundDraft = saved.draft ?? undefined;
  } else {
    game = null;
    roundDraft = undefined;
  }
  endedAt = undefined;
  if (sameGame(before, game) || current === 'other' || !app) return;
  notice = 'This game was changed in another tab.';
  showHome(app);
}

/** Same players, rounds, End game and Redo: only the votes being entered or the screen differ. */
function sameGame(a: Game | null, b: Game | null): boolean {
  const key = (g: Game | null) => g && JSON.stringify([g.seats, g.trackLength, g.storyteller, g.rounds, g.endedByHand, g.redo]);
  return key(a) === key(b);
}

/**
 * A game another tab ended is left for that tab to record (see `gameChangedElsewhere`). Before a
 * new game is saved over it, record it here, so it is not lost. Saving the new game sends the
 * other tab Home, so it cannot record it again.
 */
function recordGameEndedElsewhere() {
  const saved = games.gameKeptSafe ? null : games.savedGame();
  const restored = saved ? restoreGame(saved.game) : null;
  if (saved && restored && gameOver(restored)) finishGame(restored, saved.endedAt);
}

function open(screen: typeof current, show: () => () => void) {
  leaveScreen?.();
  current = screen;
  leaveScreen = show();
  guardGame();
}

function inProgress(): boolean {
  return game !== null && !gameOver(game);
}

/**
 * While a game is in progress: no pull-to-refresh (html.in-game in style.css), and the browser
 * asks before leaving. The game and the votes are saved as they change, but the prompt is kept
 * on purpose: storage can be blocked or full, and then leaving loses the game.
 */
function guardGame() {
  document.documentElement.classList.toggle('in-game', inProgress());
}

window.addEventListener('beforeunload', (event) => {
  if (inProgress() && !updating) event.preventDefault();
});

function showHome(root: HTMLElement) {
  // Another tab moved to a new version: this page runs the old code, and Home is a safe place to reload.
  if (updates?.reloadNeeded) return reloadForUpdate();
  leaveScreen?.();
  leaveScreen = null;
  current = 'home';
  guardGame();
  root.classList.remove('screen-root');

  const parts: HTMLElement[] = [
    h('h1', { className: 'title', textContent: APP_NAME }),
    h('p', { className: 'tagline', textContent: APP_TAGLINE }),
  ];
  if (notice) parts.push(h('p', { className: 'home-notice', role: 'status', textContent: notice }));
  notice = null;
  if (games.gameKeptSafe) {
    parts.push(h('p', { className: 'home-notice', textContent: 'A saved game could not be opened by this version of Hopscore. It is kept safe, not changed.' }));
  }
  if (updates?.ready) {
    parts.push(button('New version ready: tap to update', 'btn home-link home-update', () => updates.apply()));
  }
  parts.push(button('New game', 'btn btn-primary home-link', () => showSetup(root)));
  if (inProgress()) {
    parts.push(button('Resume game', 'btn home-link', () => showGame(root, gameView)));
  }
  if (games.history().length > 0) {
    parts.push(button('Past games', 'btn btn-ghost home-link', () =>
      open('other', () => showHistoryScreen(root, games, { onBack: () => showHome(root) }))));
  }
  parts.push(button('Players & groups', 'btn btn-ghost home-link', () =>
    open('other', () => showPlayersScreen(root, store, { onBack: () => showHome(root) }))));
  parts.push(h('footer', { className: 'home-footer', textContent: DISCLAIMER }));
  root.replaceChildren(...parts);
}

function showSetup(root: HTMLElement) {
  open('setup', () => showSetupScreen(root, store, {
    replacing: inProgress(),
    onBack: () => showHome(root),
    onStart: (started) => {
      recordGameEndedElsewhere();
      game = started;
      endedAt = undefined;
      roundDraft = undefined;
      showGame(root, 'round');
    },
  }));
}

/** `play` says what the board plays when the scores open: only straight after Confirm or End game. */
function showGame(root: HTMLElement, view: 'round' | 'scores', play: PlayMode = 'none') {
  const shown = game;
  if (!shown) return showHome(root);
  gameView = view;
  saveGame();
  const onHome = () => showHome(root);
  if (view === 'round') {
    open('round', () => showRoundScreen(root, shown, {
      draft: roundDraft,
      onDraftChange: (draft) => {
        roundDraft = draft;
        saveGame();
      },
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
    open('scores', () => showScoresScreen(root, shown, {
      play,
      onHome,
      onNextRound: () => showGame(root, 'round'),
      onEnd: (ended) => {
        game = ended;
        showGame(root, 'scores', 'finale');
      },
      onDone: () => {
        finishGame(shown, endedAt);
        game = null;
        endedAt = undefined;
        showHome(root);
      },
      onUndo: () => {
        game = undoLast(shown);
        roundDraft = undefined;
        showGame(root, 'scores', { undoneFrom: shown });
      },
      onRedo: () => {
        const step = nextRedo(shown);
        game = redoNext(shown);
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
