import { describe, expect, it } from 'vitest';
import { distanceOf, groundPointAt, poseAt, project, type CameraPose, type Lens } from './camera';
import { attachControls } from './controls';

const W = 390;
const H = 700;
const LENS: Lens = { fov: 40, aspect: W / H };
const LIMITS = { minDistance: 2.5, maxDistance: 80, minX: -10, maxX: 10, minZ: -30, maxZ: 30 };

/** A stand-in element: enough of the DOM for the controls to listen and measure. */
function fakeElement() {
  const listeners = new Map<string, (e: unknown) => void>();
  const el = {
    addEventListener: (type: string, fn: (e: unknown) => void) => listeners.set(type, fn),
    removeEventListener: (type: string) => listeners.delete(type),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: W, height: H }),
    setPointerCapture: () => {},
  };
  const fire = (type: string, id: number, x: number, y: number) =>
    listeners.get(type)?.({ pointerId: id, pointerType: 'touch', button: 0, clientX: x, clientY: y });
  return { el: el as unknown as HTMLElement, fire, listeners };
}

function setup(start: CameraPose) {
  let pose: CameraPose | null = start;
  let resets = 0;
  const { el, fire, listeners } = fakeElement();
  const detach = attachControls(el, {
    pose: () => pose,
    lens: () => LENS,
    limits: () => LIMITS,
    move: (p) => {
      pose = p;
    },
    reset: () => {
      resets += 1;
    },
  });
  return { fire, listeners, detach, pose: () => pose!, resets: () => resets };
}

/** Screen pixel of a ground point. */
function pixel(p: { x: number; y: number; z: number }, pose: CameraPose) {
  const s = project(p, pose, LENS);
  return { x: ((s.x + 1) / 2) * W, y: ((1 - s.y) / 2) * H };
}

function groundAtPixel(x: number, y: number, pose: CameraPose) {
  return groundPointAt((x / W) * 2 - 1, 1 - (y / H) * 2, pose, LENS)!;
}

describe('attachControls', () => {
  const start = poseAt({ x: 0, y: 0.8, z: 0 }, 40);

  it('pans so the ground stays under one finger', () => {
    const c = setup(start);
    const grabbed = groundAtPixel(200, 300, start);
    c.fire('pointerdown', 1, 200, 300);
    for (let i = 1; i <= 10; i += 1) c.fire('pointermove', 1, 200 + i * 5, 300 + i * 8);
    c.fire('pointerup', 1, 250, 380);
    const at = pixel(grabbed, c.pose());
    expect(at.x).toBeCloseTo(250, 0);
    expect(at.y).toBeCloseTo(380, 0);
    expect(distanceOf(c.pose())).toBeCloseTo(40);
  });

  it('pinches in about the point between the fingers', () => {
    const c = setup(start);
    const middle = groundAtPixel(200, 450, start);
    c.fire('pointerdown', 1, 180, 450);
    c.fire('pointerdown', 2, 220, 450);
    for (let i = 1; i <= 10; i += 1) {
      c.fire('pointermove', 1, 180 - i * 6, 450);
      c.fire('pointermove', 2, 220 + i * 6, 450);
    }
    c.fire('pointerup', 1, 120, 450);
    c.fire('pointerup', 2, 280, 450);
    // Fingers spread 40px -> 160px: four times closer.
    expect(distanceOf(c.pose())).toBeCloseTo(10, 0);
    const at = pixel(middle, c.pose());
    expect(at.x).toBeCloseTo(200, 0);
    expect(at.y).toBeCloseTo(450, 0);
  });

  it('never zooms past the limits', () => {
    const c = setup(start);
    c.fire('pointerdown', 1, 190, 350);
    c.fire('pointerdown', 2, 200, 350);
    for (let i = 1; i <= 40; i += 1) c.fire('pointermove', 2, 200 + i * 10, 350);
    expect(distanceOf(c.pose())).toBeGreaterThanOrEqual(LIMITS.minDistance - 1e-9);
  });

  it('resets on a double tap, but not after a drag', () => {
    const c = setup(start);
    c.fire('pointerdown', 1, 100, 100);
    c.fire('pointerup', 1, 100, 100);
    c.fire('pointerdown', 1, 102, 101);
    c.fire('pointerup', 1, 102, 101);
    expect(c.resets()).toBe(1);

    c.fire('pointerdown', 1, 100, 100);
    c.fire('pointermove', 1, 160, 100);
    c.fire('pointerup', 1, 160, 100);
    c.fire('pointerdown', 1, 160, 100);
    c.fire('pointerup', 1, 160, 100);
    expect(c.resets()).toBe(1);
  });

  it('stops listening when detached', () => {
    const c = setup(start);
    c.detach();
    expect(c.listeners.size).toBe(0);
  });
});

describe('attachControls tap', () => {
  const start = poseAt({ x: 0, y: 0.8, z: 0 }, 40);

  function setupTaps() {
    let pose: CameraPose = start;
    const counts = { taps: 0, resets: 0 };
    const { el, fire } = fakeElement();
    attachControls(el, {
      pose: () => pose,
      lens: () => LENS,
      limits: () => LIMITS,
      move: (p) => {
        pose = p;
      },
      reset: () => {
        counts.resets += 1;
      },
      tap: () => {
        counts.taps += 1;
      },
    });
    return { fire, counts };
  }

  it('reports a single tap at once', () => {
    const c = setupTaps();
    c.fire('pointerdown', 1, 100, 100);
    c.fire('pointerup', 1, 100, 100);
    expect(c.counts).toEqual({ taps: 1, resets: 0 });
  });

  it('reports one tap and one reset for a double tap', () => {
    const c = setupTaps();
    c.fire('pointerdown', 1, 100, 100);
    c.fire('pointerup', 1, 100, 100);
    c.fire('pointerdown', 1, 102, 101);
    c.fire('pointerup', 1, 102, 101);
    expect(c.counts).toEqual({ taps: 1, resets: 1 });
  });

  it('does not tap after a drag', () => {
    const c = setupTaps();
    c.fire('pointerdown', 1, 100, 100);
    c.fire('pointermove', 1, 160, 100);
    c.fire('pointerup', 1, 160, 100);
    expect(c.counts.taps).toBe(0);
  });

  it('does not tap after a pinch, whichever finger lifts last', () => {
    const c = setupTaps();
    c.fire('pointerdown', 1, 180, 450);
    c.fire('pointerdown', 2, 220, 450);
    c.fire('pointerup', 2, 220, 450);
    c.fire('pointerup', 1, 180, 450);
    expect(c.counts.taps).toBe(0);
  });

  it('does not tap when the browser cancels the touch', () => {
    const c = setupTaps();
    c.fire('pointerdown', 1, 100, 100);
    c.fire('pointercancel', 1, 100, 100);
    expect(c.counts.taps).toBe(0);
  });
});
