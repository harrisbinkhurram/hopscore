import './style.css';
import { APP_NAME, APP_TAGLINE } from './app/branding';

const app = document.querySelector<HTMLElement>('#app');
if (app) {
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
