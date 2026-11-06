/**
 * The stepping-stone path, as plain numbers (no Three.js), so it can be unit tested.
 *
 * World axes: x is left/right on screen, z points towards the camera, y is up.
 * The path starts near the camera (positive z) and winds away from it (negative z),
 * so on a portrait screen it reads bottom to top.
 */

/** Radius of a stone on the way. Big enough for four bunnies (see layout.ts). */
export const STONE_RADIUS = 1.05;

/** Radius of the start and finish stones, where the whole group can gather. */
export const END_STONE_RADIUS = 1.5;

/** Distance between the centres of two neighbouring stones on the way. */
export const STONE_SPACING = 2.55;

/** Smallest gap between the edges of any two stones that are not neighbours. */
export const MIN_STONE_GAP = 0.3;

/** Smallest gap between the edges of neighbouring stones, also on a tight bend. */
export const MIN_STEP_GAP = 0.25;

/** Width over height the path aims for, to fill a portrait phone screen. */
const PORTRAIT_SHAPE = 0.45;

/**
 * How much the path flattens into side-to-side runs (0 is a plain S-curve, near 1 is
 * almost a zig-zag of rows). Rows use the screen width, so the track stays short.
 */
const SWITCHBACK = 0.55;

export interface Stone {
  /** 0 is the start, `trackLength` is the finish. */
  index: number;
  x: number;
  z: number;
  radius: number;
  /** Unit direction of travel at this stone, in the x/z plane. */
  dirX: number;
  dirZ: number;
}

export interface Track {
  length: number;
  stones: Stone[];
}

/** Stones that show their number: every 5th one, plus the finish. */
export function isNumberedStone(index: number, trackLength: number): boolean {
  return index > 0 && (index % 5 === 0 || index === trackLength);
}

export function stoneRadius(index: number, trackLength: number): number {
  return index === 0 || index === trackLength ? END_STONE_RADIUS : STONE_RADIUS;
}

/** Distance along the path from the start to stone `index`. The end stones get extra room. */
function distanceAlong(index: number, length: number): number {
  const extra = END_STONE_RADIUS - STONE_RADIUS;
  if (index === 0) return 0;
  return extra + index * STONE_SPACING + (index === length ? extra : 0);
}

/**
 * Builds a track of `trackLength` steps: `trackLength + 1` stones along a winding
 * path. It tries a few amounts of winding and keeps the most compact one in which
 * no two stones crowd each other.
 */
export function buildTrack(trackLength: number): Track {
  const length = Math.max(1, Math.floor(trackLength));
  const total = distanceAlong(length, length);

  let best: { height: number; stones: Stone[] } | null = null;
  for (let waves = 0.5; waves <= 8; waves += 0.5) {
    const height = solveHeight(total, waves);
    const stones = placeStones(length, height, waves);
    if (!stonesKeepApart(stones)) continue;
    if (!best || height < best.height) best = { height, stones };
  }
  // A plain gentle curve always keeps apart; it is the fallback.
  best ??= { height: 0, stones: placeStones(length, solveHeight(total, 0.5), 0.5) };
  return { length, stones: best.stones };
}

/** True when every pair of stones has a clear gap, neighbours included. */
export function stonesKeepApart(stones: readonly Stone[]): boolean {
  for (let i = 0; i < stones.length; i += 1) {
    for (let j = i + 1; j < stones.length; j += 1) {
      const a = stones[i];
      const b = stones[j];
      const gap = j === i + 1 ? MIN_STEP_GAP : MIN_STONE_GAP;
      if (Math.hypot(a.x - b.x, a.z - b.z) < a.radius + b.radius + gap) return false;
    }
  }
  return true;
}

function swingFor(height: number): number {
  return Math.max(0.5, (PORTRAIT_SHAPE * height) / 2 - STONE_RADIUS);
}

function curveAt(u: number, height: number, waves: number) {
  const w = 2 * Math.PI * waves;
  return {
    x: swingFor(height) * Math.sin(w * u),
    // Climbs slowly while crossing the middle, quickly at the turns: side-to-side rows.
    z: height / 2 - height * (u - (SWITCHBACK * Math.sin(2 * w * u)) / (2 * w)),
  };
}

function placeStones(length: number, height: number, waves: number): Stone[] {
  const samples = sampleByLength((u) => curveAt(u, height, waves), Math.ceil(600 * waves));
  const total = distanceAlong(length, length);
  const stones: Stone[] = [];
  for (let i = 0; i <= length; i += 1) {
    const at = pointAtLength(samples, (distanceAlong(i, length) / total) * samples.total);
    stones.push({ index: i, ...at, radius: stoneRadius(i, length) });
  }
  return stones;
}

interface Sampled {
  points: { x: number; z: number; s: number }[];
  total: number;
}

function sampleByLength(curve: (u: number) => { x: number; z: number }, count: number): Sampled {
  const points: Sampled['points'] = [];
  let s = 0;
  let prev = curve(0);
  points.push({ ...prev, s: 0 });
  for (let i = 1; i <= count; i += 1) {
    const p = curve(i / count);
    s += Math.hypot(p.x - prev.x, p.z - prev.z);
    points.push({ ...p, s });
    prev = p;
  }
  return { points, total: s };
}

function pointAtLength(samples: Sampled, s: number) {
  const pts = samples.points;
  let lo = 0;
  let hi = pts.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (pts[mid].s < s) lo = mid;
    else hi = mid;
  }
  const a = pts[lo];
  const b = pts[hi];
  const span = b.s - a.s || 1;
  const t = Math.min(1, Math.max(0, (s - a.s) / span));
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const d = Math.hypot(dx, dz) || 1;
  return { x: a.x + dx * t, z: a.z + dz * t, dirX: dx / d, dirZ: dz / d };
}

function curveLength(height: number, waves: number): number {
  const steps = Math.ceil(300 * waves);
  let s = 0;
  let prev = curveAt(0, height, waves);
  for (let i = 1; i <= steps; i += 1) {
    const p = curveAt(i / steps, height, waves);
    s += Math.hypot(p.x - prev.x, p.z - prev.z);
    prev = p;
  }
  return s;
}

/** Finds the path height that makes the curve `total` long (longer as it gets taller). */
function solveHeight(total: number, waves: number): number {
  let lo = 0;
  let hi = total;
  for (let i = 0; i < 40; i += 1) {
    const mid = (lo + hi) / 2;
    if (curveLength(mid, waves) < total) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
