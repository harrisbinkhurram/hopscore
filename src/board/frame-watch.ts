/**
 * When a round plays too slowly. Averaging a window (not counting single long frames) lets a
 * short hitch pass; the limit sits below the 30 fps cap of battery-saver modes, so a capped
 * phone is not mistaken for a slow one.
 */
export const FRAME_WATCH = {
  /** Frames ignored after a reset: the first frames of a round can stutter on any phone. */
  warmUpFrames: 6,
  /** How many frames are averaged: short enough to fill within one round on a slow phone (about 2 s at 12 fps). */
  windowFrames: 24,
  /** Average frame time above which the board is too slow: under 24 fps. */
  slowMs: 1000 / 24,
  /** A longer frame is a pause (tab hidden, phone busy elsewhere), not drawing: ignored. */
  gapMs: 250,
} as const;

export interface FrameWatch {
  /** Adds one frame's duration. True when the window is full and too slow; it then starts again. */
  add(ms: number): boolean;
  /** Starts again, with a new warm-up: at a new round, or after the board turned its effects down. */
  reset(): void;
}

/** Feed it only frames drawn one after another while a round plays: idle gaps are not frames. */
export function createFrameWatch(settings: typeof FRAME_WATCH = FRAME_WATCH): FrameWatch {
  let warmUp = settings.warmUpFrames;
  let frames: number[] = [];
  let total = 0;

  const reset = () => {
    warmUp = settings.warmUpFrames;
    frames = [];
    total = 0;
  };

  return {
    add(ms) {
      if (!(ms > 0) || ms > settings.gapMs) return false;
      if (warmUp > 0) {
        warmUp -= 1;
        return false;
      }
      frames.push(ms);
      total += ms;
      if (frames.length > settings.windowFrames) total -= frames.shift()!;
      if (frames.length < settings.windowFrames || total / frames.length <= settings.slowMs) return false;
      reset();
      return true;
    },
    reset,
  };
}
