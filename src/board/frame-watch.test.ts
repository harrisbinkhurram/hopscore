import { describe, expect, it } from 'vitest';
import { createFrameWatch, FRAME_WATCH } from './frame-watch';

/** Feeds `count` frames of `ms` each; true if any of them reported slow. */
function feed(watch: ReturnType<typeof createFrameWatch>, ms: number, count: number) {
  let slow = false;
  for (let i = 0; i < count; i++) if (watch.add(ms)) slow = true;
  return slow;
}

const ENOUGH = FRAME_WATCH.warmUpFrames + FRAME_WATCH.windowFrames;

describe('createFrameWatch', () => {
  it('is happy with a smooth 60 fps', () => {
    expect(feed(createFrameWatch(), 1000 / 60, ENOUGH * 4)).toBe(false);
  });

  it('is happy with the 30 fps cap of battery-saver modes', () => {
    expect(feed(createFrameWatch(), 1000 / 30, ENOUGH * 4)).toBe(false);
  });

  it('reports a steady 15 fps once the window is full', () => {
    const watch = createFrameWatch();
    expect(feed(watch, 1000 / 15, ENOUGH - 1)).toBe(false);
    expect(watch.add(1000 / 15)).toBe(true);
  });

  it('ignores slow frames while warming up', () => {
    const watch = createFrameWatch();
    feed(watch, 200, FRAME_WATCH.warmUpFrames);
    expect(feed(watch, 1000 / 60, FRAME_WATCH.windowFrames * 2)).toBe(false);
  });

  it('ignores long pauses, such as the tab being hidden', () => {
    const watch = createFrameWatch();
    for (let i = 0; i < ENOUGH * 2; i++) {
      watch.add(1000 / 60);
      expect(watch.add(5000)).toBe(false);
    }
  });

  it('lets a short hitch pass', () => {
    const watch = createFrameWatch();
    feed(watch, 1000 / 60, ENOUGH);
    // Two long frames, as a garbage collection or a notification might cause.
    expect(feed(watch, 150, 2)).toBe(false);
    expect(feed(watch, 1000 / 60, ENOUGH)).toBe(false);
  });

  it('starts again after reporting, and after a reset old frames do not count', () => {
    const watch = createFrameWatch();
    expect(feed(watch, 1000 / 15, ENOUGH)).toBe(true);
    // The window was emptied: it takes a whole new warm-up and window to report again.
    expect(feed(watch, 1000 / 15, ENOUGH - 1)).toBe(false);
    watch.reset();
    expect(feed(watch, 1000 / 15, ENOUGH - 1)).toBe(false);
    expect(watch.add(1000 / 15)).toBe(true);
  });
});
