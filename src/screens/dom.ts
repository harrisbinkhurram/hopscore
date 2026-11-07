import './common.css';
import { bunnyColour } from '../storage/colours';

/** Creates an element with properties and children. `role` is set as an attribute. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> & { role?: string } = {},
  ...children: Node[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  const { role, ...rest } = props;
  Object.assign(el, rest);
  if (role) el.setAttribute('role', role);
  el.append(...children);
  return el;
}

export function button(text: string, className: string, onClick: () => void) {
  const b = h('button', { type: 'button', className, textContent: text });
  b.addEventListener('click', onClick);
  return b;
}

/** A round dot in a bunny colour. Decorative: the name is always shown next to it. */
export function swatch(colourId: string) {
  const s = h('span', { className: 'swatch' });
  s.style.background = bunnyColour(colourId).hex;
  s.setAttribute('aria-hidden', 'true');
  return s;
}

export function errorLine(text: string) {
  return h('p', { className: 'error-line', role: 'alert', textContent: text });
}
