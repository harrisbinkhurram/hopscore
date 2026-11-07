/**
 * Camera framing as plain maths, so it can be tested without WebGL.
 *
 * The camera always looks at the board from the same angle: from the front
 * (positive z), tilted down. Only its target and distance change.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface CameraPose {
  position: Vec3;
  target: Vec3;
}

export interface Lens {
  /** Vertical field of view, degrees. */
  fov: number;
  /** Width divided by height. Below 1 is portrait. */
  aspect: number;
}

/** How far the view is tilted down from horizontal, degrees. */
export const CAMERA_TILT = 58;

/** Distance used when the camera focuses on one bunny. */
export const FOCUS_DISTANCE = 6.5;

/** Unit vector from the target towards the camera. */
function backDirection(): Vec3 {
  const t = (CAMERA_TILT * Math.PI) / 180;
  return { x: 0, y: Math.sin(t), z: Math.cos(t) };
}

export function poseAt(target: Vec3, distance: number): CameraPose {
  const b = backDirection();
  return {
    target: { ...target },
    position: { x: target.x + b.x * distance, y: target.y + b.y * distance, z: target.z + b.z * distance },
  };
}

/**
 * Projects a point for a camera in `pose`, returning normalised screen coordinates
 * (-1..1 on both axes when on screen) and the depth in front of the camera.
 */
/** Camera basis: forward towards the target, right is +x (the camera never turns sideways). */
function basis(pose: CameraPose) {
  const fx = pose.target.x - pose.position.x;
  const fy = pose.target.y - pose.position.y;
  const fz = pose.target.z - pose.position.z;
  const fl = Math.hypot(fx, fy, fz) || 1;
  const f = { x: fx / fl, y: fy / fl, z: fz / fl };
  const r = { x: 1, y: 0, z: 0 };
  // up = right x forward
  const u = { x: r.y * f.z - r.z * f.y, y: r.z * f.x - r.x * f.z, z: r.x * f.y - r.y * f.x };
  return { f, r, u };
}

export function project(point: Vec3, pose: CameraPose, lens: Lens): { x: number; y: number; depth: number } {
  const { f, r, u } = basis(pose);

  const dx = point.x - pose.position.x;
  const dy = point.y - pose.position.y;
  const dz = point.z - pose.position.z;
  const depth = dx * f.x + dy * f.y + dz * f.z;
  const sx = dx * r.x + dy * r.y + dz * r.z;
  const sy = dx * u.x + dy * u.y + dz * u.z;

  const halfH = Math.tan((lens.fov * Math.PI) / 360);
  const halfW = halfH * lens.aspect;
  return { x: sx / (depth * halfW), y: sy / (depth * halfH), depth };
}

/**
 * The pose that shows every point, with `margin` of the screen kept free around the
 * edges and `topMargin` along the top (both as a share of half the screen, 0..1).
 */
