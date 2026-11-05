import './style.css';
import { APP_NAME, APP_TAGLINE } from './app/branding';

const app = document.querySelector<HTMLElement>('#app');
if (app && new URLSearchParams(window.location.search).has('board')) {
  // Debug view of the 3D board. Loaded on demand, so Three.js stays out of the first load.
  void import('./board/debug').then((m) => m.mountDebugBoard(app));
} else if (app) {
  const title = document.createElement('h1');
  title.className = 'title';
  title.textContent = APP_NAME;

  const tagline = document.createElement('p');
  tagline.className = 'tagline';
  tagline.textContent = APP_TAGLINE;

  const note = document.createElement('p');
  note.className = 'note';
  note.textContent = 'Coming soon.';

  app.replaceChildren(title, tagline, note);
}
