import './style.css';
import { APP_NAME, APP_TAGLINE } from './app/branding';
import { showPlayersScreen } from './screens/players/players-screen';
import { createPlayerStore } from './storage/player-store';

const app = document.querySelector<HTMLElement>('#app');
const store = createPlayerStore();
let leaveScreen: (() => void) | null = null;

function showHome(root: HTMLElement) {
  leaveScreen?.();
  leaveScreen = null;
  root.classList.remove('screen-root');

  const title = document.createElement('h1');
  title.className = 'title';
  title.textContent = APP_NAME;

  const tagline = document.createElement('p');
  tagline.className = 'tagline';
  tagline.textContent = APP_TAGLINE;

  const note = document.createElement('p');
  note.className = 'note';
  note.textContent = 'Coming soon.';

  const players = document.createElement('button');
  players.type = 'button';
  players.className = 'btn btn-primary home-link';
  players.textContent = 'Players & groups';
  players.addEventListener('click', () => {
    leaveScreen = showPlayersScreen(root, store, { onBack: () => showHome(root) });
  });

  root.replaceChildren(title, tagline, note, players);
}

if (app) showHome(app);
