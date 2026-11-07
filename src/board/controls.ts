import { clampPose, groundPointAt, panBy, zoomAbout, type CameraPose, type Lens, type Limits } from './camera';

/**
 * Touch and mouse control of the board camera.
 *
 * - One finger (or mouse drag) pans: the ground stays under the finger.
 * - Two fingers pinch to zoom, about the point between them, and pan as they move.
 * - Mouse wheel / trackpad zooms about the cursor.
 * - Double tap (or double click) goes back to the whole track.
 * - A single tap is reported at once (the board uses it to skip a round). The second tap of a
 *   double tap only resets.
 */
export interface ControlsHost {
  pose(): CameraPose | null;
  lens(): Lens;
  limits(): Limits;
  /** Called with the new pose on every gesture step. */
  move(pose: CameraPose): void;
  /** Double tap. */
  reset(): void;
  /** A single tap: no movement, one finger, not a cancelled touch. */
  tap?(): void;
}

const DOUBLE_TAP_MS = 320;
const TAP_SLOP_PX = 10;

export function attachControls(el: HTMLElement, host: ControlsHost): () => void {
  const pointers = new Map<number, { x: number; y: number }>();
  let lastTap = { time: 0, x: 0, y: 0 };
  let downAt = { x: 0, y: 0, moved: false };

  const toScreen = (x: number, y: number) => {
    const rect = el.getBoundingClientRect();
    return {
      sx: ((x - rect.left) / (rect.width || 1)) * 2 - 1,
      sy: 1 - ((y - rect.top) / (rect.height || 1)) * 2,
    };
  };

  const ground = (pose: CameraPose, x: number, y: number) => {
    const { sx, sy } = toScreen(x, y);
    return groundPointAt(sx, sy, pose, host.lens());
  };

  const apply = (pose: CameraPose) => host.move(clampPose(pose, host.limits()));

  /** Moves the camera so the ground under `from` ends up under `to`. */
  const panScreen = (pose: CameraPose, from: { x: number; y: number }, to: { x: number; y: number }) => {
    const a = ground(pose, from.x, from.y);
    const b = ground(pose, to.x, to.y);
    return a && b ? panBy(pose, a.x - b.x, a.z - b.z) : pose;
  };

  const zoomScreen = (pose: CameraPose, factor: number, at: { x: number; y: number }) => {
    const anchor = ground(pose, at.x, at.y) ?? pose.target;
    return zoomAbout(pose, factor, anchor);
  };

  const mid = () => {
    const [a, b] = [...pointers.values()];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, spread: Math.hypot(a.x - b.x, a.y - b.y) };
  };

  function onDown(e: PointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // The pointer is already gone (or synthetic); the gesture still works without capture.
    }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) downAt = { x: e.clientX, y: e.clientY, moved: false };
    else downAt.moved = true; // a pinch is never a tap
  }

  function onMove(e: PointerEvent) {
    const prev = pointers.get(e.pointerId);
    const pose = host.pose();
    if (!prev || !pose) return;
    const next = { x: e.clientX, y: e.clientY };

    if (Math.hypot(next.x - downAt.x, next.y - downAt.y) > TAP_SLOP_PX) downAt.moved = true;

    if (pointers.size === 1) {
      pointers.set(e.pointerId, next);
      apply(panScreen(pose, prev, next));
    } else if (pointers.size === 2) {
      const before = mid();
      pointers.set(e.pointerId, next);
      const after = mid();
      let moved = panScreen(pose, before, after);
      if (before.spread > 0 && after.spread > 0) {
        moved = zoomScreen(moved, before.spread / after.spread, after);
      }
      apply(moved);
    }
  }

  function onUp(e: PointerEvent, cancelled = false) {
    if (!pointers.delete(e.pointerId)) return;
    if (pointers.size > 0 || downAt.moved || cancelled) return;
    const now = performance.now();
    const near = Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < TAP_SLOP_PX * 3;
    if (now - lastTap.time < DOUBLE_TAP_MS && near) {
      lastTap = { time: 0, x: 0, y: 0 };
      host.reset();
    } else {
      lastTap = { time: now, x: e.clientX, y: e.clientY };
      host.tap?.();
    }
  }

  /** The browser took the touch over (a scroll, a system gesture): never a tap. */
  function onCancel(e: PointerEvent) {
    onUp(e, true);
  }

  function onWheel(e: WheelEvent) {
    const pose = host.pose();
    if (!pose) return;
    e.preventDefault();
    // Pixel-ish deltas; line-mode wheels report about 1/30 of that.
    const delta = e.deltaMode === 1 ? e.deltaY * 30 : e.deltaY;
    const factor = Math.exp(Math.max(-1, Math.min(1, delta * 0.0018)));
    apply(zoomScreen(pose, factor, { x: e.clientX, y: e.clientY }));
  }

  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onCancel);
  el.addEventListener('wheel', onWheel, { passive: false });

  return () => {
    el.removeEventListener('pointerdown', onDown);
    el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerup', onUp);
    el.removeEventListener('pointercancel', onCancel);
    el.removeEventListener('wheel', onWheel);
  };
}
