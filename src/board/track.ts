/**
 * The stepping-stone path, as plain numbers (no Three.js), so it can be unit tested.
 *
 * World axes: x is left/right on screen, z points towards the camera, y is up.
 * The path starts near the camera (positive z) and winds away from it (negative z),
 * so on a portrait screen it reads bottom to top.
 */

/** Distance between the centres of two neighbouring stones. */
export const STONE_SPACING = 1.2;

/** Radius of one stone. */
export const STONE_RADIUS = 0.46;

/** Widest the path swings left or right of the centre line. */
const MAX_SWING = 3;

/**
 * Steepest the path may turn away from straight up the screen. Bunnies that share
 * a stone stand side by side along the screen's x axis; keeping the path mostly
 * upright keeps them clear of the bunnies on the next stone.
 */
export const MAX_TURN_DEGREES = 30;

export interface Stone {
  /** 0 is the start, `trackLength` is the finish. */
  index: number;
  x: number;
  z: number;
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

/**
 * Builds a track of `trackLength` steps: `trackLength + 1` stones, evenly spaced
 * along a gentle S-curve.
 */
export function buildTrack(trackLength: number): Track {
  const length = Math.max(1, Math.floor(trackLength));
  const total = length * STONE_SPACING;

  // About one full left-right swing per 25 steps.
  const waves = Math.max(1, Math.round(length / 25));
  // Keep the swing small enough that the path still has to climb (a sine wave
  // with zero height is 4 * swing long per wave).
  let swing = Math.min(MAX_SWING, (0.6 * total) / (4 * waves));
  let height = solveHeight(total, swing, waves);
  // The sine's steepest slope is swing * 2 * pi * waves / height. Narrow the swing until it
  // stays within MAX_TURN_DEGREES (a few rounds converge: the path gets taller as it narrows).
  const maxSlope = Math.tan((MAX_TURN_DEGREES * Math.PI) / 180) * 0.98;
  for (let i = 0; i < 20 && (swing * 2 * Math.PI * waves) / height > maxSlope; i += 1) {
    swing = (maxSlope * height) / (2 * Math.PI * waves);
    height = solveHeight(total, swing, waves);
  }

  const curve = (u: number) => ({
    x: swing * Math.sin(2 * Math.PI * waves * u),
    z: height / 2 - height * u,
  });

  const samples = sampleByLength(curve, 400 * waves);
  const stones: Stone[] = [];
  for (let i = 0; i <= length; i += 1) {
    const at = pointAtLength(samples, (i / length) * samples.total);
    stones.push({ index: i, ...at });
  }
  return { length, stones };
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

function curveLength(height: number, swing: number, waves: number): number {
  const steps = 200 * waves;
  let s = 0;
  let px = 0;
  let pz = 0;
  for (let i = 1; i <= steps; i += 1) {
    const u = i / steps;
    const x = swing * Math.sin(2 * Math.PI * waves * u);
    const z = -height * u;
    s += Math.hypot(x - px, z - pz);
    px = x;
    pz = z;
  }
  return s;
}

/** Finds the path height that makes the curve `total` long. */
function solveHeight(total: number, swing: number, waves: number): number {
  let lo = 0;
  let hi = total;
  for (let i = 0; i < 50; i += 1) {
    const mid = (lo + hi) / 2;
    if (curveLength(mid, swing, waves) < total) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
