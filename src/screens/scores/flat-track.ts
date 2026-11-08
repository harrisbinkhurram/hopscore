// Types only from the board: Three.js must stay out of the first load.
import type { BoardPlayer } from '../../board/layout';

/** Stones per row. Rows wind back and forth, like the garden path. */
export const FLAT_ROW = 10;
/** Every this many stones carries its number, as on the 3D board. */
export const FLAT_NUMBER_EVERY = 5;

/** Layout units: one stone is `UNIT` wide, one row `ROW` tall. */
const UNIT = 30;
const ROW = 40;
const STONE_R = 11;
const MARK_R = 8.5;
const MARK_GAP = 12;

export interface FlatStone {
  /** 0 is the start, the track length the finish. */
  n: number;
  x: number;
  y: number;
  numbered: boolean;
}

export interface FlatMarker {
  id: string;
  name: string;
  color: string;
  stone: number;
  x: number;
  y: number;
}

export interface FlatTrack {
  width: number;
  height: number;
  stones: FlatStone[];
  /** In the players' order. */
  markers: FlatMarker[];
}

/**
 * The 2D track: stones 0 to `trackLength` in rows that wind back and forth, and one marker per
 * player on their stone (a score past the finish stands on the finish). Players sharing a stone
 * stand in a small grid on it. No player count is assumed.
 */
export function flatTrackLayout(trackLength: number, players: readonly BoardPlayer[]): FlatTrack {
  const stones: FlatStone[] = [];
  for (let n = 0; n <= trackLength; n++) {
    const row = Math.floor(n / FLAT_ROW);
    const along = n % FLAT_ROW;
    const col = row % 2 === 0 ? along : FLAT_ROW - 1 - along;
    stones.push({ n, x: col * UNIT + UNIT / 2, y: row * ROW + ROW / 2, numbered: n % FLAT_NUMBER_EVERY === 0 });
  }

  const byStone = new Map<number, BoardPlayer[]>();
  for (const p of players) {
    const stone = Math.min(Math.max(Math.round(p.score), 0), trackLength);
    byStone.set(stone, [...(byStone.get(stone) ?? []), p]);
  }
  const markers: FlatMarker[] = [];
  for (const p of players) {
    const stone = Math.min(Math.max(Math.round(p.score), 0), trackLength);
    const group = byStone.get(stone)!;
    const i = group.indexOf(p);
    const cols = group.length === 1 ? 1 : group.length <= 4 ? 2 : 3;
    const rows = Math.ceil(group.length / cols);
    const col = i % cols;
    const row = Math.floor(i / cols);
    markers.push({
      id: p.id,
      name: p.name,
      color: p.color,
      stone,
      x: stones[stone].x + (col - (cols - 1) / 2) * MARK_GAP,
      y: stones[stone].y + (row - (rows - 1) / 2) * MARK_GAP,
    });
  }

  const rowCount = Math.floor(trackLength / FLAT_ROW) + 1;
  // Room under the last row for its stone numbers.
  return { width: FLAT_ROW * UNIT, height: rowCount * ROW + 4, stones, markers };
}

const SVG = 'http://www.w3.org/2000/svg';

function el(name: string, attrs: Record<string, string | number>, text?: string) {
  const node = document.createElementNS(SVG, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Dark text on light colours, white on dark ones. */
function inkOn(hex: string) {
  const v = parseInt(hex.slice(1), 16);
  const lum = 0.2126 * ((v >> 16) & 255) + 0.7152 * ((v >> 8) & 255) + 0.0722 * (v & 255);
  return lum > 150 ? '#2b2433' : '#ffffff';
}

/**
 * Draws the 2D track into `stage`, filling it: the simple board used when the 3D one is too slow
 * or cannot run. No animation; the score list next to it names everyone.
 */
export function showFlatTrack(stage: HTMLElement, trackLength: number, players: readonly BoardPlayer[]) {
  const layout = flatTrackLayout(trackLength, players);
  const svg = el('svg', {
    class: 'sc-flat',
    viewBox: `0 0 ${layout.width} ${layout.height}`,
    preserveAspectRatio: 'xMidYMid meet',
    role: 'img',
  });
  const where = players.map((p) => `${p.name} ${Math.max(0, Math.round(p.score))}`).join(', ');
  svg.setAttribute('aria-label', `Track to ${trackLength}: ${where}`);

  const path = layout.stones.map((s, i) => `${i === 0 ? 'M' : 'L'}${s.x} ${s.y}`).join(' ');
  svg.append(el('path', { class: 'sc-flat-path', d: path }));
  for (const s of layout.stones) {
    const finish = s.n === trackLength;
    svg.append(el('circle', { class: `sc-flat-stone${finish ? ' is-finish' : ''}`, cx: s.x, cy: s.y, r: STONE_R }));
    if (s.numbered || finish) {
      svg.append(el('text', { class: 'sc-flat-number', x: s.x, y: s.y + STONE_R + 9 }, String(s.n)));
    }
  }
  for (const m of layout.markers) {
    const g = el('g', { class: 'sc-flat-marker' });
    g.append(
      el('circle', { cx: m.x, cy: m.y, r: MARK_R, fill: m.color }),
      el('text', { x: m.x, y: m.y + 0.5, fill: inkOn(m.color) }, [...m.name][0]?.toUpperCase() ?? ''),
    );
    svg.append(g);
  }
  stage.append(svg);
  return svg;
}
