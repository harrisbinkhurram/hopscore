import { describe, expect, it } from 'vitest';
import {
  clampPose,
  distanceOf,
  fitPoints,
  focusOn,
  groundPointAt,
  panBy,
  poseAt,
  project,
  zoomAbout,
  FOCUS_DISTANCE,
  type Vec3,
} from './camera';
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

describe('gestures', () => {
  const pose = poseAt({ x: 1, y: 0, z: -4 }, 20);

  it('finds the ground point under a spot on screen', () => {
    for (const [sx, sy] of [[0, 0], [0.5, -0.4], [-0.8, 0.7]]) {
      const g = groundPointAt(sx, sy, pose, PORTRAIT)!;
      expect(g.y).toBe(0);
      const back = project(g, pose, PORTRAIT);
      expect(back.x).toBeCloseTo(sx, 6);
      expect(back.y).toBeCloseTo(sy, 6);
    }
  });

  it('finds the target under the middle of the screen', () => {
    const g = groundPointAt(0, 0, pose, PORTRAIT)!;
    expect(g.x).toBeCloseTo(1);
    expect(g.z).toBeCloseTo(-4);
  });

  it('zooms in towards the pinch point and keeps it under the fingers', () => {
    const anchor = groundPointAt(0.4, -0.3, pose, PORTRAIT)!;
    const zoomed = zoomAbout(pose, 0.5, anchor);
    expect(distanceOf(zoomed)).toBeCloseTo(10);
    const s = project(anchor, zoomed, PORTRAIT);
    expect(s.x).toBeCloseTo(0.4, 6);
    expect(s.y).toBeCloseTo(-0.3, 6);
  });

  it('pans along the ground without changing the zoom', () => {
    const moved = panBy(pose, 2, -3);
    expect(moved.target).toEqual({ x: 3, y: 0, z: -7 });
    expect(distanceOf(moved)).toBeCloseTo(20);
  });

  it('keeps the camera inside the limits', () => {
    const limits = { minDistance: 3, maxDistance: 30, minX: -5, maxX: 5, minZ: -20, maxZ: 10 };
    const far = clampPose(poseAt({ x: 50, y: 0, z: -90 }, 500), limits);
    expect(far.target.x).toBe(5);
    expect(far.target.z).toBe(-20);
    expect(distanceOf(far)).toBeCloseTo(30);
    expect(distanceOf(clampPose(poseAt({ x: 0, y: 0, z: 0 }, 1), limits))).toBeCloseTo(3);
  });
});