export function fitPoints(points: readonly Vec3[], lens: Lens, margin = 0.08, topMargin = margin): CameraPose {
  if (points.length === 0) return poseAt({ x: 0, y: 0, z: 0 }, FOCUS_DISTANCE);

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }
  const target = { x: (minX + maxX) / 2, y: (minY + maxY) / 2, z: (minZ + maxZ) / 2 };
  const limit = 1 - margin;
  const limitTop = 1 - topMargin;
  // Vertical room on screen, and the centre the points should sit around.
  const room = limit + limitTop;
  const middle = (limitTop - limit) / 2;

  const fits = (distance: number) => {
    const pose = poseAt(target, distance);
    let top = -Infinity;
    let bottom = Infinity;
    for (const p of points) {
      const s = project(p, pose, lens);
      if (s.depth <= 0.1 || Math.abs(s.x) > limit) return { ok: false, top, bottom };
      top = Math.max(top, s.y);
      bottom = Math.min(bottom, s.y);
    }
    // The tilt makes the far end look smaller, so re-centre vertically before judging the fit.
    return { ok: top - bottom <= room, top, bottom };
  };

  let lo = 0.5;
  let hi = 1;
  while (!fits(hi).ok && hi < 1e4) hi *= 2;
  for (let i = 0; i < 40; i += 1) {
    const mid = (lo + hi) / 2;
    if (fits(mid).ok) hi = mid;
    else lo = mid;
  }

  // Slide the target along the screen's up direction so the points sit in the middle.
  let pose = poseAt(target, hi);
  for (let i = 0; i < 4; i += 1) {
    const { top, bottom } = fits(hi);
    const shift = (top + bottom) / 2 - middle;
    if (Math.abs(shift) < 1e-4) break;
    const halfH = Math.tan((lens.fov * Math.PI) / 360);
    const depth = Math.hypot(
      pose.position.x - target.x,
      pose.position.y - target.y,
      pose.position.z - target.z,
    );
    // Moving the target along the ground's -z moves it up the screen.
    const t = (CAMERA_TILT * Math.PI) / 180;
    target.z -= (shift * halfH * depth) / Math.sin(t);
    pose = poseAt(target, hi);
    // Re-fit the distance for the moved target.
    lo = 0.5;
    let h = hi * 2;
    for (let j = 0; j < 40; j += 1) {
      const mid = (lo + h) / 2;
      if (fits(mid).ok) h = mid;
      else lo = mid;
    }
    hi = h;
    pose = poseAt(target, hi);
  }
  return pose;
}

/** The pose that focuses on one point (a bunny). */
export function focusOn(point: Vec3): CameraPose {
  return poseAt(point, FOCUS_DISTANCE);
}

/** How far the camera is from what it looks at. */
export function distanceOf(pose: CameraPose): number {
  return Math.hypot(
    pose.position.x - pose.target.x,
    pose.position.y - pose.target.y,
    pose.position.z - pose.target.z,
  );
}

/**
 * The point on the ground (y = 0) under a spot on screen, given in normalised
 * coordinates (-1..1). Null when that spot looks at the sky.
 */
export function groundPointAt(sx: number, sy: number, pose: CameraPose, lens: Lens): Vec3 | null {
  const { f, r, u } = basis(pose);
  const halfH = Math.tan((lens.fov * Math.PI) / 360);
  const halfW = halfH * lens.aspect;
  const d = {
    x: f.x + r.x * sx * halfW + u.x * sy * halfH,
    y: f.y + r.y * sx * halfW + u.y * sy * halfH,
    z: f.z + r.z * sx * halfW + u.z * sy * halfH,
  };
  if (d.y >= -1e-6) return null;
  const t = -pose.position.y / d.y;
  return { x: pose.position.x + d.x * t, y: 0, z: pose.position.z + d.z * t };
}

/**
 * Zooms by `factor` (below 1 moves in) while keeping `anchor` at the same spot on
 * screen. The view angle never changes, so this is a plain scale about the anchor.
 */
export function zoomAbout(pose: CameraPose, factor: number, anchor: Vec3): CameraPose {
  const scale = (p: Vec3) => ({
    x: anchor.x + (p.x - anchor.x) * factor,
    y: anchor.y + (p.y - anchor.y) * factor,
    z: anchor.z + (p.z - anchor.z) * factor,
  });
  return { position: scale(pose.position), target: scale(pose.target) };
}

/** Moves the camera along the ground by (dx, dz) without turning it. */
export function panBy(pose: CameraPose, dx: number, dz: number): CameraPose {
  return {
    position: { ...pose.position, x: pose.position.x + dx, z: pose.position.z + dz },
    target: { ...pose.target, x: pose.target.x + dx, z: pose.target.z + dz },
  };
}

export interface Limits {
  minDistance: number;
  maxDistance: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** Keeps the camera inside the garden and between the nearest and farthest zoom. */
export function clampPose(pose: CameraPose, limits: Limits): CameraPose {
  const d = distanceOf(pose);
  const distance = Math.min(limits.maxDistance, Math.max(limits.minDistance, d));
  const target = {
    x: Math.min(limits.maxX, Math.max(limits.minX, pose.target.x)),
    y: pose.target.y,
    z: Math.min(limits.maxZ, Math.max(limits.minZ, pose.target.z)),
  };
  return poseAt(target, distance);
}
