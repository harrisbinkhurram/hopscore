import { describe, expect, it } from 'vitest';
import { fitPoints, focusOn, project, FOCUS_DISTANCE, type Vec3 } from './camera';
import { buildTrack } from './track';

const PORTRAIT = { fov: 40, aspect: 390 / 844 };

function trackPoints(len: number): Vec3[] {
  return buildTrack(len).stones.map((s) => ({ x: s.x, y: 0, z: s.z }));
}

describe('fitPoints', () => {
  it.each([10, 30, 60])('shows the whole track of %i on a portrait phone', (len) => {
    const points = trackPoints(len);
    const pose = fitPoints(points, PORTRAIT, 0.08);
    for (const p of points) {
      const s = project(p, pose, PORTRAIT);
      expect(s.depth).toBeGreaterThan(0);
      expect(Math.abs(s.x)).toBeLessThanOrEqual(0.92 + 1e-6);
      expect(Math.abs(s.y)).toBeLessThanOrEqual(0.92 + 1e-3);
    }
  });

  it('does not waste the screen: the track fills most of the height', () => {
    const points = trackPoints(30);
    const pose = fitPoints(points, PORTRAIT, 0.08);
    const ys = points.map((p) => project(p, pose, PORTRAIT).y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(1.6);
  });

  it('keeps extra room at the top when asked', () => {
    const points = trackPoints(30);
    const pose = fitPoints(points, PORTRAIT, 0.05, 0.2);
    const ys = points.map((p) => project(p, pose, PORTRAIT).y);
    expect(Math.max(...ys)).toBeLessThanOrEqual(0.8 + 1e-3);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(-0.95 - 1e-3);
  });

  it('also fits a landscape screen', () => {
    const lens = { fov: 40, aspect: 16 / 9 };
    const points = trackPoints(30);
    const pose = fitPoints(points, lens);
    for (const p of points) {
      const s = project(p, pose, lens);
      expect(Math.abs(s.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(s.y)).toBeLessThanOrEqual(1);
    }
  });

  it('looks down at the board from above and in front', () => {
    const pose = fitPoints(trackPoints(30), PORTRAIT);
    expect(pose.position.y).toBeGreaterThan(pose.target.y);
    expect(pose.position.z).toBeGreaterThan(pose.target.z);
  });
});

describe('focusOn', () => {
  it('centres the point on screen at the focus distance', () => {
    const point = { x: 2, y: 0.4, z: -5 };
    const pose = focusOn(point);
    const s = project(point, pose, PORTRAIT);
    expect(s.x).toBeCloseTo(0);
    expect(s.y).toBeCloseTo(0);
    expect(s.depth).toBeCloseTo(FOCUS_DISTANCE);
  });
});
